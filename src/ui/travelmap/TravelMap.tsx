// Fast travel map: M opens a full-screen map of Spain with the landmarks; click one (or Tab to it
// and press Enter) and the detective flies there by plane. M or Esc closes it.
// The overlay only listens and draws; the app shell decides when it may open and starts the trip.
// The Canary Islands sit in a box in the south-west corner; their badges are airfields (shared/travelSpots.ts).
// Map data: the same public files the game loads (Natural Earth outlines and rivers, landmarks.json).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { TRAVEL_SPOTS } from '../../shared/travelSpots'
import {
  CANARY_FRAME,
  CLOSE_MS,
  GLYPHS,
  HOVER_SCALE,
  MAP_BOUNDS,
  MAP_HEIGHT,
  MAP_WIDTH,
  NEIGHBOURS,
  OPEN_MS,
  RIVER_RANK,
  TOGGLE_KEY,
  TRAVEL_LANDMARKS,
  ZOOM_FROM,
  project,
  projectSpain,
  toMapLonLat,
  type Glyph,
} from './travelConfig'
import { L } from '../../shared/i18n'
import './TravelMap.css'

/** Extra wait after the closing animation before the map is removed anyway (ms). */
const CLOSE_FALLBACK_EXTRA_MS = 150

interface Props {
  open: boolean
  /** M may open the map now (game ready, no level, magnifier, pause panel or flight) */
  canOpen: boolean
  onOpenChange: (open: boolean) => void
  /** A landmark was picked: the app closes the map and starts the flight */
  onTravel: (landmarkId: string) => void
  /** Where the detective is now */
  position: { lat: number; lon: number } | null
}

interface MapLandmark {
  id: string
  name: string
  city: string
  lat: number
  lon: number
  glyph: Glyph
}

interface MapShapes {
  spain: string
  neighbours: string
  rivers: string
  landmarks: MapLandmark[]
}

type Ring = [number, number][]

/** SVG path of polygon rings, in map units. */
function ringsToPath(rings: Ring[], toMap: (lon: number, lat: number) => { x: number; y: number } = project) {
  return rings
    .map((ring) => ring.map(([lon, lat], i) => {
      const { x, y } = toMap(lon, lat)
      return `${i ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`
    }).join('') + 'Z')
    .join('')
}

/** True if any point of the ring falls in the map frame (with a margin). */
const ringInView = (ring: Ring) =>
  ring.some(([lon, lat]) => lon > MAP_BOUNDS.west - 6 && lon < MAP_BOUNDS.east + 6 && lat > MAP_BOUNDS.south - 6 && lat < MAP_BOUNDS.north + 6)

let shapesPromise: Promise<MapShapes> | null = null
/** Loads (once) and projects what the map draws. The browser already has these files from the game. */
function loadShapes(): Promise<MapShapes> {
  shapesPromise ??= Promise.all([
    fetch('/maps/world-countries.json').then((r) => r.json()),
    fetch('/maps/countries/ESP/rivers.json').then((r) => (r.ok ? r.json() : { rivers: [] })),
    fetch('/maps/countries/ESP/landmarks.json').then((r) => (r.ok ? r.json() : { landmarks: [] })),
  ]).then(([world, rivers, lm]) => {
    type C = { id: string; polygons: Ring[][] }
    const countries = world.countries as C[]
    const rings = (c: C | undefined) => (c ? c.polygons.flat().filter(ringInView) : [])
    // Spain: its Canary Islands rings are moved into their box before the frame test
    const esp = countries.find((c) => c.id === 'ESP')
    const spain = ringsToPath(esp ? esp.polygons.flat().filter((ring) => ringInView(ring.map(([lon, lat]) => toMapLonLat(lon, lat)))) : [], projectSpain)
    const neighbours = ringsToPath(NEIGHBOURS.flatMap((id) => rings(countries.find((c) => c.id === id))))
    const riverPath = (rivers.rivers as { rank: number; lines: Ring[] }[])
      .filter((r) => r.rank <= RIVER_RANK)
      .flatMap((r) => r.lines)
      .map((line) => line.map(([lon, lat], i) => {
        const { x, y } = project(lon, lat)
        return `${i ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`
      }).join(''))
      .join('')
    // `travel: false` (small provincial-capital monuments): visual only, never on this map
    const byId = new Map((lm.landmarks as (Omit<MapLandmark, 'glyph'> & { travel?: boolean })[]).filter((l) => l.travel !== false).map((l) => [l.id, l]))
    const landmarks = TRAVEL_LANDMARKS.flatMap(({ id, glyph }) => {
      const l = byId.get(id)
      return l ? [{ id, name: l.name, city: l.city, lat: l.lat, lon: l.lon, glyph }] : []
    })
    landmarks.push(...TRAVEL_SPOTS.map((s) => ({ ...s, glyph: 'plane' as const }))) // airfields (Canary Islands)
    return { spain, neighbours, rivers: riverPath, landmarks }
  })
  shapesPromise.catch(() => {
    shapesPromise = null // try again next time
  })
  return shapesPromise
}

/** Position on the map as CSS percentages. */
function place(lon: number, lat: number): CSSProperties {
  const { x, y } = projectSpain(lon, lat)
  return { left: `${(x / MAP_WIDTH) * 100}%`, top: `${(y / MAP_HEIGHT) * 100}%` }
}

