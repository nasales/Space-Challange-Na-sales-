// Córdoba heat level data, precomputed by pipeline/level_cordoba.py: official analyze_trend numbers,
// record warm / cold months (strictly above / below every earlier year of the same calendar month,
// counted from 1990 on) and a fixed-seed simulation of the same series without its trend.
import type { TrendResult } from '../common/format'
import raw from './cordoba_level.json'

export interface Decade {
  label: string
  start: number
  end: number
  /** The decade is not over yet (last_month = last month of data) */
  partial: boolean
  last_month: string | null
}

export interface CordobaData {
  case_id: string
  t2m: { units: string; dataset: string; anomalies: { dates: string[]; values: (number | null)[] } }
  full: TrendResult
  decades: Decade[]
  records: {
    first_year: number
    /** Indices (into t2m.anomalies) of the record warm / record cold months */
    warm_idx: number[]
    cold_idx: number[]
    /** Counts per decade, same order as decades */
    warm: number[]
    cold: number[]
    /** Share of warm records among all records (warm / (warm + cold)) per decade */
    warm_share: (number | null)[]
    /** Start year of the decade(s) with the highest share of warm records (phase 1 answer) */
    top_share_decades: number[]
  }
  simulation: {
    seed: number
    n: number
    slope_removed_decade: number
    /** Mean record counts per decade over the simulated trend-free series */
    expected_warm: number[]
    expected_cold: number[]
    total_warm_mean: number
    total_warm_p95: number
    total_warm_max: number
    share_at_least_observed: number
    observed_total_warm: number
    observed_total_cold: number
    /** observed_total_warm > total_warm_p95 */
    more_than_chance: boolean
  }
}

export const LEVEL = raw as unknown as CordobaData
