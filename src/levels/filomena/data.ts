// Filomena level data, precomputed by pipeline/level_filomena.py with the official analyze_trend.
import raw from './filomena_level.json'

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

export interface FilomenaData {
  case_id: string
  variable: string
  units: string
  dataset: string
  filomena_month: string
  anomalies: { dates: string[]; values: (number | null)[] }
  windows: Record<string, TrendResult>
  filomena: { with: TrendResult; without: TrendResult }
}

export const LEVEL = raw as unknown as FilomenaData

export const FIRST_YEAR = Number(LEVEL.anomalies.dates[0].slice(0, 4))
export const LAST_YEAR = Number(LEVEL.anomalies.dates[LEVEL.anomalies.dates.length - 1].slice(0, 4))

export function windowResult(start: number, end: number): TrendResult {
  return LEVEL.windows[`${start}-${end}`] ?? { too_short: true }
}

/** Decimal year of "YYYY-MM", same as pipeline/trend.py. */
export function decimalYear(date: string): number {
  return Number(date.slice(0, 4)) + (Number(date.slice(5, 7)) - 1) / 12
}

export function fmtSlope(x: number): string {
  return `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}`
}

export function fmtP(p: number): string {
  return p < 0.001 ? '< 0.001' : p.toFixed(3)
}
