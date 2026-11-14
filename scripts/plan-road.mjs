// Plans ONE closed road that loops through mainland Spain, offline, from the map data already in
// the repo (no download), and saves it as public/maps/countries/<ID>/roads.json.
//
//   node scripts/plan-road.mjs        (defaults to ESP)
//
// Inputs: meta.json + zone-0-height.bin (relief), world-countries.json (border), rivers.json,
// landmarks.json and places.json. How the route is found:
//   1. a cost map on the height grid (2x coarser): steep ground is expensive (the road follows
//      valleys and plateaus); the coast strip and anything outside the mainland are expensive or
//      closed; monument areas are closed; every river cell costs a lot (few crossings, narrow
//      rivers preferred) and the band next to a river costs a little (never run along it);
//      town centres cost a little (the road skirts them);
//   2. a few LOOSE anchor regions in the interior, in loop order; each one picks its easiest
//      cell inside its radius;
//   3. the legs between anchors are found with A*; a leg that is too costly drops its anchor
//      (the neighbours are joined instead); each leg makes the cells of the previous legs
//      expensive, so the loop never runs over or along itself;
//   4. the path is simplified, smoothed (Chaikin) and given a gentle low-frequency meander where
//      the ground is easy, then checked again against the cost map.
// Output (same format as before): { "source", "roads": [ { "name", "rank": 2, "lines": [loop] } ] }
// The single line is closed: its last point equals its first.

import { readFileSync, writeFileSync } from 'node:fs'

const id = (process.argv[2] ?? 'ESP').toUpperCase()
const DIR = `public/maps/countries/${id}/`
const OUT_FILE = `${DIR}roads.json`
const meta = JSON.parse(readFileSync(`${DIR}meta.json`, 'utf8'))
const { countries } = JSON.parse(readFileSync('public/maps/world-countries.json', 'utf8'))
const rivers = JSON.parse(readFileSync(`${DIR}rivers.json`, 'utf8')).rivers
const landmarks = JSON.parse(readFileSync(`${DIR}landmarks.json`, 'utf8')).landmarks
const places = JSON.parse(readFileSync(`${DIR}places.json`, 'utf8')).places

const ROAD_NAME = "The Detective's Road"
const DOWNSAMPLE = 2 // cost grid = height grid / 2 (~1.2 km cells)
const START = [-3.7, 40.4] // a point surely on the mainland (Madrid)
// Cost terms (1 = one km of easy flat ground)
const GRADE = 0.035 // a 3.5 % grade doubles the cost of a step
const GRADE_MAX = 40
const COAST_CLOSED_KM = 2 // closed this close to the sea
const COAST_SOFT_KM = 8 // extra cost from 2 to 8 km
const COAST_SOFT = 6
const MONUMENT_KM = 40 // monuments are big on the toy map: their whole area is closed
const RIVER_CELL = { 1: 250, 2: 220, 3: 160 } // per river cell entered: few crossings, narrow rivers preferred
const RIVER_BAND_KM = 3.5 // band next to a river
const RIVER_BAND = 3
const RIVER_HALF_KM = { 1: 1.7, 2: 1.0, 3: 0.65 }
const TOWN_POP = 15000
const TOWN = 4
const USED_KM = 10 // previous legs make this band around them expensive
const USED = 60
const LEG_RATIO_MAX = 14 // a leg costing more than this per straight km drops its anchor
// Loose anchor regions in loop order (lon, lat, radius km); none is an exact city
const ANCHORS = [
  { name: 'Castilla y León (Tierra de Campos)', lon: -4.9, lat: 41.95, r: 45 },
  { name: 'La Rioja / Ebro plains', lon: -2.15, lat: 42.25, r: 35 },
  { name: 'Aragón (Monegros)', lon: -0.35, lat: 41.55, r: 45 },
  { name: 'Lleida plain', lon: 0.9, lat: 41.65, r: 30 },
  { name: 'Teruel uplands', lon: -1.05, lat: 40.5, r: 40 },
  { name: 'Valencia interior', lon: -0.95, lat: 39.3, r: 35 },
  { name: 'Murcia interior', lon: -1.7, lat: 38.2, r: 35 },
  { name: 'Baza / Guadix highlands', lon: -2.75, lat: 37.45, r: 30 },
  { name: 'Interior Andalucía (Campiña)', lon: -4.5, lat: 37.45, r: 40 },
  { name: 'Sierra Morena west', lon: -6.1, lat: 38.05, r: 35 },
  { name: 'Extremadura (Vegas)', lon: -6.15, lat: 39.05, r: 45 },
  { name: 'La Mancha', lon: -3.1, lat: 39.25, r: 50 },
  { name: 'Alcarria', lon: -2.55, lat: 40.55, r: 35 },
  { name: 'Salamanca fields', lon: -5.75, lat: 40.9, r: 40 },
  { name: 'Zamora / Sanabria edge', lon: -6.15, lat: 41.75, r: 35 },
]

