// Almeria-Murcia level data, precomputed by pipeline/level_almeria.py with the official analyze_trend
// (full-record numbers) and fixed-seed year shuffles (Sen slopes of the shuffled anomalies).
import type { TrendResult } from '../common/format'
import raw from './almeria_level.json'

export interface ShuffleSet {
  /** Sen slope of the real series, per decade (same as analyze_trend) */
  real_decade: number
  /** Sen slopes of the shuffled series, per decade, in the order the player sees them */
  slopes_decade: number[]
  /** Share of shuffles at least as steep (absolute value) as the real slope */
  share_as_steep: number
  /** share_as_steep < 0.05 */
  stands_out: boolean
}

export interface AlmeriaData {
  case_id: string
  soilm: { units: string; dataset: string; anomalies: { dates: string[]; values: (number | null)[] } }
  precip: { units: string; dataset: string }
  full: { soilm: TrendResult; precip: TrendResult }
  shuffles: { seed: number; n: number; soilm: ShuffleSet; precip: ShuffleSet }
}

export const LEVEL = raw as unknown as AlmeriaData
