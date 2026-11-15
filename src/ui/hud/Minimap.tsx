// Minimap in the top-right corner: the whole silhouette of Spain (north up) with the detective
// drawn as an arrow at his position, turned to where he faces. The map itself (land, rivers,
// roads, cities, monuments) is drawn once into an offscreen canvas in the game's comic look;
// each HUD tick only redraws that image and moves the arrow, so it stays cheap.
// The Canary Islands are drawn smaller in a dashed box in the south-west corner (shared/canaryBox.ts).
import { useEffect, useRef, useState } from 'react'
import { KM_PER_DEG_LAT, KM_PER_DEG_LON, UNITS_PER_KM } from '../../shared/projection'
import { canaryBox, worldLonLatToReal } from '../../shared/canaryBox'
import './Minimap.css'

/** Offscreen map resolution: pixels per real kilometre (sharp at minimap size on high-DPI screens). */
const PX_PER_KM = 0.6
/** Reference CSS width of the minimap; line widths below are in CSS pixels at this width. */
const REF_CSS_WIDTH = 210
/** Cities with at least this many people get a dot. */
const CITY_MIN_POP = 300_000

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

/** Canary Islands box: in the sea south-west of the peninsula (corner in degrees, scale). */
const CANARY = canaryBox(-9.85, 35.42, 0.55)

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

