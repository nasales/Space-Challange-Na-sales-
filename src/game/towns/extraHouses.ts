// A few houses at fixed spots, added to the towns after placeTowns(): e.g. by Peñafiel Castle,
// whose town centre is under the castle. Same house models, night lights and scenery clearance as
// every other house (they go into the same list for createTowns). Each spot is checked with the
// same rules as the town houses; one that fails is skipped (with a warning in development).
import { lonLatToWorld } from '../map/projection'
import { styleOf, type HouseSpot, type HouseVariant, type TownGround } from './placeTowns'

export interface ExtraHouse {
  /** Town it belongs to (for people reading this list) */
  town: string
  /** Region of the town: gives the house style (see styleOf) */
  region: string
  lat: number
  lon: number
  /** Facing (degrees): the front (+Z of the model) turns by this much */
  rot: number
  variant: HouseVariant
}

export const EXTRA_HOUSES: ExtraHouse[] = [
  // Peñafiel: two houses on the flat ground south of the castle (just outside its clearance),
  // facing it, one on each side so the way up to the plaza in front of the castle stays open
  { town: 'Peñafiel', region: 'Castilla y León', lat: 41.55959, lon: -4.07531, rot: -139, variant: 1 },
  { town: 'Peñafiel', region: 'Castilla y León', lat: 41.55959, lon: -4.15869, rot: 139, variant: 0 },
]

// Same rules as placeTowns.ts
const HOUSE_RADIUS = 6
const RIVER_CLEARANCE = 6
const ROAD_CLEARANCE = 2.5
const MAX_SLOPE = 3
const LANDMARK_CLEARANCE = 80
const STREET = 9

export function placeExtraHouses(list: ExtraHouse[], ground: TownGround, existing: HouseSpot[]): HouseSpot[] {
  const out: HouseSpot[] = []
  for (const h of list) {
    const { x, z } = lonLatToWorld(h.lon, h.lat)
    const r = HOUSE_RADIUS
    const pts = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].map(([dx, dz]) => [x + dx, z + dz])
    const hs = pts.map(([px, pz]) => ground.heightAt(px, pz))
    const problem = !pts.every(([px, pz]) => ground.isLand(px, pz))
      ? 'not on land'
      : ground.landmarkDistance(x, z) < LANDMARK_CLEARANCE
        ? 'too close to a monument'
        : ground.nearRiver(x, z, r * Math.SQRT2 + RIVER_CLEARANCE)
          ? 'by a river'
          : ground.nearRoad?.(x, z, r * Math.SQRT2 + ROAD_CLEARANCE)
            ? 'on a road'
            : Math.max(...hs) - Math.min(...hs) > MAX_SLOPE
              ? 'on a slope'
              : [...existing, ...out].some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < (o.radius + r + STREET) ** 2)
                ? 'on another house'
                : null
    if (problem) {
      if (import.meta.env.DEV) console.warn(`Extra house in ${h.town} skipped: ${problem}`)
      continue
    }
    out.push({ x, z, y: Math.min(...hs), rot: (h.rot * Math.PI) / 180, scale: 0.96, style: styleOf(h.region), variant: h.variant, radius: r })
  }
  return out
}
