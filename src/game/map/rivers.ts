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
/** Springs: the water starts at this share of the full width and reaches it after SOURCE_TAPER_KM. */
const SOURCE_MIN = 0.35
const SOURCE_TAPER_KM = 3
/** Mouths: the water widens up to MOUTH_WIDEN times over the last MOUTH_KM (a small estuary). */
const MOUTH_WIDEN = 1.3
const MOUTH_KM = 2

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

/**
 * Cleans the source lines and labels their ends:
 * 1) pieces of the same river with a small gap between their ends become one line;
 * 2) an end close to another river's line is extended onto it (`join`, a confluence);
 * 3) the other ends are a `mouth` if the sea is next to them, a `cut` at the zone edge, else a `source`.
 */
export function prepareRivers(rivers: River[], zone: Pick<ZoneData, 'bounds' | 'heights' | 'heightWidth' | 'heightHeight'>): River[] {
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
    return { ...river, lines }
  })

  // 2) + 3) Label (and extend) the ends
  const all = merged.flatMap((r, ri) => r.lines.map((line, li) => ({ ri, li, line })))
  const heightAt = ([lon, lat]: LonLat) => {
    const c = Math.round(((lon - b.west) / (b.east - b.west)) * (gw - 1))
    const r = Math.round(((b.north - lat) / (b.north - b.south)) * (gh - 1))
    return c < 0 || r < 0 || c >= gw || r >= gh ? NaN : heights[r * gw + c]
  }
  const seaNear = (p: LonLat, searchKm = MOUTH_SEARCH_KM) => {
    const kx = kmPerDegLon(p[1])
    for (let ring = 0; ring <= 3; ring++) {
      const rKm = (ring / 3) * searchKm
      for (let k = 0; k < (ring === 0 ? 1 : 12); k++) {
        const a = (k / 12) * Math.PI * 2
        if (heightAt([p[0] + (Math.cos(a) * rKm) / kx, p[1] + (Math.sin(a) * rKm) / KM_LAT]) <= 0) return true
      }
    }
    return false
  }
  const inZone = ([lon, lat]: LonLat) => lon > b.west && lon < b.east && lat > b.south && lat < b.north

  return merged.map((river, ri) => {
    const ends: [RiverEnd, RiverEnd][] = []
    const lines = river.lines.map((line, li) => {
      const out = line.slice()
      const kinds = ([0, 1] as const).map((side): RiverEnd => {
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
        return seaNear(p) ? 'mouth' : 'source'
      })
      // A river cannot rise at both ends: the lower one is its mouth (sea a bit further away) or a plain end
      if (kinds[0] === 'source' && kinds[1] === 'source') {
        const low = (heightAt(line[0]) || 0) < (heightAt(line[line.length - 1]) || 0) ? 0 : 1
        kinds[low] = seaNear(low === 0 ? line[0] : line[line.length - 1], MOUTH_SEARCH_KM * 4) ? 'mouth' : 'cut'
      }
      ends.push([kinds[0], kinds[1]])
      return out
    })
    return { ...river, lines, ends }
  })
}

/** Width scale (1 = normal) at `dKm` from a line end of the given kind. */
function endWidthScale(dKm: number, kind: RiverEnd): number {
  if (kind === 'source') return SOURCE_MIN + (1 - SOURCE_MIN) * smooth(0, SOURCE_TAPER_KM, dKm)
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
): RiverField {
  const edge = new Float32Array(w * h).fill(Infinity)
  const halfWidth = new Float32Array(w * h)
  const sx = (w - 1) / (bounds.east - bounds.west)
  const sy = (h - 1) / (bounds.north - bounds.south)

  for (const river of rivers) {
    const hwFull = Math.max(riverHalfWidthKm(river.rank) * pxPerKm, river.rank <= 2 ? minHalfPx : 0)
    const reachPx = reachKm * pxPerKm
    river.lines.forEach((line, li) => {
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
            const ex = x - (ax + t * dx), ey = y - (ay + t * dy)
            const hw = ha + (hb - ha) * t
            const e = Math.sqrt(ex * ex + ey * ey) - hw
            const i = y * w + x
            if (e < edge[i] && e < reachPx) {
              edge[i] = e
              halfWidth[i] = hw
            }
          }
        }
      }
    })
  }
  return { edge, halfWidth }
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
 * How far a monument bends a river: from the target distance out to target + max(DETOUR_MIN_KM,
 * DETOUR_SPREAD x target). The bend is spread over many km, so it reads as a natural meander and
 * not as a river hugging the building.
 */
