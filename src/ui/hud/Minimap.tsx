// Round minimap in the top-right corner: north up, centred on the detective, who is drawn as an
// arrow turned to where he faces. The map itself (land, rivers, roads, cities, monuments) is drawn
// once into an offscreen canvas in the game's comic look; each HUD tick only copies the part
// around the detective, so it stays cheap.
import { useEffect, useRef, useState } from 'react'
import { KM_PER_DEG_LAT, KM_PER_DEG_LON, UNITS_PER_KM } from '../../shared/projection'
import './Minimap.css'

/** Offscreen map resolution: pixels per real kilometre (2 = sharp on high-DPI screens). */
const PX_PER_KM = 2
/** Kilometres shown per CSS pixel of the minimap (a 170 px map shows about 170 km). */
const KM_PER_CSS_PX = 1
/** Cities with at least this many people get a dot. */
const CITY_MIN_POP = 100_000

const INK = '#1A1423'
const SEA = '#6fc3e4'
const SEA_DOT = '#5bb0d4'
const LAND = '#f6d488'
const NEIGHBOUR = '#ddd2c0'
const RIVER = '#3a8fd0'
const ROAD = '#fff3d1'
const CITY = '#ffffff'
const LANDMARK = '#f2c14e'
const ARROW = '#e5322d'

const COUNTRY_DIR = '/maps/countries/ESP/'

interface Bounds { west: number; east: number; south: number; north: number }
type Ring = [number, number][]
interface MapImage {
  canvas: HTMLCanvasElement
  bounds: Bounds
}

const getJson = <T,>(url: string): Promise<T | null> =>
  fetch(url).then((r) => (r.ok ? (r.json() as Promise<T>) : null)).catch(() => null)

/** Lon/lat -> offscreen pixel (equirectangular, same scale as the 3D world). */
const toPx = (b: Bounds, lon: number, lat: number): [number, number] => [
  (lon - b.west) * KM_PER_DEG_LON * PX_PER_KM,
  (b.north - lat) * KM_PER_DEG_LAT * PX_PER_KM,
]

