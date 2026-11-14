// Plans a simple road network for mainland Spain, offline, from the map data already in the repo
// (no download), and saves it as public/maps/countries/<ID>/roads.json: ONE closed road that loops
// through the interior plus a few open roads between big cities (NET_ROADS) that cross the loop
// and each other at clean, near right-angle junctions away from rivers.
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
//      the ground is easy, then checked again against the cost map;
//   5. the open roads: same cost map and A* between loose waypoints near cities (an end inside a
//      monument area snaps to its edge). Every road already laid leaves a band of extra cost:
//      cheap to cross straight over, expensive to run along, and dearer near rivers, so crossings
//      are near right angles and far from bridges. No meander near another road.
// Output (same format as before): { "source", "roads": [ { "name", "rank": 2, "lines": [line] } ] }
// The first road is the loop (closed: its last point equals its first); the others are open.
// Deterministic: re-run it after changing landmarks.json or the other inputs; it prints every
// junction with its angle and distance to the nearest river ("<-- check" flags a doubtful one).

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
const MONUMENT_KM = 41 // monuments are big on the toy map: their whole area is closed (41: the smoothed line stays >= 40 km away)
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
/**
 * Removes every self-crossing of a line (km plane): where segment i crosses segment j, the small
 * loop between them is cut out and replaced by the crossing point. On a closed line (no repeated
 * last point) the shorter side of the crossing is the one cut. Usually a tight spur at an anchor
 * or waypoint, where the leg in and the leg out run close and smoothing makes them touch.
 */
function removeSelfCrossings(line, closed) {
  let p = line
  for (let guard = 0; guard < 100; guard++) {
    const n = p.length
    const segs = closed ? n : n - 1
    let hit = null
    for (let i = 0; i < segs && !hit; i++) {
      const a = p[i], b = p[(i + 1) % n]
      for (let j = i + 2; j < segs; j++) {
        if (closed && i === 0 && j === n - 1) continue // neighbours around the seam
        const c = p[j], d = p[(j + 1) % n]
        const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1]
        const den = rx * sy - ry * sx
        if (Math.abs(den) < 1e-12) continue
        const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den
        const u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den
        if (t > 0 && t < 1 && u > 0 && u < 1) {
          hit = { i, j, x: [a[0] + rx * t, a[1] + ry * t] }
          break
        }
      }
    }
    if (!hit) return p
    const { i, j, x } = hit
    // inner part: points i+1..j; outer part: j+1..i (around the seam on a closed line)
    if (!closed || j - i <= n - (j - i)) p = [...p.slice(0, i + 1), x, ...p.slice(j + 1)]
    else p = [x, ...p.slice(i + 1, j + 1)]
  }
  return p
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
pts = removeSelfCrossings(simplifyClosed(pts, 0.12), true)

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

// ---------- Network: open roads between big cities that cross the loop and each other ----------
// Same cost map and A* as the loop. Every road already laid (the loop first, then each new road)
// leaves a band of extra cost around it: cheap to cross straight over (a junction), expensive to
// run along. Waypoints are loose: each snaps to the easiest open cell near it (an end that falls
// inside a monument area snaps to the nearest open cell, i.e. the edge of that area).
const NET_USED_KM = 8 // band around the roads already laid
const NET_USED = 25
const NET_LEG_RATIO_MAX = 20 // a leg costing more than this per straight km drops its waypoint
const NET_SNAP_KM = 25 // search radius of a waypoint (ends: up to END_SNAP_KM)
const END_SNAP_KM = 70
const NET_RIVER_KM = 5 // crossing a road this close to a river costs NET_RIVER times more (no junction by a bridge)
const NET_RIVER = 4
const JUNCTION_KM = 10 // inside this distance of a junction the roads run straight (no meander)
// [lon, lat] waypoints in order; the first and last are the ends of the road
const NET_ROADS = [
  {
    name: 'North-South Road', // Burgos, east of Guadalajara, Tarancón, Ciudad Real, Jaén
    rank: 2,
    via: [[-3.7, 42.34], [-3.05, 40.75], [-3.0, 40.0], [-3.93, 38.99], [-3.79, 37.77]],
  },
  {
    name: 'East-West Road', // Valencia, Cuenca, south of Aranjuez, Talavera, Trujillo, Mérida, Badajoz
    rank: 2,
    via: [[-0.6, 39.45], [-2.13, 40.07], [-3.55, 39.9], [-4.83, 39.96], [-5.88, 39.46], [-6.34, 38.92], [-6.97, 38.88]],
  },
  {
    name: 'Castile Road', // León, Palencia, Valladolid, the Duero, Soria, Zaragoza
    rank: 2,
    via: [[-5.57, 42.6], [-4.52, 42.01], [-4.72, 41.66], [-3.5, 41.6], [-2.47, 41.76], [-0.88, 41.66]],
  },
  {
    name: 'Andalusian Road', // Córdoba, Bailén, Úbeda, Baza, Lorca, Murcia
    rank: 2,
    via: [[-4.77, 37.89], [-3.78, 38.1], [-3.37, 38.01], [-2.75, 37.6], [-1.7, 37.67], [-1.13, 37.99]],
  },
  {
    name: 'Silver Road', // Zamora, Salamanca, Plasencia, Cáceres, Zafra, Sevilla
    rank: 2,
    via: [[-5.74, 41.51], [-5.66, 40.97], [-6.09, 40.03], [-6.37, 39.48], [-6.42, 38.42], [-5.99, 37.38]],
  },
]

