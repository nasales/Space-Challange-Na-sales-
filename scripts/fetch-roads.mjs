// Downloads Natural Earth roads ONCE and saves a small, simplified file of a country's MAIN roads:
//   public/maps/countries/<ID>/roads.json
// The web app then works without calling any API at runtime.
//
//   node scripts/fetch-roads.mjs        (defaults to ESP)
//   node scripts/fetch-roads.mjs ESP
//
// Requires public/maps/countries/<ID>/meta.json (scripts/fetch-map-data.mjs) and
// public/maps/world-countries.json (scripts/fetch-world-data.mjs): roads are clipped to the
// explored zones and to the country's own border (no roads of the neighbours).
//
// Source (Natural Earth, public domain, https://www.naturalearthdata.com):
//   - ne_10m_roads : only "Major Highway" (motorways / autovías) and "Secondary Highway"
//                    (primary national roads, N-xxx). Local roads, tracks and ferries are skipped,
//                    so the toy map only shows the big roads.
//
// Output:
//   { "source": "...", "roads": [ { "name": "A6", "rank": 1, "lines": [[[lon, lat], ...], ...] } ] }
//   rank 1 = motorway (wide, dual carriageway look), 2 = primary road.

import { readFileSync, writeFileSync } from 'node:fs'

const id = (process.argv[2] ?? 'ESP').toUpperCase()
const OUT_FILE = `public/maps/countries/${id}/roads.json`
const meta = JSON.parse(readFileSync(`public/maps/countries/${id}/meta.json`, 'utf8'))
const { countries } = JSON.parse(readFileSync('public/maps/world-countries.json', 'utf8'))

const URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_roads.geojson'

const SIMPLIFY_DEG = 0.006 // Douglas–Peucker tolerance (~0.6 km); the game smooths the curves again
const MIN_LINE_DEG = 0.04 // drop clipped pieces shorter than this
const BORDER_SLACK_DEG = 0.03 // keep points this close to the (coarse) border: coast roads survive
const DENSIFY_DEG = 0.02 // split long segments before clipping, so the border cut is precise
const DECIMALS = 4
const RANKS = { 'Major Highway': 1, 'Secondary Highway': 2 }

// ---------- Geometry helpers ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const lineLength = (line) => {
  let l = 0
  for (let i = 1; i < line.length; i++) l += dist(line[i - 1], line[i])
  return l
}

function pointInRing([x, y], ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
/** polygons: [[outer, hole, ...], ...] */
const inPolygons = (p, polygons) => polygons.some((rings) => pointInRing(p, rings[0]) && !rings.slice(1).some((h) => pointInRing(p, h)))

function distToRings(p, polygons) {
  let best = Infinity
  for (const rings of polygons) {
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [ax, ay] = ring[i], [bx, by] = ring[i + 1]
        const dx = bx - ax, dy = by - ay
        const t = Math.min(1, Math.max(0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy || 1e-12)))
        best = Math.min(best, Math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy))
      }
    }
  }
  return best
}

function densify(line, step) {
  const out = [line[0]]
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i]
    const n = Math.ceil(dist(a, b) / step)
    for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
  }
  return out
}

/** Splits a line into the runs of consecutive points that pass `keep`. */
function clipBy(line, keep) {
  const out = []
  let cur = []
  for (const p of line) {
    if (keep(p)) cur.push(p)
    else {
      if (cur.length >= 2) out.push(cur)
      cur = []
    }
  }
  if (cur.length >= 2) out.push(cur)
  return out
}