const DETOUR_SPREAD = 3
const DETOUR_MIN_KM = 6

/**
 * Wide smooth push: a point at distance d (< outer) from a clearing moves out to
 * d + target * (1 - d / outer)^2. It starts at `target`, meets the identity at `outer` with the same
 * slope (no kink where the bend ends) and is monotonic while outer > 2 x target (always true with
 * the spread above), so the order of the points and of nearby rivers is kept.
 */
function pushedDistance(d: number, target: number, outer: number) {
  return d >= outer ? d : d + target * (1 - d / outer) ** 2
}
const detourOuter = (target: number) => target + Math.max(DETOUR_MIN_KM, DETOUR_SPREAD * target)

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
function fromRect(c: RiverClearing, u: number, v: number): [number, number] {
  const a = c.rect!.angle
  const dx = u * Math.cos(a) + v * Math.sin(a), dz = -u * Math.sin(a) + v * Math.cos(a)
  return [c.lon + dx / KM_PER_DEG_LON, c.lat - dz / KM_PER_DEG_LAT]
}

/** Distance (km) from (lon, lat) to the edge of a rectangular clearing's footprint (0 inside). */
export function rectClearingDistanceKm(c: RiverClearing, lon: number, lat: number) {
  const { u, v } = toRect(c, lon, lat)
  return Math.hypot(Math.max(0, Math.abs(u) - c.rect!.halfWKm), Math.max(0, Math.abs(v) - c.rect!.halfDKm))
}

/**
 * Pushes a point out of a rectangular clearing: a point whose distance d to the footprint edge is
 * below `outer` slides along the ray from the centre until its distance is
 * pushedDistance(d, target, outer). Rays from the centre of a convex shape cross every
 * distance contour once, so the map is continuous (a river passing beside the centre wraps around
 * the near side, it never jumps across) and keeps the order of the points.
 */
function pushOutOfRect(c: RiverClearing, lon: number, lat: number, target: number, outer: number): [number, number] {
  const { halfWKm: a, halfDKm: b } = c.rect!
  const dist = (u: number, v: number) => Math.hypot(Math.max(0, Math.abs(u) - a), Math.max(0, Math.abs(v) - b))
  const { u, v } = toRect(c, lon, lat)
  const d = dist(u, v)
  if (d >= outer) return [lon, lat]
  const nd = pushedDistance(d, target, outer)
  const len = Math.hypot(u, v)
  const du = len > 1e-9 ? u / len : 0, dv = len > 1e-9 ? v / len : 1
  let lo = 0, hi = Math.hypot(a, b) + nd + 1
  for (let i = 0; i < 32; i++) {
    const t = (lo + hi) / 2
    if (dist(du * t, dv * t) < nd) lo = t
    else hi = t
  }
  return fromRect(c, du * hi, dv * hi)
}

/**
 * Bends the rivers around the clearings, then keeps them from overlapping each other.
 * 1) Points near a clearing are pushed out along the ray from its centre with a wide smooth
 *    falloff (pushedDistance): the river swings around the monument in a long gentle curve.
 *    The push is one warp of the plane shared by every river, so a tributary still meets its main
 *    river exactly (both move the same way) and two rivers never swap sides. Segments near a
 *    clearing are densified first so long segments cannot cut through it.
 * 2) separateRivers: where two rivers run so close that their water ribbons would overlap (the
 *    cartoon widths are much wider than real rivers, and the warp packs nearby rivers closer),
 *    the smaller one is eased away from the bigger one. Confluences and crossings are left alone.
 */