/** Raises the extra cost (a cone of radius km) around one cell. */
function markDisc(r0, c0, km, value, into = used) {
  const rr = Math.ceil(km / cellKmY), cr = Math.ceil(km / cellKmX)
  for (let r = r0 - rr; r <= r0 + rr; r++) {
    for (let c = c0 - cr; c <= c0 + cr; c++) {
      if (r < 0 || c < 0 || r >= h || c >= w) continue
      const d = Math.hypot((c - c0) * cellKmX, (r - r0) * cellKmY)
      if (d > km) continue
      const j = r * w + c
      into[j] = Math.max(into[j], value * (1 - d / km) * (into === used && riverKm[j] < NET_RIVER_KM ? NET_RIVER : 1))
    }
  }
}
/** Raises the band of extra cost around a [lon, lat] polyline (used by the next roads). */
function markLine(line, km, value, into = used) {
  const seen = new Uint8Array(N)
  for (let s = 0; s < line.length - 1; s++) {
    const [a, b] = [line[s], line[s + 1]]
    const steps = Math.ceil(Math.hypot((b[0] - a[0]) * KX, (b[1] - a[1]) * KY) / (cellKmX * 0.5)) + 1
    for (let t = 0; t <= steps; t++) {
      const c0 = Math.round(colOf(a[0] + ((b[0] - a[0]) * t) / steps)), r0 = Math.round(rowOf(a[1] + ((b[1] - a[1]) * t) / steps))
      if (r0 < 0 || c0 < 0 || r0 >= h || c0 >= w || seen[r0 * w + c0]) continue
      seen[r0 * w + c0] = 1
      markDisc(r0, c0, km, value, into)
    }
  }
}

/** Easiest open cell near a waypoint, away from rivers and from the roads already laid. */
function snap(lon, lat, isEnd) {
  const r0 = rowOf(lat), c0 = colOf(lon)
  for (const R of isEnd ? [END_SNAP_KM, END_SNAP_KM * 1.6] : [NET_SNAP_KM, NET_SNAP_KM * 2]) {
    let best = -1, bestScore = Infinity
    for (let r = Math.floor(r0 - R / cellKmY); r <= Math.ceil(r0 + R / cellKmY); r++) {
      for (let c = Math.floor(c0 - R / cellKmX); c <= Math.ceil(c0 + R / cellKmX); c++) {
        if (r < 0 || c < 0 || r >= h || c >= w) continue
        const d = Math.hypot((c - c0) * cellKmX, (r - r0) * cellKmY)
        if (d > R) continue
        const i = r * w + c
        if (!Number.isFinite(cellCost[i]) || riverRank[i] || riverKm[i] < RIVER_BAND_KM || used[i] > 0) continue
        // ends: as close to the city (or the monument edge) as possible; waypoints: easy ground first
        const score = isEnd ? d + cellCost[i] * 4 + roughness(i) * 0.1 : cellCost[i] * 10 + roughness(i) * 0.4 + d * 0.05
        if (score < bestScore) {
          bestScore = score
          best = i
        }
      }
    }
    if (best >= 0) return best
  }
  return -1
}

