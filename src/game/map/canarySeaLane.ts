// Sea to the Canary Islands (PROTOTYPE): shallow water, like the band along the coast
// (shallowSea.ts), that fills the sea between the coast of Huelva and the Algarve, the African
// coast (from the Strait of Gibraltar down to Safi) and the Canary Islands box in the south-west
// corner of the map (canaryInset.ts). The detective rows across it.
//
// The sea is a smooth outline given in DISPLAY lon/lat (where things are drawn, after the Canary
// inset shift). Its land sides run inland on purpose: land is never painted as sea, so the water
// stops exactly at each coast. The mainland and Canary zones mark it as shallow sea on their own
// grids (exploredRegion.ts, sea cells only); the open water between the two zones, where there is
// no terrain, is a flat sheet of its own (scene/createSeaLane.ts) that stops at the African coast
// of the grey world (setLaneCoast). GameView lets the boat go there with `laneFordAtWorld`.
import type { WorldData } from './worldData'
import { UNITS_PER_DEG_LAT, UNITS_PER_DEG_LON, UNITS_PER_KM } from './projection'

/** Outline of the sea (display lon, lat), counter-clockwise; smoothed below. */
const OUTLINE: [number, number][] = [
  [-5.55, 36.15], // Strait of Gibraltar, west of Tarifa (the Mediterranean is left as it is)
  [-5.9, 37.2], // Gulf of Cádiz, inland
  [-7.4, 37.45], // Huelva, inland
  [-8.9, 37.3], // Algarve, inland
  [-9.7, 36.9], // off Cape St Vincent
  [-10.8, 36.55],
  [-11.9, 36.4], // into the Canary box, north of Lanzarote
  [-12.6, 35.7],
  [-12.6, 34.3], // between Fuerteventura and Gran Canaria
  [-12.4, 33.6], // south of the box
  [-10.9, 32.9],
  [-9.1, 32.1], // reaches the African coast near Safi
  [-7.6, 32.9], // Morocco, inland
  [-6.3, 34.2],
  [-5.75, 35.3],
]
/** Coloured (deeper) sea (km) shown beyond the edge of the shallow water. */
export const LANE_SEA_KM = 14

const KM_PER_DEG_LON = UNITS_PER_DEG_LON / UNITS_PER_KM
const KM_PER_DEG_LAT = UNITS_PER_DEG_LAT / UNITS_PER_KM

/** Chaikin corner cutting: a smooth, natural-looking shore instead of straight segments. */
function smoothRing(ring: [number, number][], rounds: number): [number, number][] {
  let pts = ring
  for (let r = 0; r < rounds; r++) {
    const next: [number, number][] = []
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]
      next.push([0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by], [0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by])
    }
    pts = next
  }
  return pts
}

/** The smoothed outline in km (x east, y north). */
const RING = smoothRing(OUTLINE, 4).map(([lon, lat]) => [lon * KM_PER_DEG_LON, lat * KM_PER_DEG_LAT] as [number, number])

/** Quick reject box (display degrees), coloured sea included. */
export const LANE_BOUNDS = {
  west: Math.min(...OUTLINE.map((p) => p[0])) - LANE_SEA_KM / KM_PER_DEG_LON,
  east: Math.max(...OUTLINE.map((p) => p[0])) + LANE_SEA_KM / KM_PER_DEG_LON,
  south: Math.min(...OUTLINE.map((p) => p[1])) - LANE_SEA_KM / KM_PER_DEG_LAT,
  north: Math.max(...OUTLINE.map((p) => p[1])) + LANE_SEA_KM / KM_PER_DEG_LAT,
}
const BOX = LANE_BOUNDS

/**
 * Distance (km) from a display point to the edge of the shallow water: negative inside, positive
 * outside (+Infinity far away). Land is not taken into account here (see laneFordAtWorld).
 */
export function laneKm(lon: number, lat: number): number {
  if (lon < BOX.west || lon > BOX.east || lat < BOX.south || lat > BOX.north) return Infinity
  const px = lon * KM_PER_DEG_LON, py = lat * KM_PER_DEG_LAT
  let best = Infinity
  let inside = false
  for (let i = 0, j = RING.length - 1; i < RING.length; j = i++) {
    const [ax, ay] = RING[j], [bx, by] = RING[i]
    if (ay > py !== by > py && px < ax + ((py - ay) * (bx - ax)) / (by - ay)) inside = !inside
    const dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy))
  }
  return inside ? -best : best
}

/** Height (m) of the grey world (bilinear, like its mesh): the African coast between the zones. */
let worldHeight: (lon: number, lat: number) => number = () => -1

/**
 * Gives the lane the relief of the grey world, so its water and the boat stop at the African coast.
 * Same bilinear height as the world mesh (createWorldTerrain.ts): land where it is above 0 m.
 */
export function setLaneCoast(world: WorldData) {
  const { bounds, heights, gridWidth: gw, gridHeight: gh } = world
  worldHeight = (lon, lat) => {
    const fx = ((lon - bounds.west) / (bounds.east - bounds.west)) * (gw - 1)
    const fy = ((bounds.north - lat) / (bounds.north - bounds.south)) * (gh - 1)
    const c = Math.max(0, Math.min(gw - 2, Math.floor(fx))), r = Math.max(0, Math.min(gh - 2, Math.floor(fy)))
    const tx = fx - c, ty = fy - r
    const i = r * gw + c
    const top = heights[i] * (1 - tx) + heights[i + 1] * tx
    const bottom = heights[i + gw] * (1 - tx) + heights[i + gw + 1] * tx
    return top * (1 - ty) + bottom * ty
  }
}

/** Height (m) of the grey world at a display point (only meaningful between the zones). */
export function laneLandHeight(lon: number, lat: number): number {
  return worldHeight(lon, lat)
}

/** true if the world point (x, z), between the zones, is on the lane's shallow water. */
export function laneFordAtWorld(x: number, z: number): boolean {
  const lon = x / UNITS_PER_DEG_LON, lat = -z / UNITS_PER_DEG_LAT
  return laneKm(lon, lat) <= 0 && worldHeight(lon, lat) <= 0
}
