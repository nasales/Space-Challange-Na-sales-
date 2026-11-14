// Variable picker drawn on the glass of the detective's hand lens.
// While the detective is stopped, Space asks the game to fly the camera into the hand lens
// (onOpenChange(true)). When the game reports lensState 'in', the 3D lens glass is centred on
// screen with diameter LENS_SCREEN_DIAMETER, and this component draws a clear glass of exactly
// that size on top of it: the map stays visible through the glass, magnified and slightly bent.
// Esc fades the clues, the lens "lets go", and the game flies back out (onOpenChange(false)).
// The clues on the glass (ClueRing) are placeholders for now: visible and inviting, but inactive.
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { LENS_SCREEN_DIAMETER, type LensFocusState } from '../../shared/events'
import ClueRing from './ClueRing'
import './VariablePicker.css'

/**
 * closed: nothing on screen.
 * zooming: the camera is flying into the lens; the overlay is invisible until the game says 'in'.
 * open: the glass is up and shows the clues.
 * closing: the clues fade and the lens lets go (still focused on the lens).
 * releasing: the game is flying back out; invisible, waiting for 'out'.
 */
type Mode = 'closed' | 'zooming' | 'open' | 'closing' | 'releasing'

/** Give up waiting for the game's 'in' after this long and show the glass anyway */
const ZOOM_FALLBACK_MS = 1500
/** Give up waiting for the game's 'out' after this long */
const RELEASE_FALLBACK_MS = 1200
/** Must match the "let go" animation length in VariablePicker.css */
const CLOSE_MS = 340

/** Keys that must not reach the game or scroll the page while the lens is up */
const BLOCKED_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

/** id of the SVG refraction filter (one picker on screen at a time) */
const BARREL_FILTER_ID = 'variable-picker-barrel'

