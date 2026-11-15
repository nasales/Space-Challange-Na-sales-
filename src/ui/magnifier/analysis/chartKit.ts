// Small shared pieces of the evidence-file charts (plain SVG, no chart library).
// Each chart fills its panel: ChartBox (./ChartBox.tsx) measures the panel and the chart draws in
// a viewBox of exactly that size, so text stays at its real pixel size and nothing scrolls.

export interface Frame {
  /** viewBox size (= the panel size in CSS pixels) */
  W: number
  H: number
  /** Padding around the plot area */
  l: number
  r: number
  t: number
  b: number
}

/** Plot frame for a measured panel; a little tighter on small panels. */
export function frameFor(width: number, height: number): Frame {
  const small = width < 420
  return { W: width, H: height, l: small ? 46 : 58, r: small ? 10 : 18, t: 26, b: small ? 26 : 30 }
}

/** Linear scale from a data range to a pixel range. */
export function scale(d0: number, d1: number, p0: number, p1: number) {
  const span = d1 - d0 || 1
  return (v: number) => p0 + ((v - d0) / span) * (p1 - p0)
}

/** SVG path of a series; null values break the line. A lone point is drawn as a short dash. */
export function linePath(values: (number | null)[], sx: (i: number) => number, sy: (v: number) => number): string {
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      pen = false
      return
    }
    const x = sx(i).toFixed(1)
    const y = sy(v).toFixed(1)
    const alone = !pen && (values[i + 1] == null || !Number.isFinite(values[i + 1] as number))
    d += alone ? `M${x},${y}h0.01` : `${pen ? 'L' : 'M'}${x},${y}`
    pen = true
  })
  return d
}

/** Centred running mean over `window` months (null where too few values): the smooth path the
 *  scanning magnifier follows. Display only. */
export function rollingMean(values: (number | null)[], window = 12): (number | null)[] {
  const half = Math.floor(window / 2)
  return values.map((_, i) => {
    let sum = 0
    let count = 0
    for (let j = Math.max(0, i - half); j <= Math.min(values.length - 1, i + half); j++) {
      const v = values[j]
      if (v != null && Number.isFinite(v)) {
        sum += v
        count++
      }
    }
    return count >= Math.ceil(window / 2) ? sum / count : null
  })
}

/** Index of the highest and the lowest value (null when there are none). */
export function extremes(values: (number | null)[]): { hi: number; lo: number } | null {
  let hi = -1
  let lo = -1
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) return
    if (hi < 0 || v > (values[hi] as number)) hi = i
    if (lo < 0 || v < (values[lo] as number)) lo = i
  })
  return hi < 0 ? null : { hi, lo }
}

/** true when the player asked the system for less motion */
export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
