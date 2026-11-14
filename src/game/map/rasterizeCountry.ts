// Pinta la silueta de un país en una rejilla (1 = dentro del país, 0 = fuera).
// Se usa para recortar el país explorado y para aplanar el mundo gris debajo de él.
import type { Bounds } from './mapData'
import type { Country } from './worldData'

/**
 * @param bounds zona geográfica que cubre la rejilla
 * @param width,height tamaño de la rejilla; la fila 0 es el norte
 */
export function rasterizeCountry(country: Country, bounds: Bounds, width: number, height: number): Uint8Array {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  const toX = (lon: number) => ((lon - bounds.west) / (bounds.east - bounds.west)) * width
  const toY = (lat: number) => ((bounds.north - lat) / (bounds.north - bounds.south)) * height

  ctx.fillStyle = '#fff'
  ctx.beginPath()
  for (const polygon of country.polygons) {
    for (const ring of polygon) {
      ring.forEach(([lon, lat], k) => (k === 0 ? ctx.moveTo(toX(lon), toY(lat)) : ctx.lineTo(toX(lon), toY(lat))))
      ctx.closePath()
    }
  }
  ctx.fill('evenodd') // evenodd: los agujeros de un polígono quedan fuera

  const pixels = ctx.getImageData(0, 0, width, height).data
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i++) mask[i] = pixels[i * 4] > 127 ? 1 : 0
  return mask
}
