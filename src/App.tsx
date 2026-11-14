// App shell: first the main menu, then (after Play) the 3D game with the interface drawn on top.
// src/game and src/ui never import each other; they only talk through src/shared.
// The menu's animated character comes from src/game and is passed into the menu as a slot here.
import { useState } from 'react'
import GameView from './game/GameView'
import DetectiveShowcase from './game/detective/DetectiveShowcase'
import Hud from './ui/hud/Hud'
import MainMenu from './ui/menu/MainMenu'
import VariablePicker from './ui/magnifier/VariablePicker'
import type { GameStatus, HudState } from './shared/events'

type Screen = 'menu' | 'game'

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [status, setStatus] = useState<GameStatus>('loading')
  const [hud, setHud] = useState<HudState | null>(null)
  // The magnifier variable picker is open: the game ignores the keyboard meanwhile
  const [pickerOpen, setPickerOpen] = useState(false)

  if (screen === 'menu') {
    return (
      <main className="app">
        <MainMenu onPlay={() => setScreen('game')} character={<DetectiveShowcase />} />
      </main>
    )
  }

  return (
    <main className="app">
      <GameView onStatus={setStatus} onHud={setHud} paused={pickerOpen} />
      <Hud status={status} hud={hud} />
      <VariablePicker canOpen={status === 'ready' && !!hud?.stopped} onOpenChange={setPickerOpen} />
    </main>
  )
}
