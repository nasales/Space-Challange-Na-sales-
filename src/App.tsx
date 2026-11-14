// App shell: first the main menu, then (after Play) the 3D game with the interface drawn on top.
// src/game and src/ui never import each other; they only talk through src/shared.
// The menu's animated character comes from src/game and is passed into the menu as a slot here.
import { useState } from 'react'
import GameView from './game/GameView'
import DetectiveShowcase from './game/detective/DetectiveShowcase'
import Hud from './ui/hud/Hud'
import MainMenu from './ui/menu/MainMenu'
import VariablePicker from './ui/magnifier/VariablePicker'
import type { GameStatus, HudState, LensFocusState } from './shared/events'

type Screen = 'menu' | 'game'

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [status, setStatus] = useState<GameStatus>('loading')
  const [hud, setHud] = useState<HudState | null>(null)
  // The picker asks the game to fly the camera into the hand lens (the game ignores the keyboard
  // meanwhile); the game reports when the flight has arrived (in) or is back (out)
  const [focusLens, setFocusLens] = useState(false)
  const [lensState, setLensState] = useState<LensFocusState>('out')

  if (screen === 'menu') {
    return (
      <main className="app">
        <MainMenu onPlay={() => setScreen('game')} character={<DetectiveShowcase />} />
      </main>
    )
  }

  return (
    <main className="app">
      <GameView onStatus={setStatus} onHud={setHud} focusLens={focusLens} onLensFocus={setLensState} />
      <Hud status={status} hud={hud} />
      <VariablePicker canOpen={status === 'ready' && !!hud?.stopped} lensState={lensState} onOpenChange={setFocusLens} />
    </main>
  )
}
