// Zona "explorada" de un país: su tierra + una franja de mar junto a su costa.
// Todo lo demás se esconde y se ve el mundo gris.
import type { Bounds } from './mapData'
import type { Country } from './worldData'
import { rasterizeCountry } from './rasterizeCountry'
import { distanceTo } from './distanceField'
import { enclosedSea, COAST_SHALLOWS_KM } from './shallowSea'

/** Ancho de la franja de mar de color alrededor del país explorado. */
export const COASTAL_SEA_KM = 44 // was 20, then 28: the shallow band for the boat (shallowSea.ts) takes the first 32 km

/**
 * The country outlines are coarser than the heights, so some dry ground is left outside every
 * outline (strips along the coast, islets, gaps at the borders) and showed as holes in the map.
 * Such ground within this distance (km) of the outline of the country, and nearer to it than to
 * the outline of any other country, belongs to the country.
 */
const OUTLINE_GAP_KM = 12

export interface ExploredRegion {
  /** 1 = tierra del país */
  countryLand: Uint8Array
  /** 1 = parte de la zona explorada (tierra del país o mar cercano a su costa) */
  region: Uint8Array
  /** 1 = shallow sea: the band along the coast and the enclosed seas up to the islands, crossed by boat (see shallowSea.ts) */
  ford: Uint8Array
  /** Distance (km) from each cell to the edge of the shallow sea: negative inside it, positive outside (+Infinity on dry ground) */
  shallowKm: Float32Array
}

/**
 * @param elevation altura (m) de cada celda de la rejilla
 * @param cellsPerKm cuántas celdas de la rejilla caben en 1 km
 * @param neighbours the other countries of the world (to share out the ground no outline covers)
 */
export function computeExploredRegion(
  country: Country,
  bounds: Bounds,
  elevation: Float32Array,
  width: number,
  height: number,
  cellsPerKm: number,
  neighbours: Country[] = [],
): ExploredRegion {
  const inside = rasterizeCountry(country, bounds, width, height)
  const n = width * height
  const countryLand = new Uint8Array(n)
  for (let i = 0; i < n; i++) countryLand[i] = inside[i] && elevation[i] > 0 ? 1 : 0

  // Dry ground outside every outline: it goes to the nearest country (see OUTLINE_GAP_KM)
  if (neighbours.length) {
    const foreign = rasterizeCountry(neighbours, bounds, width, height)
    const toOwn = distanceTo(inside, width, height)
    const toForeign = distanceTo(foreign, width, height)
    const gap = OUTLINE_GAP_KM * cellsPerKm
    for (let i = 0; i < n; i++) {
      if (!inside[i] && !foreign[i] && elevation[i] > 0 && toOwn[i] <= gap && toOwn[i] <= toForeign[i]) countryLand[i] = 1
    }
  }

  // The sea "next to the country" is measured from its land and from its enclosed seas
  const enclosed = enclosedSea(countryLand, bounds, width, height)
  if (enclosed) for (let i = 0; i < n; i++) if (countryLand[i]) enclosed[i] = 1
  const distToCore = distanceTo(enclosed ?? countryLand, width, height)
  const radius = COASTAL_SEA_KM * cellsPerKm
  const region = new Uint8Array(n)
  const ford = new Uint8Array(n)
  // Shallow sea (rowing boat): the first COAST_SHALLOWS_KM of that sea. The distance buffer is
  // reused for the distance to its edge
  const shallowKm = distToCore
  for (let i = 0; i < n; i++) {
    const sea = elevation[i] <= 0
    const d = distToCore[i]
    region[i] = countryLand[i] || (sea && d < radius) ? 1 : 0
    shallowKm[i] = sea ? d / cellsPerKm - COAST_SHALLOWS_KM : Infinity
    if (sea && !countryLand[i] && shallowKm[i] <= 0) ford[i] = 1
  }
  return { countryLand, region, ford, shallowKm }
}