// Douglas–Peucker simplification (iterative, keeps endpoints).
function simplify(line, tol) {
  if (line.length <= 2) return line
  const keep = new Uint8Array(line.length)
  keep[0] = keep[line.length - 1] = 1
  const stack = [[0, line.length - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()
    const [ax, ay] = line[s]
    const [bx, by] = line[e]
    const len = Math.hypot(bx - ax, by - ay)
    let maxD = -1
    let idx = -1
    for (let i = s + 1; i < e; i++) {
      const [px, py] = line[i]
      const d = len === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (maxD > tol) {
      keep[idx] = 1
      stack.push([s, idx], [idx, e])
    }
  }
  return line.filter((_, i) => keep[i])
}

const round = (v) => +v.toFixed(DECIMALS)

// Join lines whose ends touch (Natural Earth splits roads at every junction).
function joinLines(lines) {
  const eps = 1e-6
  const same = (a, b) => Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps
  const pool = lines.map((l) => l.slice())
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < pool.length && !changed; i++) {
      for (let j = 0; j < pool.length && !changed; j++) {
        if (i === j) continue
        const a = pool[i]
        const b = pool[j]
        if (same(a[a.length - 1], b[0])) pool[i] = a.concat(b.slice(1))
        else if (same(a[a.length - 1], b[b.length - 1])) pool[i] = a.concat(b.slice(0, -1).reverse())
        else continue
        pool.splice(j, 1)
        changed = true
      }
    }
  }
  return pool
}

// ---------- Download and process ----------
const own = countries.find((c) => c.id === id)
if (!own) throw new Error(`Country ${id} not found in world-countries.json`)
const boxes = meta.zones.map((z) => z.bounds)
const inBox = ([lon, lat], b) => lon >= b.west && lon <= b.east && lat >= b.south && lat <= b.north
// Neighbours whose polygons touch the zones: a point inside one of them is never ours
const neighbours = countries
  .filter((c) => c.id !== id)
  .map((c) => c.polygons)
  .filter((polys) => polys.some((rings) => rings[0].some((p) => boxes.some((b) => inBox(p, b)))))
const keepPoint = (p) => {
  if (!boxes.some((b) => inBox(p, b))) return false
  if (inPolygons(p, own.polygons)) return true
  if (neighbours.some((polys) => inPolygons(p, polys))) return false
  return distToRings(p, own.polygons) < BORDER_SLACK_DEG
}

console.log(`Downloading ${URL}`)
const res = await fetch(URL)
if (!res.ok) throw new Error(`HTTP ${res.status} for ${URL}`)
const geo = await res.json()

const roads = new Map() // name|rank -> { name, rank, lines }
for (const f of geo.features) {
  const rank = RANKS[f.properties.type]
  if (!rank || !f.geometry) continue
  const bb = f.bbox
  if (bb && !boxes.some((b) => bb[0] <= b.east && bb[2] >= b.west && bb[1] <= b.north && bb[3] >= b.south)) continue
  const name = f.properties.label || f.properties.name || ''
  const parts = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates
  const clipped = parts.flatMap((line) => clipBy(densify(line, DENSIFY_DEG), keepPoint))
  if (!clipped.length) continue
  const key = `${name}|${rank}`
  const r = roads.get(key) ?? { name, rank, lines: [] }
  r.lines.push(...clipped)
  roads.set(key, r)
}

const result = []
for (const r of roads.values()) {
  const lines = joinLines(r.lines)
    .filter((l) => lineLength(l) >= MIN_LINE_DEG)
    .map((l) => simplify(l, SIMPLIFY_DEG).map(([x, y]) => [round(x), round(y)]))
    .filter((l) => l.length >= 2)
  if (!lines.length) continue
  result.push({ name: r.name, rank: r.rank, lines, _len: lines.reduce((s, l) => s + lineLength(l), 0) })
}
result.sort((a, b) => a.rank - b.rank || b._len - a._len)
for (const r of result) delete r._len

const out = {
  source: 'Natural Earth 10m roads, major and secondary highways only (public domain)',
  roads: result,
}
writeFileSync(OUT_FILE, JSON.stringify(out))
const points = result.reduce((s, r) => s + r.lines.reduce((t, l) => t + l.length, 0), 0)
const lines = result.reduce((s, r) => s + r.lines.length, 0)
console.log(`Saved ${OUT_FILE}: ${result.length} roads, ${lines} lines, ${points} points`)
for (const rank of [1, 2]) console.log(`  rank ${rank}: ${result.filter((r) => r.rank === rank).length} roads`)
