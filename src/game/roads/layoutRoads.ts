// Road layout: turns the coarse road lines of roads.json into smooth world-space runs that sit on
// the terrain and respect everything else on the map:
// - monuments: roads bend around each footprint (the same idea as bendRiversAround), keeping to
//   the side they already pass on;
// - rivers: a road that crosses a river gets a bridge; a road that runs next to a river is pushed
//   away from the water so it never runs inside a channel or along the water's edge;
// - sea and border: roads only exist on explored land (both edges), clipped at the zone edges;
// - relief: the deck height follows a smoothed upper envelope of the terrain across the whole
//   width, so the road never sinks into a terrace and never stair-steps (it ramps gently instead).
import type { River } from '../map/mapData'
import { chaikin, riverHalfWidthKm, riverWidthScale } from '../map/rivers'
import { lonLatToWorld, UNITS_PER_KM } from '../map/projection'
import type { Road } from './roadData'

export type XZ = [number, number]

/** Distance (world units) between two cross sections of a road. */
export const STEP = 3
/** Half width (world units, cartoon scale) of the deck by rank: 1 motorway, 2 primary road. */
export const ROAD_HALF_WIDTH: Record<1 | 2, number> = { 1: 4.6, 2: 3.1 }
/** Lift of the deck over the terrain envelope; motorways a hair higher so junctions do not flicker. */
const LIFT: Record<1 | 2, number> = { 1: 0.24, 2: 0.16 }
/** The water ribbon is this much wider than the river half width (WIDTH_FACTOR in scene/createRivers.ts). */
const WATER_WIDTH_FACTOR = 1.06
/** Gap (world units) between a road edge and the water when the road runs beside a river. */
const RIVER_GAP = 5
/** Width (world units) of the soft zone over which a road is eased away from a river. */
const RIVER_FALLOFF = 26
/** Bridge decks reach this far (world units) past the water edge, over the carved banks. */
const BRIDGE_BANK = 9
/** Longest half bridge (world units on each side of the crossing point). */
const MAX_HALF_SPAN = 90
/** Gap (world units) between a road edge and a monument clearing circle. */
const MONUMENT_GAP = 4
/** Cross sections averaged on each side when smoothing the deck height, and how many passes. */
const SMOOTH_R = 4
const ENVELOPE_PASSES = 4
/** Height probes across the deck (share of the half width) and the extra margin on steep ground. */
const ACROSS_PROBES = [-1, -2 / 3, -1 / 3, 0, 1 / 3, 2 / 3, 1]
const SLOPE_MARGIN = 0.12
const SLOPE_MARGIN_MAX = 1
/** Longest bridge made by merging two nearby crossings (world units). */
const MAX_MERGED_SPAN = 180
/** Bridges: arch height in the middle (world units) and the clearance over the ground below. */
const ARCH_MIN = 1.2
const ARCH_MAX = 3
const DECK_CLEAR = 1.6
/** Thickness of a bridge deck slab (its side face is the bridge fascia). */
export const SLAB = 1.3
/** Pieces of road shorter than this many cross sections are dropped. */
const MIN_SAMPLES = 6

export interface RoadGround {
  heightAt: (x: number, z: number) => number
  isExploredLand: (x: number, z: number) => boolean
  /** Rivers of the zone exactly as drawn (prepareRivers + bendRiversAround output). */
  rivers: River[] | undefined
  /** Monument circles to bend around (world units). */
  clearings: { x: number; z: number; r: number }[]
  /** Distance to the nearest monument footprint (0 inside). */
  landmarkDistance: (x: number, z: number) => number
}

export interface Bridge {
  /** First and last cross section of the deck (indices into the run). */
  a: number
  b: number
}

export interface RoadRun {
  rank: 1 | 2
  name: string
  hw: number
  pts: XZ[]
  /** Deck height at each cross section. */
  y: number[]
  /** Bottom of the side skirt (below the terrain; under a bridge, the slab bottom). */
  bottom: number[]
  /** Terrain height under the centre line (bridge piers stand on it). */
  ground: number[]
  /** 1 on a bridge deck. */
  bridge: Uint8Array
  bridges: Bridge[]
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Resamples a polyline to points STEP apart (ends kept). */
export function resample(pts: XZ[]): XZ[] {
  if (pts.length < 2) return pts.slice()
  const out: XZ[] = [pts[0]]
  let carry = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    if (len < 1e-9) continue
    let d = STEP - carry
    while (d <= len) {
      const t = d / len
      out.push([ax + (bx - ax) * t, az + (bz - az) * t])
      d += STEP
    }
    carry = len - (d - STEP)
  }
  const last = pts[pts.length - 1]
  const prev = out[out.length - 1]
  if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) > STEP * 0.3) out.push(last)
  else out[out.length - 1] = last
  return out
}

