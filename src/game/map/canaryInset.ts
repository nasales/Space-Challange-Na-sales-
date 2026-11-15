// Canary Islands inset (PROTOTYPE): the islands are drawn in a box in the south-west corner of the
// map, close to the mainland, like the classic maps of Spain, instead of at their real place
// ~1000 km away. Only the 3D position moves: every lon/lat in the game data stays real.
//
// projection.ts applies it: lonLatToWorld() moves any real point inside SOURCE by OFFSET, and
// worldToLonLat() moves it back. So towns, roads, rivers, scenery, case markers and the
// magnifier (which reads real coordinates) all work without changes.
//
// To move the box: change OFFSET. It must not overlap the mainland zone (west edge -9.636).
import type { Bounds } from './mapData'

/** Real bounds of the Canary Islands zone (public/maps/countries/ESP/meta.json, zone 1). */
export const CANARY_ZONE: Bounds = { west: -18.561, east: -13.023, south: 27.246, north: 29.637 }

/** Degrees added to the real lon/lat of the Canary Islands to place them in the corner box. */
export const CANARY_OFFSET = { lon: 2.4, lat: 6.6 }

/** Margin (degrees) around the zone that still moves with it (road or river points just outside). */
const MARGIN = 0.5

const SOURCE: Bounds = {
  west: CANARY_ZONE.west - MARGIN,
  east: CANARY_ZONE.east + MARGIN,
  south: CANARY_ZONE.south - MARGIN,
  north: CANARY_ZONE.north + MARGIN,
}

const shift = (b: Bounds, lon: number, lat: number): Bounds => ({
  west: b.west + lon,
  east: b.east + lon,
  south: b.south + lat,
  north: b.north + lat,
})

/** The SOURCE box as drawn on the map. */
const TARGET = shift(SOURCE, CANARY_OFFSET.lon, CANARY_OFFSET.lat)

/** Zone bounds as drawn on the map: the portal frame goes around them. */
export const CANARY_DISPLAY: Bounds = shift(CANARY_ZONE, CANARY_OFFSET.lon, CANARY_OFFSET.lat)

const inside = (b: Bounds, lon: number, lat: number) => lon >= b.west && lon <= b.east && lat >= b.south && lat <= b.north

/** Real lon/lat -> lon/lat where it is drawn. */
export function toDisplayLonLat(lon: number, lat: number) {
  return inside(SOURCE, lon, lat) ? { lon: lon + CANARY_OFFSET.lon, lat: lat + CANARY_OFFSET.lat } : { lon, lat }
}

/** Lon/lat where it is drawn -> real lon/lat. */
export function toRealLonLat(lon: number, lat: number) {
  return inside(TARGET, lon, lat) ? { lon: lon - CANARY_OFFSET.lon, lat: lat - CANARY_OFFSET.lat } : { lon, lat }
}
