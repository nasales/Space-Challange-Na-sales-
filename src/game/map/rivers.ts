// Rivers of the explored country: cartoon water ribbons painted into the toy-map texture and
// shallow beds carved into the terrain. Both use the same raster "edge field" built here, in the
// pixel space of the texture or of the height grid, so the paint and the carve line up.
import type { Bounds, River, RiverEnd, ZoneData } from './mapData'
import { mix, scale, smooth, SEA, type RGB } from './palette'

/** River colours: the toy sea's own palette (palette.ts SEA), so rivers and sea read as one water. */
export const RIVER_COLORS = {
  water: mix(SEA.deep, SEA.shallow, 0.25),
  light: SEA.coast, // lighter water next to the banks
  foam: SEA.foam,
  bank: [246, 239, 196] as RGB, // pale sandy bank, mixed into the land colour
}

/** Half width of the water ribbon (km, cartoon scale, not real) by rank: 1 big, 2 medium, 3 small. */
const HALF_WIDTH_KM: Record<number, number> = { 1: 1.7, 2: 1.0, 3: 0.65 }
/** Width (km) of the light bank strip outside the water. */
const BANK_KM = 0.45
/** Carve depth (world units) of the river bed: a base plus this much per km of half width. */
const CARVE_BASE = 1.2
const CARVE_PER_KM = 2.2
/** The carve fades out this far (km) outside the water edge: gentle banks, no cliffs. */
const CARVE_BANK_KM = 1.2
/** Where a river cuts deeper to keep running downhill, the banks widen this much (km) per world unit... */
const CARVE_BANK_PER_UNIT = 0.08
/** ...up to this width (km); must stay below FIELD_REACH_KM. */
const CARVE_BANK_MAX_KM = 3.2

/** Reach (km) of the grid edge field returned by riverCarveDepth: placement margins must stay below it. */
export const FIELD_REACH_KM = 4

export const riverHalfWidthKm = (rank: number) => HALF_WIDTH_KM[rank] ?? HALF_WIDTH_KM[3]

/** Depth (world units) of the carved channel at the centre of a river with half width `hwKm`. */
export const channelDepth = (hwKm: number) => CARVE_BASE + hwKm * CARVE_PER_KM

/** Chaikin corner cutting: turns the coarse source polylines into smooth curves (ends kept). */
export function chaikin(line: [number, number][], iterations: number): [number, number][] {
  let pts = line
  for (let k = 0; k < iterations && pts.length > 2; k++) {
    const next: [number, number][] = [pts[0]]
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1]
      next.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75])
    }
    next.push(pts[pts.length - 1])
    pts = next
  }
  return pts
}

// ---------------------------------------------------------------------------------------------
// River ends: springs that narrow, mouths that widen into the sea, tributaries that reach the
// main river. Shared by the carve, the painted bank and the water mesh, so all of them agree.
// ---------------------------------------------------------------------------------------------

const KM_LAT = 110.57
const kmPerDegLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180)

/** Line ends closer than this (km) to another line are joined to it (the source data has ~1 km gaps). */
const JOIN_KM = 1.5
/** A free end with sea (height <= 0) within this distance (km) is a river mouth. */
const MOUTH_SEARCH_KM = 1.5
/** The lower free end of a line with the sea within this distance (km) is run on into it (a mouth). */
const MOUTH_REACH_KM = 8
/** Mouths end this far (km) past the coast, so the water mesh finds the sea right ahead. */
const MOUTH_PAST_KM = 0.6
/** Radius (km) of the circle that must be half sea for a mouth (tiny pockets below 0 m do not count). */
const OPEN_SEA_KM = 0.5
/** Springs: the water starts at this share of the full width and reaches it after SOURCE_TAPER_KM. */
const SOURCE_MIN = 0.35
const SOURCE_TAPER_KM = 3
/** Mouths: the water widens up to MOUTH_WIDEN times over the last MOUTH_KM (a small estuary). */
const MOUTH_WIDEN = 1.3
const MOUTH_KM = 2
/**
 * Rivers run on this far (km) into a neighbouring country (Portugal, France, Andorra), then stop;
 * over the last FADE_KM they narrow (and the water mesh fades out), so they do not end in a cliff.
 */
export const EXTEND_KM = 40
const FADE_KM = 12
const FADE_MIN = 0.3
/** Points of a line are checked this often (km) when it is trimmed at EXTEND_KM. */
const TRIM_STEP_KM = 1
/** Line pieces with less than this much (km) on the country's own land are dropped. */
const MIN_HOME_KM = 3
/** The smoothed source lines keep their shape within this distance (km). */
const SMOOTH_TOL_KM = 0.02

type LonLat = [number, number]

/** Distance (km) between two lon/lat points (flat approximation, fine at river scale). */
function distKm(a: LonLat, b: LonLat): number {
  return Math.hypot((a[0] - b[0]) * kmPerDegLon((a[1] + b[1]) / 2), (a[1] - b[1]) * KM_LAT)
}

/** Nearest point of a polyline to `p`, and its distance (km). */
function nearestOnLine(p: LonLat, line: LonLat[]): { point: LonLat; d: number } {
  const kx = kmPerDegLon(p[1])
  let best: LonLat = line[0]
  let bestD = Infinity
  for (let i = 0; i < line.length - 1; i++) {
    const ax = (line[i][0] - p[0]) * kx, ay = (line[i][1] - p[1]) * KM_LAT
    const bx = (line[i + 1][0] - p[0]) * kx, by = (line[i + 1][1] - p[1]) * KM_LAT
    const dx = bx - ax, dy = by - ay
    const t = Math.min(1, Math.max(0, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1e-12)))
    const d = Math.hypot(ax + t * dx, ay + t * dy)
    if (d < bestD) {
      bestD = d
      best = [line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t]
    }
  }
  return { point: best, d: bestD }
}

