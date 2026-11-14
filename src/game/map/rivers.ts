// Rivers of the explored country: cartoon water ribbons painted into the toy-map texture and
// shallow beds carved into the terrain. Both use the same raster "edge field" built here, in the
// pixel space of the texture or of the height grid, so the paint and the carve line up.
import type { Bounds, River } from './mapData'
import { mix, smooth, type RGB } from './palette'

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]

/** River colours: same family as the toy sea (palette.ts SEA), a bit brighter so they pop on land. */
export const RIVER_COLORS = {
  water: hex('#2F8FEC'),
  light: hex('#7FDDF7'), // = SEA.coast: lighter water next to the banks
  foam: hex('#FFFFFF'),
  bank: hex('#F6EFC4'), // pale sandy bank, mixed into the land colour
}

/** Half width of the water ribbon (km, cartoon scale, not real) by rank: 1 big, 2 medium, 3 small. */
const HALF_WIDTH_KM: Record<number, number> = { 1: 1.7, 2: 1.0, 3: 0.65 }
/** Width (km) of the light bank strip outside the water. */
const BANK_KM = 0.45
/** Carve depth (world units) of the river bed per km of half width. */
const CARVE_PER_KM = 1.5
/** The carve fades out this far (km) outside the water edge: gentle banks, no cliffs. */
const CARVE_BANK_KM = 1.2

export const riverHalfWidthKm = (rank: number) => HALF_WIDTH_KM[rank] ?? HALF_WIDTH_KM[3]

/** Chaikin corner cutting: turns the coarse source polylines into smooth curves (ends kept). */
function chaikin(line: [number, number][], iterations: number): [number, number][] {
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
): RiverField {
  const edge = new Float32Array(w * h).fill(Infinity)
  const halfWidth = new Float32Array(w * h)
  const sx = (w - 1) / (bounds.east - bounds.west)
  const sy = (h - 1) / (bounds.north - bounds.south)

  for (const river of rivers) {
    const hw = riverHalfWidthKm(river.rank) * pxPerKm
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

/** Reach (km) that `paintRiver` needs from the field. */
export const PAINT_REACH_KM = BANK_KM + 0.4

/**
 * Colour of a land pixel with the river painted on top: blue water, lighter water near the edge,
 * a thin white foam line and a pale bank. Band edges are anti-aliased over ~1 px.
 */
export function paintRiver(land: RGB, e: number, hwPx: number, pxPerKm: number): RGB {
  if (!(e < BANK_KM * pxPerKm + 1)) return land
  const foamW = Math.max(0.5, Math.min(1.1, hwPx * 0.18))
  const lightW = Math.max(0.4, hwPx * 0.22)
  const bankW = BANK_KM * pxPerKm
  // bank -> foam -> light water -> water, from the outside in
  let c = mix(land, RIVER_COLORS.bank, 0.45 * smooth(bankW + 0.5, bankW - 0.5, e))
  c = mix(c, RIVER_COLORS.foam, smooth(0.5, -0.5, e))
  c = mix(c, RIVER_COLORS.light, smooth(-foamW + 0.5, -foamW - 0.5, e))
  c = mix(c, RIVER_COLORS.water, smooth(-foamW - lightW + 0.5, -foamW - lightW - 0.5, e))
  return c
}

/**
 * How deep (world units) to carve the terrain under the rivers, per height-grid cell.
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
): Float32Array | null {
  if (!rivers || rivers.length === 0) return null
  const { edge, halfWidth } = rasterizeRivers(rivers, bounds, gw, gh, cellsPerKm, CARVE_BANK_KM)
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
      const depth = (hw / cellsPerKm) * CARVE_PER_KM
      carve[i] = depth * smooth(bank, -hw * 0.5, e)
    }
  }
  return carve
}
