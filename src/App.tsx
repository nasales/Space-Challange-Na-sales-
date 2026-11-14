// App shell: first the main menu, then (after Play) the 3D game with the interface drawn on top.
// src/game and src/ui never import each other; they only talk through src/shared.
// The menu's animated character comes from src/game and is passed into the menu as a slot here.
import { useState } from 'react'
import GameView from './game/GameView'
import DetectiveShowcase from './game/detective/DetectiveShowcase'
import Hud from './ui/hud/Hud'
import MainMenu from './ui/menu/MainMenu'
import DbTest from './ui/dbtest/DbTest'
import DbStatus from './ui/status/DbStatus'
import PointProbe from './ui/probe/PointProbe'
import CaseFile from './ui/casefile/CaseFile'
import CaseHint from './ui/casefile/CaseHint'
import CaseFilePreview from './ui/casefile/CaseFilePreview'
import type { GameStatus, HudState } from './shared/events'

type Screen = 'menu' | 'game'

// Temporary team page: open the site with ?dbtest to test the database connection.
const DB_TEST = new URLSearchParams(window.location.search).has('dbtest')
// Temporary preview of a featured-case tutorial: ?casefile=dana_valencia
const CASE_PREVIEW = new URLSearchParams(window.location.search).has('casefile')

export default function App() {
  return (
    <>
      {CASE_PREVIEW ? (
        <main className="app">
          <CaseFilePreview />
        </main>
      ) : DB_TEST ? (
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
  // Featured-case tutorials: marker the car is near, and the case file open on screen
  const [nearCase, setNearCase] = useState<string | null>(null)
  const [openCase, setOpenCase] = useState<string | null>(null)

  if (screen === 'menu') {
    return (
      <main className="app">
        <MainMenu onPlay={() => setScreen('game')} character={<DetectiveShowcase />} />
      </main>
    )
  }

  return (
    <main className="app">
      <GameView
        onStatus={setStatus}
        onHud={setHud}
        onCaseNear={setNearCase}
        onCaseOpen={setOpenCase}
        paused={openCase !== null}
      />
      <Hud status={status} hud={hud} />
      {/* PROTOTYPE variable menu on Space (Perry); remove this line when the magnifying glass is ready */}
      {!openCase && <PointProbe location={hud?.location ?? null} />}
      {!openCase && <CaseHint caseId={nearCase} />}
      {openCase && <CaseFile caseId={openCase} onClose={() => setOpenCase(null)} />}
    </main>
  )
}