// ---------- Grid ----------
const zone = meta.zones[0]
const B = zone.bounds
const W0 = zone.height.width, H0 = zone.height.height
const raw = readFileSync(DIR + zone.height.file)
const h0 = new Int16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength))
const w = Math.ceil(W0 / DOWNSAMPLE), h = Math.ceil(H0 / DOWNSAMPLE)
const N = w * h
const KX = 111.32 * Math.cos((40 * Math.PI) / 180)
const KY = 110.57
const lonOf = (c) => B.west + ((c * DOWNSAMPLE) / (W0 - 1)) * (B.east - B.west)
const latOf = (r) => B.north - ((r * DOWNSAMPLE) / (H0 - 1)) * (B.north - B.south)
const colOf = (lon) => ((lon - B.west) / (B.east - B.west)) * (W0 - 1) / DOWNSAMPLE
const rowOf = (lat) => ((B.north - lat) / (B.north - B.south)) * (H0 - 1) / DOWNSAMPLE
const cellKmX = ((B.east - B.west) * KX * DOWNSAMPLE) / (W0 - 1)
const cellKmY = ((B.north - B.south) * KY * DOWNSAMPLE) / (H0 - 1)
const cellOf = (lon, lat) => Math.round(rowOf(lat)) * w + Math.round(colOf(lon))

const height = new Float32Array(N)
for (let r = 0; r < h; r++) {
  for (let c = 0; c < w; c++) {
    let s = 0, n = 0
    for (let dr = 0; dr < DOWNSAMPLE; dr++) {
      for (let dc = 0; dc < DOWNSAMPLE; dc++) {
        const rr = r * DOWNSAMPLE + dr, cc = c * DOWNSAMPLE + dc
        if (rr < H0 && cc < W0) {
          s += h0[rr * W0 + cc]
          n++
        }
      }
    }
    height[r * w + c] = s / n
  }
}

// Country mask (even-odd scanline fill of the border polygons) and land
const own = countries.find((c) => c.id === id)
const inside = new Uint8Array(N)
for (let r = 0; r < h; r++) {
  const lat = latOf(r)
  const xs = []
  for (const poly of own.polygons) {
    for (const ring of poly) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length]
        if (a[1] > lat !== b[1] > lat) xs.push(colOf(a[0] + ((lat - a[1]) / (b[1] - a[1])) * (b[0] - a[0])))
      }
    }
  }
  xs.sort((p, q) => p - q)
  for (let k = 0; k + 1 < xs.length; k += 2) {
    for (let c = Math.max(0, Math.ceil(xs[k])); c <= Math.min(w - 1, Math.floor(xs[k + 1])); c++) inside[r * w + c] = 1
  }
}
// Mainland: the land region connected to START
const mainland = new Uint8Array(N)
{
  const start = cellOf(START[0], START[1])
  const stack = [start]
  mainland[start] = 1
  while (stack.length) {
    const i = stack.pop()
    const r = Math.floor(i / w), c = i % w
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = r + dr, cc = c + dc
      if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue
      const j = rr * w + cc
      if (!mainland[j] && inside[j] && height[j] > 0) {
        mainland[j] = 1
        stack.push(j)
      }
    }
  }
}