/** Unit tangent of a polyline at point i. */
export function tangent(pts: XZ[], i: number): XZ {
  const [px, pz] = pts[Math.max(0, i - 1)]
  const [nx, nz] = pts[Math.min(pts.length - 1, i + 1)]
  const tx = nx - px, tz = nz - pz
  const tl = Math.hypot(tx, tz) || 1
  return [tx / tl, tz / tl]
}

// ---------------------------------------------------------------------------------------------
// River index: the drawn water as segments with their half width, in a coarse grid
// ---------------------------------------------------------------------------------------------

interface RiverSeg {
  ax: number
  az: number
  bx: number
  bz: number
  /** Water half width (world units) at both ends. */
  ha: number
  hb: number
}

interface NearRiver {
  /** Distance from the point to the water edge (negative inside the water). */
  edge: number
  /** Distance to the centre line, and the water half width there. */
  d: number
  hw: number
  /** Closest point on the centre line, and the river direction there. */
  cx: number
  cz: number
  tx: number
  tz: number
}

const CELL = 40

function riverIndex(rivers: River[] | undefined) {
  const grid = new Map<string, RiverSeg[]>()
  let maxHw = 0
  for (const river of rivers ?? []) {
    const hwFull = riverHalfWidthKm(river.rank) * UNITS_PER_KM * WATER_WIDTH_FACTOR
    river.lines.forEach((line, li) => {
      const pts = chaikin(line, 3).map(([lon, lat]) => {
        const p = lonLatToWorld(lon, lat)
        return [p.x, p.z] as XZ
      })
      const along = [0]
      for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
      const totalKm = along[along.length - 1] / UNITS_PER_KM
      const hw = along.map((a) => hwFull * riverWidthScale(a / UNITS_PER_KM, totalKm, river.ends?.[li]))
      for (let i = 0; i < pts.length - 1; i++) {
        const seg: RiverSeg = { ax: pts[i][0], az: pts[i][1], bx: pts[i + 1][0], bz: pts[i + 1][1], ha: hw[i], hb: hw[i + 1] }
        maxHw = Math.max(maxHw, seg.ha, seg.hb)
        const c0 = Math.floor(Math.min(seg.ax, seg.bx) / CELL), c1 = Math.floor(Math.max(seg.ax, seg.bx) / CELL)
        const r0 = Math.floor(Math.min(seg.az, seg.bz) / CELL), r1 = Math.floor(Math.max(seg.az, seg.bz) / CELL)
        for (let c = c0; c <= c1; c++) {
          for (let r = r0; r <= r1; r++) {
            const key = `${c},${r}`
            let list = grid.get(key)
            if (!list) grid.set(key, (list = []))
            list.push(seg)
          }
        }
      }
    })
  }

  /** Nearest water (by distance to its edge) within `reach` units of the edge, or null. */
  const nearest = (x: number, z: number, reach: number): NearRiver | null => {
    const r = reach + maxHw
    const c0 = Math.floor((x - r) / CELL), c1 = Math.floor((x + r) / CELL)
    const r0 = Math.floor((z - r) / CELL), r1 = Math.floor((z + r) / CELL)
    let best: NearRiver | null = null
    for (let c = c0; c <= c1; c++) {
      for (let rr = r0; rr <= r1; rr++) {
        for (const s of grid.get(`${c},${rr}`) ?? []) {
          const dx = s.bx - s.ax, dz = s.bz - s.az
          const len2 = dx * dx + dz * dz || 1e-9
          const t = Math.min(1, Math.max(0, ((x - s.ax) * dx + (z - s.az) * dz) / len2))
          const cx = s.ax + dx * t, cz = s.az + dz * t
          const d = Math.hypot(x - cx, z - cz)
          const hw = s.ha + (s.hb - s.ha) * t
          const edge = d - hw
          if (edge < reach && (!best || edge < best.edge)) {
            const l = Math.sqrt(len2)
            best = { edge, d, hw, cx, cz, tx: dx / l, tz: dz / l }
          }
        }
      }
    }
    return best
  }

  /** Points (float index along the road) where the road centre line crosses a river centre line. */
  const crossings = (pts: XZ[]): { at: number; sin: number }[] => {
    const out: { at: number; sin: number }[] = []
    for (let i = 0; i < pts.length - 1; i++) {
      const [px, pz] = pts[i], [qx, qz] = pts[i + 1]
      const rx = qx - px, rz = qz - pz
      const seen = new Set<RiverSeg>()
      for (const [x, z] of [pts[i], pts[i + 1]]) {
        for (const s of grid.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
          if (seen.has(s)) continue
          seen.add(s)
          const sx = s.bx - s.ax, sz = s.bz - s.az
          const den = rx * sz - rz * sx
          if (Math.abs(den) < 1e-9) continue
          const t = ((s.ax - px) * sz - (s.az - pz) * sx) / den
          const u = ((s.ax - px) * rz - (s.az - pz) * rx) / den
          if (t < 0 || t >= 1 || u < 0 || u > 1) continue
          out.push({ at: i + t, sin: Math.abs(den) / (Math.hypot(rx, rz) * Math.hypot(sx, sz) || 1) })
        }
      }
    }
    // Several river segments (or a confluence) at the same spot count as one crossing
    out.sort((a, b) => a.at - b.at)
    const merged: { at: number; sin: number }[] = []
    for (const c of out) {
      const last = merged[merged.length - 1]
      if (last && (c.at - last.at) * STEP < 12) last.sin = Math.min(last.sin, c.sin)
      else merged.push({ ...c })
    }
    return merged
  }

  return { nearest, crossings, empty: grid.size === 0 }
}

