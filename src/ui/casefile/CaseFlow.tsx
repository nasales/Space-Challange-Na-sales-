// Full flow of a featured case, opened with Space in a case zone:
//   scene (witness dialogue, if the script has one) -> tutorial (case file + notebook)
//   -> final test (the case's level from src/levels, rendered by the app shell)
//   -> case closed (stamp, verdict on the witness's claim, statistics) -> back to the map.
// A case without a tutorial script goes straight to its level, as before.
// Escape: scene = skip the scene; case file = its own "close?" question; final test = "leave?";
// case closed = back to the map. One handler per phase, so the keys never reach the game.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_OUTFIT, type Outfit } from '../../shared/outfit'
import { getWitness } from '../../shared/witness'
import type { AnchorStore } from './anchors'
import CaseClosed, { type LevelResult } from './CaseClosed'
import CaseFile from './CaseFile'
import { hasTutorial, loadTutorial, type LoadedTutorial } from './loader'
import type { NotebookClue } from './Notebook'
import WitnessScene, { type Speaker } from './WitnessScene'
import './CaseFlow.css'

/** Same shape as CaseLevelProps (src/levels/types.ts); the app shell renders the level */
export interface LevelSlotProps {
  caseId: string
  onExit: () => void
  onResult: (r: { caseId: string; correct: boolean; score?: number }) => void
}

export interface DialogueState {
  /** true while the witness scene plays (the game frames detective + witness) */
  active: boolean
  speaking: Speaker | null
}

interface Props {
  caseId: string
  renderLevel: (p: LevelSlotProps) => ReactNode
  /** Back to the map */
  onClose: () => void
  /** The final test was passed (Ivan's rule: only then the marker turns green) */
  onSolved?: (caseId: string) => void
  onDialogue?: (d: DialogueState) => void
  /** Head positions from the game; leave out when no game is behind (the preview draws stand-ins) */
  anchors?: AnchorStore
  outfit?: Outfit
}

type Phase = 'loading' | 'scene' | 'tutorial' | 'level' | 'closed'

export default function CaseFlow({ caseId, renderLevel, onClose, onSolved, onDialogue, anchors, outfit = DEFAULT_OUTFIT }: Props) {
  const [phase, setPhase] = useState<Phase>(hasTutorial(caseId) ? 'loading' : 'level')
  const [tutorial, setTutorial] = useState<LoadedTutorial | null>(null)
  const [conclusion, setConclusion] = useState('')
  const [clues, setClues] = useState<NotebookClue[]>([])
  const [result, setResult] = useState<LevelResult | null>(null)
  const [leaving, setLeaving] = useState(false)
  const witness = getWitness(caseId)

  useEffect(() => {
    if (phase !== 'loading') return
    let alive = true
    loadTutorial(caseId)
      .then((t) => {
        if (!alive) return
        setTutorial(t)
        setPhase(t.script.scene && (t.script.scene.lines.length > 0 || t.script.scene.claim) ? 'scene' : 'tutorial')
      })
      // no case file after all: the level alone, as before
      .catch(() => alive && setPhase('level'))
    return () => {
      alive = false
    }
  }, [caseId, phase])

  // Tell the app shell when the game must frame the dialogue
  const dialogue = useRef(onDialogue)
  useEffect(() => {
    dialogue.current = onDialogue
  })
  const [speaking, setSpeaking] = useState<Speaker | null>(null)
  const sceneOn = phase === 'scene'
  useEffect(() => {
    dialogue.current?.({ active: sceneOn, speaking: sceneOn ? speaking : null })
  }, [sceneOn, speaking])
  useEffect(() => () => dialogue.current?.({ active: false, speaking: null }), [])

  // Escape during the final test asks first (Ivan's levels have no exit button before the end)
  const leavingRef = useRef(leaving)
  useEffect(() => {
    leavingRef.current = leaving
  })
  useEffect(() => {
    if (phase !== 'level') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      setLeaving(!leavingRef.current)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [phase])

  // Case closed: Escape = back to the map; other keys stay away from the game
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    if (phase !== 'closed') return
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        close.current()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [phase])

  const sceneDone = useCallback(() => setPhase('tutorial'), [])

  // The level's own exit: after the case file, always the case-closed screen
  const levelExit = () => (tutorial ? setPhase('closed') : onClose())
  const levelResult = (r: { caseId: string; correct: boolean; score?: number }) => {
    setResult({ correct: r.correct, score: r.score })
    if (r.correct) onSolved?.(r.caseId)
  }

  if (phase === 'loading') return null

  if (phase === 'scene' && tutorial?.script.scene) {
    return (
      <WitnessScene
        scene={tutorial.script.scene}
        witness={witness}
        outfit={outfit}
        anchors={anchors}
        onSpeaking={setSpeaking}
        onDone={sceneDone}
      />
    )
  }

  if ((phase === 'tutorial' || phase === 'scene') && tutorial) {
    return (
      <CaseFile
        caseId={caseId}
        tutorial={tutorial}
        onClose={onClose}
        flow={{
          claim: tutorial.script.scene?.claim,
          witnessName: witness?.name,
          brief: !!tutorial.script.scene,
          onConcluded: (text, noted) => {
            setConclusion(text)
            setClues(noted)
            setPhase('level')
          },
        }}
      />
    )
  }

  if (phase === 'closed' && tutorial) {
    return (
      <CaseClosed
        tutorial={tutorial}
        witness={witness}
        conclusion={conclusion}
        clues={clues}
        result={result}
        onClose={onClose}
      />
    )
  }

  return (
    <div className="caseflow-level" role="region" aria-label="Final test">
      <div className="caseflow-level__bar">
        <p className="caseflow-level__tag">{tutorial ? 'Final test' : 'Case'}</p>
        <button type="button" className="caseflow-level__leave" onClick={() => setLeaving(true)}>
          Leave case <kbd>Esc</kbd>
        </button>
      </div>
      <div className="caseflow-level__body">
        {renderLevel({ caseId, onExit: levelExit, onResult: levelResult })}
      </div>
      {leaving && (
        <div className="caseflow-level__confirm" role="alertdialog" aria-labelledby="caseflow-leave-text">
          <p id="caseflow-leave-text">Leave this case? Your answers in this case will be lost.</p>
          <div className="caseflow-level__actions">
            <button type="button" className="caseflow-level__btn" onClick={() => setLeaving(false)} autoFocus>
              Keep investigating
            </button>
            <button type="button" className="caseflow-level__btn caseflow-level__btn--danger" onClick={onClose}>
              Back to the map
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
