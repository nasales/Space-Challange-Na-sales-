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
   One SVG in a 100 x 100 box that scales with the lens. Every ring and arc is drawn around the
   glass centre (50, 50) with a radius given as a fraction of the glass radius (50), so nothing has
   a centre of its own that could sit off the bezel's.
------------------------------------------------------------------------------------------------ */

/** Centre and radius of the glass in the SVG box */
const G_C = 50
const G_R = 50

/** Point on the circle of radius f * G_R at angle deg (SVG angles: 0 = right, 90 = down) */
function glassPoint(f: number, deg: number): string {
  const a = (deg * Math.PI) / 180
  return `${(G_C + f * G_R * Math.cos(a)).toFixed(3)} ${(G_C + f * G_R * Math.sin(a)).toFixed(3)}`
}

/** Open arc on the circle of radius f * G_R, clockwise from a0 to a1 (degrees, a1 > a0, < 180 apart) */
function glassArc(f: number, a0: number, a1: number): string {
  const r = (f * G_R).toFixed(3)
  return `M ${glassPoint(f, a0)} A ${r} ${r} 0 0 1 ${glassPoint(f, a1)}`
}

/** Ring sector between radii fIn and fOut (fractions of G_R), from a0 to a1 */
function glassBand(fIn: number, fOut: number, a0: number, a1: number): string {
  const rIn = (fIn * G_R).toFixed(3)
  const rOut = (fOut * G_R).toFixed(3)
  return (
    `M ${glassPoint(fOut, a0)} A ${rOut} ${rOut} 0 0 1 ${glassPoint(fOut, a1)} ` +
    `L ${glassPoint(fIn, a1)} A ${rIn} ${rIn} 0 0 0 ${glassPoint(fIn, a0)} Z`
  )
}

// Reflections, all concentric with the glass. The light comes from the upper left (180-270 deg).
/** Main specular band along the upper-left of the glass */
const SPEC_BAND = glassBand(0.67, 0.76, 192, 262)
/** Short bright stroke just inside the band, lower on the same side */
const SPEC_STROKE = glassArc(0.61, 176, 190)
/** Soft secondary reflection, lower right (the opposite side) */
const SECONDARY_BAND = glassBand(0.62, 0.72, 30, 62)
const SECONDARY_STROKE = glassArc(0.74, 34, 58)

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
        <circle cx={G_C} cy={G_C} r={G_R} fill="url(#vp-thickness)" />

        {/* chromatic fringe: two concentric rings just inside the rim, cool inside and warm outside
            (red bends least, so it lands nearest the edge) */}
        <circle cx={G_C} cy={G_C} r={G_R * 0.966} fill="none" stroke="#3fc8ff" strokeOpacity="0.3" strokeWidth="0.8" filter="url(#vp-soft)" />
        <circle cx={G_C} cy={G_C} r={G_R * 0.984} fill="none" stroke="#ff5a7a" strokeOpacity="0.3" strokeWidth="0.8" filter="url(#vp-soft)" />

        {/* curved specular highlight along the upper-left of the glass */}
        <path d={SPEC_BAND} fill="url(#vp-spec)" filter="url(#vp-soft)" />
        <path d={SPEC_STROKE} stroke="#fff" strokeOpacity="0.7" strokeWidth="1.3" strokeLinecap="round" fill="none" />

        {/* soft secondary reflection, lower right */}
        <path d={SECONDARY_BAND} fill="#fff" fillOpacity="0.2" filter="url(#vp-softer)" />
        <path d={SECONDARY_STROKE} stroke="#fff" strokeOpacity="0.4" strokeWidth="0.9" strokeLinecap="round" fill="none" />

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
