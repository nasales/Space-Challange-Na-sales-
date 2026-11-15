// App shell: first the main menu, then (after Play) the 3D game with the interface drawn on top.
// src/game and src/ui never import each other; they only talk through src/shared.
// The menu's animated character comes from src/game and is passed into the menu as a slot here.
import { useCallback, useEffect, useMemo, useState } from 'react'
import GameView from './game/GameView'
import DetectiveShowcase from './game/detective/DetectiveShowcase'
import Hud from './ui/hud/Hud'
import MainMenu from './ui/menu/MainMenu'
import VariablePicker from './ui/magnifier/VariablePicker'
import Wardrobe from './ui/wardrobe/Wardrobe'
import DbTest from './ui/dbtest/DbTest'
import DbStatus from './ui/status/DbStatus'
import CaseFilePreview from './ui/casefile/CaseFilePreview'
import CaseFlow, { type DialogueState, type LevelSlotProps } from './ui/casefile/CaseFlow'
import CaseHint from './ui/casefile/CaseHint'
import { createAnchorStore } from './ui/casefile/anchors'
import type { GameStatus, HudState, LensFocusState } from './shared/events'
import { loadOutfit, type Outfit } from './shared/outfit'
import { loadCompleted, markCompleted } from './shared/progress'
import CaseLevel from './levels/CaseLevel'
import { getLevel } from './levels/registry'

type Screen = 'menu' | 'wardrobe' | 'game'

// Temporary team page: open the site with ?dbtest to test the database connection.
const DB_TEST = new URLSearchParams(window.location.search).has('dbtest')
// Temporary preview of a featured-case tutorial: ?casefile=dana_valencia
const CASE_PREVIEW = new URLSearchParams(window.location.search).has('casefile')

/** Final test of a featured case (Ivan's level), drawn by the case flow over the paused game */
const renderLevel = (p: LevelSlotProps) => <CaseLevel {...p} />

const NO_DIALOGUE: DialogueState = { active: false, speaking: null, mood: null }

export default function App() {
  // true while a featured case is open: the HUD and the database badge fade out (dialogue focus)
  const [caseFocus, setCaseFocus] = useState(false)
  return (
    <>
      {CASE_PREVIEW ? (
        <main className="app">
          <CaseFilePreview renderLevel={renderLevel} />
        </main>
      ) : DB_TEST ? (
        <main className="app">
          <DbTest />
        </main>
      ) : (
        <Game onCaseFocus={setCaseFocus} />
      )}
      {/* Database badge + build version, on every screen (hidden while a case is open) */}
      <DbStatus hidden={caseFocus} />
    </>
  )
}

function Game({ onCaseFocus }: { onCaseFocus: (on: boolean) => void }) {
  const [screen, setScreen] = useState<Screen>('menu')
  const [status, setStatus] = useState<GameStatus>('loading')
  const [hud, setHud] = useState<HudState | null>(null)
  const [outfit, setOutfit] = useState<Outfit>(loadOutfit)
  // The picker asks the game to fly the camera into the hand lens (the game ignores the keyboard
  // meanwhile); the game reports when the flight has arrived (in) or is back (out)
  const [focusLens, setFocusLens] = useState(false)
  const [lensState, setLensState] = useState<LensFocusState>('out')
  // Featured cases: Space inside a case zone (detective stopped) opens the case flow
  // (witness scene -> case file -> final test -> case closed, src/ui/casefile/CaseFlow.tsx).
  // Escape inside the flow is handled there, one phase at a time.
  const [openCase, setOpenCase] = useState<string | null>(null)
  const [dialogue, setDialogue] = useState<DialogueState>(NO_DIALOGUE)
  const [anchors] = useState(createAnchorStore)
  const [completed, setCompleted] = useState<Set<string>>(loadCompleted)
  const completedList = useMemo(() => [...completed], [completed])
  const zoneCase = hud?.caseZone && getLevel(hud.caseZone) ? hud.caseZone : null
  // only with the camera out of the hand lens (the picker cannot reset it once a case is open)
  const canOpenCase =
    screen === 'game' && status === 'ready' && !!hud?.stopped && !!zoneCase && !openCase && !focusLens && lensState === 'out'
  useEffect(() => {
    if (!canOpenCase) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      if (!e.repeat) setOpenCase(zoneCase)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canOpenCase, zoneCase])
  useEffect(() => {
    onCaseFocus(!!openCase)
  }, [openCase, onCaseFocus])
  const closeCase = useCallback(() => {
    setOpenCase(null)
    setDialogue(NO_DIALOGUE)
  }, [])
  const solveCase = useCallback((caseId: string) => {
    // Green marker only for a correct answer in the final test (Ivan's rule)
    markCompleted(caseId)
    setCompleted((prev) => new Set(prev).add(caseId))
  }, [])

  if (screen === 'menu') {
    return (
      <main className="app">
        <MainMenu
          onPlay={() => setScreen('game')}
          onWardrobe={() => setScreen('wardrobe')}
          character={<DetectiveShowcase outfit={outfit} />}
        />
      </main>
    )
  }

  if (screen === 'wardrobe') {
    return (
      <main className="app">
        <Wardrobe
          outfit={outfit}
          onChange={setOutfit}
          onBack={() => setScreen('menu')}
          preview={<DetectiveShowcase outfit={outfit} mode="turntable" />}
        />
      </main>
    )
  }

  return (
    <main className="app">
      <GameView
        onStatus={setStatus}
        onHud={setHud}
        focusLens={focusLens}
        onLensFocus={setLensState}
        paused={!!openCase}
        completedCases={completedList}
        dialogueCase={openCase && dialogue.active ? openCase : null}
        speaking={dialogue.speaking}
        speakingMood={dialogue.mood}
        onDialogueAnchors={anchors.set}
      />
      {/* Dialogue focus: the whole HUD fades out while a case is open */}
      <Hud status={status} hud={hud} hidden={!!openCase} />
      {/* Outside case zones Space opens the magnifier picker, as before */}
      <VariablePicker
        canOpen={status === 'ready' && !!hud?.stopped && !zoneCase && !openCase}
        lensState={lensState}
        onOpenChange={setFocusLens}
        location={hud?.location ?? null}
      />
      {zoneCase && <CaseHint caseId={zoneCase} stopped={!!hud?.stopped} hidden={!!openCase} />}
      {openCase && (
        <CaseFlow
          key={openCase}
          caseId={openCase}
          renderLevel={renderLevel}
          onClose={closeCase}
          onSolved={solveCase}
          onDialogue={setDialogue}
          anchors={anchors}
          outfit={outfit}
        />
      )}
    </main>
  )
}
