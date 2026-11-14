// Textura del mundo sin explorar: tierra gris con relieve suave, mar gris azulado,
// costa marcada y fronteras finas (para poder elegir país más adelante).
import type { WorldData } from './worldData'
import { UNEXPLORED, scale, type RGB } from './palette'

export function buildWorldTexture(world: WorldData, width = 4096): HTMLCanvasElement {
  const { bounds, heights, gridWidth: gw, gridHeight: gh } = world
  const height = Math.round((width * gh) / gw)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(width, height)
  const out = img.data

  // Altura en una celda (con el borde repetido)
  const H = (x: number, y: number) =>
    heights[Math.min(gh - 1, Math.max(0, y)) * gw + ((x + gw) % gw)]

  // Altura interpolada (bilineal) en una posición fraccionaria de la rejilla: así no se ven cuadros
  const Hs = (fx: number, fy: number) => {
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0
    return (
      H(x0, y0) * (1 - tx) * (1 - ty) +
      H(x0 + 1, y0) * tx * (1 - ty) +
      H(x0, y0 + 1) * (1 - tx) * ty +
      H(x0 + 1, y0 + 1) * tx * ty
    )
  }

  for (let y = 0; y < height; y++) {
    const gy = (y / height) * gh - 0.5
    for (let x = 0; x < width; x++) {
      const gx = (x / width) * gw - 0.5
      const h = Hs(gx, gy)
      let c: RGB
      if (h <= 0) {
        // Junto a la costa el mar se aclara un poco
        c = h > -150 ? scale(UNEXPLORED.sea, 1.1) : UNEXPLORED.sea
      } else {
        // Sombreado suave: luz desde el noroeste
        const slope = (Hs(gx - 1, gy - 1) - Hs(gx + 1, gy + 1)) / 2500
        c = scale(UNEXPLORED.land, Math.min(1.12, Math.max(0.78, 1 + slope)))
      }
      const i = (y * width + x) * 4
      out[i] = c[0]
      out[i + 1] = c[1]
      out[i + 2] = c[2]
      out[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  // Costa y fronteras dibujadas como líneas a partir de los polígonos de los países
  const toX = (lon: number) => ((lon - bounds.west) / (bounds.east - bounds.west)) * width
  const toY = (lat: number) => ((bounds.north - lat) / (bounds.north - bounds.south)) * height
  ctx.lineJoin = 'round'
  ctx.beginPath()
  for (const country of world.countries) {
    for (const polygon of country.polygons) {
      for (const ring of polygon) {
        ring.forEach(([lon, lat], k) => (k === 0 ? ctx.moveTo(toX(lon), toY(lat)) : ctx.lineTo(toX(lon), toY(lat))))
        ctx.closePath()
      }
    }
  }
  ctx.strokeStyle = `rgb(${UNEXPLORED.border.join(',')})`
  ctx.lineWidth = 1.2
  ctx.stroke()
  return canvas
}
