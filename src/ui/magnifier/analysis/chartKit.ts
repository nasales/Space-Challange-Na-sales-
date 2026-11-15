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
