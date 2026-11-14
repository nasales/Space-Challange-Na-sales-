// Zona "explorada" de un país: su tierra + una franja de mar junto a su costa.
// Todo lo demás se esconde y se ve el mundo gris.
import type { Bounds } from './mapData'
import type { Country } from './worldData'
import { rasterizeCountry } from './rasterizeCountry'
import { distanceTo } from './distanceField'

/** Ancho de la franja de mar de color alrededor del país explorado. */
export const COASTAL_SEA_KM = 20

export interface ExploredRegion {
  /** 1 = tierra del país */
  countryLand: Uint8Array
  /** 1 = parte de la zona explorada (tierra del país o mar cercano a su costa) */
  region: Uint8Array
}

/**
 * @param elevation altura (m) de cada celda de la rejilla
 * @param cellsPerKm cuántas celdas de la rejilla caben en 1 km
 */
export function computeExploredRegion(
  country: Country,
  bounds: Bounds,
  elevation: Float32Array,
  width: number,
  height: number,
  cellsPerKm: number,
): ExploredRegion {
  const inside = rasterizeCountry(country, bounds, width, height)
  const n = width * height
  const countryLand = new Uint8Array(n)
  for (let i = 0; i < n; i++) countryLand[i] = inside[i] && elevation[i] > 0 ? 1 : 0

  const distToCountry = distanceTo(countryLand, width, height)
  const radius = COASTAL_SEA_KM * cellsPerKm
  const region = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    region[i] = countryLand[i] || (elevation[i] <= 0 && distToCountry[i] < radius) ? 1 : 0
  }
  return { countryLand, region }
}