/** Where rivers may run, on the zone's height grid (see computeExploredRegion). */
export interface RiverReach {
  /** 1 = the country's own land */
  countryLand: Uint8Array
  /** Distance (km) from each cell to the country's land */
  countryKm: Float32Array
  /**
   * The heights (m) the terrain is built from (smoothed): sea and land as the game draws them.
   * The raw grid puts marshes and lagoons (Doñana, the Albufera) at or below 0 m, so a mouth
   * found there would end in a blob on dry ground.
   */
  heights: Float32Array
}

/**
 * Cleans the source lines and labels their ends:
 * 1) pieces of the same river with a small gap between their ends become one line;
 * 1b) with `reach`: lines are cut EXTEND_KM into the neighbouring countries (those ends `fade`),
 *     and pieces that never touch the country itself are dropped;
 * 2) an end close to another river's line is extended onto it (`join`, a confluence);
 * 3) the other ends are a `mouth` if the sea is next to them, a `cut` at the zone edge, else a `source`.
 */
export function prepareRivers(
  rivers: River[],
  zone: Pick<ZoneData, 'bounds' | 'heights' | 'heightWidth' | 'heightHeight'>,
  reach?: RiverReach,
): River[] {
  const { bounds: b, heights, heightWidth: gw, heightHeight: gh } = zone

  // 1) Merge pieces of the same river
  const merged = rivers.map((river) => {
    const lines = river.lines.map((l) => l.slice())
    for (let found = true; found; ) {
      found = false
      for (let i = 0; i < lines.length && !found; i++) {
        for (let j = i + 1; j < lines.length && !found; j++) {
          const a = lines[i], c = lines[j]
          const options: [number, () => LonLat[]][] = [
            [distKm(a[a.length - 1], c[0]), () => [...a, ...c]],
            [distKm(c[c.length - 1], a[0]), () => [...c, ...a]],
            [distKm(a[a.length - 1], c[c.length - 1]), () => [...a, ...c.slice().reverse()]],
            [distKm(a[0], c[0]), () => [...a.slice().reverse(), ...c]],
          ]
          const [d, join] = options.reduce((m, o) => (o[0] < m[0] ? o : m))
          if (d < JOIN_KM) {
            lines[i] = join()
            lines.splice(j, 1)
            found = true
          }
        }
      }
    }
    // Round the corners of the coarse source lines (points ~8 km apart) now: the later steps
    // densify some stretches (trim, monument bends, separation), and their own smoothing then only
    // rounds the corners at that small scale, leaving sharp kinks
    return { ...river, lines: lines.map((l) => simplifyKm(chaikin(l, 4), SMOOTH_TOL_KM)) }
  })

  const cellOf =([lon, lat]: LonLat) => {
    const c = Math.round(((lon - b.west) / (b.east - b.west)) * (gw - 1))
    const r = Math.round(((b.north - lat) / (b.north - b.south)) * (gh - 1))
    return c < 0 || r < 0 || c >= gw || r >= gh ? -1 : r * gw + c
  }

  // 1b) Trim to the country plus EXTEND_KM of its neighbours (trimmed ends fade out)
  const fades = new Map<LonLat[], [boolean, boolean]>()
  const kept = !reach
    ? merged
    : merged
        .map((river) => {
          const lines: LonLat[][] = []
          for (const line of river.lines) {
            for (const piece of trimLine(line, cellOf, reach)) {
              lines.push(piece.line)
              fades.set(piece.line, piece.fade)
            }
          }
          return { ...river, lines }
        })
        .filter((r) => r.lines.length > 0)

  // 2) + 3) Label (and extend) the ends
  const all = kept.flatMap((r, ri) => r.lines.map((line, li) => ({ ri, li, line })))
  const grid = reach?.heights ?? heights
  const heightAt = (p: LonLat) => {
    const i = cellOf(p)
    return i < 0 ? NaN : grid[i]
  }
  /** Open water, not a puddle below 0 m: at least half of a small circle around `q` is sea too. */
  const openSea = (q: LonLat) => {
    if (!(heightAt(q) <= 0)) return false
    const kx = kmPerDegLon(q[1])
    let wet = 0
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2
      if (heightAt([q[0] + (Math.cos(a) * OPEN_SEA_KM) / kx, q[1] + (Math.sin(a) * OPEN_SEA_KM) / KM_LAT]) <= 0) wet++
    }
    return wet >= 6
  }
  /** Nearest open sea point within `searchKm` (rings 0.25 km apart), or null. */
  const nearestSea = (p: LonLat, searchKm = MOUTH_SEARCH_KM): LonLat | null => {
    const kx = kmPerDegLon(p[1])
    const rings = Math.ceil(searchKm / 0.25)
    for (let ring = 0; ring <= rings; ring++) {
      const rKm = (ring / rings) * searchKm
      const count = ring === 0 ? 1 : Math.max(12, Math.round(rKm * 8))
      for (let k = 0; k < count; k++) {
        const a = (k / count) * Math.PI * 2
        const q: LonLat = [p[0] + (Math.cos(a) * rKm) / kx, p[1] + (Math.sin(a) * rKm) / KM_LAT]
        if (openSea(q)) return q
      }
    }
    return null
  }
  /** Runs the end of `out` on `side` straight out into the sea at `sea` (a little past the coast). */
  const reachSea = (out: LonLat[], side: 0 | 1, sea: LonLat) => {
    const end = side === 0 ? out[0] : out[out.length - 1]
    const d = distKm(end, sea)
    if (d < 0.3) return
    const past: LonLat = [sea[0] + ((sea[0] - end[0]) * MOUTH_PAST_KM) / d, sea[1] + ((sea[1] - end[1]) * MOUTH_PAST_KM) / d]
    if (side === 0) out.unshift(past, sea)
    else out.push(sea, past)
  }
  const inZone = ([lon, lat]: LonLat) => lon > b.west && lon < b.east && lat > b.south && lat < b.north

  return kept.map((river, ri) => {
    const ends: [RiverEnd, RiverEnd][] = []
    const lines = river.lines.map((line, li) => {
      const out = line.slice()
      const fade = fades.get(line)
      const kinds = ([0, 1] as const).map((side): RiverEnd => {
        if (fade?.[side]) return 'fade'
        const p = side === 0 ? line[0] : line[line.length - 1]
        let best: { point: LonLat; d: number } | null = null
        for (const o of all) {
          if (o.ri === ri && o.li === li) continue
          const n = nearestOnLine(p, o.line)
          if (!best || n.d < best.d) best = n
        }
        if (best && best.d < JOIN_KM) {
          if (best.d > 0.02) {
            if (side === 0) out.unshift(best.point)
            else out.push(best.point)
          }
          return 'join'
        }
        if (!inZone(p)) return 'cut'
        return nearestSea(p) ? 'mouth' : 'source'
      })
      // A river cannot rise at both ends: the lower one is its mouth (sea a bit further away) or a plain end
      const h0 = heightAt(line[0]) || 0, h1 = heightAt(line[line.length - 1]) || 0
      if (kinds[0] === 'source' && kinds[1] === 'source') kinds[h0 < h1 ? 0 : 1] = 'cut'
      // A low end a few km from the coast is a mouth: the source line just stops short of the sea,
      // so it is run on into it (else the water would end in a round blob by the beach)
      for (const side of [0, 1] as const) {
        const k = kinds[side]
        const lower = side === 0 ? h0 <= h1 : h1 <= h0
        if (!(k === 'mouth' || ((k === 'cut' || k === 'source') && lower))) continue
        const p = side === 0 ? line[0] : line[line.length - 1]
        if (!inZone(p)) continue
        const sea = nearestSea(p, k === 'mouth' ? MOUTH_SEARCH_KM : MOUTH_REACH_KM)
        if (!sea) continue
        reachSea(out, side, sea)
        kinds[side] = 'mouth'
      }
      ends.push([kinds[0], kinds[1]])
      return out
    })
    return { ...river, lines, ends }
  })
}

