// App shell: the 3D game fills the screen and the interface is drawn on top.
// src/game and src/ui never import each other; they only talk through src/shared.
import { useState } from 'react'
import GameView from './game/GameView'
import Hud from './ui/hud/Hud'
import type { GameStatus, HudState } from './shared/events'

export default function App() {
  const [status, setStatus] = useState<GameStatus>('loading')
  const [hud, setHud] = useState<HudState | null>(null)

  return (
    <main className="app">
      <GameView onStatus={setStatus} onHud={setHud} />
      <Hud status={status} hud={hud} />
    </main>
  )
}