type RiverIndex = ReturnType<typeof riverIndex>

// ---------------------------------------------------------------------------------------------
// Steps of the layout
// ---------------------------------------------------------------------------------------------

/**
 * Bends a road around monument circles. Points closer than the clearing are pushed radially out
 * with a soft falloff (a gentle curve, not a kink), always to the side the road already passes on
 * (points on the other side are mirrored first), so the road never splits around a monument.
 */
function avoidMonuments(pts: XZ[], clearings: RoadGround['clearings'], hw: number): XZ[] {
  let out = pts
  for (const c of clearings) {
    const target = c.r + hw + MONUMENT_GAP
    const outer = Math.max(target * 1.6, target + 30)
    let k = -1, kd = Infinity
    for (let i = 0; i < out.length; i++) {
      const d = Math.hypot(out[i][0] - c.x, out[i][1] - c.z)
      if (d < kd) {
        kd = d
        k = i
      }
    }
    if (k < 0 || kd >= outer) continue
    const [tx, tz] = tangent(out, k)
    const vx = out[k][0] - c.x, vz = out[k][1] - c.z
    const side = -tz * vx + tx * vz >= 0 ? 1 : -1
    const nx = -tz * side, nz = tx * side // unit normal pointing to the road's side
    out = out.map(([x, z]): XZ => {
      let dx = x - c.x, dz = z - c.z
      if (Math.hypot(dx, dz) >= outer) return [x, z]
      const dn = dx * nx + dz * nz
      if (dn < 0) {
        dx -= 2 * dn * nx
        dz -= 2 * dn * nz
      }
      const d = Math.hypot(dx, dz)
      const nd = target + (d / outer) * (outer - target)
      if (d < 1e-6) return [c.x + nx * nd, c.z + nz * nd]
      return [c.x + (dx / d) * nd, c.z + (dz / d) * nd]
    })
  }
  return out
}

/**
 * Eases a road away from rivers it runs beside. Around each real crossing the road is left alone
 * (it gets a bridge there), with a smooth hand-over so the line never kinks.
 */
