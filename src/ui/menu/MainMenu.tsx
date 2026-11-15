// Main menu: left panel is a comic-page detective wall (ink-drawn sheets pinned to the page and
// joined by red string), right panel is a comic-style stage for the animated character. Only the
// optional sign-in badge sits on the stage; the volume sliders are a taped note on the wall.
// Each sheet has its own hover/focus "show" (CSS only, see MainMenu.css), with comic sound effects.
// The character is passed in as a slot from App.tsx, so the UI never imports from src/game.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import casesArt from '../assets/menu/cases.svg'
import creditsArt from '../assets/menu/credits.svg'
import howArt from '../assets/menu/how.svg'
import panelBg from '../assets/menu/panel-bg.svg'
import playArt from '../assets/menu/play.svg'
import wardrobeArt from '../assets/menu/wardrobe.svg'
import { signOut, useSession } from '../../shared/auth'
import SoundSliders from '../settings/SoundSliders'
import CaseFileDialog from './CaseFileDialog'
import { FEATURED } from './featuredCases'
import HowItWorks from './how/HowItWorks'
import { Credits, FeaturedCases } from './menuFiles'
import './MainMenu.css'
import { L, LANG } from '../../shared/i18n'
import { LanguageSwitch } from '../language/LanguagePicker'

interface MainMenuProps {
  onPlay: () => void
  onWardrobe: () => void
  /** Opens the optional Account screen (an account is never needed to play). */
  onAccount: () => void
  character: ReactNode
}

type FileId = 'how' | 'cases' | 'credits'

// Pin positions on the page, in percent of the page's width (x) and height (y).
// px is where the pin goes through the sheet, in percent of the sheet's width (50 = top center,
// 92 = top-right corner). Corner pins let the string leave the sheet at once, so it never runs
// across a heading. The title caption is not pinned; it only uses its position.
const PINS = {
  title: { x: 50, y: 2.5, px: 50 },
  play: { x: 15, y: 28, px: 12 },
  wardrobe: { x: 80, y: 26, px: 50 },
  cases: { x: 87, y: 55, px: 95 },
  how: { x: 34, y: 61, px: 88 },
  credits: { x: 70, y: 89, px: 50 },
} as const

type PinId = keyof typeof PINS

// Red string between pins: [from, to, c1x, c1y, c2x, c2y], a cubic curve whose two control
// points (in board percent) route it around the sheets, so it never runs across a heading.
// The wardrobe card hangs from a center pin, so it only takes the top string.
const STRINGS: [PinId, PinId, number, number, number, number][] = [
  ['play', 'wardrobe', 38, 31, 60, 30],
  ['play', 'how', -8, 45, 10, 62],
  ['how', 'credits', 46, 64, 50, 86],
  ['cases', 'credits', 100, 62, 94, 84],
]

const PINNED: PinId[] = ['play', 'wardrobe', 'cases', 'how', 'credits']

function stringPath(from: PinId, to: PinId, c1x: number, c1y: number, c2x: number, c2y: number) {
  const a = PINS[from]
  const b = PINS[to]
  return `M ${a.x} ${a.y} C ${c1x} ${c1y} ${c2x} ${c2y} ${b.x} ${b.y}`
}

function pinStyle(id: PinId, rotate = 0): CSSProperties {
  const pin = PINS[id]
  return { '--x': pin.x, '--y': pin.y, '--px': `${pin.px}%`, '--r': `${rotate}deg` } as CSSProperties
}

// "How it works" is a full-screen walkthrough (./how/), not a case-file dialog.
const FILES: Record<Exclude<FileId, 'how'>, { label: string; title: string; body: () => ReactNode }> = {
  cases: {
    label: L('Case file: open cases', 'Expediente: casos abiertos'),
    title: L('Featured cases', 'Casos destacados'),
    body: FeaturedCases,
  },
  credits: { label: L('Case file: credits', 'Expediente: créditos'), title: L('Credits', 'Créditos'), body: Credits },
}

// Comic sound effect lettering. Decorative only: hidden from assistive technology.
function Sfx({ kind, burst = false, children }: { kind: string; burst?: boolean; children: ReactNode }) {
  return (
    <span className={`sfx sfx--${kind}${burst ? ' sfx--burst' : ''}`} aria-hidden="true">
      <span className="sfx__word">{children}</span>
    </span>
  )
}

function Lightbulb() {
  return (
    <svg className="board-note__bulb-art" viewBox="0 0 48 64" aria-hidden="true">
      <path
        className="board-note__glass"
        d="M24 3C12.4 3 4 11.6 4 22.4c0 7.6 4 12.4 7.6 16.2 2.4 2.6 3.6 5 3.6 8.4h17.6c0-3.4 1.2-5.8 3.6-8.4C40 34.8 44 30 44 22.4 44 11.6 35.6 3 24 3Z"
      />
      <path className="board-note__filament" d="M18 30l3 5 3-5 3 5 3-5" />
      <rect className="board-note__base" x="15" y="47" width="18" height="6" rx="1" />
      <rect className="board-note__base" x="17" y="53" width="14" height="6" rx="1" />
    </svg>
  )
}