function chaikinOpen(line, iterations) {
  let p = line
  for (let k2 = 0; k2 < iterations; k2++) {
    const next = [p[0]]
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1]
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75])
    }
    next.push(p[p.length - 1])
    p = next
  }
  return p
}
/** Douglas-Peucker on an open line (both ends kept). */
function simplifyOpen(a, tol) {
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

const network = []
const netLog = []
used.fill(0)
markLine(loop, NET_USED_KM, NET_USED)
const nearRoads = new Float32Array(N) // > 0 within JUNCTION_KM of a road already laid
markLine(loop, JUNCTION_KM, 1, nearRoads)
for (const road of NET_ROADS) {
  const cellsVia = []
  road.via.forEach(([lon, lat], k) => {
    const c = snap(lon, lat, k === 0 || k === road.via.length - 1)
    if (c >= 0) cellsVia.push(c)
    else netLog.push(`${road.name}: waypoint ${k} dropped (no open cell)`)
  })
  // Legs; a too costly leg drops its far waypoint
  const path = cellsVia.length ? [cellsVia[0]] : []
  for (let k = 1; k < cellsVia.length; k++) {
    const from = path[path.length - 1]
    // the road's own previous legs count as laid (no going back the same way), except near `from`
    const saved = used.slice()
    const fr = Math.floor(from / w), fc = from % w
    for (const i of path) {
      if (Math.hypot(((i % w) - fc) * cellKmX, (Math.floor(i / w) - fr) * cellKmY) > NET_USED_KM + 4) markDisc(Math.floor(i / w), i % w, NET_USED_KM, NET_USED)
    }
    const leg = astar(from, cellsVia[k])
    used.set(saved)
    const ratio = leg ? leg.cost / Math.max(1, straightKm(from, cellsVia[k])) : Infinity
    if (!leg || ratio > NET_LEG_RATIO_MAX) {
      netLog.push(`${road.name}: waypoint ${k} dropped (leg ${ratio.toFixed(1)} per km)`)
      continue
    }
    path.push(...leg.path.slice(1))
  }
  if (path.length < 10) {
    netLog.push(`${road.name}: dropped (no route)`)
    continue
  }
  let p = path.map((i) => [lonOf(i % w) * KX, latOf(Math.floor(i / w)) * KY])
  p = chaikinOpen(simplifyOpen(p, 1.2), 3)
  // Gentle meander (as the loop), switched off near the roads already laid (straight junctions)
  {
    const n = p.length
    const along = [0]
    for (let i = 1; i < n; i++) along.push(along[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]))
    const near = (q) => {
      const c = Math.round(colOf(q[0] / KX)), r = Math.round(rowOf(q[1] / KY))
      return r < 0 || c < 0 || r >= h || c >= w || nearRoads[r * w + c] > 0
    }
    const normal = (i) => {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)]
      const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      return [-(b[1] - a[1]) / tl, (b[0] - a[0]) / tl]
    }
    const offs = p.map((q, i) => {
      if (i === 0 || i === n - 1 || near(q)) return 0
      const s = along[i]
      const wave = 0.62 * Math.sin((2 * Math.PI * s) / 41 + 2.1) + 0.38 * Math.sin((2 * Math.PI * s) / 14.7 + 0.7)
      const [nx, ny] = normal(i)
      for (const amp of [1.3, 0.7, 0]) {
        const o = [q[0] + nx * wave * amp, q[1] + ny * wave * amp]
        if (amp === 0 || (costAtKm(o) < 2.5 && costAtKm(q) < 2.5)) return wave * amp
      }
      return 0
    })
    const sm = offs.map((_, i) => {
      if (i === 0 || i === n - 1) return 0
      let s = 0
      for (let d = -6; d <= 6; d++) s += offs[Math.min(n - 1, Math.max(0, i + d))]
      return s / 13
    })
    p = p.map((q, i) => {
      const [nx, ny] = normal(i)
      return [q[0] + nx * sm[i], q[1] + ny * sm[i]]
    })
  }
  p = removeSelfCrossings(simplifyOpen(p, 0.12), false)
  const line = p.map(([x, y]) => [+(x / KX).toFixed(4), +(y / KY).toFixed(4)])
  network.push({ name: road.name, rank: road.rank, lines: [line] })
  markLine(line, NET_USED_KM, NET_USED)
  markLine(line, JUNCTION_KM, 1, nearRoads)
}