function avoidRivers(pts: XZ[], rivers: RiverIndex, hw: number): XZ[] {
  const n = pts.length
  const free = new Float32Array(n).fill(1) // 0 = protected (crossing), 1 = may be pushed
  const reachZone = hw + RIVER_GAP + RIVER_FALLOFF
  for (const c of rivers.crossings(pts)) {
    const L = Math.min(MAX_HALF_SPAN, (reachZone + 10) / Math.max(c.sin, 0.3)) / STEP
    const ramp = 6
    const i0 = Math.max(0, Math.floor(c.at - L - ramp)), i1 = Math.min(n - 1, Math.ceil(c.at + L + ramp))
    for (let i = i0; i <= i1; i++) free[i] = Math.min(free[i], smooth(L, L + ramp, Math.abs(i - c.at)))
  }
  return pts.map(([x, z], i): XZ => {
    if (free[i] === 0) return [x, z]
    const nr = rivers.nearest(x, z, hw + RIVER_GAP + RIVER_FALLOFF)
    if (!nr) return [x, z]
    const target = nr.hw + hw + RIVER_GAP
    const outer = target + RIVER_FALLOFF
    if (nr.d >= outer) return [x, z]
    const nd = target + (nr.d / outer) * (outer - target)
    let ux = x - nr.cx, uz = z - nr.cz
    if (nr.d < 1e-6) {
      ux = -nr.tz
      uz = nr.tx
    } else {
      ux /= nr.d
      uz /= nr.d
    }
    const px = nr.cx + ux * nd, pz = nr.cz + uz * nd
    return [x + (px - x) * free[i], z + (pz - z) * free[i]]
  })
}

/** Deck intervals (indices) around each river crossing: the water plus its carved banks. */
function bridgeIntervals(pts: XZ[], rivers: RiverIndex, hw: number): Bridge[] {
  const n = pts.length
  const reach = BRIDGE_BANK + hw * 0.6
  const wet = (i: number) => {
    const nr = rivers.nearest(pts[i][0], pts[i][1], reach)
    return nr !== null && nr.edge < reach
  }
  const maxSteps = Math.ceil(MAX_HALF_SPAN / STEP)
  const out: Bridge[] = []
  for (const c of rivers.crossings(pts)) {
    let a = Math.floor(c.at), b = Math.ceil(c.at)
    while (a > 0 && c.at - a < maxSteps && wet(a - 1)) a--
    while (b < n - 1 && b - c.at < maxSteps && wet(b + 1)) b++
    a = Math.max(0, a - 1)
    b = Math.min(n - 1, b + 1)
    const last = out[out.length - 1]
    if (last && a <= last.b + 2 && (Math.max(last.b, b) - last.a) * STEP <= MAX_MERGED_SPAN) {
      last.b = Math.max(last.b, b)
    } else {
      // Too long to merge: overlapping decks are trimmed so the two bridges meet at one section
      if (last && a <= last.b) a = last.b + 1
      if (b > a) out.push({ a, b })
    }
  }
  return out
}

/**
 * Upper envelope smoothing: box filter, then never below the input, a few times. Straight slopes
 * stay where they are (a plain max filter would lift a long ramp by its grade times the radius),
 * dips and terrace kinks are filled with smooth curves, and the result never sinks under the input.
 */
function envelope(raw: number[], r: number): number[] {
  const n = raw.length
  let y = raw
  for (let pass = 0; pass < ENVELOPE_PASSES; pass++) {
    const prev = y
    y = raw.map((v, i) => {
      let s = 0, c = 0
      for (let k = Math.max(0, i - r); k <= Math.min(n - 1, i + r); k++) {
        s += prev[k]
        c++
      }
      return Math.max(v, s / c)
    })
  }
  return y
}

/** Heights of one run: deck (with bridges), skirt bottom and the ground under the centre. */
function profile(run: Omit<RoadRun, 'y' | 'bottom' | 'ground'>, ground: RoadGround): RoadRun {
  const { pts, hw, rank, bridges } = run
  const n = pts.length
  const raw: number[] = []
  const low: number[] = []
  const centre: number[] = []
  for (let i = 0; i < n; i++) {
    const [x, z] = pts[i]
    const [tx, tz] = tangent(pts, i)
    const nx = -tz, nz = tx
    // Probes across the whole width, at this section and half a step on each side (the deck is
    // straight between sections, the terrain is not), so slopes between sections cannot poke up
    let hi = -Infinity, lo = Infinity
    for (const along of [-0.5, 0, 0.5]) {
      if ((i === 0 && along < 0) || (i === n - 1 && along > 0)) continue
      const cx = x + tx * along * STEP, cz = z + tz * along * STEP
      for (const k of ACROSS_PROBES) {
        const o = k * (hw + 0.6)
        const h = ground.heightAt(cx + nx * o, cz + nz * o)
        hi = Math.max(hi, h)
        lo = Math.min(lo, h)
      }
    }
    // Steep ground: a little extra margin (bilinear lookups vs. the triangulated terrain mesh)
    hi += Math.min(SLOPE_MARGIN_MAX, (hi - lo) * SLOPE_MARGIN)
    const o = hw + 1.5
    low.push(Math.min(ground.heightAt(x + nx * o, z + nz * o), ground.heightAt(x - nx * o, z - nz * o)))
    centre.push(ground.heightAt(x, z))
    raw.push(hi + LIFT[rank])
  }
  // Bridges: a gentle arch from bank to bank, always clear of the channel below
  for (const { a, b } of bridges) {
    const ya = raw[a], yb = raw[b]
    const span = (b - a) * STEP
    const arch = Math.min(ARCH_MAX, ARCH_MIN + span * 0.02)
    for (let i = a; i <= b; i++) {
      const t = (i - a) / Math.max(1, b - a)
      const deck = ya + (yb - ya) * t + arch * Math.sin(Math.PI * t)
      raw[i] = Math.max(deck, raw[i] + (i > a && i < b ? DECK_CLEAR : 0))
    }
  }
  const y = envelope(raw, SMOOTH_R)
  const bottom = y.map((yi, i) => (run.bridge[i] ? yi - SLAB : Math.min(low[i], yi) - 0.8))
  return { ...run, y, bottom, ground: centre }
}

