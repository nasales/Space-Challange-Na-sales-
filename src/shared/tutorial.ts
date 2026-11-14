// Featured-case tutorials: shared types between the story script, the data pipeline and the UI.
// Full description and rules: docs/case_tutorials.md. Changing this file needs agreement
// from Data (Diego), Interface (Yeipi) and Game (Person 2).

/** Featured cases that have a tutorial. The game draws a marker only for these ids. */
export const TUTORIAL_CASE_IDS = [
  'dana_valencia',
  'filomena_madrid',
  'cordoba_heat',
  'aneto_glacier',
  'donana',
  'daimiel',
  'almeria_murcia',
  'ebro_delta',
  'galicia_fires',
  'sierra_culebra',
] as const
export type TutorialCaseId = (typeof TUTORIAL_CASE_IDS)[number]

/** Where a case marker goes on the map (taken from data/cases_index.json). */
export interface CaseMarker {
  id: string
  title: string
  place: string
  lat: number
  lon: number
}

// ---------------------------------------------------------------------------
// 1. Story script: data/tutorials/<case_id>.json (written by the story agent)
// ---------------------------------------------------------------------------

export interface TutorialScript {
  case_id: string
  title: string
  place: string
  /** First screen: context about the case, before any chart */
  intro: {
    headline: string
    /** 2-4 short paragraphs, plain English */
    paragraphs: string[]
    /** The question the player will answer at the end */
    question: string
  }
  /**
   * Optional opening scene on the map: the witness (src/shared/witness.ts) tells the detective
   * the context in speech bubbles, and ends with a claim the player will test with the data.
   * When present, the UI plays it before the steps (the intro card can be skipped or shortened).
   */
  scene?: {
    lines: { speaker: 'detective' | 'witness'; text: string }[]
    /** The witness's claim, in quotes, pinned at the top of the detective's notebook */
    claim: string
  }
  steps: TutorialStep[]
  /** Last screen: the player writes their own conclusion (normal game loop) */
  conclusion: {
    prompt: string
    /** Variable the conclusion is about (key in TutorialData.variables) */
    variable: string
    /** Optional sentence starter shown as placeholder */
    placeholder?: string
  }
  /** Shown after the conclusion is submitted: what the statistics say, in plain words */
  reveal: {
    /** One entry per variable used in the tutorial */
    by_variable: Record<string, string>
    lesson: string
    /** Was the witness's claim right? Shown with the "CASE CLOSED" stamp. */
    claim_verdict?: 'right' | 'wrong' | 'partly'
    /** One or two sentences explaining the verdict, addressed to the witness */
    claim_text?: string
  }
}

export interface TutorialStep {
  id: string
  title: string
  /** Explanation shown next to the chart, plain English, at most ~80 words */
  text: string
  chart: ChartSpec
  /** Optional multiple-choice check; exactly one option has correct: true */
  question?: {
    prompt: string
    options: { text: string; correct: boolean; feedback: string }[]
  }
  /** One-line lesson shown after the step (after answering, if there is a question) */
  takeaway: string
  /** Optional short note added to the detective's notebook when the step is solved */
  clue?: string
}

/**
 * What the UI draws. All series come from TutorialData; the script never contains numbers
 * that the data does not back up.
 * Basic views (every case):
 * - monthly: raw monthly values
 * - climatology: the 12-month average cycle (Jan..Dec), one line
 * - anomaly: monthly values minus the climatology of their month
 * - annual: annual means (only complete years)
 * Technique views (each featured case teaches one; data in TutorialSeries.extras):
 * - same_month: one calendar month across the years (`month` 1-12), e.g. every January
 * - season: one season across the years (`season`), e.g. every summer
 * - ranking: bars of `season` (or annual if no season) sorted from highest to lowest;
 *   `top_n` bars, the last `recent_years` years coloured differently
 * - threshold_count: per year, number of months above/below a threshold (`threshold_id`)
 * - zscore_pair: two variables (`variables`) on one scale: standardised anomalies,
 *   12-month running mean
 * - cumulative: running sum of anomalies (multi-year droughts and recoveries)
 * - running_mean: monthly series with a centred running mean of `window` months (12 or 60)
 * - periods: histogram of monthly anomalies, before vs from the split date of the series
 * - season_scatter: one dot per year, x = `season` mean of `variables[0]`,
 *   y = `season` mean of `variables[1]`; the last `recent_years` years coloured differently
 * - window_trends: trend of the monthly series for different start years (bar = slope,
 *   whisker = 95% CI, filled if significant)
 * show_trend adds a trend line to monthly, anomaly, annual, same_month, season and
 * threshold_count (from the matching trend in the data).
 */
