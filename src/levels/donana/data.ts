// Doñana level data, precomputed by pipeline/level_donana.py with the official analyze_trend.
import type { TrendResult } from '../common/format'
import raw from './donana_level.json'

interface Series {
  units: string
  dataset: string
  anomalies: { dates: string[]; values: (number | null)[] }
}

export interface DonanaData {
  case_id: string
  soilm: Series
  precip: Series
  windows: Record<string, TrendResult>
  full: { soilm: TrendResult; precip: TrendResult }
  common: { first: string; last: string; soilm: TrendResult; precip: TrendResult }
}

export const LEVEL = raw as unknown as DonanaData

const soilDates = LEVEL.soilm.anomalies.dates
export const FIRST_YEAR = Number(soilDates[0].slice(0, 4))
export const LAST_YEAR = Number(soilDates[soilDates.length - 1].slice(0, 4))

export function windowResult(start: number, end: number): TrendResult {
  return LEVEL.windows[`${start}-${end}`] ?? { too_short: true }
}
