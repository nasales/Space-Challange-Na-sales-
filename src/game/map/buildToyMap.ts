// Dibuja la textura de la maqueta del país explorado en un <canvas>: un color plano por piso
// de altura, playa, mar por bandas y espuma en la costa (los bordes los marca la tinta).
// La forma del relieve la pone la geometría 3D; aquí solo van los colores.
import type { ZoneData } from './mapData'
import type { Country } from './worldData'
import { terraceHeight, terraceIndex } from './terrace'
import { HEIGHT_EXAGGERATION, metersToY } from './projection'
import { SUN_DIRECTION } from '../scene/createSky'
import { distanceTo } from './distanceField'
import { computeExploredRegion } from './exploredRegion'
import { UNITS_PER_DEG_LON, UNITS_PER_KM } from './projection'
import { SEA, SAND, LEVEL_COLORS, FIELD_TINT, UNEXPLORED, mix, scale, smooth, type RGB } from './palette'
import { fractalNoise } from './valueNoise'
import { rasterizeRivers, paintRiver, PAINT_REACH_KM } from './rivers'

/** Tamaño de las manchas de campos, en píxeles de la textura. */
const FIELD_SIZE = 28
/** How much the field patches take the field tint (0..1). */
const FIELD_STRENGTH = 0.7
/** Large, gentle brightness variation in the plains (0 = none). */
const BRIGHTNESS_NOISE = 0.06
/**
 * Hillshade painted into the ground: slopes facing the sun get lighter, slopes facing away darker.
 * The cel shading has only two tones, so without this gentle ramps are invisible from above.
 * HILLSHADE = strength; the factor is clamped to [HILLSHADE_MIN, HILLSHADE_MAX].
 */
const HILLSHADE = 1.6
const HILLSHADE_MIN = 0.72
const HILLSHADE_MAX = 1.18
/** Size of each hillshade tone step (banded comic look instead of a smooth gradient). */
const HILLSHADE_STEP = 0.08
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

  // 3b) Rivers: distance of each pixel to the nearest water edge (rasterised once)
  const rivers = data.rivers?.length ? rasterizeRivers(data.rivers, bounds, width, height, pxPerKm, PAINT_REACH_KM) : null

  // 4) Pintar
  const pxWorld = UNITS_PER_KM / pxPerKm // world units per texture pixel (for the hillshade)
  const surfY = (m: number) => metersToY(terraceHeight(Math.max(m, 1)), HEIGHT_EXAGGERATION)
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
        // Hillshade from the terraced surface that is actually rendered (world units)
        if (x > 0 && y > 0 && x < width - 1 && y < height - 1) {
          const hx = (surfY(elev[i + 1]) - surfY(elev[i - 1])) / (2 * pxWorld)
          const hz = (surfY(elev[i + width]) - surfY(elev[i - width])) / (2 * pxWorld)
          const len = Math.hypot(hx, 1, hz)
          const lit = (-hx * SUN_DIRECTION.x + SUN_DIRECTION.y - hz * SUN_DIRECTION.z) / len / SUN_DIRECTION.y
          const shade = Math.min(HILLSHADE_MAX, Math.max(HILLSHADE_MIN, 1 + (lit - 1) * HILLSHADE))
          c = scale(c, 1 + Math.round((shade - 1) / HILLSHADE_STEP) * HILLSHADE_STEP) // banded, like cel shading
        }
        if (rivers) c = paintRiver(c, rivers.edge[i], rivers.halfWidth[i], pxPerKm)
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