/** Two-pass chamfer distance (km) to the nearest cell where `seed` is true. */
function distanceKm(seed) {
  const d = new Float32Array(N)
  for (let i = 0; i < N; i++) d[i] = seed(i) ? 0 : 1e9
  const dx = cellKmX, dy = cellKmY, dd = Math.hypot(dx, dy)
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c
      let v = d[i]
      if (c > 0) v = Math.min(v, d[i - 1] + dx)
      if (r > 0) {
        v = Math.min(v, d[i - w] + dy)
        if (c > 0) v = Math.min(v, d[i - w - 1] + dd)
        if (c < w - 1) v = Math.min(v, d[i - w + 1] + dd)
      }
      d[i] = v
    }
  }
  for (let r = h - 1; r >= 0; r--) {
    for (let c = w - 1; c >= 0; c--) {
      const i = r * w + c
      let v = d[i]
      if (c < w - 1) v = Math.min(v, d[i + 1] + dx)
      if (r < h - 1) {
        v = Math.min(v, d[i + w] + dy)
        if (c < w - 1) v = Math.min(v, d[i + w + 1] + dd)
        if (c > 0) v = Math.min(v, d[i + w - 1] + dd)
      }
      d[i] = v
    }
  }
  return d
}
const coastKm = distanceKm((i) => !mainland[i])

// Rivers: cells of water (with the rank of the river) and distance to the nearest water
const riverRank = new Uint8Array(N)
const riverSegs = []
for (const river of rivers) {
  for (const line of river.lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const [a, b] = [line[i], line[i + 1]]
      riverSegs.push({ a, b, rank: river.rank })
      const steps = Math.ceil(Math.hypot((b[0] - a[0]) * KX, (b[1] - a[1]) * KY) / (cellKmX * 0.4)) + 1
      const half = RIVER_HALF_KM[river.rank]
      const rc = Math.ceil(half / cellKmX)
      for (let s = 0; s <= steps; s++) {
        const lon = a[0] + ((b[0] - a[0]) * s) / steps, lat = a[1] + ((b[1] - a[1]) * s) / steps
        const c0 = Math.round(colOf(lon)), r0 = Math.round(rowOf(lat))
        for (let dr = -rc; dr <= rc; dr++) {
          for (let dc = -rc; dc <= rc; dc++) {
            if (Math.hypot(dc * cellKmX, dr * cellKmY) > half + cellKmX * 0.5) continue
            const rr = r0 + dr, cc = c0 + dc
            if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue
            const j = rr * w + cc
            if (!riverRank[j] || river.rank < riverRank[j]) riverRank[j] = river.rank
          }
        }
      }
    }
  }
}
const riverKm = distanceKm((i) => riverRank[i] > 0)

// Static cost of standing in a cell (per km), Infinity = closed
const cellCost = new Float32Array(N)
for (let i = 0; i < N; i++) {
  if (!mainland[i] || coastKm[i] < COAST_CLOSED_KM) {
    cellCost[i] = Infinity
    continue
  }
  let k = 1
  if (coastKm[i] < COAST_SOFT_KM) k += COAST_SOFT * (1 - (coastKm[i] - COAST_CLOSED_KM) / (COAST_SOFT_KM - COAST_CLOSED_KM))
  if (!riverRank[i] && riverKm[i] < RIVER_BAND_KM) k += RIVER_BAND * (1 - riverKm[i] / RIVER_BAND_KM)
  cellCost[i] = k
}
const closeDisc = (lon, lat, km, value, add) => {
  const r0 = rowOf(lat), c0 = colOf(lon)
  const rr = Math.ceil(km / cellKmY), cr = Math.ceil(km / cellKmX)
  for (let r = Math.floor(r0 - rr); r <= Math.ceil(r0 + rr); r++) {
    for (let c = Math.floor(c0 - cr); c <= Math.ceil(c0 + cr); c++) {
      if (r < 0 || c < 0 || r >= h || c >= w) continue
      const d = Math.hypot((c - c0) * cellKmX, (r - r0) * cellKmY)
      if (d > km) continue
      const i = r * w + c
      cellCost[i] = add ? cellCost[i] + value * (1 - d / km) : value
    }
  }
}
for (const l of landmarks) closeDisc(l.lon, l.lat, MONUMENT_KM, Infinity, false)
for (const p of places) {
  if (p.pop < TOWN_POP) continue
  closeDisc(p.lon, p.lat, 2 + 2.5 * Math.log10(p.pop / TOWN_POP), TOWN, true)
}