/**
 * Cuts a line where it goes further than EXTEND_KM from the country (on land or sea). Returns the
 * pieces that run on the country's own land for at least MIN_HOME_KM, and which of their ends
 * were cut here (those ends fade out).
 */
function trimLine(line: LonLat[], cellOf: (p: LonLat) => number, reach: RiverReach) {
  // Densify, so the cut lands within TRIM_STEP_KM of the limit
  const dense: LonLat[] = [line[0]]
  for (let i = 1; i < line.length; i++) {
    const n = Math.max(1, Math.ceil(distKm(line[i - 1], line[i]) / TRIM_STEP_KM))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      dense.push(k === n ? line[i] : [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t])
    }
  }
  const allowed = dense.map((p) => {
    const i = cellOf(p)
    return i >= 0 && reach.countryKm[i] <= EXTEND_KM
  })
  const out: { line: LonLat[]; fade: [boolean, boolean] }[] = []
  let s = -1
  for (let i = 0; i <= dense.length; i++) {
    const ok = i < dense.length && allowed[i]
    if (ok && s < 0) s = i
    if (!ok && s >= 0) {
      const piece = dense.slice(s, i)
      let home = 0
      for (let k = 1; k < piece.length; k++) {
        const c = cellOf(piece[k])
        if (c >= 0 && reach.countryLand[c]) home += distKm(piece[k - 1], piece[k])
      }
      if (piece.length >= 2 && home >= MIN_HOME_KM) out.push({ line: simplifyKm(piece, SMOOTH_TOL_KM), fade: [s > 0, i < dense.length] })
      s = -1
    }
  }
  return out
}

