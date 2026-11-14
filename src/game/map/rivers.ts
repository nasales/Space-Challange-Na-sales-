// Rivers of the explored country: cartoon water ribbons painted into the toy-map texture and
// shallow beds carved into the terrain. Both use the same raster "edge field" built here, in the
// pixel space of the texture or of the height grid, so the paint and the carve line up.
import type { Bounds, River } from './mapData'
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
    const hw = Math.max(riverHalfWidthKm(river.rank) * pxPerKm, river.rank <= 2 ? minHalfPx : 0)
    const reach = hw + reachKm * pxPerKm
    for (const line of river.lines) {
      const pts = chaikin(line, 3).map(([lon, lat]) => [(lon - bounds.west) * sx, (bounds.north - lat) * sy])
      for (let s = 0; s < pts.length - 1; s++) {
        const [ax, ay] = pts[s], [bx, by] = pts[s + 1]
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
            const e = Math.sqrt(ex * ex + ey * ey) - hw
            const i = y * w + x
            if (e < edge[i] && e < reach - hw) {
              edge[i] = e
              halfWidth[i] = hw
            }
          }
        }
      }
    }
  }
  return { edge, halfWidth }
}

/** A circle (e.g. a monument footprint) that rivers must flow around. */
export interface RiverClearing {
  lon: number
  lat: number
  radiusKm: number
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
 * Returns null when there are no rivers. Flattened landmark plazas (cells whose height is
 * exactly equal to their neighbours') are left untouched, so monuments never float.
 */
export function riverCarveDepth(
  rivers: River[] | undefined,
  bounds: Bounds,
  heights: Float32Array,
  gw: number,
  gh: number,
  cellsPerKm: number,
  isLand: Uint8Array,
): { carve: Float32Array; edge: Float32Array } | null {
  if (!rivers || rivers.length === 0) return null
  const { edge, halfWidth } = rasterizeRivers(rivers, bounds, gw, gh, cellsPerKm, FIELD_REACH_KM)
  const bank = CARVE_BANK_KM * cellsPerKm
  const carve = new Float32Array(gw * gh)
  const isFlat = (i: number) =>
    heights[i] > 0 && heights[i] === heights[i - 1] && heights[i] === heights[i + 1] &&
    heights[i] === heights[i - gw] && heights[i] === heights[i + gw]
  const PLAZA_MARGIN = 3 // cells around a flat plaza where the carve is also skipped
  for (let r = 1; r < gh - 1; r++) {
    for (let c = 1; c < gw - 1; c++) {
      const i = r * gw + c
      const e = edge[i]
      if (!(e < bank) || !isLand[i]) continue
      const hw = halfWidth[i]
      let nearPlaza = false
      for (let dr = -PLAZA_MARGIN; dr <= PLAZA_MARGIN && !nearPlaza; dr += PLAZA_MARGIN) {
        for (let dc = -PLAZA_MARGIN; dc <= PLAZA_MARGIN; dc += PLAZA_MARGIN) {
          const rr = r + dr, cc = c + dc
          if (rr < 1 || rr >= gh - 1 || cc < 1 || cc >= gw - 1) continue
          if (isFlat(rr * gw + cc)) { nearPlaza = true; break }
        }
      }
      if (nearPlaza) continue
      const depth = channelDepth(hw / cellsPerKm)
      carve[i] = depth * smooth(bank, -hw * 0.5, e)
    }
  }
  return { carve, edge }
}
