// Valencia DANA level data, precomputed by pipeline/level_dana.py with the official analyze_trend.
import type { TrendResult } from '../common/format'
import raw from './dana_level.json'

interface Series {
  units: string
  dataset: string
  anomalies: { dates: string[]; values: (number | null)[] }
}

export interface DanaData {
  case_id: string
  precip: Series
  t2m: Series
  flood: {
    month: string
    index: number
    value: number
    anomaly: number
    rank: number
    n_months: number
    wettest_month: string
    wettest_value: number
    same_month_mean: number
  }
  precip_trend: { with_flood: TrendResult; without_flood: TrendResult }
  t2m_trend: {
    full: TrendResult
    first: string
    last: string
    years: number
    total_change: number
    cc_rate: number
    water_capacity_gain: number
  }
}

export const LEVEL = raw as unknown as DanaData

/** Picks within this many months of the flood month count as "found". */
export const FIND_TOLERANCE = 3

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2024-10" -> "Oct 2024". */
export function monthLabel(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`
}