/** Drops the points the densify step added back (Douglas-Peucker, tolerance in km; ends kept). */
function simplifyKm(line: LonLat[], tolKm: number): LonLat[] {
  if (line.length <= 2) return line
  const keep = new Uint8Array(line.length)
  keep[0] = keep[line.length - 1] = 1
  const stack: [number, number][] = [[0, line.length - 1]]
  while (stack.length) {
    const [a, e] = stack.pop()!
    let maxD = -1, idx = -1
    for (let i = a + 1; i < e; i++) {
      const d = nearestOnLine(line[i], [line[a], line[e]]).d
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (maxD > tolKm) {
      keep[idx] = 1
      stack.push([a, idx], [idx, e])
    }
  }
  return line.filter((_, i) => keep[i])
}

/** Width scale (1 = normal) at `dKm` from a line end of the given kind. */
function endWidthScale(dKm: number, kind: RiverEnd): number {
  if (kind === 'source') return SOURCE_MIN + (1 - SOURCE_MIN) * smooth(0, SOURCE_TAPER_KM, dKm)
  if (kind === 'fade') return FADE_MIN + (1 - FADE_MIN) * smooth(0, FADE_KM, dKm)
  if (kind === 'mouth') return 1 + (MOUTH_WIDEN - 1) * (1 - smooth(0, MOUTH_KM, dKm))
  return 1
}

/** Width scale of a river at `fromStartKm` along a line of `lengthKm` with these end kinds. */
export function riverWidthScale(fromStartKm: number, lengthKm: number, ends: [RiverEnd, RiverEnd] | undefined): number {
  if (!ends) return 1
  return endWidthScale(Math.max(0, fromStartKm), ends[0]) * endWidthScale(Math.max(0, lengthKm - fromStartKm), ends[1])
}

export interface RiverField {
  /** Distance (px) from each pixel to the nearest water edge; negative inside the water. */
  edge: Float32Array
  /** Half width (px) of the river that owns each pixel (0 = no river nearby). */
  halfWidth: Float32Array
  /** Extra carve depth (world units) of the river that owns each pixel (only with `extraDepth`). */
  extra: Float32Array
}

/**
 * Rasterises the rivers into a w×h raster that covers `bounds` (pixel 0 = west/north edge,
 * pixel w-1 / h-1 = east/south edge, like the height grid and the toy-map texture).
 * Only pixels within `reachKm` of a water edge are written; the rest keep edge = +Infinity.
 */
export function rasterizeRivers(
  rivers: River[],
  bounds: Bounds,
  w: number,
  h: number,
  pxPerKm: number,
  reachKm: number,
  /** Minimum half width (px) for ranks 1–2, so big rivers still read in the far overview. */
  minHalfPx = 0,
  /** Per river, per line, per point of chaikin(line, 3): extra carve depth (see riverProfiles). */
  extraDepth?: number[][][],
): RiverField {
  const edge = new Float32Array(w * h).fill(Infinity)
  const halfWidth = new Float32Array(w * h)
  const extra = new Float32Array(extraDepth ? w * h : 0)
  const sx = (w - 1) / (bounds.east - bounds.west)
  const sy = (h - 1) / (bounds.north - bounds.south)

  rivers.forEach((river, ri) => {
    const hwFull = Math.max(riverHalfWidthKm(river.rank) * pxPerKm, river.rank <= 2 ? minHalfPx : 0)
    const reachPx = reachKm * pxPerKm
    river.lines.forEach((line, li) => {
      const ex = extraDepth?.[ri]?.[li]
      const pts = chaikin(line, 3).map(([lon, lat]) => [(lon - bounds.west) * sx, (bounds.north - lat) * sy])
      // Half width at each point: narrow at springs, wider at mouths (same profile as the water mesh)
      const along = [0]
      for (let s = 1; s < pts.length; s++) along.push(along[s - 1] + Math.hypot(pts[s][0] - pts[s - 1][0], pts[s][1] - pts[s - 1][1]) / pxPerKm)
      const total = along[along.length - 1]
      const hws = along.map((a) => hwFull * riverWidthScale(a, total, river.ends?.[li]))
      for (let s = 0; s < pts.length - 1; s++) {
        const [ax, ay] = pts[s], [bx, by] = pts[s + 1]
        const ha = hws[s], hb = hws[s + 1]
        const reach = Math.max(ha, hb) + reachPx
        const dx = bx - ax, dy = by - ay
        const len2 = dx * dx + dy * dy || 1e-9
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - reach))
        const x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + reach))
        const y0 = Math.max(0, Math.floor(Math.min(ay, by) - reach))
        const y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + reach))
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / len2))
            const ox = x - (ax + t * dx), oy = y - (ay + t * dy)
            const hw = ha + (hb - ha) * t
            const e = Math.sqrt(ox * ox + oy * oy) - hw
            const i = y * w + x
            if (e < edge[i] && e < reachPx) {
              edge[i] = e
              halfWidth[i] = hw
              if (ex) extra[i] = ex[s] + (ex[s + 1] - ex[s]) * t
            }
          }
        }
      }
    })
  })
  return { edge, halfWidth, extra }
}

/** Which end of a line is downstream, by kind: higher = further downstream (same as createRivers). */
export const DOWNSTREAM: Record<RiverEnd, number> = { source: 0, cut: 1, fade: 1, join: 2, mouth: 3 }

/** Deepest extra carve (world units, about 380 m of real relief): a river never cuts deeper. */
const MAX_EXTRA = 24

/**
 * How much deeper than the usual channel each river must cut so that it only ever runs downhill.
 * The source lines (Natural Earth) do not follow the valleys of the height grid exactly, and the
 * relief is exaggerated, so a river would often climb over a ridge; the water then broke into
 * pieces or floated. Along each line (at the points of chaikin(line, 3)), from upstream to
 * downstream, the bed follows the lowest ground met so far: extra = ground - that minimum.
 * @param groundY uncarved ground height (world units) at a lon/lat
 */
export function riverProfiles(rivers: River[], groundY: (lon: number, lat: number) => number): number[][][] {
  return rivers.map((river) =>
    river.lines.map((line, li) => {
      const pts = chaikin(line, 3)
      const y = pts.map(([lon, lat]) => groundY(lon, lat))
      const ends = river.ends?.[li] ?? (['cut', 'cut'] as [RiverEnd, RiverEnd])
      const d = DOWNSTREAM[ends[1]] - DOWNSTREAM[ends[0]]
      const forward = d > 0 || (d === 0 && y[0] >= y[y.length - 1])
      const order = forward ? y.map((_, i) => i) : y.map((_, i) => y.length - 1 - i)
      const extra = new Array<number>(y.length).fill(0)
      let low = Infinity
      for (const i of order) {
        if (!Number.isFinite(y[i])) continue
        low = Math.min(low, y[i])
        extra[i] = Math.min(MAX_EXTRA, y[i] - low)
      }
      return extra
    }),
  )
}

/**
 * An area (e.g. a monument footprint) that rivers must flow around: a circle, or, when `rect` is
 * given, the real rotated rectangle of the footprint plus a margin (rivers then hug its edge).
 */
export interface RiverClearing {
  lon: number
  lat: number
  radiusKm: number
  /** Radius (km) of the object itself (without margin): the ground there is never carved. */
  innerKm?: number
  /** Rotated rectangle: half sizes (km) and turn (radians, as the monument's holder.rotation.y). */
  rect?: { halfWKm: number; halfDKm: number; angle: number; marginKm: number }
}

/**
 * How long a monument's bend is: the river moves aside over max(DETOUR_MIN_KM, DETOUR_SPREAD x
 * clearance) km of its course on each side of the monument, so it reads as a natural meander and
 * not as a river hugging the building.
 */
