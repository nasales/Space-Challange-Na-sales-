// App shell: first the main menu, then (after Play) the 3D game with the interface drawn on top.
// src/game and src/ui never import each other; they only talk through src/shared.
// The menu's animated character comes from src/game and is passed into the menu as a slot here.
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import GameView from './game/GameView'
import DetectiveShowcase from './game/detective/DetectiveShowcase'
import Hud from './ui/hud/Hud'
import MapLoader from './ui/loading/MapLoader'
import MainMenu from './ui/menu/MainMenu'
import VariablePicker from './ui/magnifier/VariablePicker'
import PauseMenu from './ui/pause/PauseMenu'
import Wardrobe from './ui/wardrobe/Wardrobe'
import DbTest from './ui/dbtest/DbTest'
import DbStatus from './ui/status/DbStatus'
import type { GameStatus, HudState, LensFocusState } from './shared/events'
import { loadOutfit, type Outfit } from './shared/outfit'
import { loadCompleted, markCompleted } from './shared/progress'
import { startBackgroundMusic } from './shared/music'
import CaseLevel from './levels/CaseLevel'
import { getLevel } from './levels/registry'
import { getCaseEntry } from './levels/data'

type Screen = 'menu' | 'wardrobe' | 'game'

// Temporary team page: open the site with ?dbtest to test the database connection.
const DB_TEST = new URLSearchParams(window.location.search).has('dbtest')

/** Featured case level drawn over the paused game. */
const OVERLAY_STYLE: CSSProperties = { position: 'fixed', inset: 0, zIndex: 50, overflow: 'auto' }
/** Small hint while the detective stands in a case zone (prototype look; Interface can restyle it). */
const HINT_STYLE: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: '96px',
  transform: 'translateX(-50%)',
  zIndex: 20,
  padding: '8px 16px',
  borderRadius: '12px',
  border: '2px solid #1a1423',
  background: '#ffc21a',
  color: '#1a1423',
  font: '600 15px/1.3 system-ui, sans-serif',
  pointerEvents: 'none',
  maxWidth: 'calc(100vw - 32px)',
  textAlign: 'center',
}

export default function App() {
  return (
    <>
      {DB_TEST ? (
        <main className="app">
          <DbTest />
        </main>
      ) : (
        <Game />
      )}
      {/* Database badge + build version, on every screen */}
      <DbStatus />
    </>
  )
}

function Game() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [status, setStatus] = useState<GameStatus>('loading')
  const [hud, setHud] = useState<HudState | null>(null)
  const [loadProgress, setLoadProgress] = useState(0)
  const [outfit, setOutfit] = useState<Outfit>(loadOutfit)
  // The picker asks the game to fly the camera into the hand lens (the game ignores the keyboard
  // meanwhile); the game reports when the flight has arrived (in) or is back (out)
  const [focusLens, setFocusLens] = useState(false)
  const [lensState, setLensState] = useState<LensFocusState>('out')
  // Esc pause panel on the map (the game ignores driving input while it is open)
  const [paused, setPaused] = useState(false)
  // Featured cases: Space inside a case zone (detective stopped) opens that case's level
  const [openCase, setOpenCase] = useState<string | null>(null)
  const [completed, setCompleted] = useState<Set<string>>(loadCompleted)
  const completedList = useMemo(() => [...completed], [completed])
  // Background music from the menu on (it starts on the first click or key press)
  useEffect(startBackgroundMusic, [])
  const zoneCase = hud?.caseZone && getLevel(hud.caseZone) ? hud.caseZone : null
  const canOpenCase = screen === 'game' && status === 'ready' && !!hud?.stopped && !!zoneCase && !openCase && !paused
  const exitToMenu = () => {
    // GameView unmounts and disposes its scene; reset the game state so Play starts fresh
    setPaused(false)
    setOpenCase(null)
    setFocusLens(false)
    setLensState('out')
    setHud(null)
    setStatus('loading')
    setLoadProgress(0)
    setScreen('menu')
  }
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
  // Esc leaves an open level (the levels only show their exit button on the last screen)
  useEffect(() => {
    if (!openCase) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') setOpenCase(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openCase])

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
        onProgress={setLoadProgress}
        outfit={outfit}
        paused={paused || !!openCase}
        completedCases={completedList}
      />
      <Hud status={status} hud={hud} />
      <MapLoader status={status} progress={loadProgress} outfit={outfit} />
      {/* Outside case zones Space opens the magnifier picker, as before */}
      <VariablePicker
        canOpen={status === 'ready' && !!hud?.stopped && !paused && !zoneCase && !openCase}
        lensState={lensState}
        onOpenChange={setFocusLens}
        location={hud?.location ?? null}
      />
      {/* After the picker, so the picker's Esc handler runs first and wins; a case level has its own Esc */}
      <PauseMenu
        open={paused}
        canOpen={status === 'ready' && !focusLens && lensState === 'out' && !openCase}
        onOpenChange={setPaused}
        onMainMenu={exitToMenu}
      />
      {zoneCase && !openCase && !paused && (
        <div className="case-zone-hint" style={HINT_STYLE}>
          {hud?.stopped ? 'Press Space' : 'Stop and press Space'} to investigate {getCaseEntry(zoneCase)?.title ?? zoneCase}
        </div>
      )}
      {openCase && (
        <div className="case-level-overlay" style={OVERLAY_STYLE}>
          <CaseLevel
            caseId={openCase}
            onExit={() => setOpenCase(null)}
            onResult={(r) => {
              // Green marker only for a correct answer (Ivan's rule)
              if (!r.correct) return
              markCompleted(r.caseId)
              setCompleted((prev) => new Set(prev).add(r.caseId))
            }}
          />
        </div>
      )}
    </main>
  )
}
