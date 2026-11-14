// Dibuja la textura de la maqueta del país explorado en un <canvas>: un color plano por piso
// de altura, playa, mar por bandas y espuma en la costa (los bordes los marca la tinta).
// La forma del relieve la pone la geometría 3D; aquí solo van los colores.
import type { ZoneData } from './mapData'
import type { Country } from './worldData'
import { terraceIndex } from './terrace'
import { distanceTo } from './distanceField'
import { computeExploredRegion } from './exploredRegion'
import { UNITS_PER_DEG_LON, UNITS_PER_KM } from './projection'
import { SEA, SAND, LEVEL_COLORS, FIELD_TINT, UNEXPLORED, mix, scale, smooth, type RGB } from './palette'
import { fractalNoise } from './valueNoise'

/** Tamaño de las manchas de campos, en píxeles de la textura. */
const FIELD_SIZE = 28
/** How much the field patches take the field tint (0..1). */
const FIELD_STRENGTH = 0.7
/** Large, gentle brightness variation in the plains (0 = none). */
const BRIGHTNESS_NOISE = 0.06
/** Blur (texture pixels) of the satellite image that decides wet/mid/dry zones. */
const ZONE_BLUR = 10

/**
 * @param heights alturas suavizadas (m) en la rejilla de datos (la misma que usa el terreno 3D)
 */
export function buildToyMap(
  data: ZoneData,
  heights: Float32Array,
  country: Country,
  width = 4096,
): HTMLCanvasElement {
  const { bounds, heightWidth: gw, heightHeight: gh } = data
  const height = Math.round((width * gh) / gw)
  const n = width * height

  // 1) Altura de cada píxel (bilineal) y su piso
  const elev = new Float32Array(n)
  const level = new Int8Array(n)
  for (let y = 0; y < height; y++) {
    const gy = Math.min(gh - 1.001, (y / (height - 1)) * (gh - 1))
    const y0 = Math.floor(gy), ty = gy - y0
    for (let x = 0; x < width; x++) {
      const gx = Math.min(gw - 1.001, (x / (width - 1)) * (gw - 1))
      const x0 = Math.floor(gx), tx = gx - x0
      const i = y0 * gw + x0
      const h =
        heights[i] * (1 - tx) * (1 - ty) +
        heights[i + 1] * tx * (1 - ty) +
        heights[i + gw] * (1 - tx) * ty +
        heights[i + gw + 1] * tx * ty
      elev[y * width + x] = h
      level[y * width + x] = terraceIndex(h)
    }
  }

  // 2) Zona explorada y distancias a la costa
  const pxPerKm = width / (((bounds.east - bounds.west) * UNITS_PER_DEG_LON) / UNITS_PER_KM)
  const { countryLand, region } = computeExploredRegion(country, bounds, elev, width, height, pxPerKm)
  const land = new Uint8Array(n)
  const sea = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    land[i] = level[i] >= 0 ? 1 : 0
    sea[i] = 1 - land[i]
  }
  const distToLand = distanceTo(land, width, height)
  const distToSea = distanceTo(sea, width, height)

  // 3) Satélite como dato: ¿zona húmeda (verde) o seca?
  const satCanvas = document.createElement('canvas')
  satCanvas.width = width
  satCanvas.height = height
  const satCtx = satCanvas.getContext('2d', { willReadFrequently: true })!
  satCtx.filter = `blur(${ZONE_BLUR}px)` // blurred: zones become big round shapes, not speckles
  satCtx.drawImage(data.satellite, 0, 0, width, height)
  const sat = satCtx.getImageData(0, 0, width, height).data

  // 4) Pintar
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(width, height)
  const out = img.data

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const lv = level[i]
      let c: RGB

      if (!region[i]) {
        // Fuera de la zona explorada (queda escondido; solo asoma en el corte de la frontera)
        c = UNEXPLORED.wall
      } else if (!countryLand[i]) {
        // ---- MAR: tres bandas planas + dos líneas de espuma ----
        const dl = distToLand[i]
        c = elev[i] > -150 ? SEA.shallow : SEA.deep
        if (dl < 8) c = SEA.coast
        if (dl < 2.6 || (dl > 12 && dl < 14.5)) c = SEA.foam
      } else {
        // ---- TIERRA: color plano según piso y zona ----
        const g_r = sat[i * 4 + 1] - sat[i * 4] // verde menos rojo
        const zone = g_r > -10 ? 'wet' : g_r > -22 ? 'mid' : 'dry'
        c = LEVEL_COLORS[zone][lv]
        if (lv <= 4) {
          // Llanuras y Meseta: manchas de "campos" de borde nítido (estilo cómic, sin líneas) y
          // un ligero cambio de brillo, para que el suelo no sea un color muerto
          const n = fractalNoise(x / FIELD_SIZE, y / FIELD_SIZE)
          const field = smooth(0.62, 0.64, n) // 0 or 1, almost no transition
          c = mix(c, FIELD_TINT[zone], field * FIELD_STRENGTH)
          c = scale(c, 1 + (fractalNoise(x / 160 + 50, y / 160) - 0.5) * BRIGHTNESS_NOISE)
        }
        if (lv === 0 && distToSea[i] < 5) c = SAND // beach
        // (Ya no se pinta un borde oscuro entre pisos: los contornos de tinta marcan esos bordes)
      }

      out[i * 4] = c[0]
      out[i * 4 + 1] = c[1]
      out[i * 4 + 2] = c[2]
      out[i * 4 + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}
