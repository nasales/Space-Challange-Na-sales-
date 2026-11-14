// Shared types and number formatting of the statistics levels.

/** One trend result precomputed by pipeline/level_data.py (analyze_trend), per decade. */
export type TrendResult =
  | { too_short: true }
  | {
      too_short?: undefined
      slope_decade: number
      ci_decade: [number, number]
      p_value: number
      significant: boolean
      n_months: number
    }

/** Decimal year of "YYYY-MM", same as pipeline/trend.py. */
export function decimalYear(date: string): number {
  return Number(date.slice(0, 4)) + (Number(date.slice(5, 7)) - 1) / 12
}

/** Signed number with a real minus sign, e.g. "+0.37", "−0.29". */
export function fmtSlope(x: number, digits = 2): string {
  const v = Math.abs(x) < 0.5 * 10 ** -digits ? 0 : x
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(digits)}`
}

export function fmtP(p: number, digits = 3): string {
  return p < 0.001 ? '< 0.001' : p.toFixed(digits)
}

/** Does the 95 % range of the slope include zero? */
export function ciIncludesZero(r: TrendResult): boolean {
  return !r.too_short && r.ci_decade[0] <= 0 && r.ci_decade[1] >= 0
}
