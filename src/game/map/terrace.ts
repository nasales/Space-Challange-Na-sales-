// Relieve "en escalones" estilo maqueta: las alturas se agrupan en pisos planos.

/** Altura (m) a la que empieza cada piso. */
export const TERRACE_LEVELS = [0, 150, 350, 600, 900, 1200, 1600, 2000, 2500]
/** Altura a la que se dibuja cada piso (el primero, un pequeño escalón sobre el mar). */
const PLATEAU = [40, ...TERRACE_LEVELS.slice(1)]
/** Fracción del tramo entre dos pisos que es pared (el resto es suelo plano). */
const WALL_START = 0.7
const WALL_MIDDLE = (WALL_START + 1) / 2

/** Busca el tramo [i, i+1] en el que cae una altura y en qué punto (t de 0 a 1). */
function locate(meters: number) {
  let i = 0
  while (i + 1 < TERRACE_LEVELS.length && meters >= TERRACE_LEVELS[i + 1]) i++
  if (i === TERRACE_LEVELS.length - 1) return { i, t: 0 }
  const t = (meters - TERRACE_LEVELS[i]) / (TERRACE_LEVELS[i + 1] - TERRACE_LEVELS[i])
  return { i, t }
}

/** Índice del piso que se VE en una altura (−1 = mar). Cambia a mitad de la pared. */
export function terraceIndex(meters: number): number {
  if (meters <= 0) return -1
  const { i, t } = locate(meters)
  return t >= WALL_MIDDLE ? i + 1 : i
}

/**
 * Altura "en escalones": casi todo el tramo es suelo plano y al final sube
 * con una pared empinada pero continua. Al ser continua, las paredes siguen
 * curvas suaves en vez de dientes de sierra.
 */
export function terraceHeight(meters: number): number {
  if (meters <= 0) return meters
  const { i, t } = locate(meters)
  if (i === TERRACE_LEVELS.length - 1) return PLATEAU[i]
  const s = Math.min(1, Math.max(0, (t - WALL_START) / (1 - WALL_START)))
  const k = s * s * (3 - 2 * s)
  return PLATEAU[i] + (PLATEAU[i + 1] - PLATEAU[i]) * k
}

/**
 * Suaviza la rejilla de alturas (desenfoque 3x3, varias pasadas) para que los bordes
 * de los pisos salgan redondeados.
 */
export function smoothHeights(src: Int16Array, w: number, h: number, passes = 4): Float32Array {
  let a = Float32Array.from(src)
  let b = new Float32Array(a.length)
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, n = 0
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy
          if (yy < 0 || yy >= h) continue
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx
            if (xx < 0 || xx >= w) continue
            sum += a[yy * w + xx]
            n++
          }
        }
        b[y * w + x] = sum / n
      }
    }
    ;[a, b] = [b, a]
  }
  return a
}