const DETOUR_SPREAD = 3
const DETOUR_MIN_KM = 6

/** Same equirectangular projection as map/projection.ts (km per degree, reference latitude 40). */
const KM_PER_DEG_LON = 111.32 * Math.cos((40 * Math.PI) / 180)
const KM_PER_DEG_LAT = 110.57

/**
 * Point (lon, lat) in the rectangle's own frame (km; u along its width, v along its depth), and
 * back. Same rotation as createLandmarks (east = +x, south = +z).
 */
function toRect(c: RiverClearing, lon: number, lat: number) {
  const a = c.rect!.angle
  const dx = (lon - c.lon) * KM_PER_DEG_LON, dz = -(lat - c.lat) * KM_PER_DEG_LAT
  return { u: dx * Math.cos(a) - dz * Math.sin(a), v: dx * Math.sin(a) + dz * Math.cos(a) }
}
/** Distance (km) from (lon, lat) to the edge of a rectangular clearing's footprint (0 inside). */
export function rectClearingDistanceKm(c: RiverClearing, lon: number, lat: number) {
  const { u, v } = toRect(c, lon, lat)
  return Math.hypot(Math.max(0, Math.abs(u) - c.rect!.halfWKm), Math.max(0, Math.abs(v) - c.rect!.halfDKm))
}

/**
 * Bends the rivers around the clearings, then keeps them from overlapping each other.
 * 1) bendAround: a river that passes too close to a monument moves aside to ONE side (the side it
 *    already passes on) in a long, smooth bump along its course: a gentle meander, with no corners
 *    and no risk of splitting the river around both sides of the building.
 * 2) snapJoins: a tributary whose main river moved is eased onto it again over its last km.
 * 3) separateRivers: where two rivers run so close that their water ribbons would overlap (the
 *    cartoon widths are much wider than real rivers), the smaller one is eased away from the
 *    bigger one. Confluences and crossings are left alone.
 */
export function bendRiversAround(rivers: River[], clearings: RiverClearing[]): River[] {
  const bent = clearings.length === 0 ? rivers : rivers.map((river) => {
    const hw = riverHalfWidthKm(river.rank)
    return { ...river, lines: river.lines.map((line) => clearings.reduce((l, c) => bendAround(l, c, hw), line)) }
  })
  return separateRivers(snapJoins(bent))
}

/** Points of a polyline are this far apart (km) where it is bent around a monument. */
const BEND_STEP_KM = 0.3

/**
 * Moves the stretch of `line` that passes too close to a clearing sideways, to one side: just far
 * enough that its water and banks clear the monument's footprint (its real rectangle; monuments
 * are tens of km long at the cartoon scale) plus margin. The shift is held along the footprint
 * and fades out smoothly along the river over `spread` km each way (no kink where the bend ends).
 */
function bendAround(line: LonLat[], c: RiverClearing, hw: number): LonLat[] {
  const kx = kmPerDegLon(c.lat)
  // Clearance from the footprint edge (rectangle) or from the circle (radius includes the margin)
  const clearance = (c.rect ? c.rect.marginKm : 0) + hw + BANK_KM
  const toLonLat = ([x, y]: [number, number]): LonLat => [c.lon + x / kx, c.lat + y / KM_LAT]
  const gap = (p: [number, number]) => {
    if (!c.rect) return Math.hypot(p[0], p[1]) - c.radiusKm
    const [lon, lat] = toLonLat(p)
    return rectClearingDistanceKm(c, lon, lat)
  }
  /** How far the clearing reaches from its centre in the direction (dx east, dy north), km. */
  const support = (dx: number, dy: number) => {
    if (!c.rect) return c.radiusKm
    const a = c.rect.angle
    // Same rotation as toRect (x east, z south)
    const u = dx * Math.cos(a) + dy * Math.sin(a), v = dx * Math.sin(a) - dy * Math.cos(a)
    return c.rect.halfWKm * Math.abs(u) + c.rect.halfDKm * Math.abs(v)
  }
  const reach = support(1, 0) + support(0, 1) + clearance

  let pts = line.map(([lon, lat]): [number, number] => [(lon - c.lon) * kx, (lat - c.lat) * KM_LAT])
  let close = false
  for (let i = 0; i < pts.length - 1 && !close; i++) close = closestOnSegment([0, 0], pts[i], pts[i + 1]).d < reach
  if (!close) return line

  // Densify the part that may move
  const dense: [number, number][] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = closestOnSegment([0, 0], a, b).d < reach * 3 + DETOUR_MIN_KM ? Math.ceil(len / BEND_STEP_KM) : 1
    for (let k = 1; k <= n; k++) dense.push(k === n ? b : [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
  }
  pts = dense
  if (pts.every((p) => gap(p) >= clearance * 0.98)) return line

  // A few rounds: a river that curls around the monument may still pass close after one bump
  for (let round = 0; round < 3; round++) {
    let k = 0, kd = Infinity
    pts.forEach((p, i) => {
      const d = gap(p)
      if (d < kd) {
        kd = d
        k = i
      }
    })
    if (kd >= clearance * 0.98) break
    // Side: perpendicular to the river there, pointing from the monument towards the river
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)]
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const tx = (b[0] - a[0]) / tl, ty = (b[1] - a[1]) / tl
    let nx = -ty, ny = tx
    let across = pts[k][0] * nx + pts[k][1] * ny
    if (across < 0) {
      nx = -nx
      ny = -ny
      across = -across
    }
    const shift = support(nx, ny) + clearance - across
    if (shift <= 0) break
    // Held over the footprint's length along the river, then a smooth bell
    const plateau = support(tx, ty) + clearance
    const spread = Math.max(DETOUR_MIN_KM, DETOUR_SPREAD * shift)
    // Arc length from the closest point, both ways
    const s = new Float64Array(pts.length)
    for (let i = k + 1; i < pts.length; i++) s[i] = s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    for (let i = k - 1; i >= 0; i--) s[i] = s[i + 1] + Math.hypot(pts[i][0] - pts[i + 1][0], pts[i][1] - pts[i + 1][1])
    pts = pts.map(([x, y], i) => {
      const u = Math.max(0, s[i] - plateau) / spread
      if (u >= 1) return [x, y]
      const w = (1 - u * u) ** 2
      return [x + nx * shift * w, y + ny * shift * w]
    })
  }
  return pts.map(toLonLat)
}

