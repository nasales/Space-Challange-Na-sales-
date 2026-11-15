// Numbers the evidence-board tasks check against, always taken from the case data
// (data/tutorial_data/<case>.json), never from the script.
import type { ChartSpec, TutorialSeries } from '../../../shared/tutorial'
import { monthX } from '../chartKit'

/** Yearly values behind a yearly chart view (season, same_month, annual, ranking), by year */
export function yearlyValues(spec: ChartSpec, series: TutorialSeries): Map<number, number> {
  const ex = series.extras
  let ys: { years: number[]; values: (number | null)[] } | undefined
  if (spec.view === 'season' || (spec.view === 'ranking' && spec.season)) ys = spec.season ? ex?.seasons?.[spec.season] : undefined
  else if (spec.view === 'same_month') ys = ex?.same_month?.[Math.min(12, Math.max(1, spec.month ?? 1)) - 1]
  else if (spec.view === 'threshold_count') {
    const tc = ex?.threshold_counts?.find((c) => c.id === spec.threshold_id) ?? ex?.threshold_counts?.[0]
    ys = tc ? { years: tc.years, values: tc.counts } : undefined
  } else ys = series.annual
  const out = new Map<number, number>()
  ys?.years.forEach((y, i) => {
    const v = ys.values[i]
    if (v != null && Number.isFinite(v)) out.set(y, v)
  })
  return out
}

/**
 * The real trend line of a chart view, in the chart's own coordinates (x = decimal year,
 * y = value): the line the fit_line ruler is compared with. null when the view has none.
 */
export function viewTrend(spec: ChartSpec, series: TutorialSeries): { slopePerYear: number; ends: [number, number, number, number] } | null {
  const t = series.trend
  const md = series.monthly.dates
  const ta = monthX(md[0] ?? '2000-01')
  const tb = monthX(md[md.length - 1] ?? '2000-01')
  const ex = series.extras
  switch (spec.view) {
    case 'monthly':
    case 'running_mean':
      return t ? { slopePerYear: t.slope_per_year, ends: [ta, t.monthly_line[0], tb, t.monthly_line[1]] } : null
    case 'anomaly':
      return t ? { slopePerYear: t.slope_per_year, ends: [ta, t.anomaly_line[0], tb, t.anomaly_line[1]] } : null
    case 'annual': {
      const yrs = series.annual.years
      if (!t || yrs.length < 2) return null
      return { slopePerYear: t.slope_per_year, ends: [yrs[0], t.annual_line[0], yrs[yrs.length - 1], t.annual_line[1]] }
    }
    case 'same_month':
    case 'season': {
      const ys = spec.view === 'season' ? ex?.seasons?.[spec.season ?? 'JJA'] : ex?.same_month?.[Math.min(12, Math.max(1, spec.month ?? 1)) - 1]
      if (!ys || ys.years.length < 2) return null
      return { slopePerYear: ys.trend.slope_per_year, ends: [ys.years[0], ys.trend.line[0], ys.years[ys.years.length - 1], ys.trend.line[1]] }
    }
    case 'threshold_count': {
      const tc = ex?.threshold_counts?.find((c) => c.id === spec.threshold_id) ?? ex?.threshold_counts?.[0]
      if (!tc || tc.years.length < 2) return null
      return { slopePerYear: tc.trend.slope_per_year, ends: [tc.years[0], tc.trend.line[0], tc.years[tc.years.length - 1], tc.trend.line[1]] }
    }
    default:
      return null
  }
}

/** Views whose chart shows a trend line when `show_trend` is set (TimeSeriesChart) */
export const TREND_VIEWS: ChartSpec['view'][] = ['monthly', 'anomaly', 'annual', 'same_month', 'season', 'threshold_count']

/** "2021" or "2021-01" -> what the player reads ("2021", "January 2021") */
export function keyLabel(key: string): string {
  const [y, m] = key.split('-')
  if (!m) return y
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`
}

/** Year of a period bound ("1980" or "1980-01") */
export const yearOf = (bound: string) => Number(bound.slice(0, 4))
