// App shell: first the main menu, then (after Play) the 3D game with the interface drawn on top.
// src/game and src/ui never import each other; they only talk through src/shared.
// The menu's animated character comes from src/game and is passed into the menu as a slot here.
import { useState } from 'react'
import GameView from './game/GameView'
import DetectiveShowcase from './game/detective/DetectiveShowcase'
import Hud from './ui/hud/Hud'
import MainMenu from './ui/menu/MainMenu'
import DbTest from './ui/dbtest/DbTest'
import type { GameStatus, HudState } from './shared/events'

type Screen = 'menu' | 'game'

// Temporary team page: open the site with ?dbtest to test the database connection.
const DB_TEST = new URLSearchParams(window.location.search).has('dbtest')

export default function App() {
  if (DB_TEST) {
    return (
      <main className="app">
        <DbTest />
      </main>
    )
  }
  return <Game />
}

function Game() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [status, setStatus] = useState<GameStatus>('loading')
  const [hud, setHud] = useState<HudState | null>(null)

  if (screen === 'menu') {
    return (
      <main className="app">
        <MainMenu onPlay={() => setScreen('game')} character={<DetectiveShowcase />} />
      </main>
    )
  }

  return (
    <main className="app">
      <GameView onStatus={setStatus} onHud={setHud} />
      <Hud status={status} hud={hud} />
    </main>
  )
}
