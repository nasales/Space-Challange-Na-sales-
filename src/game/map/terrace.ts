// Toy-model "terraced" relief: heights are grouped into floors joined by long, gentle ramps.

/** Height (m) at which each floor starts. Same order and count as LEVEL_COLORS in palette.ts. */
export const TERRACE_LEVELS = [0, 150, 350, 600, 900, 1200, 1600, 2000, 2500]
/** Height at which each floor is drawn (the first one is a small step above the sea). */
const PLATEAU = [40, ...TERRACE_LEVELS.slice(1)]
/**
 * Fraction of each band between two floors that stays flat (a small landing); the rest is the ramp
 * up to the next floor. Low value = long ramps, short landings: slopes stay long and walkable while
 * the landings still give the playful stepped look.
 */
const WALL_START = 0.2
const WALL_MIDDLE = (WALL_START + 1) / 2

/** Finds the band [i, i+1] a height falls in, and where inside it (t from 0 to 1). */
function locate(meters: number) {
  let i = 0
  while (i + 1 < TERRACE_LEVELS.length && meters >= TERRACE_LEVELS[i + 1]) i++
  if (i === TERRACE_LEVELS.length - 1) return { i, t: 0 }
  const t = (meters - TERRACE_LEVELS[i]) / (TERRACE_LEVELS[i + 1] - TERRACE_LEVELS[i])
  return { i, t }
}

/** Index of the floor SEEN at a height (-1 = sea). It changes halfway up the ramp. */
export function terraceIndex(meters: number): number {
  if (meters <= 0) return -1
  const { i, t } = locate(meters)
  return t >= WALL_MIDDLE ? i + 1 : i
}

/**
 * Stepped height: a short flat landing, then a long ramp up to the next floor. The ramp eases in
 * and out (smoothstep), so step edges are rounded instead of sharp.
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
 * Extra land-only smoothing (radius in grid cells, ~600 m each; applied three times, which is close
 * to a Gaussian blur). It stretches mountain flanks into long ramps.
 */
const LAND_RADIUS = 4

/** One 3x3 box-blur pass, done as two separable 3-tap passes (same result, much faster). */
function blurPass(a: Float32Array, tmp: Float32Array, out: Float32Array, w: number, h: number) {
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      let sum = a[row + x], n = 1
      if (x > 0) { sum += a[row + x - 1]; n++ }
      if (x < w - 1) { sum += a[row + x + 1]; n++ }
      tmp[row + x] = sum / n
    }
  }
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      let sum = tmp[row + x], n = 1
      if (y > 0) { sum += tmp[row - w + x]; n++ }
      if (y < h - 1) { sum += tmp[row + w + x]; n++ }
      out[row + x] = sum / n
    }
  }
}

/** Box SUM of radius r along one axis (running sum, cost independent of r; outside counts as 0). */
function boxSum(src: Float32Array, out: Float32Array, w: number, h: number, r: number, alongX: boolean) {
  const n = alongX ? w : h, lines = alongX ? h : w
  const step = alongX ? 1 : w
  for (let line = 0; line < lines; line++) {
    const base = alongX ? line * w : line
    let sum = 0
    for (let k = 0; k < Math.min(r, n); k++) sum += src[base + k * step]
    for (let k = 0; k < n; k++) {
      if (k + r < n) sum += src[base + (k + r) * step]
      if (k - r - 1 >= 0) sum -= src[base + (k - r - 1) * step]
      out[base + k * step] = sum
    }
  }
}

/** Three separable box passes (unnormalised, in place): a cheap, Gaussian-like blur. */
function softBlur(a: Float32Array, tmp: Float32Array, w: number, h: number, r: number) {
  for (let pass = 0; pass < 3; pass++) {
    boxSum(a, tmp, w, h, r, true)
    boxSum(tmp, a, w, h, r, false)
  }
}

/**
 * Smooths the height grid so floor edges come out rounded.
 * 1) `passes` 3x3 blur passes over everything: they decide the coastline (as before).
 * 2) A wider blur over land only, so mountain slopes become long ramps. Sea cells weigh 0 and are
 *    left untouched, so the coast does not move and islands keep their height.
 */
export function smoothHeights(src: Int16Array, w: number, h: number, passes = 6): Float32Array {
  let a = Float32Array.from(src)
  let b = new Float32Array(a.length)
  const tmp = new Float32Array(a.length)
  for (let pass = 0; pass < passes; pass++) {
    blurPass(a, tmp, b, w, h)
    ;[a, b] = [b, a]
  }
  if (LAND_RADIUS <= 0) return a

  // Normalised convolution: blur(height * land) / blur(land)
  const weight = new Float32Array(a.length)
  const land = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) {
    weight[i] = a[i] > 0 ? 1 : 0
    land[i] = weight[i] * a[i]
  }
  softBlur(weight, tmp, w, h, LAND_RADIUS)
  softBlur(land, tmp, w, h, LAND_RADIUS)
  for (let i = 0; i < a.length; i++) if (a[i] > 0) a[i] = Math.max(1, land[i] / weight[i])
  return a
}
