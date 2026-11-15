// Pure helpers for the magnifier evidence sheet (no React, no fetch).
// They only PREPARE numbers for display. The trend itself (Sen slope, 95 % range, p-value) comes
// from the statistics pipeline through the database and is never recomputed here.
// Time convention: t in years from the first month of the series (t = monthIndex / 12).
import { L, LANG } from '../../../shared/i18n'

/** Inclusive index range of the months used by the trend test. */
export interface Period {
  start: number
  end: number
}

export const MONTH_NAMES =
  LANG === 'es'
    ? ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Decimal comma in Spanish (display only) */
const comma = (s: string) => (LANG === 'es' ? s.replace('.', ',') : s)

const isNum = (v: number | null | undefined): v is number => v != null && Number.isFinite(v)

/** "2005-03" (or "2005-03-01") -> 0-based calendar month, 0 when the date is malformed */
export function monthOf(date: string): number {
  const m = Number(date.slice(5, 7)) - 1
  return m >= 0 && m < 12 ? m : 0
}

export const yearOf = (date: string) => Number(date.slice(0, 4))

/** "2005-03" -> "Mar 2005" */
export const monthLabel = (date: string) => `${MONTH_NAMES[monthOf(date)]} ${date.slice(0, 4)}`

export function mean(xs: number[]): number | null {
  if (xs.length === 0) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Mean of every calendar month over the series itself (null when a month has no value). */
export function monthlyMeans(dates: string[], values: (number | null)[]): (number | null)[] {
  const sum = new Array<number>(12).fill(0)
  const n = new Array<number>(12).fill(0)
  values.forEach((v, i) => {
    if (!isNum(v)) return
    const m = monthOf(dates[i] ?? '')
    sum[m] += v
    n[m] += 1
  })
  return sum.map((s, m) => (n[m] > 0 ? s / n[m] : null))
}

/**
 * Monthly anomalies: value minus the mean of its calendar month (seasonal cycle removed).
 * The calendar-month means come from the series; `climatology` is only a fallback for a month
 * that has no value in the series.
 */
export function anomalies(
  dates: string[],
  values: (number | null)[],
  climatology: (number | null)[] = [],
): (number | null)[] {
  const base = monthlyMeans(dates, values).map((m, i) => (m != null ? m : isNum(climatology[i]) ? climatology[i] : null))
  return values.map((v, i) => {
    const b = base[monthOf(dates[i] ?? '')]
    return isNum(v) && b != null ? v - b : null
  })
}

export interface AnnualMean {
  year: number
  mean: number
  months: number
}

/** Annual means, only for years with at least `minMonths` valid months. */
export function annualMeans(dates: string[], values: (number | null)[], minMonths = 10): AnnualMean[] {
  const byYear = new Map<number, { sum: number; n: number }>()
  values.forEach((v, i) => {
    if (!isNum(v)) return
    const year = yearOf(dates[i] ?? '')
    if (!Number.isFinite(year)) return
    const y = byYear.get(year) ?? { sum: 0, n: 0 }
    y.sum += v
    y.n += 1
    byYear.set(year, y)
  })
  return [...byYear.entries()]
    .filter(([, y]) => y.n >= minMonths)
    .map(([year, y]) => ({ year, mean: y.sum / y.n, months: y.n }))
    .sort((a, b) => a.year - b.year)
}

/**
 * Months used by the trend test. `periodStart` / `periodEnd` come from the database; when they
 * are missing, the first and last month with a value are used. null when there is no value.
 */
export function testPeriod(
  dates: string[],
  values: (number | null)[],
  periodStart: string | null,
  periodEnd: string | null,
): Period | null {
  const from = periodStart?.slice(0, 7) ?? ''
  const to = periodEnd?.slice(0, 7) ?? '9999-99'
  let start = -1
  let end = -1
  values.forEach((v, i) => {
    const d = (dates[i] ?? '').slice(0, 7)
    if (!isNum(v) || d < from || d > to) return
    if (start < 0) start = i
    end = i
  })
  return start < 0 ? null : { start, end }
}

/** Length of the period in years, counting both the first and the last month. */
export const periodYears = (period: Period) => (period.end - period.start + 1) / 12

/** Number of months with a value inside the period. */
export function validMonths(values: (number | null)[], period: Period): number {
  let n = 0
  for (let i = period.start; i <= period.end; i++) if (isNum(values[i])) n += 1
  return n
}

/** Total change over the test period implied by the slope (units/year * years). */
export const totalChange = (slopePerYear: number, period: Period) => slopePerYear * periodYears(period)

export interface TrendLine {
  /** Value of the line at t = 0 (first month of the series) */
  intercept: number
  /** Ends of the line: t in years from the first month, y in anomaly units */
  t0: number
  t1: number
  y0: number
  y1: number
}

/**
 * Sen trend line over the anomalies: y = slope * t + b, with b = median(anomaly - slope * t)
 * over the valid months of the period. The slope is given, not estimated.
 */
export function trendLine(anoms: (number | null)[], slopePerYear: number, period: Period): TrendLine | null {
  const rest: number[] = []
  for (let i = period.start; i <= period.end; i++) {
    const a = anoms[i]
    if (isNum(a)) rest.push(a - slopePerYear * (i / 12))
  }
  const intercept = median(rest)
  if (intercept == null || !Number.isFinite(slopePerYear)) return null
  const t0 = period.start / 12
  const t1 = period.end / 12
  return { intercept, t0, t1, y0: slopePerYear * t0 + intercept, y1: slopePerYear * t1 + intercept }
}

export interface CiBand {
  tMid: number
  yMid: number
  /** Line with the low slope at both ends, then the line with the high slope */
  low0: number
  low1: number
  high0: number
  high1: number
}

/**
 * 95 % range of the slope drawn as two lines through the middle point of the trend line.
 * null when the database has no confidence interval.
 */
export function ciBand(line: TrendLine, ciLow: number | null, ciHigh: number | null): CiBand | null {
  if (!isNum(ciLow) || !isNum(ciHigh)) return null
  const tMid = (line.t0 + line.t1) / 2
  const yMid = (line.y0 + line.y1) / 2
  return {
    tMid,
    yMid,
    low0: yMid + ciLow * (line.t0 - tMid),
    low1: yMid + ciLow * (line.t1 - tMid),
    high0: yMid + ciHigh * (line.t0 - tMid),
    high1: yMid + ciHigh * (line.t1 - tMid),
  }
}

export interface SeasonWindow {
  /** e.g. "1998–2007" */
  label: string
  /** 12 calendar-month means, January to December */
  months: (number | null)[]
  /** Mean of all the values of the window */
  mean: number | null
}

export interface SeasonalComparison {
  years: number
  first: SeasonWindow
  last: SeasonWindow
}

/**
 * Seasonal cycle of the first and the last `maxYears` years of the period. With a shorter series
 * the windows shrink so they never overlap; null when each window would be under 2 years.
 */
export function seasonalComparison(
  dates: string[],
  values: (number | null)[],
  period: Period,
  maxYears = 10,
): SeasonalComparison | null {
  const years = Math.min(maxYears, Math.floor(periodYears(period) / 2))
  if (years < 2) return null
  const window = (from: number, to: number): SeasonWindow => {
    const d = dates.slice(from, to + 1)
    const v = values.slice(from, to + 1)
    const y0 = (dates[from] ?? '').slice(0, 4)
    const y1 = (dates[to] ?? '').slice(0, 4)
    return { label: `${y0}–${y1}`, months: monthlyMeans(d, v), mean: mean(v.filter(isNum)) }
  }
  return {
    years,
    first: window(period.start, period.start + years * 12 - 1),
    last: window(period.end - years * 12 + 1, period.end),
  }
}

// --- Number formatting ---------------------------------------------------------------------

/** 3 significant figures, never an exponent: 0.0123, 1.23, 12.3, 123, 12346 */
export function fmt(x: number): string {
  if (!Number.isFinite(x)) return '–'
  if (x === 0) return '0'
  const magnitude = Math.floor(Math.log10(Math.abs(x)))
  const decimals = Math.min(Math.max(2 - magnitude, 0), 8)
  const s = x.toFixed(decimals)
  // "-0.00" style results of a tiny negative number read as zero
  return Number(s) === 0 ? '0' : comma(s.replace('-', '−'))
}

/** Like fmt, with an explicit sign for changes: "+0.21", "−1.4", "0" */
export function fmtSigned(x: number): string {
  const s = fmt(x)
  return x > 0 && s !== '0' ? `+${s}` : s
}

/** "p < 0.001" or "p = 0.032" */
export const fmtP = (p: number) => (p < 0.001 ? L('p < 0.001', 'p < 0,001') : `p = ${comma(p.toFixed(3))}`)

// --- Axis helpers --------------------------------------------------------------------------

export interface Ticks {
  min: number
  max: number
  values: number[]
  /** Decimals needed to tell the ticks apart */
  decimals: number
}

/** Round axis limits and about `count` ticks (steps of 1, 2 or 5 times a power of ten). */
export function niceTicks(lo: number, hi: number, count = 4): Ticks {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 1, values: [0, 1], decimals: 0 }
  if (lo === hi) {
    const pad = Math.abs(lo) > 0 ? Math.abs(lo) * 0.1 : 1
    lo -= pad
    hi += pad
  }
  const raw = (hi - lo) / Math.max(count, 1)
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow
  const min = Math.floor(lo / step) * step
  const max = Math.ceil(hi / step) * step
  const values: number[] = []
  for (let k = 0; min + k * step <= max + step / 2; k++) values.push(min + k * step)
  return { min, max, values, decimals: Math.min(Math.max(-Math.floor(Math.log10(step)), 0), 8) }
}

export const fmtTick = (v: number, decimals: number) => {
  const s = v.toFixed(decimals)
  return Number(s) === 0 ? '0' : comma(s.replace('-', '−'))
}

/** Years to label on a time axis: every 10, 5, 2 or 1 years depending on the span. */
export function yearTicks(firstYear: number, lastYear: number, maxTicks = 8): number[] {
  if (!Number.isFinite(firstYear) || !Number.isFinite(lastYear) || lastYear < firstYear) return []
  const span = lastYear - firstYear
  const step = [1, 2, 5, 10, 20, 50].find((s) => span / s <= maxTicks) ?? 100
  const out: number[] = []
  for (let y = Math.ceil(firstYear / step) * step; y <= lastYear; y += step) out.push(y)
  return out
}
