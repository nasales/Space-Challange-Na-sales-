// Canary Islands box for the 2D maps of the interface (minimap, travel map): the islands are drawn
// smaller in a box in the south-west corner, like the classic maps of Spain. Each map picks where
// its box goes and how big it is; everything outside the islands' area is left where it is.

/** Real area (degrees) that goes into the box: the Canary Islands zone of the game (meta.json, zone 1). */
export const CANARY_REAL = { west: -18.561, east: -13.023, south: 27.246, north: 29.637 }

/**
 * Degrees the 3D world adds to the islands' real lon/lat (it draws them in a corner too).
 * Copy of CANARY_OFFSET in src/game/map/canaryInset.ts: keep both in sync.
 */
const WORLD_OFFSET = { lon: 2.4, lat: 6.6 }

const inReal = (lon: number, lat: number) =>
  lon >= CANARY_REAL.west && lon <= CANARY_REAL.east && lat >= CANARY_REAL.south && lat <= CANARY_REAL.north

/**
 * A box for one map.
 * @param west,south south-west corner of the box on that map (degrees)
 * @param scale size of the islands in the box (1 = same scale as the rest of the map)
 */
export function canaryBox(west: number, south: number, scale: number) {
  return {
    /** The box on the map (degrees), for its frame line. */
    frame: {
      west,
      south,
      east: west + (CANARY_REAL.east - CANARY_REAL.west) * scale,
      north: south + (CANARY_REAL.north - CANARY_REAL.south) * scale,
    },
    /** Real lon/lat of a point of Spain -> lon/lat where the map draws it (only the Canary Islands move). */
    toMap(lon: number, lat: number): [number, number] {
      if (!inReal(lon, lat)) return [lon, lat]
      return [west + (lon - CANARY_REAL.west) * scale, south + (lat - CANARY_REAL.south) * scale]
    },
  }
}

/** Lon/lat as drawn in the 3D world (world x, z divided by the scale) -> real lon/lat. */
export function worldLonLatToReal(lon: number, lat: number): [number, number] {
  const realLon = lon - WORLD_OFFSET.lon, realLat = lat - WORLD_OFFSET.lat
  return inReal(realLon, realLat) ? [realLon, realLat] : [lon, lat]
}
