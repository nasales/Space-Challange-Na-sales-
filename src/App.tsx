// App shell: first the main menu, then (after Play) the 3D game with the interface drawn on top.
// src/game and src/ui never import each other; they only talk through src/shared.
// The menu's animated character comes from src/game and is passed into the menu as a slot here.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GameView from './game/GameView'
import DetectiveShowcase from './game/detective/DetectiveShowcase'
import Hud from './ui/hud/Hud'
import MapLoader from './ui/loading/MapLoader'
import MainMenu from './ui/menu/MainMenu'
import VariablePicker from './ui/magnifier/VariablePicker'
import PauseMenu from './ui/pause/PauseMenu'
import Wardrobe from './ui/wardrobe/Wardrobe'
import LoginScreen from './ui/auth/LoginScreen'
import { isRecoveryLink, useSession } from './shared/auth'
import DbTest from './ui/dbtest/DbTest'
import DbStatus from './ui/status/DbStatus'
import CaseFilePreview from './ui/casefile/CaseFilePreview'
import CaseFlow, { type DialogueState } from './ui/casefile/CaseFlow'
import CaseHint from './ui/casefile/CaseHint'
import { createAnchorStore } from './ui/casefile/anchors'
import TravelMap from './ui/travelmap/TravelMap'
import AchievementToasts from './ui/achievements/AchievementToasts'
import { reportCaseSolved } from './shared/achievements'
import GuidePrompt from './ui/guide/GuidePrompt'
import GuideTour from './ui/guide/GuideTour'
import { createGuideAnchorStore } from './ui/guide/anchor'
import type { GameStatus, GuideCue, HudState, LensFocusState, TravelRequest } from './shared/events'
import LanguagePicker from './ui/language/LanguagePicker'
import { LANG_CHOSEN } from './shared/i18n'
import { loadOutfit, type Outfit } from './shared/outfit'
import {
  fetchRemoteCompleted,
  loadCompleted,
  loadGuideSeen,
  markCompleted,
  markGuideSeen,
  saveRemoteCompleted,
} from './shared/progress'
import { startBackgroundMusic } from './shared/music'
import { hasTutorial } from './ui/casefile/loader'
import { installUiSounds, playSfx, setWind } from './shared/sound'

type Screen = 'menu' | 'wardrobe' | 'account' | 'game'

// Opened from a password reset email: start on the Account screen to choose the new password.
const RECOVERY = isRecoveryLink()

// Temporary team page: open the site with ?dbtest to test the database connection.
const DB_TEST = new URLSearchParams(window.location.search).has('dbtest')
// Temporary preview of a featured-case tutorial: ?casefile=dana_valencia
const CASE_PREVIEW = new URLSearchParams(window.location.search).has('casefile')

const NO_DIALOGUE: DialogueState = { active: false, speaking: null, mood: null }