/** Lays out every road of a zone. */
export function layoutRoads(roads: Road[], ground: RoadGround): RoadRun[] {
  const rivers = riverIndex(ground.rivers)
  const runs: RoadRun[] = []
  for (const road of roads) {
    const hw = ROAD_HALF_WIDTH[road.rank]
    for (const line of road.lines) {
      let pts = resample(
        chaikin(line, 2).map(([lon, lat]) => {
          const p = lonLatToWorld(lon, lat)
          return [p.x, p.z] as XZ
        }),
      )
      if (pts.length < 2) continue
      pts = resample(avoidMonuments(pts, ground.clearings, hw))
      if (!rivers.empty) for (let pass = 0; pass < 2; pass++) pts = resample(avoidRivers(pts, rivers, hw))
      pts = resample(avoidMonuments(pts, ground.clearings, hw)) // monuments always win
      const n = pts.length
      if (n < MIN_SAMPLES) continue

      // Which cross sections may exist: both edges on explored land, off monuments, out of the water
      const bridges = rivers.empty ? [] : bridgeIntervals(pts, rivers, hw)
      const onBridge = new Uint8Array(n)
      for (const { a, b } of bridges) onBridge.fill(1, a, b + 1)
      const keep = new Uint8Array(n)
      for (let i = 0; i < n; i++) {
        const [x, z] = pts[i]
        const [tx, tz] = tangent(pts, i)
        const o = hw + 0.5
        const land = ground.isExploredLand(x, z) && ground.isExploredLand(x - tz * o, z + tx * o) && ground.isExploredLand(x + tz * o, z - tx * o)
        if (!land || ground.landmarkDistance(x, z) < hw + 1) continue
        if (!onBridge[i] && !rivers.empty) {
          const nr = rivers.nearest(x, z, hw)
          if (nr && nr.edge < hw) continue // would run in the water: cut
        }
        keep[i] = 1
      }
      // A bridge must be complete with land at both ends; otherwise the road stops before it
      const okBridges: Bridge[] = []
      for (const br of bridges) {
        let ok = br.a >= 2 && br.b <= n - 3
        for (let i = Math.max(0, br.a - 2); ok && i <= Math.min(n - 1, br.b + 2); i++) if (!keep[i]) ok = false
        if (ok) okBridges.push(br)
        else keep.fill(0, Math.max(0, br.a - 2), Math.min(n, br.b + 3))
      }

      // Split into continuous runs
      let s = -1
      for (let i = 0; i <= n; i++) {
        const k = i < n && keep[i] === 1
        if (k && s < 0) s = i
        if (!k && s >= 0) {
          if (i - s >= MIN_SAMPLES) {
            const local = okBridges.filter((b) => b.a >= s && b.b < i).map((b) => ({ a: b.a - s, b: b.b - s }))
            const bridge = new Uint8Array(i - s)
            for (const b of local) bridge.fill(1, b.a, b.b + 1)
            runs.push(profile({ rank: road.rank, name: road.name, hw, pts: pts.slice(s, i), bridge, bridges: local }, ground))
          }
          s = -1
        }
      }
    }
  }
  return runs
}
