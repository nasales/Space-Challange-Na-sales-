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

/** A circle (e.g. a monument footprint) that rivers must flow around. */
export interface RiverClearing {
  lon: number
  lat: number
  radiusKm: number
  /** Radius (km) of the object itself (without margin): the ground there is never carved. */
  innerKm?: number
}

/**
 * Bends the rivers around the clearings: points inside (radius + river half width + bank) are
 * pushed radially out, with a soft falloff so the bend is a gentle curve, not a kink. Segments
 * near a clearing are densified first so long segments cannot cut through it.
 */
export function bendRiversAround(rivers: River[], clearings: RiverClearing[]): River[] {
  if (clearings.length === 0) return rivers
  const KM_LAT = 110.57
  const STEP_KM = 0.3
  return rivers.map((river) => {
    const hw = riverHalfWidthKm(river.rank)
    const zones = clearings.map((c) => {
      const kmLon = 111.32 * Math.cos((c.lat * Math.PI) / 180)
      const target = c.radiusKm + hw + BANK_KM
      return { c, kmLon, target, outer: target * 1.6 }
    })
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
          if (Math.hypot(mx, my) > z.outer + len / 2) continue
          const n = Math.ceil(len / STEP_KM)
          for (let k = 1; k < n; k++) dense.push([lon + ((lon2 - lon) * k) / n, lat + ((lat2 - lat) * k) / n])
          break
        }
      }
      // 2) push points out: distance d in [0, outer] maps to [target, outer] (monotonic, smooth)
      return dense.map(([lon, lat]): [number, number] => {
        for (const z of zones) {
          const dx = (lon - z.c.lon) * z.kmLon, dy = (lat - z.c.lat) * KM_LAT
          const d = Math.hypot(dx, dy)
          if (d >= z.outer) continue
          const nd = z.target + (d / z.outer) * (z.outer - z.target)
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
        if (dist < d.outer) keep = Math.min(keep, smooth(d.inner, d.outer, dist))
      }
      if (keep === 0) continue
      const hw = halfWidth[i]
      const depth = channelDepth(hw / cellsPerKm)
      carve[i] = depth * smooth(bank, -hw * 0.5, e) * keep
    }
  }
  return { carve, edge }
}
