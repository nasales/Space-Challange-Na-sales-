// App shell: first the main menu, then (after Play) the 3D game with the interface drawn on top.
// src/game and src/ui never import each other; they only talk through src/shared.
// The menu's animated character comes from src/game and is passed into the menu as a slot here.
import { useState } from 'react'
import GameView from './game/GameView'
import DetectiveShowcase from './game/detective/DetectiveShowcase'
import Hud from './ui/hud/Hud'
import MainMenu from './ui/menu/MainMenu'
import VariablePicker from './ui/magnifier/VariablePicker'
import Wardrobe from './ui/wardrobe/Wardrobe'
import DbTest from './ui/dbtest/DbTest'
import DbStatus from './ui/status/DbStatus'
import type { GameStatus, HudState, LensFocusState } from './shared/events'
import { loadOutfit, type Outfit } from './shared/outfit'

type Screen = 'menu' | 'wardrobe' | 'game'

// Temporary team page: open the site with ?dbtest to test the database connection.
const DB_TEST = new URLSearchParams(window.location.search).has('dbtest')

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
  const [outfit, setOutfit] = useState<Outfit>(loadOutfit)
  // The picker asks the game to fly the camera into the hand lens (the game ignores the keyboard
  // meanwhile); the game reports when the flight has arrived (in) or is back (out)
  const [focusLens, setFocusLens] = useState(false)
  const [lensState, setLensState] = useState<LensFocusState>('out')

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
      <GameView onStatus={setStatus} onHud={setHud} focusLens={focusLens} onLensFocus={setLensState} outfit={outfit} />
      <Hud status={status} hud={hud} />
      <VariablePicker canOpen={status === 'ready' && !!hud?.stopped} lensState={lensState} onOpenChange={setFocusLens} />
    </main>
  )
}