// ---------- A* ----------
const used = new Float32Array(N) // extra cost from previous legs
const g = new Float64Array(N)
const came = new Int32Array(N)
const NEIGH = [
  [0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1],
]
function stepCost(a, b) {
  const ca = cellCost[a], cb = cellCost[b]
  if (!Number.isFinite(cb) || !Number.isFinite(ca)) return Infinity
  const ra = Math.floor(a / w), rb = Math.floor(b / w)
  const len = Math.hypot(((b % w) - (a % w)) * cellKmX, (rb - ra) * cellKmY)
  const grade = Math.abs(height[b] - height[a]) / (len * 1000)
  const slope = Math.min(GRADE_MAX, (grade / GRADE) ** 2)
  let cost = len * ((ca + cb) / 2 + slope + used[b])
  if (riverRank[b] && riverRank[b] !== riverRank[a]) cost += RIVER_CELL[riverRank[b]] // entering a river
  else if (riverRank[b]) cost += RIVER_CELL[riverRank[b]] * 0.5 // still in it (wide rivers cost more)
  return cost
}
function astar(from, to) {
  g.fill(Infinity)
  came.fill(-1)
  const tr = Math.floor(to / w), tc = to % w
  const hfun = (i) => Math.hypot(((i % w) - tc) * cellKmX, (Math.floor(i / w) - tr) * cellKmY)
  let heapIdx = new Int32Array(1 << 16), heapF = new Float64Array(1 << 16), size = 0
  const push = (i, f) => {
    if (size === heapIdx.length) {
      const ni = new Int32Array(size * 2), nf = new Float64Array(size * 2)
      ni.set(heapIdx)
      nf.set(heapF)
      heapIdx = ni
      heapF = nf
    }
    let k = size++
    while (k > 0) {
      const p = (k - 1) >> 1
      if (heapF[p] <= f) break
      heapIdx[k] = heapIdx[p]
      heapF[k] = heapF[p]
      k = p
    }
    heapIdx[k] = i
    heapF[k] = f
  }
  const pop = () => {
    const top = heapIdx[0]
    const li = heapIdx[--size], lf = heapF[size]
    let k = 0
    for (;;) {
      let m = 2 * k + 1
      if (m >= size) break
      if (m + 1 < size && heapF[m + 1] < heapF[m]) m++
      if (heapF[m] >= lf) break
      heapIdx[k] = heapIdx[m]
      heapF[k] = heapF[m]
      k = m
    }
    heapIdx[k] = li
    heapF[k] = lf
    return top
  }
  g[from] = 0
  push(from, hfun(from))
  while (size) {
    const i = pop()
    if (i === to) break
    const r = Math.floor(i / w), c = i % w
    for (const [dr, dc] of NEIGH) {
      const rr = r + dr, cc = c + dc
      if (rr < 0 || cc < 0 || rr >= h || cc >= w) continue
      const j = rr * w + cc
      const ng = g[i] + stepCost(i, j)
      if (ng < g[j]) {
        g[j] = ng
        came[j] = i
        push(j, ng + hfun(j))
      }
    }
  }
  if (!Number.isFinite(g[to])) return null
  const path = []
  for (let i = to; i !== -1; i = came[i]) path.push(i)
  return { cost: g[to], path: path.reverse() }
}

