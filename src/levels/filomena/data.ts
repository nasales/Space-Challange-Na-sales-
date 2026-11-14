// Filomena level data, precomputed by pipeline/level_filomena.py with the official analyze_trend.
import type { TrendResult } from '../common/format'
import raw from './filomena_level.json'

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