/** A confluence end that ended up this far (km) from its main river is eased back onto it. */
const SNAP_MAX_KM = 15
/** ...over this much of the tributary's course (km), at least. */
const SNAP_MIN_SPAN_KM = 3

/** Eases each `join` end back onto the nearest other line (the bend may have moved either one). */
function snapJoins(rivers: River[]): River[] {
  const all = rivers.flatMap((r, ri) => r.lines.map((line, li) => ({ ri, li, line })))
  return rivers.map((river, ri) => ({
    ...river,
    lines: river.lines.map((line, li) => {
      let out = line
      for (const side of [0, 1] as const) {
        if (river.ends?.[li]?.[side] !== 'join') continue
        const end = side === 0 ? out[0] : out[out.length - 1]
        let best: { point: LonLat; d: number } | null = null
        for (const o of all) {
          if (o.ri === ri && o.li === li) continue
          const n = nearestOnLine(end, o.line)
          if (!best || n.d < best.d) best = n
        }
        if (!best || best.d < 0.02 || best.d > SNAP_MAX_KM) continue
        const dx = best.point[0] - end[0], dy = best.point[1] - end[1]
        const span = Math.max(SNAP_MIN_SPAN_KM, best.d * 3)
        const orig = side === 0 ? out.slice() : out.slice().reverse()
        const pts = orig.slice()
        let along = 0
        for (let i = 0; i < pts.length; i++) {
          if (i > 0) along += distKm(orig[i - 1], orig[i])
          if (along >= span) break
          const w = (1 - along / span) ** 2
          pts[i] = [pts[i][0] + dx * w, pts[i][1] + dy * w]
        }
        out = side === 0 ? pts : pts.reverse()
      }
      return out
    }),
  }))
}

// ---------------------------------------------------------------------------------------------
// River vs river: two water ribbons must never overlap (except where one joins the other)
// ---------------------------------------------------------------------------------------------

/** Gap (km) kept between two water ribbons, on top of both half widths (their banks). */
const RIVER_SEP_GAP_KM = 2 * BANK_KM
/** Width (km) of the soft zone over which a river is eased away from a bigger one. */
const RIVER_SEP_FALLOFF_KM = 2.5
/** Around a confluence or a crossing nothing moves within this distance (km), then it eases in. */
const RIVER_PROTECT_KM = 3
/** Long segments near another river are split into pieces this long (km) before moving them. */
const RIVER_SEP_STEP_KM = 0.4
const RIVER_SEP_PASSES = 2
const SEP_CELL_KM = 6

interface PlanarLine {
  /** River index, line index and rank (the river with the lower rank number is the bigger one). */
  ri: number
  li: number
  rank: number
  /** Water half width (km, full width: conservative near springs). */
  hw: number
  pts: [number, number][]
}

/** Lines of all rivers in a flat km frame around the zone (lon/lat converted back at the end). */
function toPlanar(rivers: River[]) {
  let latSum = 0, count = 0
  for (const r of rivers) for (const l of r.lines) for (const p of l) {
    latSum += p[1]
    count++
  }
  const kx = kmPerDegLon(count ? latSum / count : 40)
  const lines: PlanarLine[] = rivers.flatMap((r, ri) =>
    r.lines.map((line, li) => ({
      ri,
      li,
      rank: r.rank,
      hw: riverHalfWidthKm(r.rank) * 1.06, // the water mesh is a hair wider (WIDTH_FACTOR in createRivers)
      pts: line.map(([lon, lat]): [number, number] => [lon * kx, lat * KM_LAT]),
    })),
  )
  return { lines, back: ([x, y]: [number, number]): [number, number] => [x / kx, y / KM_LAT] }
}

/** Segment grid of planar lines, for nearest-point and crossing queries. */
function segmentGrid(lines: PlanarLine[]) {
  const grid = new Map<string, { l: number; i: number }[]>()
  lines.forEach((line, l) => {
    for (let i = 0; i < line.pts.length - 1; i++) {
      const [ax, ay] = line.pts[i], [bx, by] = line.pts[i + 1]
      const c0 = Math.floor(Math.min(ax, bx) / SEP_CELL_KM), c1 = Math.floor(Math.max(ax, bx) / SEP_CELL_KM)
      const r0 = Math.floor(Math.min(ay, by) / SEP_CELL_KM), r1 = Math.floor(Math.max(ay, by) / SEP_CELL_KM)
      for (let c = c0; c <= c1; c++) {
        for (let r = r0; r <= r1; r++) {
          const key = `${c},${r}`
          let list = grid.get(key)
          if (!list) grid.set(key, (list = []))
          list.push({ l, i })
        }
      }
    }
  })
  /** Segments whose cells touch the square of half size `reach` around (x, y). */
  const near = (x: number, y: number, reach: number) => {
    const out = new Set<{ l: number; i: number }>()
    const c0 = Math.floor((x - reach) / SEP_CELL_KM), c1 = Math.floor((x + reach) / SEP_CELL_KM)
    const r0 = Math.floor((y - reach) / SEP_CELL_KM), r1 = Math.floor((y + reach) / SEP_CELL_KM)
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) for (const s of grid.get(`${c},${r}`) ?? []) out.add(s)
    return out
  }
  return { near }
}