// ---------- Anchors ----------
const roughness = (i) => {
  const r = Math.floor(i / w), c = i % w
  let m = 0
  for (const [dr, dc] of NEIGH) {
    const rr = r + dr, cc = c + dc
    if (rr >= 0 && cc >= 0 && rr < h && cc < w) m = Math.max(m, Math.abs(height[rr * w + cc] - height[i]))
  }
  return m
}
const anchors = []
for (const a of ANCHORS) {
  let best = -1, bestScore = Infinity
  const r0 = rowOf(a.lat), c0 = colOf(a.lon)
  for (let r = Math.floor(r0 - a.r / cellKmY); r <= Math.ceil(r0 + a.r / cellKmY); r++) {
    for (let c = Math.floor(c0 - a.r / cellKmX); c <= Math.ceil(c0 + a.r / cellKmX); c++) {
      if (r < 0 || c < 0 || r >= h || c >= w) continue
      const d = Math.hypot((c - c0) * cellKmX, (r - r0) * cellKmY)
      if (d > a.r) continue
      const i = r * w + c
      if (!Number.isFinite(cellCost[i]) || riverRank[i] || riverKm[i] < RIVER_BAND_KM) continue
      // easy, flat ground; a slight pull to the region centre
      const score = cellCost[i] * 10 + roughness(i) * 0.4 + d * 0.05
      if (score < bestScore) {
        bestScore = score
        best = i
      }
    }
  }
  if (best >= 0) anchors.push({ ...a, cell: best })
  else console.log(`Anchor dropped (no open cell): ${a.name}`)
}

// ---------- Legs ----------
const markUsed = (path) => {
  const rr = Math.ceil(USED_KM / cellKmY), cr = Math.ceil(USED_KM / cellKmX)
  for (const i of path) {
    const r0 = Math.floor(i / w), c0 = i % w
    for (let r = r0 - rr; r <= r0 + rr; r++) {
      for (let c = c0 - cr; c <= c0 + cr; c++) {
        if (r < 0 || c < 0 || r >= h || c >= w) continue
        const d = Math.hypot((c - c0) * cellKmX, (r - r0) * cellKmY)
        if (d <= USED_KM) used[r * w + c] = Math.max(used[r * w + c], USED * (1 - d / USED_KM))
      }
    }
  }
}
/** Lets the leg leave / reach an anchor even if an earlier leg passed near it. */
const withFreeEnds = (a, b, fn) => {
  const saved = []
  for (const end of [a, b]) {
    const r0 = Math.floor(end / w), c0 = end % w
    const rr = Math.ceil((USED_KM + 2) / cellKmY), cr = Math.ceil((USED_KM + 2) / cellKmX)
    for (let r = r0 - rr; r <= r0 + rr; r++) {
      for (let c = c0 - cr; c <= c0 + cr; c++) {
        if (r < 0 || c < 0 || r >= h || c >= w) continue
        const i = r * w + c
        if (used[i] > 0) {
          saved.push([i, used[i]])
          used[i] = 0
        }
      }
    }
  }
  const out = fn()
  for (const [i, v] of saved) used[i] = v
  return out
}
const straightKm = (a, b) => Math.hypot(((b % w) - (a % w)) * cellKmX, (Math.floor(b / w) - Math.floor(a / w)) * cellKmY)

const kept = [anchors[0]]
const dropped = []
const legs = []
let k = 1
while (k <= anchors.length) {
  const from = kept[kept.length - 1]
  const closing = k === anchors.length
  const to = closing ? anchors[0] : anchors[k]
  const leg = withFreeEnds(from.cell, to.cell, () => astar(from.cell, to.cell))
  const ratio = leg ? leg.cost / Math.max(1, straightKm(from.cell, to.cell)) : Infinity
  if (!leg || ratio > LEG_RATIO_MAX) {
    if (closing) {
      // cannot close the loop from here: drop the last kept anchor and its leg, retry
      if (kept.length <= 3) throw new Error('Could not close the loop')
      dropped.push(kept.pop().name)
      const last = legs.pop()
      used.fill(0)
      for (const l of legs) markUsed(l.path)
      void last
      continue
    }
    dropped.push(to.name)
    console.log(`Anchor dropped (leg too costly, ${ratio.toFixed(1)} per km): ${to.name}`)
    k++
    continue
  }
  legs.push(leg)
  markUsed(leg.path)
  if (closing) break
  kept.push(to)
  k++
}

