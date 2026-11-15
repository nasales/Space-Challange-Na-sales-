// Featured-case tutorials: shared types between the story script, the data pipeline and the UI.
// Full description and rules: docs/case_tutorials.md. Changing this file needs agreement
// from Data (Diego), Interface (Yeipi) and Game (Person 2).

/**
 * Featured cases active in the game (2026-11-15: the team keeps 5). The game draws a marker only
 * for these ids. Parked cases keep their scripts, data and levels in the repo: to restore one,
 * move its id from PARKED_CASE_IDS back to this list.
 */
export const TUTORIAL_CASE_IDS = [
  'dana_valencia',
  'filomena_madrid',
  'cordoba_heat',
  'aneto_glacier',
  'donana',
] as const
/** Parked featured cases (not shown in the game; nothing deleted). */
export const PARKED_CASE_IDS = ['daimiel', 'almeria_murcia', 'ebro_delta', 'galicia_fires', 'sierra_culebra'] as const
export function isActiveCase(caseId: string): boolean {
  return (TUTORIAL_CASE_IDS as readonly string[]).includes(caseId)
}
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
    lines: { speaker: 'detective' | 'witness'; text: string; mood?: LineMood }[]
    /** The witness's claim, in quotes, pinned at the top of the detective's notebook */
    claim: string
  }
  /** Quiz-style lesson steps (DANA format). Empty when the case uses `board`. */
  steps: TutorialStep[]
  /**
   * Evidence board (detective corkboard): when present, the UI shows it instead of `steps`.
   * See docs/evidence_board.md.
   */
  board?: EvidenceBoard
  /**
   * Interrogation room (two suspects behind a one-way mirror): when present, the UI shows it
   * instead of `steps` (and `steps` is empty). A case uses either `board` or `interrogation`.
   */
  interrogation?: Interrogation
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

/**
 * How the speaker feels on a dialogue line: drives the emote in the speech bubble (UI) and the
 * talking pose / face of the 3D character (game). Default 'neutral'.
 */
export type LineMood =
  | 'neutral'
  | 'happy'
  | 'curious'
  | 'explaining'
  | 'sad'
  | 'proud'
  | 'doubtful'
  | 'insistent'
  | 'determined'
  | 'confident'

/** Evidence board: the witness's claim in the centre, items around it. */
export interface EvidenceBoard {
  /** Short title on the board header, e.g. "Is Madrid really not warming?" */
  title: string
  /** One sentence shown before the first item is opened (how to play the board) */
  instructions: string
  /** 4-6 items, in the suggested order (the player may open them in any order) */
  items: EvidenceItem[]
  /** Shown when every item is linked: the overall picture in 1-3 sentences (no final verdict) */
  summary: string
}

export type EvidenceKind = 'chart' | 'clipping' | 'datacard'
export type EvidenceRelation = 'supports' | 'contradicts' | 'neutral'

export interface EvidenceItem {
  id: string
  kind: EvidenceKind
  /** Label on the pinned card (face down and face up) */
  title: string
  /** Hand-written note on the face-down card, e.g. "Every January since 1980" */
  teaser: string
  /** What this item teaches about reading a time series (<= 80 words, plain English) */
  text: string
  /** The chart shown with the task (existing views). Clippings may omit it. */
  chart?: ChartSpec
  /** For kind "clipping": the newspaper text (well-known facts only, no invented quotes) */
  clipping?: { headline: string; body: string; date?: string }
  /** The hands-on task the player solves to turn the card face up */
  task: EvidenceTask
  /** How this evidence relates to the witness's claim (the player links it with red string) */
  relation: EvidenceRelation
  /** Explanation shown after the player links it (also shown as the hint if they pick wrong) */
  relation_feedback: string
  /** Notebook entry (<= 15 words) */
  clue: string
}

/**
 * Hands-on tasks (each one is a small UI mini-game). Every task has a short `prompt`, a `hint`
 * shown after a wrong try, and a `success` message.
 * - click_point: click the right point on the chart (`answer` = "YYYY-MM" or "YYYY")
 * - fit_line: drag the ends of a ruler over the chart; success when the slope sign matches the
 *   real trend (and, if `tolerance` is given, its value per decade within that tolerance); then the
 *   real trend line is drawn for comparison
 * - order_cards: drag polaroid cards into order; `cards` are years of a yearly series (season or
 *   annual, from the chart), `order` "desc" = highest first
 * - slider_window: move a slider over start years (data extras.window_trends); `question` asked
 *   at the end with `options` (exactly one correct)
 * - tally: count points that match a rule on the chart per period (`periods` of years) and type
 *   the counts; `answers` = the right counts
 * - compare: a clipping (or data card) next to the chart; pick the right explanation among `options`
 */