interface Props {
  /** The detective is stopped, so Space may open the picker */
  canOpen: boolean
  /** Camera flight into the hand lens, reported by the game */
  lensState?: LensFocusState
  /** Asks the game to fly into the hand lens (true) or back out (false) */
  onOpenChange?: (open: boolean) => void
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function VariablePicker({ canOpen, lensState = 'out', onOpenChange }: Props) {
  const [mode, setMode] = useState<Mode>('closed')
  const dialog = useRef<HTMLDivElement>(null)

  // The game's report moves the picker on without an extra state change:
  // zooming + 'in' is open, releasing + 'out' is closed.
  const phase: Mode =
    mode === 'zooming' && lensState === 'in'
      ? 'open'
      : mode === 'releasing' && lensState === 'out'
        ? 'closed'
        : mode

  // Latest values for the window key handler, which is attached only once
  const state = useRef({ phase, canOpen })
  useEffect(() => {
    state.current = { phase, canOpen }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { phase, canOpen } = state.current
      if (phase === 'closed') {
        // Space opens only while stopped; while moving it does nothing here (the game handles keys)
        if (e.code === 'Space' && canOpen) {
          e.preventDefault()
          if (!e.repeat) setMode('zooming')
        }
        return
      }
      if (BLOCKED_KEYS.has(e.code)) {
        e.preventDefault() // no page scroll, no button "click", no car movement
      } else if (e.code === 'Escape') {
        e.preventDefault()
        if (phase === 'zooming') setMode('releasing') // cancel: nothing to fade yet
        else if (phase === 'open') setMode(prefersReducedMotion() ? 'releasing' : 'closing')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Fallbacks in case the game never reports, and the end of the "let go" animation
  useEffect(() => {
    let next: Mode | null = null
    let ms = 0
    if (mode === 'zooming') [next, ms] = ['open', ZOOM_FALLBACK_MS]
    else if (mode === 'closing') [next, ms] = ['releasing', CLOSE_MS]
    else if (mode === 'releasing') [next, ms] = ['closed', RELEASE_FALLBACK_MS]
    if (!next) return
    const target = next
    const timer = window.setTimeout(() => setMode(target), ms)
    return () => window.clearTimeout(timer)
  }, [mode])

  // Hold the camera in the lens from the first Space until the clues have faded
  const focused = phase === 'zooming' || phase === 'open' || phase === 'closing'
  useEffect(() => {
    onOpenChange?.(focused)
  }, [focused, onOpenChange])

  useEffect(() => {
    if (phase === 'zooming' || phase === 'open') dialog.current?.focus()
  }, [phase])

  if (phase === 'closed') return null

  return (
    <div
      className={`variable-picker variable-picker--${phase}`}
      style={{ '--lens-screen-d': LENS_SCREEN_DIAMETER } as CSSProperties}
    >
      <BarrelFilter lens={dialog} />
      <div
        ref={dialog}
        className="variable-picker__lens"
        role="dialog"
        aria-modal="true"
        aria-labelledby="variable-picker-title"
        aria-describedby="variable-picker-lead"
        aria-busy={phase === 'zooming'}
        tabIndex={-1}
      >
        {/* Brass bezel around the glass; the 3D hand lens handle shows behind it */}
        <div className="variable-picker__bezel" aria-hidden="true">
          <div className="variable-picker__knurl" />
        </div>

        {/* Optics, bottom to top: colour lift, refraction, defocus (fades out), rim blur */}
        <div className="variable-picker__optic variable-picker__optic--tint" aria-hidden="true" />
        {supportsBackdropSvgFilter() && (
          <div
            className="variable-picker__optic variable-picker__optic--refract"
            style={{ backdropFilter: `url(#${BARREL_FILTER_ID})` }}
            aria-hidden="true"
          />
        )}
        <div className="variable-picker__optic variable-picker__optic--rim" aria-hidden="true" />
        <div className="variable-picker__optic variable-picker__optic--defocus" aria-hidden="true" />

        {/* Thickness, fringe and reflections */}
        <GlassSurface />

        {/* Clues, case question and hints (title/lead ids for the dialog live there) */}
        <ClueRing phase={phase} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------------------------------
   Refraction. Only Chromium applies an SVG filter as a backdrop-filter; elsewhere the layer is not
   rendered at all and the glass falls back to the colour lift + rim blur, which still reads as glass.
------------------------------------------------------------------------------------------------ */

function supportsBackdropSvgFilter(): boolean {
  const uaData = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } })
    .userAgentData
  return !!uaData?.brands?.some((b) => b.brand === 'Chromium')
}

/** Centre magnification of the barrel map: 1 / BARREL_K (about 1.3x) */
const BARREL_K = 0.76
/** Largest displacement of the map, as a fraction of the lens radius (max of (1-k) r (1-r²)) */
const BARREL_MAX = (1 - BARREL_K) * (2 / (3 * Math.sqrt(3)))

let barrelMapUrl: string | null = null

/**
 * Displacement map for feDisplacementMap: red = horizontal offset, green = vertical (0.5 = none).
 * A pixel at normalised radius r samples the backdrop at r * (k + (1 - k) r²): magnified in the
 * centre and squeezed towards the rim, like a real thick lens. Built once on a small canvas.
 */
function getBarrelMap(): string {
  if (barrelMapUrl) return barrelMapUrl
  const n = 256
  const canvas = document.createElement('canvas')
  canvas.width = n
  canvas.height = n
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const img = ctx.createImageData(n, n)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const nx = ((x + 0.5) / n) * 2 - 1
      const ny = ((y + 0.5) / n) * 2 - 1
      const r2 = nx * nx + ny * ny
      // offset = p * (1 - k) * (r² - 1): points inward, zero at the centre and on the rim
      const f = r2 < 1 ? (1 - BARREL_K) * (r2 - 1) : 0
      const i = (y * n + x) * 4
      img.data[i] = Math.round(255 * (0.5 + (nx * f) / (2 * BARREL_MAX)))
      img.data[i + 1] = Math.round(255 * (0.5 + (ny * f) / (2 * BARREL_MAX)))
      img.data[i + 2] = 128
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  barrelMapUrl = canvas.toDataURL('image/png')
  return barrelMapUrl
}

/** The SVG filter, sized in pixels to the lens (backdrop filters use the element's own box) */
function BarrelFilter({ lens }: { lens: RefObject<HTMLDivElement | null> }) {
  const [size, setSize] = useState(0)
  const enabled = supportsBackdropSvgFilter()

  useEffect(() => {
    if (!enabled) return
    const el = lens.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setSize(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [enabled, lens])

  if (!enabled || size === 0) return null
  return (
    <svg className="variable-picker__defs" aria-hidden="true" focusable="false">
      <filter
        id={BARREL_FILTER_ID}
        filterUnits="userSpaceOnUse"
        primitiveUnits="userSpaceOnUse"
        x="0"
        y="0"
        width={size}
        height={size}
        colorInterpolationFilters="sRGB"
      >
        <feImage
          href={getBarrelMap()}
          x="0"
          y="0"
          width={size}
          height={size}
          preserveAspectRatio="none"
          result="map"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="map"
          scale={BARREL_MAX * size}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  )
}

/* ------------------------------------------------------------------------------------------------
   Glass surface: chromatic fringe, thickness shading, curved highlight, secondary reflection, dust.
   One SVG in a 100 x 100 box that scales with the lens.
------------------------------------------------------------------------------------------------ */

function GlassSurface() {
  return (
    <div className="variable-picker__surface" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <radialGradient id="vp-thickness" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
            <stop offset="0.72" stopColor="#1a1423" stopOpacity="0" />
            <stop offset="0.93" stopColor="#1a1423" stopOpacity="0.16" />
            <stop offset="1" stopColor="#1a1423" stopOpacity="0.42" />
          </radialGradient>
          <linearGradient id="vp-spec" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
            <stop offset="0.6" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <filter id="vp-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
          <filter id="vp-softer" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>

        {/* thickness: the glass gets darker and denser towards the rim */}
        <circle cx="50" cy="50" r="50" fill="url(#vp-thickness)" />

        {/* chromatic fringe: warm on one side of the rim, cool on the other */}
        <circle cx="50.35" cy="50.2" r="49.1" fill="none" stroke="#ff5a7a" strokeOpacity="0.32" strokeWidth="0.9" filter="url(#vp-soft)" />
        <circle cx="49.65" cy="49.8" r="49.1" fill="none" stroke="#3fc8ff" strokeOpacity="0.32" strokeWidth="0.9" filter="url(#vp-soft)" />

        {/* curved specular highlight along the upper-left of the glass */}
        <path
          d="M 13 44 A 38 38 0 0 1 44 13 L 45.5 17.5 A 33.5 33.5 0 0 0 17.5 45.5 Z"
          fill="url(#vp-spec)"
          filter="url(#vp-soft)"
        />
        <path d="M 19.5 52 A 31 31 0 0 1 20.3 46" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.3" strokeLinecap="round" fill="none" />

        {/* soft secondary reflection, lower right */}
        <ellipse cx="72" cy="76" rx="11" ry="5" transform="rotate(-38 72 76)" fill="#fff" fillOpacity="0.22" filter="url(#vp-softer)" />
        <path d="M 80 70 A 33 33 0 0 1 70 81" stroke="#fff" strokeOpacity="0.4" strokeWidth="0.9" strokeLinecap="round" fill="none" />

        {/* faint dust on the glass */}
        <g fill="#fff">
          <circle cx="31" cy="63" r="0.35" fillOpacity="0.55" />
          <circle cx="66" cy="27" r="0.25" fillOpacity="0.5" />
          <circle cx="58" cy="71" r="0.3" fillOpacity="0.4" />
          <circle cx="24" cy="35" r="0.2" fillOpacity="0.6" />
          <circle cx="77" cy="49" r="0.28" fillOpacity="0.45" />
          <circle cx="44" cy="86" r="0.22" fillOpacity="0.5" />
        </g>
        <g fill="#1a1423">
          <circle cx="62" cy="58" r="0.22" fillOpacity="0.25" />
          <circle cx="38" cy="22" r="0.18" fillOpacity="0.2" />
        </g>
      </svg>
      <div className="variable-picker__glint" />
    </div>
  )
}