export default function TravelMap({ open, canOpen, onOpenChange, onTravel, position }: Props) {
  // Stays mounted while the closing animation plays
  const [shown, setShown] = useState(open)
  const [hovered, setHovered] = useState<string | null>(null)
  if (open && !shown) {
    setShown(true)
    setHovered(null)
  }
  const closing = shown && !open
  const [shapes, setShapes] = useState<MapShapes | null>(null)
  const [error, setError] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)

  // Latest values for the window key handler, attached once (same pattern as the pause panel)
  const state = useRef({ open, canOpen, onOpenChange })
  useLayoutEffect(() => {
    state.current = { open, canOpen, onOpenChange }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { open, canOpen, onOpenChange } = state.current
      if (e.repeat) return
      if (e.code === TOGGLE_KEY) {
        if (!open && !canOpen) return
        e.preventDefault()
        onOpenChange(!open)
      } else if (e.code === 'Escape' && open) {
        e.preventDefault() // the pause panel ignores an Esc that closed the map
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!shown || shapes) return
    let live = true
    loadShapes().then(
      (s) => live && setShapes(s),
      () => live && setError(true),
    )
    return () => {
      live = false
    }
  }, [shown, shapes])

  // Fallback in case the closing animation never reports its end (hidden tab, no animations)
  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(() => setShown(false), CLOSE_MS + CLOSE_FALLBACK_EXTRA_MS)
    return () => window.clearTimeout(timer)
  }, [closing])

  // Focus the dialog on open (Tab then walks the landmark buttons); give focus back on close
  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    return () => before?.focus?.()
  }, [open])

  const cssVars = useMemo(
    () => ({ '--travel-open': `${OPEN_MS}ms`, '--travel-close': `${CLOSE_MS}ms`, '--travel-zoom': ZOOM_FROM, '--travel-hover': HOVER_SCALE }) as CSSProperties,
    [],
  )

  if (!shown) return null
  const hoveredLandmark = shapes?.landmarks.find((l) => l.id === hovered) ?? null

  return (
    <div
      className={`travel-map ${closing ? 'travel-map--out' : 'travel-map--in'}`}
      style={cssVars}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) setShown(false)
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !closing) onOpenChange(false) // click outside the sheet closes
      }}
    >
      <div
        ref={dialog}
        className="travel-map__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="travel-map-title"
        tabIndex={-1}
      >
        <header className="travel-map__header">
          <span className="travel-map__tag">{L('Travel map', 'Mapa de viaje')}</span>
          <h2 id="travel-map-title" className="travel-map__title">{L('Where to, detective?', '¿Adónde, detective?')}</h2>
        </header>

        <div className="travel-map__frame" style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }}>
          <svg className="travel-map__svg" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <pattern id="travel-map-dots" width="0.22" height="0.22" patternUnits="userSpaceOnUse">
                <circle cx="0.11" cy="0.11" r="0.035" fill="rgba(255,255,255,0.28)" />
              </pattern>
            </defs>
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} className="travel-map__sea" />
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#travel-map-dots)" />
            {shapes && (
              <>
                <path d={shapes.neighbours} className="travel-map__neighbours" />
                <rect
                  className="travel-map__inset"
                  x={project(CANARY_FRAME.west, 0).x}
                  y={project(0, CANARY_FRAME.north).y}
                  width={project(CANARY_FRAME.east, 0).x - project(CANARY_FRAME.west, 0).x}
                  height={CANARY_FRAME.north - CANARY_FRAME.south}
                />
                <path d={shapes.spain} className="travel-map__shadow" transform="translate(0.09 0.11)" />
                <path d={shapes.spain} className="travel-map__spain" />
                <path d={shapes.rivers} className="travel-map__rivers" />
              </>
            )}
          </svg>

          {shapes?.landmarks.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`travel-map__pin${hovered === l.id ? ' is-hot' : ''}`}
              style={place(l.lon, l.lat)}
              aria-label={L(`Fly to ${l.name}, ${l.city}`, `Volar a ${l.name}, ${l.city}`)}
              disabled={closing}
              onMouseEnter={() => setHovered(l.id)}
              onMouseLeave={() => setHovered((h) => (h === l.id ? null : h))}
              onFocus={() => setHovered(l.id)}
              onBlur={() => setHovered((h) => (h === l.id ? null : h))}
              onClick={() => onTravel(l.id)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={GLYPHS[l.glyph]} />
              </svg>
            </button>
          ))}

          {hoveredLandmark && (
            <div className="travel-map__label" style={place(hoveredLandmark.lon, hoveredLandmark.lat)} aria-hidden="true">
              <strong>{hoveredLandmark.name}</strong>
              <span>{hoveredLandmark.city}</span>
            </div>
          )}

          {position && (
            <div className="travel-map__you" style={place(position.lon, position.lat)} aria-label={L('You are here', 'Estás aquí')} role="img">
              <span className="travel-map__you-dot" />
              <span className="travel-map__you-text">{L('You', 'Tú')}</span>
            </div>
          )}

          {!shapes && <p className="travel-map__loading">{error ? L('The map could not be loaded.', 'No se ha podido cargar el mapa.') : L('Unfolding the map…', 'Desplegando el mapa…')}</p>}
        </div>

        <footer className="travel-map__footer">
          <span>
            {L('Click a badge to fly there · ', 'Pulsa una chapa para volar allí · ')}<kbd>M</kbd>{L(' or ', ' o ')}<kbd>Esc</kbd>{L(' to close', ' para cerrar')}
          </span>
          <span className="travel-map__credit">{L('Map: Natural Earth', 'Mapa: Natural Earth')}</span>
        </footer>
      </div>
    </div>
  )
}
