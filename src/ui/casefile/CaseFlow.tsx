// Full flow of a featured case, opened with Space in a case zone:
//   scene (witness dialogue, if the script has one) -> tutorial (case file + notebook, or the
//   evidence board when the script has `board`, EvidenceBoard.tsx, or the courtroom trial when it
//   has `trial`, Trial.tsx)
//   -> case closed (stamp, verdict on the witness's claim, statistics) -> back to the map.
// Finishing the tutorial solves the case (its marker turns green).
// Escape: scene = skip the scene; case file / board = their own "close?" question;
// case closed = back to the map. One handler per phase, so the keys never reach the game.
import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_OUTFIT, type Outfit } from '../../shared/outfit'
import type { LineMood } from '../../shared/tutorial'
import { getWitness } from '../../shared/witness'
import type { AnchorStore } from './anchors'
import CaseClosed from './CaseClosed'
import CaseFile from './CaseFile'
import EvidenceBoard from './EvidenceBoard'
import { hasTutorial, loadTutorial, type LoadedTutorial } from './loader'
import type { NotebookClue } from './Notebook'
import Trial from './Trial'
import WitnessScene, { type Speaker } from './WitnessScene'

export interface DialogueState {
  /** true while the witness scene plays (the game frames detective + witness) */
  active: boolean
  speaking: Speaker | null
  /** Mood of the line being spoken (null when nobody speaks) */
  mood: LineMood | null
}

interface Props {
  caseId: string
  /** Back to the map */
  onClose: () => void
  /** The case was solved (tutorial finished): its marker turns green */
  onSolved?: (caseId: string) => void
  onDialogue?: (d: DialogueState) => void
  /** Head positions from the game; leave out when no game is behind (the preview draws stand-ins) */
  anchors?: AnchorStore
  outfit?: Outfit
}

type Phase = 'loading' | 'scene' | 'tutorial' | 'closed'

export default function CaseFlow({ caseId, onClose, onSolved, onDialogue, anchors, outfit = DEFAULT_OUTFIT }: Props) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [tutorial, setTutorial] = useState<LoadedTutorial | null>(null)
  const [clues, setClues] = useState<NotebookClue[]>([])
  const witness = getWitness(caseId)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (phase !== 'loading') return
    if (!hasTutorial(caseId)) {
      onCloseRef.current()
      return
    }
    let alive = true
    loadTutorial(caseId)
      .then((t) => {
        if (!alive) return
        setTutorial(t)
        setPhase(t.script.scene && (t.script.scene.lines.length > 0 || t.script.scene.claim) ? 'scene' : 'tutorial')
      })
      // no case file after all: nothing to show, back to the map
      .catch(() => alive && onCloseRef.current())
    return () => {
      alive = false
    }
  }, [caseId, phase])

  // Tell the app shell when the game must frame the dialogue
  const dialogue = useRef(onDialogue)
  useEffect(() => {
    dialogue.current = onDialogue
  })
  const [talk, setTalk] = useState<{ speaking: Speaker | null; mood: LineMood | null }>({ speaking: null, mood: null })
  const onSpeaking = useCallback((speaking: Speaker | null, mood: LineMood | null) => setTalk({ speaking, mood }), [])
  const sceneOn = phase === 'scene'
  const { speaking, mood } = talk
  useEffect(() => {
    dialogue.current?.({ active: sceneOn, speaking: sceneOn ? speaking : null, mood: sceneOn ? mood : null })
  }, [sceneOn, speaking, mood])
  useEffect(() => () => dialogue.current?.({ active: false, speaking: null, mood: null }), [])

  // Case closed: Escape = back to the map; other keys stay away from the game
  useEffect(() => {
    if (phase !== 'closed') return
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [phase])

  const sceneDone = useCallback(() => setPhase('tutorial'), [])

  if (phase === 'loading') return null

  if (phase === 'scene' && tutorial?.script.scene) {
    return (
      <WitnessScene
        scene={tutorial.script.scene}
        witness={witness}
        outfit={outfit}
        anchors={anchors}
        onSpeaking={onSpeaking}
        onDone={sceneDone}
      />
    )
  }

  const finished = (noted: NotebookClue[]) => {
    setClues(noted)
    onSolved?.(caseId)
    setPhase('closed')
  }

  // Cases with a courtroom trial (Trial.tsx) play it instead of the case-file steps
  if ((phase === 'tutorial' || phase === 'scene') && tutorial?.script.trial) {
    return <Trial tutorial={tutorial} witness={witness} onClose={onClose} onFinished={finished} />
  }

  // Cases with an evidence board play it instead of the case-file steps
  if ((phase === 'tutorial' || phase === 'scene') && tutorial?.script.board) {
    return <EvidenceBoard tutorial={tutorial} witness={witness} onClose={onClose} onFinished={finished} />
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
          onFinished: finished,
        }}
      />
    )
  }

  if (phase === 'closed' && tutorial) {
    return (
      <CaseClosed
        tutorial={tutorial}
        witness={witness}
        clues={clues}
        onClose={onClose}
      />
    )
  }

  return null
}