// Optional account: a small ID badge in the stage corner. Signed in, it shows the email and Sign out.
function AccountBadge({ onAccount }: { onAccount: () => void }) {
  const { user } = useSession()
  const [busy, setBusy] = useState(false)
  const email = user?.email ?? L('detective', 'detective')
  return (
    <div className="menu-account">
      <button
        type="button"
        className="menu-account__open"
        onClick={onAccount}
        aria-label={
          user
            ? L(`Account: signed in as ${email}`, `Cuenta: has iniciado sesión como ${email}`)
            : L('Account: sign in or create an account (optional)', 'Cuenta: inicia sesión o crea una cuenta (opcional)')
        }
      >
        <span className="menu-account__word">{L('Account', 'Cuenta')}</span>
        <span className="menu-account__who">{user ? email : L('Sign in (optional)', 'Iniciar sesión (opcional)')}</span>
      </button>
      {user && (
        <button
          type="button"
          className="menu-account__out"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await signOut()
            setBusy(false)
          }}
        >
          {L('Sign out', 'Cerrar sesión')}
        </button>
      )}
      {/* EN / ES: changing it reloads the page in the new language (src/shared/i18n.ts) */}
      <LanguageSwitch current={LANG} />
    </div>
  )
}

function Art({ src, className }: { src: string; className: string }) {
  return <img className={className} src={src} alt="" draggable={false} />
}

