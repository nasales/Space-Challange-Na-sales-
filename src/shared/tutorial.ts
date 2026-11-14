// Featured-case tutorials: shared types between the story script, the data pipeline and the UI.
// Full description and rules: docs/case_tutorials.md. Changing this file needs agreement
// from Data (Diego), Interface (Yeipi) and Game (Person 2).

/** Featured cases that have a tutorial. The game draws a marker only for these ids. */
export const TUTORIAL_CASE_IDS = ['dana_valencia'] as const
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
}

/**
 * What the UI draws. All series come from TutorialData; the script never contains numbers
 * that the data does not back up.
 * - monthly: raw monthly values
 * - climatology: the 12-month average cycle (Jan..Dec), one line
 * - anomaly: monthly values minus the climatology of their month
 * - annual: annual means (only complete years)
 * Any view except climatology can add the trend line with show_trend.
 */
export interface ChartSpec {
  variable: string
  view: 'monthly' | 'climatology' | 'anomaly' | 'annual'
  /** Optional zoom, inclusive, "YYYY-MM" (or "YYYY" for annual) */
  range?: [string, string]
  show_trend?: boolean
  /** Draw the series with the largest monthly value as a labelled point */
  highlight_max?: boolean
  /** Labelled points or bands. Dates must exist in the data. */
  highlights?: Highlight[]
}

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
}
