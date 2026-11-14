// Tablas de Daimiel level data, precomputed by pipeline/level_daimiel.py with the official analyze_trend.
import type { TrendResult } from '../common/format'
import raw from './daimiel_level.json'

interface Series {
  units: string
  dataset: string
  anomalies: { dates: string[]; values: (number | null)[] }
}

export type Evidence = 'strong' | 'weak' | 'none'
export type ChanceOption = 'none' | 'one' | 'five' | 'ten'

/** One of the featured series tested in phase 2. */
export interface FeaturedTest {
  id: string
  case_id: string
  title: string
  variable: string
  dataset: string
  p_value: number
  significant: boolean
  bonferroni: boolean
}

export interface DaimielData {
  case_id: string
  soilm: Series
  precip: Series
  full: { soilm: TrendResult; precip: TrendResult; evidence: Evidence }
  tests: FeaturedTest[]
  real_significant: number
  bonferroni_threshold: number
  bonferroni_survivors: number
  simulation: {
    seed: number
    runs: number
    n_series: number
    alpha: number
    expected: number
    counts: number[]
    /** histogram[k] = number of runs with exactly k results p < 0.05 */
    histogram: number[]
    mean: number
    typical: number
    share_at_least_one: number
    /** Share of runs with at least one p below the Bonferroni threshold */
    share_any_bonferroni: number
    max: number
    options: { id: ChanceOption; lo: number; hi: number }[]
    answer: ChanceOption | null
  }
}

export const LEVEL = raw as unknown as DaimielData

/** The Daimiel soil-moisture test of the grid. */
export const DAIMIEL_SOIL = LEVEL.tests.find((t) => t.case_id === 'daimiel' && t.variable === 'SOILM')
