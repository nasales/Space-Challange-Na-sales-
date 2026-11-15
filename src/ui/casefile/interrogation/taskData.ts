// Numbers the interrogation tasks check against, always computed from the case data
// (data/tutorial_data/<case>.json), never from the script. Mirrored by the validator in
// pipeline/tests/test_tutorial_script.py (season_switch_answer, exhibit_p).
import type { InterrogationTask, ProofExhibit, SeasonId, TutorialData, TutorialSeries } from '../../../shared/tutorial'
import { ALPHA } from './labels'

export type TaskOf<T extends InterrogationTask['type']> = Extract<InterrogationTask, { type: T }>

export interface Trend {
  /** per decade */
  slope: number
  lo: number
  hi: number
  p: number
}

/** Whole-record trend (season undefined), one season's trend, or a threshold count's trend */
export function trendOf(series: TutorialSeries, season?: SeasonId, thresholdId?: string): Trend | null {
  if (thresholdId) {
    const t = series.extras?.threshold_counts.find((c) => c.id === thresholdId)?.trend
    return t ? { slope: t.slope_per_year * 10, lo: t.ci_low * 10, hi: t.ci_high * 10, p: t.p_value } : null
  }
  if (season) {
    const t = series.extras?.seasons?.[season]?.trend
    return t ? { slope: t.slope_per_year * 10, lo: t.ci_low * 10, hi: t.ci_high * 10, p: t.p_value } : null
  }
  const t = series.trend
  return t ? { slope: t.slope_per_year * 10, lo: t.ci_low * 10, hi: t.ci_high * 10, p: t.p_value } : null
}

/** The seasons the player must tick (empty = "none of them") */
export function seasonSwitchAnswer(task: TaskOf<'season_switch'>, series: TutorialSeries): Set<SeasonId> {
  const year = trendOf(series)
  return new Set(
    task.seasons.filter((s) => {
      const t = trendOf(series, s)
      if (!t) return false
      return task.rule === 'faster_than_year' ? !!year && t.slope > year.slope : t.p < ALPHA
    }),
  )
}

export function exhibitP(ex: ProofExhibit, data: TutorialData): number | null {
  const s = data.variables[ex.variable]
  if (!s) return null
  return trendOf(s, ex.season, ex.threshold_id)?.p ?? null
}