function tracePath(ctx: CanvasRenderingContext2D, b: Bounds, ring: Ring, close: boolean) {
  ring.forEach(([lon, lat], i) => {
    const [x, y] = toPx(b, lon, lat)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  if (close) ctx.closePath()
}

/** Dotted sea, like a printed comic (halftone). */
function seaPattern(ctx: CanvasRenderingContext2D) {
  const tile = document.createElement('canvas')
  tile.width = tile.height = 10
  const t = tile.getContext('2d')!
  t.fillStyle = SEA
  t.fillRect(0, 0, 10, 10)
  t.fillStyle = SEA_DOT
  for (const [x, y] of [[2.5, 2.5], [7.5, 7.5]]) {
    t.beginPath()
    t.arc(x, y, 1.6, 0, Math.PI * 2)
    t.fill()
  }
  return ctx.createPattern(tile, 'repeat') ?? SEA
}

async function buildMapImage(): Promise<MapImage | null> {
  const [meta, world, rivers, roads, places, landmarks] = await Promise.all([
    getJson<{ zones: { bounds: Bounds }[] }>(`${COUNTRY_DIR}meta.json`),
    getJson<{ countries: { id: string; polygons: Ring[][] }[] }>('/maps/world-countries.json'),
    getJson<{ rivers: { lines: Ring[] }[] }>(`${COUNTRY_DIR}rivers.json`),
    getJson<{ roads: { lines: Ring[] }[] }>(`${COUNTRY_DIR}roads.json`),
    getJson<{ places: { lat: number; lon: number; pop: number }[] }>(`${COUNTRY_DIR}places.json`),
    getJson<{ landmarks: { lat: number; lon: number }[] }>(`${COUNTRY_DIR}landmarks.json`),
  ])
  const zone = meta?.zones[0]?.bounds // mainland Spain and the Balearic Islands
  if (!zone) return null
  // A little margin so the coast never touches the edge of the image
  const b: Bounds = { west: zone.west - 1, east: zone.east + 1, south: zone.south - 0.8, north: zone.north + 0.8 }
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil((b.east - b.west) * KM_PER_DEG_LON * PX_PER_KM)
  canvas.height = Math.ceil((b.north - b.south) * KM_PER_DEG_LAT * PX_PER_KM)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const px = PX_PER_KM / KM_PER_CSS_PX // offscreen pixels per minimap CSS pixel

  ctx.fillStyle = seaPattern(ctx)
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Countries: Spain in warm sand, neighbours in grey, all with ink outlines (Spain's thicker)
  const inView = (poly: Ring[]) =>
    poly[0].some(([lon, lat]) => lon > b.west && lon < b.east && lat > b.south && lat < b.north)
  const countries = (world?.countries ?? []).filter((c) => c.polygons.some(inView))
  countries.sort((a, c) => Number(a.id === 'ESP') - Number(c.id === 'ESP')) // Spain last, on top
  for (const country of countries) {
    const spain = country.id === 'ESP'
    ctx.beginPath()
    for (const poly of country.polygons) for (const ring of poly) tracePath(ctx, b, ring, true)
    ctx.fillStyle = spain ? LAND : NEIGHBOUR
    ctx.fill('evenodd')
    ctx.strokeStyle = INK
    ctx.lineWidth = (spain ? 2.5 : 1.5) * px
    ctx.stroke()
  }

  // Rivers: plain blue strokes
  ctx.strokeStyle = RIVER
  ctx.lineWidth = 1.4 * px
  ctx.beginPath()
  for (const river of rivers?.rivers ?? []) for (const line of river.lines) tracePath(ctx, b, line, false)
  ctx.stroke()

  // Roads: ink casing, then a light fill on top
  const roadPath = () => {
    ctx.beginPath()
    for (const road of roads?.roads ?? []) for (const line of road.lines) tracePath(ctx, b, line, false)
  }
  roadPath()
  ctx.strokeStyle = INK
  ctx.lineWidth = 4 * px
  ctx.stroke()
  ctx.strokeStyle = ROAD
  ctx.lineWidth = 2 * px
  ctx.stroke()

  // Cities: white dots with an ink ring, bigger for bigger cities
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.2 * px
  for (const p of places?.places ?? []) {
    if (p.pop < CITY_MIN_POP) continue
    const [x, y] = toPx(b, p.lon, p.lat)
    ctx.beginPath()
    ctx.arc(x, y, (p.pop >= 1_000_000 ? 3.6 : p.pop >= 300_000 ? 2.8 : 2.1) * px, 0, Math.PI * 2)
    ctx.fillStyle = CITY
    ctx.fill()
    ctx.stroke()
  }

  // Monuments: small gold diamonds
  for (const lm of landmarks?.landmarks ?? []) {
    const [x, y] = toPx(b, lm.lon, lm.lat)
    const r = 3.2 * px
    ctx.beginPath()
    ctx.moveTo(x, y - r)
    ctx.lineTo(x + r, y)
    ctx.lineTo(x, y + r)
    ctx.lineTo(x - r, y)
    ctx.closePath()
    ctx.fillStyle = LANDMARK
    ctx.fill()
    ctx.stroke()
  }
  return { canvas, bounds: b }
}

// Built once per page load and shared by every minimap mount
let mapImagePromise: Promise<MapImage | null> | null = null
const loadMapImage = () => (mapImagePromise ??= buildMapImage())

/** The detective: a red arrow with an ink outline, pointing up before rotation. */
function drawArrow(ctx: CanvasRenderingContext2D, size: number) {
  ctx.beginPath()
  ctx.moveTo(0, -size)
  ctx.lineTo(size * 0.72, size * 0.75)
  ctx.lineTo(0, size * 0.38)
  ctx.lineTo(-size * 0.72, size * 0.75)
  ctx.closePath()
  ctx.fillStyle = ARROW
  ctx.fill()
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.28
  ctx.strokeStyle = INK
  ctx.stroke()
}

export default function Minimap({ x, z, heading }: { x: number; z: number; heading: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<MapImage | null>(null)

  useEffect(() => {
    let alive = true
    loadMapImage().then((img) => alive && setImage(img))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    const cssSize = canvas.clientWidth
    const size = Math.round(cssSize * dpr)
    if (canvas.width !== size || canvas.height !== size) canvas.width = canvas.height = size

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = SEA
    ctx.fillRect(0, 0, size, size)
    if (image) {
      // World units -> offscreen pixels, then offscreen pixels -> device pixels of this canvas
      const ox = ((x / UNITS_PER_KM) - image.bounds.west * KM_PER_DEG_LON) * PX_PER_KM
      const oz = ((z / UNITS_PER_KM) + image.bounds.north * KM_PER_DEG_LAT) * PX_PER_KM
      const scale = dpr / (PX_PER_KM * KM_PER_CSS_PX)
      ctx.imageSmoothingEnabled = true
      ctx.setTransform(scale, 0, 0, scale, size / 2 - ox * scale, size / 2 - oz * scale)
      ctx.drawImage(image.canvas, 0, 0)
    }
    // Heading 0 faces north (screen up); forward is (-sin h, -cos h), so the arrow turns by -h
    ctx.setTransform(dpr, 0, 0, dpr, size / 2, size / 2)
    ctx.rotate(-heading)
    drawArrow(ctx, Math.max(7, cssSize * 0.055))
  }, [image, x, z, heading])

  return (
    <div className="minimap" aria-hidden="true">
      <canvas ref={canvasRef} className="minimap__canvas" />
      <span className="minimap__north">N</span>
    </div>
  )
}
