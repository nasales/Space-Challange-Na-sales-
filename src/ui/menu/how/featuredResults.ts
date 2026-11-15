// Trend results of the featured places for chapter 2 (forest plot and table), read from the
// data files so they always match the game:
// - slope, p-value and significance: data/cache/case_<id>_<VAR>.json (docs/contract.md). Only
//   these three fields are imported (JSON named exports), so the monthly series stay out of
//   the menu bundle.
// - 95 % interval of the slope: data/tutorial_data/<id>.json (`trend.ci_low` / `ci_high`, same
//   analyze_trend run). The case files carry no interval, so these larger files are loaded
//   lazily, only when the results page opens.
// Slopes are stored per year; everything here is per decade (x 10).
import { useEffect, useState } from 'react'
import { localCase } from '../../../shared/casesEs'

export type CaseVar = 'T2M' | 'PRECIP' | 'SOILM'
export const CASE_VARS: CaseVar[] = ['T2M', 'PRECIP', 'SOILM']

export interface FeaturedRow {
  key: string
  caseId: string
  /** Case title in the current language */
  title: string
  variable: CaseVar
  /** per decade */
  slope: number
  p: number
  significant: boolean
}

interface CaseIndexEntry {
  id: string
  title: string
  place: string
  files?: string[]
}

const caseIndex =
  Object.values(
    import.meta.glob<CaseIndexEntry[]>('/data/cases_index.json', {
      eager: true,
      import: 'default',
    }),
  )[0] ?? []

const slopes = import.meta.glob<number>('/data/cache/case_*.json', {
  eager: true,
  import: 'slope',
})
const pValues = import.meta.glob<number>('/data/cache/case_*.json', {
  eager: true,
  import: 'p_value',
})
const significance = import.meta.glob<boolean>('/data/cache/case_*.json', {
  eager: true,
  import: 'significant',
})

const FILE_RE = /\/case_(.+)_(T2M|PRECIP|SOILM)\.json$/

function buildRows(): FeaturedRow[] {
  const order = (id: string) => {
    const i = caseIndex.findIndex((c) => c.id === id)
    return i < 0 ? caseIndex.length : i
  }
  // within a case, the order of its `files` list (as in the report table)
  const fileOrder = (path: string, caseId: string) => {
    const files = caseIndex.find((c) => c.id === caseId)?.files ?? []
    const i = files.findIndex((f) => path.endsWith(f.slice(f.lastIndexOf('/'))))
    return i < 0 ? files.length : i
  }
  const rows: FeaturedRow[] = []
  const fileRank = new Map<string, number>()
  for (const path of Object.keys(slopes)) {
    const m = FILE_RE.exec(path)
    if (!m) continue
    const [, caseId, variable] = m
    const entry = caseIndex.find((c) => c.id === caseId)
    rows.push({
      key: `${caseId}_${variable}`,
      caseId,
      title: entry ? localCase(entry).title : caseId,
      variable: variable as CaseVar,
      slope: slopes[path] * 10,
      p: pValues[path],
      significant: significance[path],
    })
    fileRank.set(`${caseId}_${variable}`, fileOrder(path, caseId))
  }
  const rank = (r: FeaturedRow) => fileRank.get(r.key) ?? 0
  return rows.sort((a, b) => order(a.caseId) - order(b.caseId) || a.caseId.localeCompare(b.caseId) || rank(a) - rank(b))
}

/** One row per featured series, in the order of data/cases_index.json (and of each case's files) */
export const FEATURED_ROWS: FeaturedRow[] = buildRows()

/** 95 % interval per decade, by row key */
export type Intervals = Map<string, [number, number]>

interface TutorialTrendFile {
  case_id: string
  variables: Record<
    string,
    {
      variable?: string
      trend?: { slope_per_year: number; ci_low: number; ci_high: number }
    }
  >
}

const tutorialFiles = import.meta.glob<TutorialTrendFile>('/data/tutorial_data/*.json', { import: 'default' })

let pending: Promise<Intervals> | null = null

/** Loads the intervals once. An interval is kept only if its slope matches the case file. */
function loadIntervals(): Promise<Intervals> {
  pending ??= (async () => {
    const out: Intervals = new Map()
    const bySlope = new Map(FEATURED_ROWS.map((r) => [r.key, r.slope]))
    const files = await Promise.all(Object.values(tutorialFiles).map((load) => load()))
    for (const file of files) {
      for (const [key, series] of Object.entries(file.variables ?? {})) {
        const t = series.trend
        const rowKey = `${file.case_id}_${series.variable ?? key}`
        const slope = bySlope.get(rowKey)
        if (!t || slope === undefined) continue
        // a stale tutorial file (different analysis run) must not lend its interval
        if (Math.abs(t.slope_per_year * 10 - slope) > 1e-9 * Math.max(1, Math.abs(slope))) continue
        out.set(rowKey, [t.ci_low * 10, t.ci_high * 10])
      }
    }
    return out
  })()
  return pending
}

/** null while loading; an empty map if the files could not be loaded */
export function useIntervals(): Intervals | null {
  const [intervals, setIntervals] = useState<Intervals | null>(null)
  useEffect(() => {
    let live = true
    loadIntervals()
      .then((m) => live && setIntervals(m))
      .catch(() => live && setIntervals(new Map()))
    return () => {
      live = false
    }
  }, [])
  return intervals
}

/** Significant, but the 95 % interval still reaches zero (test and interval near the 5 % boundary) */
export const isBorderline = (row: FeaturedRow, ci: [number, number] | undefined) =>
  row.significant && ci !== undefined && ci[0] <= 0 && ci[1] >= 0