export type EvidenceTask = { prompt: string; hint: string; success: string } & (
  | { type: 'click_point'; answer: string }
  | { type: 'fit_line'; tolerance?: number }
  | { type: 'order_cards'; cards: string[]; order: 'asc' | 'desc' }
  | { type: 'slider_window'; question: string; options: { text: string; correct: boolean }[] }
  | { type: 'tally'; rule: string; periods: { label: string; from: string; to: string }[]; answers: number[] }
  | { type: 'compare'; options: { text: string; correct: boolean }[] }
)

// ---- Interrogation room (Aneto format, src/ui/casefile/Interrogation.tsx) ----------------------

/**
 * Interrogation room: two suspects (causes, drawn as noir cartoon characters, never real people)
 * stand behind a one-way mirror, each with an alibi. The player opens the evidence folders on the
 * table; each one is a small hands-on task. Once solved, the player confronts the folder's suspect:
 * does it break the alibi, back it, or leave reasonable doubt (not enough to charge)? At the end
 * the player charges the guilty suspect and releases the other, then the summary closes the case.
 */
export interface Interrogation {
  /** Short title in the room header, e.g. "Who is melting the glacier?" */
  title: string
  /** One sentence shown in the header before the first folder is opened (how to play) */
  instructions: string
  /** Exactly two suspects; exactly one has `guilty: true` */
  suspects: Suspect[]
  /** 4-6 evidence folders, in the suggested order (the player may open them in any order) */
  evidence: InterrogationEvidence[]
  /** The decision: charge one suspect, release the other */
  finale: {
    /** Question asked when every folder has been used, e.g. "Who do you charge?" */
    prompt: string
  }
  /** Shown after the right decision: the overall picture in 1-3 sentences */
  summary: string
}

/** Look of a suspect's drawing (original inline SVG art in the UI) */
export type SuspectLook = 'heat' | 'snow'

export interface Suspect {
  id: string
  /** e.g. "Summer Heat" */
  name: string
  look: SuspectLook
  /** One line on the suspect's file card, e.g. "Works June to August. Melts ice." */
  record: string
  /** What the suspect claims, in quotes (shown in a speech bubble behind the glass) */
  alibi: string
  /** The suspect the data point to (exactly one per interrogation) */
  guilty: boolean
  /** Shown after the right decision about this suspect (charged or released) */
  decision_text: string
  /** Kind hint shown when the player decides wrongly about this suspect */
  wrong_hint: string
}

/** What a piece of evidence does to the suspect's alibi */
export type AlibiVerdict = 'breaks' | 'backs' | 'doubt'

export interface InterrogationEvidence {
  id: string
  /** Label on the folder tab (open and closed) */
  title: string
  /** Hand-written note on the closed folder, e.g. "Every summer since 1980" */
  teaser: string
  /** What this evidence teaches about reading a time series (<= 80 words, plain English) */
  text: string
  /** Chart shown with the task (existing views); season_switch and proof_line draw their own */
  chart?: ChartSpec
  task: InterrogationTask
  /** Id of the suspect this evidence is put to */
  suspect: string
  /** The right answer when the player confronts the suspect */
  verdict: AlibiVerdict
  /** Explanation shown after the confrontation (also the hint after a wrong pick) */
  verdict_feedback: string
  /** Notebook entry (<= 15 words) */
  clue: string
}

/**
 * Tasks of the interrogation: every evidence-board task (EvidenceTask) plus two of its own.
 * - season_switch: tabs flip the chart between the whole year and each season of `variable`
 *   (annual means with the whole-record trend, or one season with its own trend); the player
 *   ticks the seasons that match `rule` ("faster_than_year": the seasonal slope is larger than the
 *   whole-record slope; "significant": p < 0.05), or "none of them". The answer is computed from
 *   the data, never written in the script.
 * - proof_line: the standard of proof. Each exhibit is one trend from the data (whole record, a
 *   season, or a threshold count); the player puts it on the side of the p = 0.05 line where it
 *   belongs: "beyond reasonable doubt" (p < 0.05) or "reasonable doubt". Answers from the data.
 */
export type InterrogationTask =
  | EvidenceTask
  | ({ prompt: string; hint: string; success: string } & (
      | {
          type: 'season_switch'
          variable: string
          seasons: SeasonId[]
          rule: 'faster_than_year' | 'significant'
          /** Question above the tick boxes, e.g. "Which seasons warm faster than the year?" */
          question: string
        }
      | { type: 'proof_line'; exhibits: ProofExhibit[] }
    ))

/** One trend put on the proof line: whole record (no season, no threshold), a season or a count */
export interface ProofExhibit {
  label: string
  variable: string
  season?: SeasonId
  /** id in TutorialSeries.extras.threshold_counts */
  threshold_id?: string
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