// ---------- Network validation: junctions (angle, rivers nearby, spacing) ----------
const segHit = (p, q, a, b) => {
  const rx = (q[0] - p[0]) * KX, ry = (q[1] - p[1]) * KY, sx = (b[0] - a[0]) * KX, sy = (b[1] - a[1]) * KY
  const den = rx * sy - ry * sx
  if (Math.abs(den) < 1e-12) return null
  const ax = (a[0] - p[0]) * KX, ay = (a[1] - p[1]) * KY
  const t = (ax * sy - ay * sx) / den
  const u = (ax * ry - ay * rx) / den
  if (t < 0 || t >= 1 || u < 0 || u >= 1) return null
  return { t, sin: Math.abs(den) / (Math.hypot(rx, ry) * Math.hypot(sx, sy)) }
}
const allLines = [{ name: ROAD_NAME, line: loop }, ...network.map((r) => ({ name: r.name, line: r.lines[0] }))]
const junctions = []
let netSelfCross = 0
for (let A = 0; A < allLines.length; A++) {
  for (let Bi = A; Bi < allLines.length; Bi++) {
    const la = allLines[A].line, lb = allLines[Bi].line
    for (let i = 1; i < la.length; i++) {
      for (let j = Bi === A ? i + 2 : 1; j < lb.length; j++) {
        if (Bi === A && (A === 0 || i === 1) && j === la.length - 1) continue
        const hit = segHit(la[i - 1], la[i], lb[j - 1], lb[j])
        if (!hit) continue
        if (Bi === A) {
          netSelfCross++
          continue
        }
        const p = la[i - 1], q = la[i]
        const lon = p[0] + (q[0] - p[0]) * hit.t, lat = p[1] + (q[1] - p[1]) * hit.t
        junctions.push({ a: allLines[A].name, b: allLines[Bi].name, lon, lat, angle: (Math.asin(Math.min(1, hit.sin)) * 180) / Math.PI, riverKm: riverKm[cellOf(lon, lat)] })
      }
    }
  }
}
for (const j of junctions) {
  j.nextKm = Infinity
  for (const o of junctions) if (o !== j) j.nextKm = Math.min(j.nextKm, Math.hypot((o.lon - j.lon) * KX, (o.lat - j.lat) * KY))
}
let netKm = 0
const netCross = { 1: 0, 2: 0, 3: 0 }
let netMonumentKm = Infinity, netOff = 0
for (const r of network) {
  const l = r.lines[0]
  for (let i = 1; i < l.length; i++) {
    netKm += Math.hypot((l[i][0] - l[i - 1][0]) * KX, (l[i][1] - l[i - 1][1]) * KY)
    for (const s of riverSegs) if (segHit(l[i - 1], l[i], s.a, s.b)) netCross[s.rank]++
  }
  for (const [lon, lat] of l) {
    for (const lm of landmarks) netMonumentKm = Math.min(netMonumentKm, Math.hypot((lon - lm.lon) * KX, (lat - lm.lat) * KY))
    if (!mainland[cellOf(lon, lat)]) netOff++
  }
}

writeFileSync(
  OUT_FILE,
  JSON.stringify({
    source: 'Planned offline by scripts/plan-road.mjs from the repo map data (relief, border, rivers, landmarks, places)',
    roads: [{ name: ROAD_NAME, rank: 2, lines: [loop] }, ...network],
  }),
)
console.log(`Saved ${OUT_FILE}: ${1 + network.length} roads (the loop + ${network.length} open roads)`)
console.log(`Loop: ${loop.length} points, ${Math.round(lengthKm)} km`)
console.log(`Anchors kept (${kept.length}): ${kept.map((a) => a.name).join(' -> ')}`)
console.log(`Anchors dropped (${dropped.length}): ${dropped.join(', ') || 'none'}`)
console.log(`River crossings: ${crossings[1] + crossings[2] + crossings[3]} (big ${crossings[1]}, medium ${crossings[2]}, small ${crossings[3]})`)
console.log(`Closest monument: ${monumentKm.toFixed(1)} km; closest coast: ${coastMin.toFixed(1)} km; points off the mainland: ${offLand}`)
console.log(`Closest approach of the loop to itself (parts > 30 km apart along it): ${selfKm.toFixed(1)} km; self-crossings: ${selfCross}`)
console.log(`Open roads: ${network.map((r) => `${r.name} (${r.lines[0].length} pts)`).join(', ')}; ${Math.round(netKm)} km`)
for (const m of netLog) console.log(`  ${m}`)
console.log(`Open roads: river crossings ${netCross[1] + netCross[2] + netCross[3]} (big ${netCross[1]}, medium ${netCross[2]}, small ${netCross[3]}); closest monument ${netMonumentKm.toFixed(1)} km; points off the mainland ${netOff}; self-crossings ${netSelfCross}`)
console.log(`Junctions: ${junctions.length}`)
for (const j of junctions) {
  const warn = j.angle < 35 || j.riverKm < 3 || j.nextKm < 12 ? '  <-- check' : ''
  console.log(`  ${j.a} x ${j.b} at ${j.lon.toFixed(3)}, ${j.lat.toFixed(3)}: angle ${j.angle.toFixed(0)} deg, river ${j.riverKm.toFixed(1)} km, next junction ${j.nextKm.toFixed(1)} km${warn}`)
}
