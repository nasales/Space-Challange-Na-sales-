// Longitude/latitude <-> 3D world coordinates, for the interface (the UI never imports src/game).
// Copy of the maths in src/game/map/projection.ts: keep both in sync if the world scale changes.
//
// Equirectangular projection: degrees of longitude are measured as at latitude 40 (Spain), so the
// country is not stretched. North = -Z, East = +X.

/** World scale: 3D units per real kilometre (same as the game). */
export const UNITS_PER_KM = 8

const REF_LAT = 40
export const KM_PER_DEG_LON = 111.32 * Math.cos((REF_LAT * Math.PI) / 180)
export const KM_PER_DEG_LAT = 110.57

export const UNITS_PER_DEG_LON = KM_PER_DEG_LON * UNITS_PER_KM
export const UNITS_PER_DEG_LAT = KM_PER_DEG_LAT * UNITS_PER_KM

export function lonLatToWorld(lon: number, lat: number) {
  return { x: lon * UNITS_PER_DEG_LON, z: -lat * UNITS_PER_DEG_LAT }
}

export function worldToLonLat(x: number, z: number) {
  return { lon: x / UNITS_PER_DEG_LON, lat: -z / UNITS_PER_DEG_LAT }
}
