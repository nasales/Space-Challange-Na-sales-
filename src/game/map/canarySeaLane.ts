// Sea lane to the Canary Islands (PROTOTYPE): a band of shallow water, like the one along the coast
// (shallowSea.ts), from the coast of Huelva, south of the Algarve, out to the Canary Islands box
// in the south-west corner of the map (canaryInset.ts). The detective rows along it.
//
// The lane is given in DISPLAY lon/lat (where things are drawn, after the Canary inset shift).
// The mainland and Canary zones mark it as shallow sea on their own grids (exploredRegion.ts);
// the open water between the two zones, where there is no terrain, is a flat strip of its own
// (scene/createSeaLane.ts), and GameView lets the boat go there with `laneFordAtWorld`.
import { UNITS_PER_DEG_LAT, UNITS_PER_DEG_LON, UNITS_PER_KM } from './projection'

/** Centre line of the lane (display lon, lat): Huelva coast -> south of Cape St Vincent -> Lanzarote. */
export const LANE: [number, number][] = [
  [-6.9, 36.75],
  [-8.0, 36.5],
  [-9.0, 36.35],
  [-10.2, 36.0],
  [-11.0, 35.75],
]
/** Half width (km) of the shallow water of the lane (the coast band is 32 km wide; the lane is a wide sea, like the Balearic one). */
export const LANE_HALF_KM = 70
/** Coloured sea (km) shown beyond each side of the shallow water. */
export const LANE_SEA_KM = 14

const KM_PER_DEG_LON = UNITS_PER_DEG_LON / UNITS_PER_KM
const KM_PER_DEG_LAT = UNITS_PER_DEG_LAT / UNITS_PER_KM
const REACH_KM = LANE_HALF_KM + LANE_SEA_KM

// Quick reject box (display degrees)
const BOX = {
  west: Math.min(...LANE.map((p) => p[0])) - REACH_KM / KM_PER_DEG_LON,
  east: Math.max(...LANE.map((p) => p[0])) + REACH_KM / KM_PER_DEG_LON,
  south: Math.min(...LANE.map((p) => p[1])) - REACH_KM / KM_PER_DEG_LAT,
  north: Math.max(...LANE.map((p) => p[1])) + REACH_KM / KM_PER_DEG_LAT,
}
export const LANE_BOUNDS = BOX

/**
 * Distance (km) from a display point to the edge of the lane's shallow water: negative inside,
 * positive outside (+Infinity far away).
 */
export function laneKm(lon: number, lat: number): number {
  if (lon < BOX.west || lon > BOX.east || lat < BOX.south || lat > BOX.north) return Infinity
  const px = lon * KM_PER_DEG_LON, py = lat * KM_PER_DEG_LAT
  let best = Infinity
  for (let k = 0; k < LANE.length - 1; k++) {
    const ax = LANE[k][0] * KM_PER_DEG_LON, ay = LANE[k][1] * KM_PER_DEG_LAT
    const bx = LANE[k + 1][0] * KM_PER_DEG_LON, by = LANE[k + 1][1] * KM_PER_DEG_LAT
    const dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy))
  }
  return best - LANE_HALF_KM
}

/** true if the world point (x, z) is on the lane's shallow water. */
export function laneFordAtWorld(x: number, z: number): boolean {
  return laneKm(x / UNITS_PER_DEG_LON, -z / UNITS_PER_DEG_LAT) <= 0
}