export function bendRiversAround(rivers: River[], clearings: RiverClearing[]): River[] {
  return separateRivers(bendAroundClearings(rivers, clearings))
}

function bendAroundClearings(rivers: River[], clearings: RiverClearing[]): River[] {
  if (clearings.length === 0) return rivers
  const KM_LAT = 110.57
  const STEP_KM = 0.3
  // One warp for all rivers (sized for the widest one), so confluences stay joined
  const hw = riverHalfWidthKm(1)
  const zones = clearings.map((c) => {
    const kmLon = 111.32 * Math.cos((c.lat * Math.PI) / 180)
    if (c.rect) {
      // Distances measured from the footprint edge, so the river keeps its margin from the building
      const target = c.rect.marginKm + hw + BANK_KM
      const outer = detourOuter(target)
      return { c, kmLon, target, outer, reach: Math.hypot(c.rect.halfWKm, c.rect.halfDKm) + outer }
    }
    const target = c.radiusKm + hw + BANK_KM
    const outer = detourOuter(target)
    return { c, kmLon, target, outer, reach: outer }
  })
  return rivers.map((river) => {
    const lines = river.lines.map((line) => {
      // 1) densify segments that pass near a clearing
      const dense: [number, number][] = []
      for (let s = 0; s < line.length; s++) {
        const [lon, lat] = line[s]
        dense.push([lon, lat])
        if (s === line.length - 1) break
        const [lon2, lat2] = line[s + 1]
        for (const z of zones) {
          const ex = (lon2 - lon) * z.kmLon, ey = (lat2 - lat) * KM_LAT
          const len = Math.hypot(ex, ey)
          const mx = ((lon + lon2) / 2 - z.c.lon) * z.kmLon, my = ((lat + lat2) / 2 - z.c.lat) * KM_LAT
          if (Math.hypot(mx, my) > z.reach + len / 2) continue
          const n = Math.ceil(len / STEP_KM)
          for (let k = 1; k < n; k++) dense.push([lon + ((lon2 - lon) * k) / n, lat + ((lat2 - lat) * k) / n])
          break
        }
      }
      // 2) push points out: distance d in [0, outer] maps to [target, outer] (monotonic, smooth)
      return dense.map(([lon, lat]): [number, number] => {
        for (const z of zones) {
          if (z.c.rect) {
            ;[lon, lat] = pushOutOfRect(z.c, lon, lat, z.target, z.outer)
            continue
          }
          const dx = (lon - z.c.lon) * z.kmLon, dy = (lat - z.c.lat) * KM_LAT
          const d = Math.hypot(dx, dy)
          if (d >= z.outer) continue
          const nd = pushedDistance(d, z.target, z.outer)
          const k = d > 1e-6 ? nd / d : 0
          const ux = d > 1e-6 ? dx * k : nd, uy = d > 1e-6 ? dy * k : 0
          lon = z.c.lon + ux / z.kmLon
          lat = z.c.lat + uy / KM_LAT
        }
        return [lon, lat]
      })
    })
    return { ...river, lines }
  })
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
): { carve: Float32Array; edge: Float32Array } | null {
  if (!rivers || rivers.length === 0) return null
  const { edge, halfWidth } = rasterizeRivers(rivers, bounds, gw, gh, cellsPerKm, FIELD_REACH_KM)
  const bank = CARVE_BANK_KM * cellsPerKm
  const carve = new Float32Array(gw * gh)
  const sx = (gw - 1) / (bounds.east - bounds.west)
  const sy = (gh - 1) / (bounds.north - bounds.south)
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
      const depth = channelDepth(hw / cellsPerKm)
      carve[i] = depth * smooth(bank, -hw * 0.5, e) * keep
    }
  }
  return { carve, edge }
}
