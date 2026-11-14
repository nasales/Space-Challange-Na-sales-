// Aneto level data, precomputed by pipeline/level_aneto.py with the official analyze_trend.
import type { TrendResult } from '../common/format'
import raw from './aneto_level.json'

interface Series {
  units: string
  dataset: string
  anomalies: { dates: string[]; values: (number | null)[] }
}

/** T2M trend of one featured case, per decade (fastest first in LEVEL.race). */
export interface RaceRow {
  case_id: string
  title: string
  first: string
  last: string
  slope_decade: number
  ci_decade: [number, number]
  significant: boolean
}

export interface AnetoData {
  case_id: string
  t2m: Series
  precip: Series
  full: { t2m: TrendResult; precip: TrendResult }
  race: RaceRow[]
  verdict: { fastest_estimate: boolean; overlapping: string[]; clearly_fastest: boolean }
}

export const LEVEL = raw as unknown as AnetoData