// ---------- Geometry: cells -> smooth lon/lat loop ----------
let cells = legs.flatMap((l, i) => (i === 0 ? l.path : l.path.slice(1)))
let pts = cells.map((i) => [lonOf(i % w) * KX, latOf(Math.floor(i / w)) * KY]) // km plane
pts.pop() // the loop's last cell repeats the first

function simplifyClosed(line, tol) {
  const dp = (a) => {
    if (a.length <= 2) return a
    const keep = new Uint8Array(a.length)
    keep[0] = keep[a.length - 1] = 1
    const stack = [[0, a.length - 1]]
    while (stack.length) {
      const [s, e] = stack.pop()
      let md = -1, mi = -1
      const [ax, ay] = a[s], [bx, by] = a[e]
      const len = Math.hypot(bx - ax, by - ay) || 1e-9
      for (let i = s + 1; i < e; i++) {
        const d = Math.abs((bx - ax) * (ay - a[i][1]) - (ax - a[i][0]) * (by - ay)) / len
        if (d > md) {
          md = d
          mi = i
        }
      }
      if (md > tol) {
        keep[mi] = 1
        stack.push([s, mi], [mi, e])
      }
    }
    return a.filter((_, i) => keep[i])
  }
  const half = Math.floor(line.length / 2)
  return [...dp(line.slice(0, half + 1)).slice(0, -1), ...dp([...line.slice(half), line[0]]).slice(0, -1)]
}
function chaikinClosed(line, iterations) {
  let p = line
  for (let k2 = 0; k2 < iterations; k2++) {
    const next = []
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length]
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    p = next
  }
  return p
}
const costAtKm = ([x, y]) => {
  const c = Math.round(colOf(x / KX)), r = Math.round(rowOf(y / KY))
  if (r < 0 || c < 0 || r >= h || c >= w) return Infinity
  const i = r * w + c
  return riverRank[i] || riverKm[i] < RIVER_BAND_KM ? Infinity : cellCost[i] + roughness(i) * 0.02
}
pts = chaikinClosed(simplifyClosed(pts, 1.2), 3)

// Gentle meander (two incommensurate low frequencies) where the ground is easy; never near rivers
{
  const n = pts.length
  const along = [0]
  for (let i = 1; i < n; i++) along.push(along[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const offs = pts.map((p, i) => {
    const s = along[i]
    const wave = 0.62 * Math.sin((2 * Math.PI * s) / 41 + 1.3) + 0.38 * Math.sin((2 * Math.PI * s) / 14.7 + 4.1)
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n]
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const nx = -(b[1] - a[1]) / tl, ny = (b[0] - a[0]) / tl
    for (const amp of [1.3, 0.7, 0]) {
      const q = [p[0] + nx * wave * amp, p[1] + ny * wave * amp]
      if (amp === 0 || (costAtKm(q) < 2.5 && costAtKm(p) < 2.5)) return wave * amp
    }
    return 0
  })
  // smooth the offsets so the meander never kinks where it is switched off
  const sm = offs.map((_, i) => {
    let s = 0
    for (let d = -6; d <= 6; d++) s += offs[(i + d + n) % n]
    return s / 13
  })
  pts = pts.map((p, i) => {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n]
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [p[0] - ((b[1] - a[1]) / tl) * sm[i], p[1] + ((b[0] - a[0]) / tl) * sm[i]]
  })
}
pts = simplifyClosed(pts, 0.12)

// Start the loop far from any river (so the seam never sits on a bridge)
{
  let best = 0, bestD = -1
  pts.forEach(([x, y], i) => {
    const c = Math.round(colOf(x / KX)), r = Math.round(rowOf(y / KY))
    const d = riverKm[r * w + c]
    if (d > bestD) {
      bestD = d
      best = i
    }
  })
  pts = [...pts.slice(best), ...pts.slice(0, best)]
}
const loop = pts.map(([x, y]) => [+(x / KX).toFixed(4), +(y / KY).toFixed(4)])
loop.push(loop[0])