export default function MainMenu({ onPlay, onWardrobe, onAccount, character }: MainMenuProps) {
  const [openFile, setOpenFile] = useState<FileId | null>(null)
  const triggers = useRef<Partial<Record<FileId, HTMLButtonElement | null>>>({})
  // The autofocused Play sheet must not run its focus show on load: the shows (and the focus
  // ring) only follow keyboard focus after a real key press.
  const [keyboard, setKeyboard] = useState(false)

  useEffect(() => {
    if (keyboard) return
    const onKey = () => setKeyboard(true)
    window.addEventListener('keydown', onKey, { once: true })
    return () => window.removeEventListener('keydown', onKey)
  }, [keyboard])

  const closeFile = () => {
    const id = openFile
    setOpenFile(null)
    if (id) requestAnimationFrame(() => triggers.current[id]?.focus())
  }

  const file = openFile && openFile !== 'how' ? FILES[openFile] : null
  const FileBody = file?.body
  const boardStyle = { '--panel-bg': `url("${panelBg}")` } as CSSProperties

  return (
    <section className="main-menu">
      <div className="main-menu__panel">
        <div className="board" style={boardStyle} data-kbd={keyboard || undefined}>
          <header className="board__masthead" style={pinStyle('title', -1.5)}>
            <h1 className="board__title">
              <span className="board__title-top">John</span>
              <span className="board__title-big">Datason</span>
            </h1>
            <p className="board__tagline">
              {L('Follow the clues. Read the data. Crack the climate case.', 'Sigue las pistas. Lee los datos. Resuelve el caso del clima.')}
            </p>
          </header>

          <button
            type="button"
            className="board__sheet board-play"
            style={pinStyle('play', -3)}
            onClick={onPlay}
            data-sfx="confirm"
            autoFocus
            aria-label={L('Play: open the case', 'Jugar: abre el caso')}
          >
            <span className="board-play__speed" aria-hidden="true" />
            <span className="sheet board-play__body">
              <span className="board-play__photo">
                <Art className="board-play__art" src={playArt} />
                <span className="board-play__flash" aria-hidden="true" />
              </span>
              <span className="board-play__word" aria-hidden="true">
                {L('Play', 'Jugar')}
              </span>
              <span className="board-play__caption">{L('Open the case', 'Abre el caso')}</span>
            </span>
            <Sfx kind="click" burst>
              {L('Click!', '¡Clic!')}
            </Sfx>
            <Sfx kind="pow" burst>
              {L('Pow!', '¡Pum!')}
            </Sfx>
          </button>

          <button
            type="button"
            className="board__sheet board-card"
            style={pinStyle('wardrobe', 3)}
            onClick={onWardrobe}
            data-sfx="open"
            aria-label={L('Wardrobe: dress your detective', 'Vestuario: viste a tu detective')}
          >
            <span className="sheet board-card__body">
              <svg className="board-card__hanger" viewBox="0 0 100 34" aria-hidden="true">
                <path d="M50 2c-6 0-8 7-3 9l3 3L6 30h88L50 14" />
              </svg>
              <Art className="board-card__art sheet__art" src={wardrobeArt} />
              <span className="board-card__title sheet__title">{L('Wardrobe', 'Vestuario')}</span>
              <span className="board-card__note sheet__note">{L('Dress your detective', 'Viste a tu detective')}</span>
            </span>
            <Sfx kind="swish">{L('Swish', '¡Fiu!')}</Sfx>
            <Sfx kind="pow" burst>
              {L('Pow!', '¡Pum!')}
            </Sfx>
          </button>

          <button
            type="button"
            className="board__sheet board-folder"
            style={pinStyle('cases', -2.5)}
            onClick={() => setOpenFile('cases')}
            data-sfx="open"
            ref={(el) => {
              triggers.current.cases = el
            }}
            aria-haspopup="dialog"
            aria-label={L(
              `Featured cases: ${FEATURED.length} open questions across Spain`,
              `Casos destacados: ${FEATURED.length} preguntas abiertas por toda España`,
            )}
          >
            <span className="sheet board-folder__body">
              <span className="board-folder__tab" aria-hidden="true">
                {FEATURED.length} {L('files', 'expedientes')}
              </span>
              <span className="board-folder__paper board-folder__paper--back" aria-hidden="true" />
              <span className="board-folder__paper board-folder__paper--front" aria-hidden="true" />
              <span className="board-folder__front">
                <Art className="board-folder__art sheet__art" src={casesArt} />
                <span className="board-folder__title sheet__title">{L('Featured cases', 'Casos destacados')}</span>
                <span className="board-folder__note sheet__note">{L('Open questions across Spain', 'Preguntas abiertas por toda España')}</span>
              </span>
            </span>
            <Sfx kind="files">{L('Case files!', '¡Expedientes!')}</Sfx>
            <Sfx kind="pow" burst>
              {L('Pow!', '¡Pum!')}
            </Sfx>
          </button>

          <button
            type="button"
            className="board__sheet board-note"
            style={pinStyle('how', 2.5)}
            onClick={() => setOpenFile('how')}
            data-sfx="open"
            ref={(el) => {
              triggers.current.how = el
            }}
            aria-haspopup="dialog"
            aria-label={L('How it works: how we read the clues', 'Cómo funciona: cómo leemos las pistas')}
          >
            <span className="sheet board-note__body">
              <Art className="board-note__art sheet__art" src={howArt} />
              <span className="board-note__title sheet__title">{L('How it works', 'Cómo funciona')}</span>
              <span className="board-note__note sheet__note">{L('How we read the clues', 'Cómo leemos las pistas')}</span>
            </span>
            <span className="board-note__bulb" aria-hidden="true">
              <span className="board-note__rays" />
              <Lightbulb />
            </span>
            <Sfx kind="aha">{L('Aha!', '¡Ajá!')}</Sfx>
            <Sfx kind="pow" burst>
              {L('Pow!', '¡Pum!')}
            </Sfx>
          </button>

          <button
            type="button"
            className="board__sheet board-tag"
            style={pinStyle('credits', -4)}
            onClick={() => setOpenFile('credits')}
            data-sfx="open"
            ref={(el) => {
              triggers.current.credits = el
            }}
            aria-haspopup="dialog"
            aria-label={L('Credits', 'Créditos')}
          >
            <span className="sheet board-tag__body">
              <span className="board-tag__eyelet" aria-hidden="true" />
              <Art className="board-tag__art sheet__art" src={creditsArt} />
              <span className="board-tag__title">{L('Credits', 'Créditos')}</span>
            </span>
            <span className="board-tag__stamp" aria-hidden="true">
              {L('Roll credits', 'Rueden créditos')}
            </span>
            <Sfx kind="pow" burst>
              {L('Pow!', '¡Pum!')}
            </Sfx>
          </button>

          <svg className="board__strings" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {STRINGS.map(([from, to, ...controls]) => (
              <g key={`${from}-${to}`}>
                <path className="board__string-ink" d={stringPath(from, to, ...controls)} />
                <path className="board__string" d={stringPath(from, to, ...controls)} />
              </g>
            ))}
          </svg>

          {PINNED.map((id) => (
            <span key={id} className={`board__pin board__pin--${id}`} style={pinStyle(id)} aria-hidden="true" />
          ))}

          <p className="board__credit">{L('Data: NASA MERRA-2', 'Datos: NASA MERRA-2')}</p>
        </div>
        {/* Volume sliders: a taped note in the wall's top-left corner (below the wall on phones) */}
        <SoundSliders className="board-sound" />
      </div>

      <div className="main-menu__stage">
        <div className="main-menu__rays" aria-hidden="true" />
        <div className="main-menu__dots" aria-hidden="true" />
        <div className="main-menu__character">{character}</div>
        <AccountBadge onAccount={onAccount} />
      </div>

      {openFile === 'how' && <HowItWorks onClose={closeFile} />}

      {file && FileBody && (
        <CaseFileDialog key={openFile} label={file.label} title={file.title} onClose={closeFile}>
          <FileBody />
        </CaseFileDialog>
      )}
    </section>
  )
}
