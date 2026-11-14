// Sierra de la Culebra level data, precomputed by pipeline/level_culebra.py with the official analyze_trend.
import type { TrendResult } from '../common/format'
import raw from './culebra_level.json'

interface Series {
  units: string
  dataset: string
  anomalies: { dates: string[]; values: (number | null)[] }
}

export interface NoiseLevel {
  factor: number
  detected: number
  runs: number
  rate: number
  example: number[]
}

export interface CulebraData {
  case_id: string
  t2m: Series
  soilm: Series
  fire: { month: string; pre_last: string; t2m: TrendResult; soilm: TrendResult }
  full: { t2m: TrendResult; soilm: TrendResult }
  noise: {
    seed: number
    runs: number
    slope_decade: number
    intercept: number
    residual_sd: number
    rho: number
    dates: string[]
    levels: NoiseLevel[]
  }
}

export const LEVEL = raw as unknown as CulebraData

/** Index of a noise factor (e.g. 2 for "twice the real noise") in LEVEL.noise.levels. */
export function noiseIndex(factor: number): number {
  return LEVEL.noise.levels.findIndex((l) => l.factor === factor)
}
