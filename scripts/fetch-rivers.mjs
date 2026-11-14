// Downloads Natural Earth river centerlines ONCE and saves a small, simplified file for a country:
//   public/maps/countries/<ID>/rivers.json
// The web app then works without calling any API at runtime.
//
//   node scripts/fetch-rivers.mjs        (defaults to ESP)
//   node scripts/fetch-rivers.mjs ESP
//
// Requires public/maps/countries/<ID>/meta.json (produced by scripts/fetch-map-data.mjs):
// rivers are clipped to the bounds of each explored zone.
//
// Sources (Natural Earth, public domain, https://www.naturalearthdata.com):
//   - ne_10m_rivers_lake_centerlines : the big rivers (Tajo, Ebro, Duero...)
//   - ne_10m_rivers_europe           : extra European detail (Júcar, Segura, Turia, Genil...)
//
// Output:
//   { "source": "...", "rivers": [ { "name": "Tajo", "rank": 1, "lines": [[[lon, lat], ...], ...] } ] }
//   rank 1 = big main river (wide line), 2 = medium, 3 = small.

import { readFileSync, writeFileSync } from 'node:fs'

const id = (process.argv[2] ?? 'ESP').toUpperCase()
const OUT_FILE = `public/maps/countries/${id}/rivers.json`
const meta = JSON.parse(readFileSync(`public/maps/countries/${id}/meta.json`, 'utf8'))

const NE_BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'
const SOURCES = [
  { file: 'ne_10m_rivers_lake_centerlines.geojson', europe: false },
  { file: 'ne_10m_rivers_europe.geojson', europe: true },
]

const SIMPLIFY_DEG = 0.01 // Douglas–Peucker tolerance
const MIN_LINE_DEG = 0.05 // drop clipped pieces shorter than this
const MIN_RIVER_DEG = 0.3 // drop rivers whose total length inside the zones is shorter than this
const DECIMALS = 4

// The five big Iberian rivers are drawn widest.
const MAIN_RIVERS = new Set(['Tajo', 'Ebro', 'Duero', 'Guadiana', 'Guadalquivir'])
// Well-known Spanish rivers that Natural Earth ranks as minor (scalerank 11) but we want medium.
const MEDIUM_RIVERS = new Set(['Turia', 'Genil'])

// Name fixes: Natural Earth 10m centerlines lost some accented characters ("Mio" = Miño),
// Portuguese spellings are merged into the Spanish name of the same river, and one
// Europe feature is mislabelled "Alagón" while it is the Aragón (Navarra/Aragón, near 42.5N).
const RENAME = { Mio: 'Miño', Minho: 'Miño', Zncara: 'Záncara', Tejo: 'Tajo' }
function riverName(props, bbox) {
  let name = props.name
  if (!name) return null
  if (name === 'Alagón' && bbox && bbox[0] > -3) name = 'Aragón'
  return RENAME[name] ?? name
}

// ---------- Geometry helpers ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
const lineLength = (line) => {
  let l = 0
  for (let i = 1; i < line.length; i++) l += dist(line[i - 1], line[i])
  return l
}

// Liang–Barsky: clip segment p→q to the box; returns [t0, t1] or null.
function clipSegment(p, q, b) {
  const dx = q[0] - p[0]
  const dy = q[1] - p[1]
  let t0 = 0
  let t1 = 1
  const checks = [
    [-dx, p[0] - b.west],
    [dx, b.east - p[0]],
    [-dy, p[1] - b.south],
    [dy, b.north - p[1]],
  ]
  for (const [pk, qk] of checks) {
    if (pk === 0) {
      if (qk < 0) return null
    } else {
      const r = qk / pk
      if (pk < 0) {
        if (r > t1) return null
        if (r > t0) t0 = r
      } else {
        if (r < t0) return null
        if (r < t1) t1 = r
      }
    }
  }
  return [t0, t1]
}
const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]

// Clip a polyline to a box, splitting it where it leaves and re-enters.
function clipLine(line, b) {
  const out = []
  let cur = null
  for (let i = 1; i < line.length; i++) {
    const p = line[i - 1]
    const q = line[i]
    const c = clipSegment(p, q, b)
    if (!c) {
      if (cur) out.push(cur)
      cur = null
      continue
    }
    const a = lerp(p, q, c[0])
    const e = lerp(p, q, c[1])
    if (!cur) cur = [a]
    cur.push(e)
    if (c[1] < 1) {
      out.push(cur)
      cur = null
    }
  }
  if (cur) out.push(cur)
  return out.filter((l) => l.length >= 2)
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
      const d =
        len === 0
          ? Math.hypot(px - ax, py - ay)
          : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len
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

// Join lines whose ends touch (Natural Earth splits rivers at lakes/reservoirs).
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
const boxes = meta.zones.map((z) => z.bounds)
const rivers = new Map() // name -> { rank, lines }

for (const src of SOURCES) {
  const url = `${NE_BASE}/${src.file}`
  console.log(`Downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const geo = await res.json()

  for (const f of geo.features) {
    if (!f.geometry) continue
    const name = riverName(f.properties, f.bbox)
    if (!name) continue // unnamed fragments are skipped
    const sr = f.properties.scalerank
    const rank = MAIN_RIVERS.has(name) ? 1 : MEDIUM_RIVERS.has(name) || !src.europe || sr <= 10 ? 2 : 3

    const parts =
      f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates
    const clipped = []
    for (const line of parts) for (const b of boxes) clipped.push(...clipLine(line, b))
    if (!clipped.length) continue

    const r = rivers.get(name) ?? { name, rank, lines: [] }
    r.rank = Math.min(r.rank, rank)
    r.lines.push(...clipped)
    rivers.set(name, r)
  }
}

const result = []
for (const r of rivers.values()) {
  const lines = joinLines(r.lines)
    .filter((l) => lineLength(l) >= MIN_LINE_DEG)
    .map((l) => simplify(l, SIMPLIFY_DEG).map(([x, y]) => [round(x), round(y)]))
    .filter((l) => l.length >= 2)
  const total = lines.reduce((s, l) => s + lineLength(l), 0)
  if (total < MIN_RIVER_DEG) continue
  result.push({ name: r.name, rank: r.rank, lines, _len: total })
}
result.sort((a, b) => a.rank - b.rank || b._len - a._len)
for (const r of result) delete r._len

const out = {
  source: 'Natural Earth 10m rivers and lake centerlines + Europe supplement (public domain)',
  rivers: result,
}
writeFileSync(OUT_FILE, JSON.stringify(out))
const points = result.reduce((s, r) => s + r.lines.reduce((t, l) => t + l.length, 0), 0)
console.log(`Saved ${OUT_FILE}: ${result.length} rivers, ${points} points`)
for (const r of result) console.log(`  [${r.rank}] ${r.name} (${r.lines.length} lines)`)