export interface ChartSpec {
  variable: string
  view:
    | 'monthly'
    | 'climatology'
    | 'anomaly'
    | 'annual'
    | 'same_month'
    | 'season'
    | 'ranking'
    | 'threshold_count'
    | 'zscore_pair'
    | 'cumulative'
    | 'running_mean'
    | 'periods'
    | 'season_scatter'
    | 'window_trends'
  /** Optional zoom, inclusive, "YYYY-MM" (or "YYYY" for yearly views) */
  range?: [string, string]
  show_trend?: boolean
  /** Draw the series with the largest monthly value as a labelled point */
  highlight_max?: boolean
  /** Labelled points or bands. Dates must exist in the data ("YYYY" for yearly views). */
  highlights?: Highlight[]
  /** same_month: 1 = January ... 12 = December */
  month?: number
  /** season, ranking, season_scatter */
  season?: SeasonId
  /** ranking: number of bars (default all) */
  top_n?: number
  /** ranking, season_scatter: highlight the last N years */
  recent_years?: number
  /** threshold_count: id in TutorialSeries.extras.threshold_counts */
  threshold_id?: string
  /** zscore_pair, season_scatter: two variable ids (variable is the first one) */
  variables?: [string, string]
  /** running_mean: 12 or 60 */
  window?: 12 | 60
}

/** DJF = Dec-Jan-Feb, assigned to the year of its January; JJAS = June-September (fire season) */
export type SeasonId = 'DJF' | 'MAM' | 'JJA' | 'SON' | 'JJAS'

export type Highlight =
  | { kind: 'point'; date: string; label: string }
  | { kind: 'band'; from: string; to: string; label: string }

// ---------------------------------------------------------------------------
// 2. Chart data: data/tutorial_data/<case_id>.json (built by pipeline/tutorial_data.py)
// ---------------------------------------------------------------------------

export interface TutorialData {
  case_id: string
  place: string
  lat: number
  lon: number
  /** Keyed by variable id, e.g. "PRECIP", "T2M" */
  variables: Record<string, TutorialSeries>
}

export interface TutorialSeries {
  variable: string
  /** Plain-English name, e.g. "Precipitation" */
  name: string
  units: string
  /** e.g. "NASA GPM_3IMERGM v07" */
  dataset: string
  monthly: { dates: string[]; values: (number | null)[] }
  /** 12 values, January..December */
  climatology: number[]
  anomaly: { dates: string[]; values: (number | null)[] }
  annual: { years: number[]; values: number[] }
  /** Largest monthly value */
  max: { date: string; value: number }
  /** Same numbers as data/cache/case_<id>_<var>.json (analyze_trend on the monthly series) */
  trend: {
    slope_per_year: number
    ci_low: number
    ci_high: number
    p_value: number
    significant: boolean
    test: string
    /** Straight line to draw: value at the first and last date of the monthly series.
     *  anomaly_line is on the anomaly scale, monthly_line on the raw scale,
     *  annual_line at the first and last year of the annual means. */
    anomaly_line: [number, number]
    monthly_line: [number, number]
    annual_line: [number, number]
  }
  /** Technique data (always present for every variable since the 10-case update) */
  extras?: TutorialExtras
}

/** A yearly sub-series with its own trend (Sen slope + Mann-Kendall on the yearly values). */
export interface YearlySeries {
  years: number[]
  values: number[]
  trend: YearlyTrend
}

export interface YearlyTrend {
  slope_per_year: number
  ci_low: number
  ci_high: number
  p_value: number
  significant: boolean
  test: string
  /** Line value at the first and last year */
  line: [number, number]
}

export interface TutorialExtras {
  /** 12 entries, index 0 = January; only years where that month has data */
  same_month: YearlySeries[]
  /** Complete seasons only */
  seasons: Record<SeasonId, YearlySeries>
  /** Defined per case in pipeline/tutorial_data.py (may be empty) */
  threshold_counts: {
    id: string
    /** e.g. "Months below 0 °C" */
    label: string
    op: 'above' | 'below'
    value: number
    years: number[]
    counts: number[]
    trend: YearlyTrend
  }[]
  /** Standardised anomaly (anomaly / its standard deviation), centred 12-month running mean */
  zscore_smooth12: { dates: string[]; values: (number | null)[] }
  /** Running sum of anomalies (gaps count as 0) */
  cumulative_anomaly: { dates: string[]; values: (number | null)[] }
  /** Centred running means of the monthly values; null where the window is incomplete */
  running_mean: { '12': (number | null)[]; '60': (number | null)[] }
  /** Monthly anomalies split in two halves of the record */
  periods: {
    split: string
    before: { from: string; to: string; mean: number; n: number }
    after: { from: string; to: string; mean: number; n: number }
    /** Shared histogram bin edges (length = counts length + 1) */
    bin_edges: number[]
    before_counts: number[]
    after_counts: number[]
  }
  /** analyze_trend on the monthly series from each start year to the end */
  window_trends: {
    start_year: number
    slope_per_year: number
    ci_low: number
    ci_high: number
    p_value: number
    significant: boolean
  }[]
}
