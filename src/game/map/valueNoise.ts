// Ruido suave ("value noise"): da un número entre 0 y 1 que cambia poco a poco al moverse.
// Sirve para pintar manchas naturales (campos, variaciones de color) en vez de cuadros o rayas.

/** Número pseudoaleatorio fijo para cada punto de la rejilla (siempre el mismo para el mismo punto). */
function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** Ruido en (x, y): se interpolan suavemente los valores de las 4 esquinas de su celda. */
export function valueNoise(x: number, y: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const tx = x - x0, ty = y - y0
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty)
  const a = hash(x0, y0), b = hash(x0 + 1, y0), c = hash(x0, y0 + 1), d = hash(x0 + 1, y0 + 1)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

/** Dos capas de ruido (manchas grandes + detalle) para que se vea menos artificial. */
export function fractalNoise(x: number, y: number) {
  return valueNoise(x, y) * 0.7 + valueNoise(x * 2.7 + 17, y * 2.7 + 31) * 0.3
}
