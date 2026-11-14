// Ebro Delta level data, precomputed by pipeline/level_ebro.py with the official analyze_trend.
import type { TrendResult } from '../common/format'
import raw from './ebro_level.json'

interface MonthlySeries {
  dates: string[]
  values: (number | null)[]
}

export interface EbroData {
  case_id: string
  t2m: {
    units: string
    dataset: string
    raw: MonthlySeries
    /** Mean of each calendar month, January first: the climatology analyze_trend removes */
    typical_year: number[]
    anomalies: MonthlySeries
  }
  full: { t2m: TrendResult; precip: TrendResult }
  /** Total change over the T2M record = slope x decades (ci = CI low / high x decades) */
  total: { first: string; last: string; decades: number; change: number; ci: [number, number] }
  precip: { units: string; dataset: string; first: string; last: string }
}

export const LEVEL = raw as unknown as EbroData

/** Slider of the phase 2 estimate (°C). */
export const GUESS = { min: -1, max: 4, step: 0.1, start: 0 }

/** A guess counts as right inside the 95 % range of the total, plus half a slider step on each side. */
export const GUESS_TOLERANCE = GUESS.step / 2

export function guessInRange(guess: number, ci: [number, number] = LEVEL.total.ci): boolean {
  return guess >= ci[0] - GUESS_TOLERANCE - 1e-9 && guess <= ci[1] + GUESS_TOLERANCE + 1e-9
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "2026-09" -> "September 2026". */
export function monthName(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`
}

/** Calendar month name, 0 = January. */
export function calendarMonth(i: number): string {
  return MONTHS[i]
}
