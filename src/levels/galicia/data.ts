// Galicia fires level data, precomputed by pipeline/level_galicia.py with the official analyze_trend.
import type { TrendResult } from '../common/format'
import raw from './galicia_level.json'

export interface Series {
  units: string
  dataset: string
  anomalies: { dates: string[]; values: (number | null)[] }
}

export interface NoiseStats {
  /** Standard deviation of the monthly anomalies around their Sen line */
  residual_sd: number
  /** Lag-1 autocorrelation of those residuals */
  rho: number
  n_months: number
}

export type TwinsAnswer = 'galicia' | 'culebra' | 'both' | 'neither'
export type WhyAnswer = 'slope' | 'noise' | 'data'
export type WarmingAnswer = 'yes' | 'weak' | 'no'

export interface GaliciaData {
  case_id: string
  compare_case_id: string
  galicia_soilm: Series
  culebra_soilm: Series
  galicia_t2m: Series
  trends: { galicia_soilm: TrendResult; culebra_soilm: TrendResult; galicia_t2m: TrendResult }
  twins: { answer: TwinsAnswer }
  why: {
    galicia: NoiseStats
    culebra: NoiseStats
    /** Galicia relative to Culebra; below 1 = this reason weakens Galicia's evidence */
    factors: Record<WhyAnswer, number>
    answer: WhyAnswer
  }
  warming: { answer: WarmingAnswer }
}

export const LEVEL = raw as unknown as GaliciaData