/** Closest point of segment a-b to p: the point and its distance. */
function closestOnSegment(p: [number, number], a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1e-12)))
  const cx = a[0] + dx * t, cy = a[1] + dy * t
  return { cx, cy, d: Math.hypot(p[0] - cx, p[1] - cy) }
}

/** Points where two different lines meet: confluence ends ('join') and real crossings. */
function meetingPoints(rivers: River[], lines: PlanarLine[]): [number, number][] {
  const out: [number, number][] = []
  for (const line of lines) {
    const ends = rivers[line.ri].ends?.[line.li]
    if (ends?.[0] === 'join') out.push(line.pts[0])
    if (ends?.[1] === 'join') out.push(line.pts[line.pts.length - 1])
  }
  const grid = segmentGrid(lines)
  lines.forEach((line, l) => {
    for (let i = 0; i < line.pts.length - 1; i++) {
      const [px, py] = line.pts[i], [qx, qy] = line.pts[i + 1]
      const rx = qx - px, ry = qy - py
      for (const s of grid.near((px + qx) / 2, (py + qy) / 2, Math.hypot(rx, ry) / 2)) {
        if (s.l <= l) continue // each pair once, never a line with itself
        const [ax, ay] = lines[s.l].pts[s.i], [bx, by] = lines[s.l].pts[s.i + 1]
        const sx = bx - ax, sy = by - ay
        const den = rx * sy - ry * sx
        if (Math.abs(den) < 1e-12) continue
        const t = ((ax - px) * sy - (ay - py) * sx) / den
        const u = ((ax - px) * ry - (ay - py) * rx) / den
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) out.push([px + rx * t, py + ry * t])
      }
    }
  })
  return out
}

/** true if line a gives way to line b (b is the bigger river; ties go by order). */
const yields = (a: PlanarLine, b: PlanarLine, ia: number, ib: number) => a.rank > b.rank || (a.rank === b.rank && ia > ib)

/**
 * Eases smaller rivers away from bigger ones where their water ribbons would overlap. A point of
 * the smaller river closer than (both half widths + gap) to the bigger one's centre line moves
 * out along the line between them, with the same soft falloff the roads use beside rivers.
 * Nothing moves near a confluence or a crossing (the tributary must still reach its river).
 */
function separateRivers(rivers: River[]): River[] {
  if (rivers.length < 2) return rivers
  const { lines, back } = toPlanar(rivers)
  const maxHw = Math.max(...lines.map((l) => l.hw))
  const meets = meetingPoints(rivers, lines)
  const protect = (x: number, y: number) => {
    let w = 1
    for (const [mx, my] of meets) w = Math.min(w, smooth(RIVER_PROTECT_KM, RIVER_PROTECT_KM * 2, Math.hypot(x - mx, y - my)))
    return w
  }
  let moved = false
  for (let pass = 0; pass < RIVER_SEP_PASSES; pass++) {
    const grid = segmentGrid(lines)
    /** Nearest point of a bigger line within `reach` of its water edge, or null. */
    const nearestBigger = (p: [number, number], l: number) => {
      const reach = lines[l].hw + RIVER_SEP_GAP_KM + RIVER_SEP_FALLOFF_KM
      let best: { cx: number; cy: number; d: number; need: number } | null = null
      for (const s of grid.near(p[0], p[1], reach + maxHw)) {
        const other = lines[s.l]
        if (!yields(lines[l], other, l, s.l)) continue
        const c = closestOnSegment(p, other.pts[s.i], other.pts[s.i + 1])
        const need = lines[l].hw + other.hw + RIVER_SEP_GAP_KM
        if (c.d < need + RIVER_SEP_FALLOFF_KM && (!best || c.d - need < best.d - best.need)) best = { ...c, need }
      }
      return best
    }
    lines.forEach((line, l) => {
      // Split long segments that pass near a bigger river, so the push follows it smoothly
      const dense: [number, number][] = []
      for (let i = 0; i < line.pts.length; i++) {
        const a = line.pts[i]
        dense.push(a)
        if (i === line.pts.length - 1) break
        const b = line.pts[i + 1]
        const len = Math.hypot(b[0] - a[0], b[1] - a[1])
        if (len <= RIVER_SEP_STEP_KM) continue
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
        const reach = line.hw + maxHw + RIVER_SEP_GAP_KM + RIVER_SEP_FALLOFF_KM + len / 2
        let close = false
        for (const s of grid.near(mid[0], mid[1], reach)) {
          if (!yields(line, lines[s.l], l, s.l)) continue
          if (closestOnSegment(mid, lines[s.l].pts[s.i], lines[s.l].pts[s.i + 1]).d < reach) {
            close = true
            break
          }
        }
        if (!close) continue
        const n = Math.ceil(len / RIVER_SEP_STEP_KM)
        for (let k = 1; k < n; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n])
      }
      line.pts = dense.map((p, i): [number, number] => {
        if (i === 0 || i === dense.length - 1) return p // ends stay (joins, mouths, zone edges)
        const nb = nearestBigger(p, l)
        if (!nb) return p
        const w = protect(p[0], p[1])
        if (w === 0) return p
        const outer = nb.need + RIVER_SEP_FALLOFF_KM
        const nd = nb.need + (nb.d / outer) * (outer - nb.need)
        if (nd <= nb.d) return p
        if (nb.d < 1e-6) return p // exactly on the other line: a crossing, left to the protection
        const ux = (p[0] - nb.cx) / nb.d, uy = (p[1] - nb.cy) / nb.d
        moved = true
        return [p[0] + (nb.cx + ux * nd - p[0]) * w, p[1] + (nb.cy + uy * nd - p[1]) * w]
      })
    })
  }
  if (!moved) return rivers
  return rivers.map((river, ri) => ({
    ...river,
    lines: river.lines.map((_, li) => lines.find((l) => l.ri === ri && l.li === li)!.pts.map(back)),
  }))
}