// ---------- Validation ----------
let lengthKm = 0
for (let i = 1; i < loop.length; i++) lengthKm += Math.hypot((loop[i][0] - loop[i - 1][0]) * KX, (loop[i][1] - loop[i - 1][1]) * KY)
const crossings = { 1: 0, 2: 0, 3: 0 }
for (let i = 1; i < loop.length; i++) {
  const p = loop[i - 1], q = loop[i]
  for (const s of riverSegs) {
    const rx = q[0] - p[0], ry = q[1] - p[1], sx = s.b[0] - s.a[0], sy = s.b[1] - s.a[1]
    const den = rx * sy - ry * sx
    if (Math.abs(den) < 1e-12) continue
    const t = ((s.a[0] - p[0]) * sy - (s.a[1] - p[1]) * sx) / den
    const u = ((s.a[0] - p[0]) * ry - (s.a[1] - p[1]) * rx) / den
    if (t >= 0 && t < 1 && u >= 0 && u <= 1) crossings[s.rank]++
  }
}
let monumentKm = Infinity, coastMin = Infinity, offLand = 0
for (const [lon, lat] of loop) {
  for (const l of landmarks) monumentKm = Math.min(monumentKm, Math.hypot((lon - l.lon) * KX, (lat - l.lat) * KY))
  const i = cellOf(lon, lat)
  coastMin = Math.min(coastMin, coastKm[i])
  if (!mainland[i]) offLand++
}
// the loop must not cross itself
let selfCross = 0
for (let i = 1; i < loop.length; i++) {
  for (let j = i + 2; j < loop.length; j++) {
    if (i === 1 && j === loop.length - 1) continue
    const p = loop[i - 1], q = loop[i], a = loop[j - 1], b = loop[j]
    const rx = q[0] - p[0], ry = q[1] - p[1], sx = b[0] - a[0], sy = b[1] - a[1]
    const den = rx * sy - ry * sx
    if (Math.abs(den) < 1e-12) continue
    const t = ((a[0] - p[0]) * sy - (a[1] - p[1]) * sx) / den
    const u = ((a[0] - p[0]) * ry - (a[1] - p[1]) * rx) / den
    if (t > 0 && t < 1 && u > 0 && u < 1) selfCross++
  }
}
// self-proximity: closest approach between two parts of the loop more than 30 km apart along it
let selfKm = Infinity
{
  const along = [0]
  for (let i = 1; i < loop.length; i++) along.push(along[i - 1] + Math.hypot((loop[i][0] - loop[i - 1][0]) * KX, (loop[i][1] - loop[i - 1][1]) * KY))
  for (let i = 0; i < loop.length; i += 2) {
    for (let j = i + 2; j < loop.length; j += 2) {
      const ds = Math.min(along[j] - along[i], lengthKm - (along[j] - along[i]))
      if (ds < 30) continue
      selfKm = Math.min(selfKm, Math.hypot((loop[i][0] - loop[j][0]) * KX, (loop[i][1] - loop[j][1]) * KY))
    }
  }
}

writeFileSync(
  OUT_FILE,
  JSON.stringify({
    source: 'Planned offline by scripts/plan-road.mjs from the repo map data (relief, border, rivers, landmarks, places)',
    roads: [{ name: ROAD_NAME, rank: 2, lines: [loop] }],
  }),
)
console.log(`Saved ${OUT_FILE}: 1 road, ${loop.length} points, ${Math.round(lengthKm)} km`)
console.log(`Anchors kept (${kept.length}): ${kept.map((a) => a.name).join(' -> ')}`)
console.log(`Anchors dropped (${dropped.length}): ${dropped.join(', ') || 'none'}`)
console.log(`River crossings: ${crossings[1] + crossings[2] + crossings[3]} (big ${crossings[1]}, medium ${crossings[2]}, small ${crossings[3]})`)
console.log(`Closest monument: ${monumentKm.toFixed(1)} km; closest coast: ${coastMin.toFixed(1)} km; points off the mainland: ${offLand}`)
console.log(`Closest approach of the loop to itself (parts > 30 km apart along it): ${selfKm.toFixed(1)} km; self-crossings: ${selfCross}`)