export default function App() {
  // true while a featured case is open: the HUD and the database badge fade out (dialogue focus)
  const [caseFocus, setCaseFocus] = useState(false)
  return (
    <>
      {!LANG_CHOSEN && !CASE_PREVIEW && !DB_TEST ? (
        // Very first visit: English or Spanish? (src/shared/i18n.ts; picking reloads the page)
        <main className="app">
          <LanguagePicker />
        </main>
      ) : CASE_PREVIEW ? (
        <main className="app">
          <CaseFilePreview />
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
  const [screen, setScreen] = useState<Screen>(RECOVERY ? 'account' : 'menu')
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
  // Featured cases: Space inside a case zone (detective stopped) opens the case flow
  // (witness scene -> case file or evidence board -> case closed, src/ui/casefile/CaseFlow.tsx).
  // Escape inside the flow is handled there, one phase at a time.
  const [openCase, setOpenCase] = useState<string | null>(null)
  const [dialogue, setDialogue] = useState<DialogueState>(NO_DIALOGUE)
  const [anchors] = useState(createAnchorStore)
  const [completed, setCompleted] = useState<Set<string>>(loadCompleted)
  // Signed-in players: solved cases saved in Supabase (minigame_progress), read on load and on
  // every sign in / sign out. Guests: local progress only, nothing is sent.
  const { user } = useSession()
  const userId = user?.id ?? null
  // Kept with the user it belongs to, so another account (or signing out) never shows these ids
  const [remote, setRemote] = useState<{ userId: string; ids: Set<string> } | null>(null)
  useEffect(() => {
    if (!userId) return
    let alive = true
    fetchRemoteCompleted(userId).then((ids) => {
      if (!alive) return
      setRemote((prev) => ({ userId, ids: new Set([...(prev?.userId === userId ? prev.ids : []), ...ids]) }))
    })
    return () => {
      alive = false
    }
  }, [userId])
  const remoteIds = remote && remote.userId === userId ? remote.ids : null
  const completedList = useMemo(() => [...new Set([...completed, ...(remoteIds ?? [])])], [completed, remoteIds])
  // Background music from the menu on (it starts on the first click or key press)
  useEffect(startBackgroundMusic, [])
  // ---- Map tutorial (src/ui/guide): offered when the map is ready the first time, replayable from the pause panel ----
  // 'offer': the Start / Skip panel is up (game paused); 'running': the guide robot is showing the player around
  const [guide, setGuide] = useState<'offer' | 'running' | null>(null)
  const [guideCue, setGuideCue] = useState<GuideCue | null>(null)
  const [guideHighlight, setGuideHighlight] = useState<'corner' | null>(null)
  const [guideAnchors] = useState(createGuideAnchorStore)
  const onGameStatus = useCallback((s: GameStatus) => {
    setStatus(s)
    // The map is drawn and the intro camera has landed: offer the tutorial once per browser
    if (s === 'ready' && !loadGuideSeen()) setGuide('offer')
  }, [])
  const startGuide = useCallback(() => {
    markGuideSeen()
    setPaused(false)
    setGuide('running')
  }, [])
  const endGuide = useCallback(() => {
    markGuideSeen()
    setGuide(null)
    setGuideCue(null)
  }, [])
  // ---- Fast travel (M map): pick a landmark, the detective flies there by plane ----
  const [travelMapOpen, setTravelMapOpen] = useState(false)
  const [travelTo, setTravelTo] = useState<TravelRequest | null>(null)
  const [flying, setFlying] = useState(false)
  const canOpenTravelMap = screen === 'game' && status === 'ready' && !paused && !openCase && !focusLens && lensState === 'out' && !flying && guide !== 'offer'
  const startTravel = (landmarkId: string) => {
    setTravelMapOpen(false)
    setFlying(true) // until the game reports 'landed'
    setTravelTo((prev) => ({ landmarkId, seq: (prev?.seq ?? 0) + 1 }))
  }
  // Map open or plane in the air: Space (magnifier, case level) and Esc (pause) wait
  const travelBusy = travelMapOpen || flying
  // Subtle sound effects: a click on every button, plus the game moments below (src/shared/sound.ts)
  useEffect(installUiSounds, [])
  const zoneCase = hud?.caseZone && hasTutorial(hud.caseZone) ? hud.caseZone : null
  // only with the camera out of the hand lens (the picker cannot reset it once a case is open)
  const canOpenCase =
    screen === 'game' && status === 'ready' && !!hud?.stopped && !!zoneCase && !openCase && !focusLens && lensState === 'out' && !paused && !travelBusy &&
    !guide // not during the tutorial: cases open once the guide robot has finished
  useGameSounds({
    playing: screen === 'game' && status === 'ready' && !paused && !openCase && !focusLens,
    rush: hud?.rush ?? 0,
    kmh: hud?.kmh ?? 0,
    turbo: !!hud?.turbo,
    zone: zoneCase,
    paused,
    lens: focusLens,
    openCase,
  })
  const exitToMenu = () => {
    // GameView unmounts and disposes its scene; reset the game state so Play starts fresh
    setPaused(false)
    setGuide(null)
    setGuideCue(null)
    setTravelMapOpen(false)
    setFlying(false)
    setTravelTo(null)
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
  useEffect(() => {
    onCaseFocus(!!openCase)
  }, [openCase, onCaseFocus])
  const closeCase = useCallback(() => {
    setOpenCase(null)
    setDialogue(NO_DIALOGUE)
  }, [])
  const solveCase = useCallback((caseId: string) => {
    // Green marker once the case is solved
    playSfx('success')
    markCompleted(caseId)
    reportCaseSolved(caseId) // achievements: case levels X/N
    setCompleted((prev) => new Set(prev).add(caseId))
    if (userId) {
      saveRemoteCompleted(caseId)
      setRemote((prev) => ({ userId, ids: new Set(prev?.userId === userId ? prev.ids : []).add(caseId) }))
    }
  }, [userId])

  if (screen === 'menu') {
    return (
      <main className="app">
        <MainMenu
          onPlay={() => setScreen('game')}
          onWardrobe={() => setScreen('wardrobe')}
          onAccount={() => setScreen('account')}
          character={<DetectiveShowcase outfit={outfit} />}
        />
      </main>
    )
  }

  // Optional login: Play never depends on it
  if (screen === 'account') {
    return (
      <main className="app">
        <LoginScreen onBack={() => setScreen('menu')} recovery={RECOVERY} />
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
        onStatus={onGameStatus}
        onHud={setHud}
        focusLens={focusLens}
        onLensFocus={setLensState}
        onProgress={setLoadProgress}
        outfit={outfit}
        paused={paused || !!openCase || travelMapOpen || guide === 'offer'}
        completedCases={completedList}
        dialogueCase={openCase && dialogue.active ? openCase : null}
        speaking={dialogue.speaking}
        speakingMood={dialogue.mood}
        onDialogueAnchors={anchors.set}
        travelTo={travelTo}
        onTravel={(state) => setFlying(state === 'flying')}
        guide={guide === 'running' ? guideCue : null}
        onGuideAnchor={guideAnchors.set}
      />
      {/* Dialogue focus: the whole HUD fades out while a case is open */}
      <Hud status={status} hud={hud} hidden={!!openCase} highlight={guide === 'running' ? guideHighlight : null} />
      <MapLoader status={status} progress={loadProgress} outfit={outfit} />
      {/* Outside case zones Space opens the magnifier picker, as before */}
      <VariablePicker
        canOpen={status === 'ready' && !!hud?.stopped && !paused && !zoneCase && !openCase && !travelBusy && guide !== 'offer'}
        lensState={lensState}
        onOpenChange={setFocusLens}
        location={hud?.location ?? null}
      />
      {/* After the picker, so the picker's Esc handler runs first and wins; a case flow has its own Esc */}
      <PauseMenu
        open={paused}
        canOpen={status === 'ready' && !focusLens && lensState === 'out' && !openCase && !travelBusy && guide !== 'offer'}
        onOpenChange={setPaused}
        onMainMenu={exitToMenu}
        onTutorial={startGuide}
      />
      {/* Fast travel map (M): opens only when nothing else is up; picking a landmark starts the flight */}
      <TravelMap
        open={travelMapOpen}
        canOpen={canOpenTravelMap}
        onOpenChange={setTravelMapOpen}
        onTravel={startTravel}
        position={hud?.location ?? null}
      />
      {/* Map tutorial: the offer panel, then the guide robot's dialogue box */}
      {guide === 'offer' && <GuidePrompt onStart={startGuide} onSkip={endGuide} />}
      {guide === 'running' && (
        <GuideTour
          hud={hud}
          focusLens={focusLens}
          lensState={lensState}
          travelMapOpen={travelMapOpen}
          flying={flying}
          blocked={paused}
          anchors={guideAnchors}
          onCue={setGuideCue}
          onHighlight={setGuideHighlight}
          onDone={endGuide}
        />
      )}
      {zoneCase && !paused && !travelBusy && !guide && <CaseHint caseId={zoneCase} stopped={!!hud?.stopped} hidden={!!openCase} />}
      {openCase && (
        <CaseFlow
          key={openCase}
          caseId={openCase}
          onClose={closeCase}
          onSolved={solveCase}
          onDialogue={setDialogue}
          anchors={anchors}
          outfit={outfit}
        />
      )}
      <AchievementToasts />
    </main>
  )
}

/** Changes worth a sound while playing on the map: wind with speed, turbo, case zones, panels. */
function useGameSounds(g: {
  playing: boolean
  rush: number
  kmh: number
  turbo: boolean
  zone: string | null
  paused: boolean
  lens: boolean
  openCase: string | null
}) {
  // Wind: a soft breeze at full walking speed, rising to a rush of air at full turbo
  const wind = g.playing ? Math.max(Math.min(1, g.kmh / 60) * 0.12, g.rush) : 0
  useEffect(() => setWind(wind), [wind])
  // Silence the wind when leaving the game screen
  useEffect(() => () => setWind(0), [])

  const prev = useRef(g)
  useEffect(() => {
    const p = prev.current
    prev.current = g
    if (g.playing && g.turbo && !p.turbo) playSfx('boost')
    if (g.zone && g.zone !== p.zone) playSfx('zone')
    if (g.paused !== p.paused) playSfx(g.paused ? 'open' : 'close')
    if (g.lens && !p.lens) playSfx('lens')
    if (!g.lens && p.lens) playSfx('close')
    if (g.openCase && !p.openCase) playSfx('open')
    if (!g.openCase && p.openCase) playSfx('close')
  })
}