/**
 * Development check: points of a river inside another river's water (both half widths), away
 * from confluences and crossings. Should be 0 after bendRiversAround.
 */
export function riverOverlaps(rivers: River[] | undefined): number {
  if (!rivers || rivers.length < 2) return 0
  const { lines } = toPlanar(rivers)
  const meets = meetingPoints(rivers, lines)
  const grid = segmentGrid(lines)
  const maxHw = Math.max(...lines.map((l) => l.hw))
  let count = 0
  lines.forEach((line, l) => {
    for (const p of line.pts) {
      if (meets.some(([mx, my]) => Math.hypot(p[0] - mx, p[1] - my) < RIVER_PROTECT_KM * 2)) continue
      for (const s of grid.near(p[0], p[1], line.hw + maxHw)) {
        if (s.l === l) continue
        const other = lines[s.l]
        if (closestOnSegment(p, other.pts[s.i], other.pts[s.i + 1]).d < line.hw + other.hw) {
          count++
          break
        }
      }
    }
  })
  return count
}

/** Reach (km) that `paintRiver` needs from the field. */
export const PAINT_REACH_KM = BANK_KM + 0.6
/** Minimum painted half width (texture px) of ranks 1–2. */
export const PAINT_MIN_HALF_PX = 3.5

/**
 * Colour of a land pixel with the river painted on top: blue water, lighter water near the edge,
 * a thin white foam line and a pale bank. Band edges are soft (~1–2 px) so they stay clean up
 * close, where one texture pixel covers a few world units.
 */
export function paintRiver(land: RGB, e: number, hwPx: number, pxPerKm: number): RGB {
  const bankW = BANK_KM * pxPerKm + 1
  if (!(e < bankW + 1)) return land
  // The animated water mesh (scene/createRivers.ts) covers the channel: here only a sandy bank,
  // a darker wet strip at the shore and deep water underneath (seen in the far, mipmapped view)
  void hwPx
  let c = mix(land, RIVER_COLORS.bank, 0.35 * smooth(bankW + 1, 0, e)) // bank fades out gradually
  c = mix(c, scale(c, 0.82), smooth(2, 0, e)) // wet earth at the shore
  c = mix(c, RIVER_COLORS.water, smooth(0.5, -1, e))
  return c
}

/**
 * How deep (world units) to carve the terrain under the rivers, per height-grid cell, plus the
 * river edge field on the grid (cells; used to keep houses and trees out of the water).
 * Returns null when there are no rivers. The ground under each `keepDry` object (its inner
 * radius) is never carved, with a soft ramp out to its full radius, so monuments never float.
 * The rest of a flattened plaza is carved normally: a river crosses it in a real channel
 * instead of floating over the flat ground.
 */
export function riverCarveDepth(
  rivers: River[] | undefined,
  bounds: Bounds,
  gw: number,
  gh: number,
  cellsPerKm: number,
  isLand: Uint8Array,
  keepDry: RiverClearing[] = [],
  /** Uncarved ground height (world units) of a cell, NaN on the sea: rivers then only run downhill (riverProfiles). */
  groundY?: (i: number) => number,
): { carve: Float32Array; edge: Float32Array } | null {
  if (!rivers || rivers.length === 0) return null
  const sx = (gw - 1) / (bounds.east - bounds.west)
  const sy = (gh - 1) / (bounds.north - bounds.south)
  const profiles = groundY
    ? riverProfiles(rivers, (lon, lat) => {
        const c = Math.round((lon - bounds.west) * sx), r = Math.round((bounds.north - lat) * sy)
        return c < 0 || r < 0 || c >= gw || r >= gh ? NaN : groundY(r * gw + c)
      })
    : undefined
  const { edge, halfWidth, extra } = rasterizeRivers(rivers, bounds, gw, gh, cellsPerKm, FIELD_REACH_KM, 0, profiles)
  const carve = new Float32Array(gw * gh)
  const dry = keepDry.map((k) => ({
    k,
    c: (k.lon - bounds.west) * sx,
    r: (bounds.north - k.lat) * sy,
    inner: (k.innerKm ?? k.radiusKm) * cellsPerKm,
    outer: k.radiusKm * cellsPerKm,
  }))
  for (let r = 1; r < gh - 1; r++) {
    for (let c = 1; c < gw - 1; c++) {
      const i = r * gw + c
      const e = edge[i]
      const deeper = profiles ? extra[i] : 0
      // A deeper cut gets wider, gentler banks (a valley, not a slot)
      const bank = Math.min(CARVE_BANK_KM + deeper * CARVE_BANK_PER_UNIT, CARVE_BANK_MAX_KM) * cellsPerKm
      if (!(e < bank) || !isLand[i]) continue
      let keep = 1
      for (const d of dry) {
        const dist = Math.hypot(c - d.c, r - d.r)
        if (dist >= d.outer) continue
        if (d.k.rect) {
          // Rectangle: dry over the footprint itself, carving ramps in across the margin
          const km = rectClearingDistanceKm(d.k, bounds.west + c / sx, bounds.north - r / sy)
          if (km < d.k.rect.marginKm) keep = Math.min(keep, smooth(0, d.k.rect.marginKm, km))
        } else keep = Math.min(keep, smooth(d.inner, d.outer, dist))
      }
      if (keep === 0) continue
      const hw = halfWidth[i]
      const depth = channelDepth(hw / cellsPerKm) + deeper
      carve[i] = depth * smooth(bank, -hw * 0.5, e) * keep
    }
  }
  return { carve, edge }
}