/** @param spain the points belong to Spain: those in the Canary Islands go into their box */
function tracePath(ctx: CanvasRenderingContext2D, b: Bounds, ring: Ring, close: boolean, spain = true) {
  ring.forEach(([lon, lat], i) => {
    const [x, y] = spain ? toPx(b, ...CANARY.toMap(lon, lat)) : toPx(b, lon, lat)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  if (close) ctx.closePath()
}

/** Dotted sea, like a printed comic (halftone). */
function seaPattern(ctx: CanvasRenderingContext2D, px: number) {
  const s = Math.max(4, Math.round(6 * px))
  const tile = document.createElement('canvas')
  tile.width = tile.height = s
  const t = tile.getContext('2d')!
  t.fillStyle = SEA
  t.fillRect(0, 0, s, s)
  t.fillStyle = SEA_DOT
  for (const [x, y] of [[0.25, 0.25], [0.75, 0.75]]) {
    t.beginPath()
    t.arc(x * s, y * s, s * 0.14, 0, Math.PI * 2)
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
  // A thin margin so the coast never touches the frame
  const b: Bounds = { west: zone.west - 0.35, east: zone.east + 0.35, south: zone.south - 0.3, north: zone.north + 0.3 }
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil((b.east - b.west) * KM_PER_DEG_LON * PX_PER_KM)
  canvas.height = Math.ceil((b.north - b.south) * KM_PER_DEG_LAT * PX_PER_KM)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const px = canvas.width / REF_CSS_WIDTH // offscreen pixels per minimap CSS pixel

  const sea = seaPattern(ctx, px)
  ctx.fillStyle = sea
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Countries: Spain in warm sand, neighbours in grey, all with ink outlines (Spain's thicker)
  const inView = (poly: Ring[]) =>
    poly[0].some(([lon, lat]) => lon > b.west && lon < b.east && lat > b.south && lat < b.north)
  const countries = (world?.countries ?? []).filter((c) => c.polygons.some(inView))
  countries.sort((a, c) => Number(a.id === 'ESP') - Number(c.id === 'ESP')) // Spain last, on top
  for (const country of countries) {
    const spain = country.id === 'ESP'
    if (spain) {
      // Canary Islands box, over the neighbours and under Spain: sea with a dashed ink frame
      const [x0, y0] = toPx(b, CANARY.frame.west, CANARY.frame.north)
      const [x1, y1] = toPx(b, CANARY.frame.east, CANARY.frame.south)
      ctx.fillStyle = sea
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0)
      ctx.strokeStyle = INK
      ctx.lineWidth = 0.9 * px
      ctx.setLineDash([3 * px, 2 * px])
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
      ctx.setLineDash([])
    }
    // The islands in the box are small: a thinner outline, or the ink would cover them
    const boxed = (poly: Ring[]) => spain && CANARY.toMap(poly[0][0][0], poly[0][0][1])[0] !== poly[0][0][0]
    for (const inBox of [false, true]) {
      ctx.beginPath()
      for (const poly of country.polygons) if (boxed(poly) === inBox) for (const ring of poly) tracePath(ctx, b, ring, true, spain)
      ctx.fillStyle = spain ? LAND : NEIGHBOUR
      ctx.fill('evenodd')
      ctx.strokeStyle = INK
      ctx.lineWidth = (inBox ? 0.7 : spain ? 1.6 : 0.9) * px
      ctx.stroke()
    }
  }

  // Rivers: thin blue strokes
  ctx.strokeStyle = RIVER
  ctx.lineWidth = 0.8 * px
  ctx.beginPath()
  for (const river of rivers?.rivers ?? []) for (const line of river.lines) tracePath(ctx, b, line, false)
  ctx.stroke()

  // Roads: ink casing, then a light fill on top
  ctx.beginPath()
  for (const road of roads?.roads ?? []) for (const line of road.lines) tracePath(ctx, b, line, false)
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.2 * px
  ctx.stroke()
  ctx.strokeStyle = ROAD
  ctx.lineWidth = 1.1 * px
  ctx.stroke()

  // Big cities: white dots with an ink ring
  ctx.strokeStyle = INK
  ctx.lineWidth = 0.8 * px
  for (const p of places?.places ?? []) {
    if (p.pop < CITY_MIN_POP) continue
    const [x, y] = toPx(b, ...CANARY.toMap(p.lon, p.lat))
    ctx.beginPath()
    ctx.arc(x, y, (p.pop >= 1_000_000 ? 2.4 : 1.7) * px, 0, Math.PI * 2)
    ctx.fillStyle = CITY
    ctx.fill()
    ctx.stroke()
  }

  // Monuments: small gold diamonds
  for (const lm of landmarks?.landmarks ?? []) {
    const [x, y] = toPx(b, ...CANARY.toMap(lm.lon, lm.lat))
    const r = 2.2 * px
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

/** The detective: a red arrow with a white halo and ink outline, pointing up before rotation. */
function drawArrow(ctx: CanvasRenderingContext2D, size: number) {
  ctx.beginPath()
  ctx.moveTo(0, -size)
  ctx.lineTo(size * 0.72, size * 0.75)
  ctx.lineTo(0, size * 0.38)
  ctx.lineTo(-size * 0.72, size * 0.75)
  ctx.closePath()
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.7
  ctx.strokeStyle = '#ffffff'
  ctx.stroke()
  ctx.lineWidth = size * 0.3
  ctx.strokeStyle = INK
  ctx.stroke()
  ctx.fillStyle = ARROW
  ctx.fill()
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
    const w = Math.round(canvas.clientWidth * dpr)
    const h = Math.round(canvas.clientHeight * dpr)
    if (!w || !h) return
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = SEA
    ctx.fillRect(0, 0, w, h)
    if (!image) return
    // The whole map image is stretched to the canvas (same aspect ratio, set in CSS)
    const scale = w / image.canvas.width
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image.canvas, 0, 0, w, image.canvas.height * scale)

    // World units -> real lon/lat -> where the map draws it (the Canary Islands in their box) -> device pixels
    const [lon, lat] = CANARY.toMap(...worldLonLatToReal(x / UNITS_PER_KM / KM_PER_DEG_LON, -z / UNITS_PER_KM / KM_PER_DEG_LAT))
    const [mx, my] = toPx(image.bounds, lon, lat)
    const ax = mx * scale, ay = my * scale
    // Heading 0 faces north (screen up); forward is (-sin h, -cos h), so the arrow turns by -h
    ctx.setTransform(dpr, 0, 0, dpr, ax, ay)
    ctx.rotate(-heading)
    drawArrow(ctx, Math.max(6, canvas.clientWidth * 0.04))
  }, [image, x, z, heading])

  const aspect = image ? `${image.canvas.width} / ${image.canvas.height}` : undefined
  return (
    <div className="minimap" aria-hidden="true">
      <canvas ref={canvasRef} className="minimap__canvas" style={{ aspectRatio: aspect }} />
      <span className="minimap__north">N</span>
    </div>
  )
}
