// Hand-made SVG chart for one ChartSpec of a featured-case tutorial (no chart library).
// Line views (this file): monthly, climatology (Jan..Dec), anomaly, annual, same_month, season,
// threshold_count (bars per year), zscore_pair, cumulative and running_mean.
// Other technique views (ranking, periods, season_scatter, window_trends): TechniqueCharts.tsx.
// It draws at the real pixel width of its box (ResizeObserver), so text stays readable on a phone.
import { useId, type ReactNode } from 'react'
import type { ChartSpec, Highlight, TutorialSeries, YearlySeries } from '../../shared/tutorial'
import {
  LABEL_H,
  SEASON_LABEL,
  frame,
  monthLabel,
  monthX,
  placeLabels,
  textBox,
  yScale,
  yearTicks,
  useWidth,
  type Box,
  type ViewResult,
} from './chartKit'
import { Key, Marks, XAxis, YGrid } from './chartParts'
import { MONTH_SHORT, baseUnits, credit, formatDate, sig } from './format'
import { periodsView, rankingView, seasonScatterView, windowTrendsView } from './TechniqueCharts'

interface Pt {
  x: number
  y: number | null
  /** date key used to find highlights: "YYYY-MM", "YYYY" (yearly views) or "MM" (climatology) */
  key: string
}

interface Layer {
  pts: Pt[]
  /** CSS modifier: casefile-chart__line--<kind> */
  kind: 'main' | 'second' | 'raw' | 'thick'
  dots?: boolean
}

const YEARLY_VIEWS: ChartSpec['view'][] = ['annual', 'same_month', 'season', 'threshold_count']

const monthlyPts = (s: { dates: string[]; values: (number | null)[] }): Pt[] =>
  s.dates.map((d, i) => ({ x: monthX(d), y: s.values[i] ?? null, key: d }))

const yearlyPts = (years: number[], values: (number | null)[]): Pt[] =>
  years.map((yr, i) => ({ x: yr, y: values[i] ?? null, key: String(yr) }))

/** Keeps the points whose key is inside the inclusive range (works for "YYYY" or "YYYY-MM" bounds) */
function inRange(pts: Pt[], range: [string, string] | undefined, yearly: boolean): Pt[] {
  if (!range) return pts
  const from = yearly ? range[0].slice(0, 4) : range[0]
  const to = yearly ? range[1].slice(0, 4) : range[1]
  return pts.filter((p) => p.key.slice(0, from.length) >= from && p.key.slice(0, to.length) <= to)
}

/** Straight trend line between two (x, value) ends, clipped to the visible x window */
function clipLine(ta: number, la: number, tb: number, lb: number, xMin: number, xMax: number) {
  const at = (x: number) => la + ((lb - la) * (x - ta)) / (tb - ta || 1)
  const xa = Math.max(ta, xMin)
  const xb = Math.min(tb, xMax)
  return xb > xa ? { xa, ya: at(xa), xb, yb: at(xb) } : null
}

const yearlyTrend = (ys: YearlySeries) =>
  ys.years.length > 1 ? ([ys.years[0], ys.trend.line[0], ys.years[ys.years.length - 1], ys.trend.line[1]] as const) : null

interface LineArgs {
  W: number
  uid: string
  layers: Layer[]
  yearly: boolean
  climatology?: boolean
  /** text at the top left (units) and, optionally, top right (what the chart shows) */
  unitsLabel: string
  title?: string
  trendEnds?: readonly [number, number, number, number] | null
  zero?: boolean
  /** shade the area between the line and zero (above in red, below in blue) */
  area?: boolean
  bars?: boolean
  highlights?: Highlight[]
  extraMarks?: { date: string; label: string }[]
  /** first words of the accessible summary */
  what: string
  valueUnits: string
}

function lineChart(a: LineArgs): ViewResult {
  const { W, layers, yearly } = a
  // units (top left) and title (top right) share one row when they fit with a clear gap,
  // otherwise the title goes on a second row (bold 12px text: about 7.4 px per character)
  const stackTitle = !!a.title && 4 + (a.unitsLabel.length + a.title.length) * 7.4 + 16 > W - 14
  const { narrow, H, P, plotW, plotH } = frame(W, stackTitle ? { t: 16 } : {})
  const main = layers[0]
  const all = layers.flatMap((l) => l.pts)
  const nums = all.filter((p): p is Pt & { y: number } => p.y != null)
  if (!main || main.pts.length === 0 || nums.length === 0) return { empty: 'No data to draw for this view.' }

  const step = yearly || a.climatology ? 1 : 1 / 12
  // ---- x domain (all layers)
  const xsAll = all.map((p) => p.x)
  const xFirst = Math.min(...xsAll)
  const xLast = Math.max(...xsAll)
  const x0 = xFirst - step / 2
  const x1 = xLast + step / 2
  const sx = (x: number) => P.l + ((x - x0) / (x1 - x0 || 1)) * plotW

  const trend = a.trendEnds ? clipLine(...a.trendEnds, xFirst, xLast) : null

  // ---- y domain
  const ys = nums.map((p) => p.y)
  if (trend) ys.push(trend.ya, trend.yb)
  const { ticks: yTicks, sy } = yScale(ys, P.t, H - P.b, { ticks: narrow ? 4 : 5, zero: a.zero || a.bars, integer: a.bars })

  // ---- x ticks
  const xTicks: { x: number; label: string }[] = []
  if (a.climatology) {
    MONTH_SHORT.forEach((m, i) => xTicks.push({ x: i, label: narrow ? m[0] : m }))
  } else {
    // monthly views: the tick sits on 1 January, the label is the year that starts there
    const fy = Math.ceil(yearly ? xFirst : x0)
    const ly = Math.floor(yearly ? xLast : x1)
    yearTicks(fy, ly, plotW, narrow).forEach((yr) => xTicks.push({ x: yr, label: String(yr) }))
  }

  // ---- line paths; a null or a missing step breaks the line
  const pathOf = (pts: Pt[]) => {
    let d = ''
    let prev: Pt | null = null
    for (const p of pts) {
      if (p.y == null) {
        prev = null
        continue
      }
      const jump = prev != null && p.x - prev.x > step * 1.5
      d += `${prev == null || jump ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`
      prev = p
    }
    return d
  }

  // ---- area between the main line and zero: one closed shape per unbroken run
  let areaD = ''
  if (a.area) {
    let run: (Pt & { y: number })[] = []
    const flush = () => {
      if (run.length > 1) {
        areaD +=
          `M${sx(run[0].x).toFixed(1)},${sy(0).toFixed(1)}` +
          run.map((p) => `L${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('') +
          `L${sx(run[run.length - 1].x).toFixed(1)},${sy(0).toFixed(1)}Z`
      }
      run = []
    }
    main.pts.forEach((p) => (p.y == null ? flush() : run.push(p as Pt & { y: number })))
    flush()
  }

  // ---- highlights (on the first layer)
  const keyOf = (date: string) => (yearly ? date.slice(0, 4) : date)
  const findPt = (date: string) => main.pts.find((p) => p.key === keyOf(date) && p.y != null) as (Pt & { y: number }) | undefined
  const marks: { x: number; y: number; label: string }[] = []
  const bands: { xa: number; xb: number; label: string }[] = []
  for (const m of a.extraMarks ?? []) {
    const p = findPt(m.date)
    if (p) marks.push({ x: p.x, y: p.y, label: m.label })
  }
  if (!a.climatology) {
    for (const h of a.highlights ?? []) {
      if (h.kind === 'point') {
        const p = findPt(h.date)
        if (p) marks.push({ x: p.x, y: p.y, label: h.label })
      } else {
        const toX = (date: string) => (yearly ? Number(date.slice(0, 4)) : monthX(date.length === 4 ? `${date}-01` : date))
        const to = h.to.length === 4 && !yearly ? monthX(`${h.to}-12`) : toX(h.to)
        const xa = Math.max(x0, toX(h.from) - step / 2)
        const xb = Math.min(x1, to + step / 2)
        if (xb > xa) bands.push({ xa, xb, label: h.label })
      }
    }
  }

  // ---- labels: the top line (units + title) and band labels are fixed, point labels avoid them
  const area = { left: P.l, right: W - P.r, top: 0, bottom: H - P.b }
  const anchorAt = (px: number) => (px < P.l + 70 ? 'start' : px > W - P.r - 70 ? 'end' : 'middle') as 'start' | 'end' | 'middle'
  const taken: Box[] = [textBox(4, 14, 'start', a.unitsLabel)]
  if (a.title) taken.push(stackTitle ? textBox(4, 30, 'start', a.title) : textBox(W - P.r, 14, 'end', a.title))
  bands.forEach((b) => {
    const mid = (sx(b.xa) + sx(b.xb)) / 2
    taken.push(textBox(mid, P.t + 13, anchorAt(mid), b.label))
  })
  const placed = placeLabels(
    marks.map((m) => ({ cx: sx(m.x), cy: sy(m.y), label: m.label })),
    taken,
    { ...area, top: LABEL_H + 6 },
  )

  // ---- accessible summary (describes the picture, never the statistical result)
  const first = main.pts[0].key
  const last = main.pts[main.pts.length - 1].key
  const summary =
    `${a.what}` +
    (a.climatology ? ', January to December' : `, from ${formatDate(first)} to ${formatDate(last)}`) +
    `. Values range from ${sig(Math.min(...nums.map((p) => p.y)))} to ${sig(Math.max(...nums.map((p) => p.y)))} ${a.valueUnits}.` +
    (trend ? ' A straight trend line is drawn over the data.' : '') +
    placed.map((m) => ` Marked: ${m.label}.`).join('') +
    bands.map((b) => ` Shaded: ${b.label}.`).join('')

  const barW = Math.max(2, Math.min(18, (plotW / Math.max(1, main.pts.length)) * 0.7))
  const clipUp = `${a.uid}-up`
  const clipDown = `${a.uid}-down`

  const body: ReactNode = (
    <>
      {bands.map((b, i) => (
        <g key={`b${i}`} className="casefile-chart__band">
          <rect x={sx(b.xa)} y={P.t} width={Math.max(2, sx(b.xb) - sx(b.xa))} height={plotH} />
          <text x={(sx(b.xa) + sx(b.xb)) / 2} y={P.t + 13} textAnchor={anchorAt((sx(b.xa) + sx(b.xb)) / 2)}>
            {b.label}
          </text>
        </g>
      ))}
      <YGrid ticks={yTicks} sy={sy} left={P.l} right={W - P.r} fmt={a.bars ? String : sig} />
      <text x={4} y={14} textAnchor="start" className="casefile-chart__units">
        {a.unitsLabel}
      </text>
      {a.title && (
        <text
          x={stackTitle ? 4 : W - P.r}
          y={stackTitle ? 30 : 14}
          textAnchor={stackTitle ? 'start' : 'end'}
          className="casefile-chart__title"
        >
          {a.title}
        </text>
      )}

      {areaD && (
        <>
          <defs>
            <clipPath id={clipUp}>
              <rect x={P.l} y={P.t} width={plotW} height={Math.max(0, sy(0) - P.t)} />
            </clipPath>
            <clipPath id={clipDown}>
              <rect x={P.l} y={sy(0)} width={plotW} height={Math.max(0, H - P.b - sy(0))} />
            </clipPath>
          </defs>
          <path d={areaD} className="casefile-chart__area casefile-chart__area--up" clipPath={`url(#${clipUp})`} />
          <path d={areaD} className="casefile-chart__area casefile-chart__area--down" clipPath={`url(#${clipDown})`} />
        </>
      )}

      {(a.zero || a.area) && <line x1={P.l} x2={W - P.r} y1={sy(0)} y2={sy(0)} className="casefile-chart__zero" />}

      <XAxis ticks={xTicks} sx={sx} left={P.l} right={W - P.r} y={H - P.b} />

      {a.bars
        ? main.pts.map(
            (p) =>
              p.y != null && (
                <rect
                  key={p.key}
                  x={sx(p.x) - barW / 2}
                  y={Math.min(sy(p.y), sy(0))}
                  width={barW}
                  height={Math.max(p.y === 0 ? 0 : 1, Math.abs(sy(0) - sy(p.y)))}
                  className="casefile-chart__bar"
                />
              ),
          )
        : layers.map((l, i) => <path key={`l${i}`} d={pathOf(l.pts)} className={`casefile-chart__line casefile-chart__line--${l.kind}`} />)}
      {!a.bars &&
        layers.map(
          (l, i) =>
            l.dots &&
            l.pts.map(
              (p) => p.y != null && <circle key={`d${i}${p.key}`} cx={sx(p.x)} cy={sy(p.y)} r={narrow ? 2.5 : 3} className="casefile-chart__dot" />,
            ),
        )}

      {trend && <line x1={sx(trend.xa)} y1={sy(trend.ya)} x2={sx(trend.xb)} y2={sy(trend.yb)} className="casefile-chart__trend" />}

      <Marks placed={placed} />
    </>
  )
  return { H, body, summary, keys: trend ? <Key kind="trend">Trend line</Key> : null }
}

// ---- views -----------------------------------------------------------------------------------

const VIEW_LABEL: Partial<Record<ChartSpec['view'], string>> = {
  monthly: 'monthly values',
  climatology: 'average for each month of the year',
  anomaly: 'difference from the usual value of each month',
  annual: 'yearly averages',
}

function renderView(spec: ChartSpec, series: TutorialSeries, variables: Record<string, TutorialSeries>, W: number, uid: string): ViewResult {
  const view = spec.view
  const yearly = YEARLY_VIEWS.includes(view)
  const ex = series.extras
  const name = series.name
  const units = series.units
  const range = (pts: Pt[]) => inRange(pts, spec.range, yearly)
  const noExtras: ViewResult = { empty: `The data for this chart (${view.replace('_', ' ')}) is not in the case file yet.` }
  const seriesKey = (label: ReactNode = name, kind = 'series') => <Key kind={kind}>{label}</Key>

  const common = { W, uid, yearly, highlights: spec.highlights, unitsLabel: units, valueUnits: units }
  const withKeys = (r: ViewResult, keys: ReactNode, note?: string): ViewResult =>
    'empty' in r ? r : { ...r, keys: <>{keys}{r.keys}</>, note }

  switch (view) {
    case 'monthly':
    case 'anomaly':
    case 'annual':
    case 'climatology': {
      const t = series.trend
      let pts: Pt[]
      let trendEnds: LineArgs['trendEnds'] = null
      const ta = monthX(series.monthly.dates[0] ?? '2000-01')
      const tb = monthX(series.monthly.dates[series.monthly.dates.length - 1] ?? '2000-01')
      if (view === 'monthly') {
        pts = range(monthlyPts(series.monthly))
        if (spec.show_trend && t) trendEnds = [ta, t.monthly_line[0], tb, t.monthly_line[1]]
      } else if (view === 'anomaly') {
        pts = range(monthlyPts(series.anomaly))
        if (spec.show_trend && t) trendEnds = [ta, t.anomaly_line[0], tb, t.anomaly_line[1]]
      } else if (view === 'annual') {
        pts = range(yearlyPts(series.annual.years, series.annual.values))
        const yrs = series.annual.years
        if (spec.show_trend && t && yrs.length > 1) trendEnds = [yrs[0], t.annual_line[0], yrs[yrs.length - 1], t.annual_line[1]]
      } else {
        pts = series.climatology.map((v, i) => ({ x: i, y: v, key: String(i + 1).padStart(2, '0') }))
      }
      const extraMarks =
        spec.highlight_max && (view === 'monthly' || view === 'anomaly') && series.max
          ? [{ date: series.max.date, label: `Highest month: ${formatDate(series.max.date)}` }]
          : []
      const r = lineChart({
        ...common,
        layers: [{ pts, kind: 'main', dots: view === 'annual' || view === 'climatology' }],
        climatology: view === 'climatology',
        zero: view === 'anomaly',
        trendEnds,
        extraMarks,
        what: `${name} in ${units}, ${VIEW_LABEL[view]}`,
      })
      return withKeys(r, seriesKey())
    }

    case 'same_month':
    case 'season': {
      if (!ex) return noExtras
      const month = Math.min(12, Math.max(1, Math.round(spec.month ?? 1)))
      const season = spec.season ?? 'JJA'
      const ys = view === 'same_month' ? ex.same_month?.[month - 1] : ex.seasons?.[season]
      if (!ys) return noExtras
      const title = view === 'same_month' ? monthLabel(month) : SEASON_LABEL[season]
      const r = lineChart({
        ...common,
        layers: [{ pts: range(yearlyPts(ys.years, ys.values)), kind: 'main', dots: true }],
        title,
        trendEnds: spec.show_trend ? yearlyTrend(ys) : null,
        what: `${name} in ${units}, ${title.replace(/^Every/, 'every')}: one point per year`,
      })
      return withKeys(r, seriesKey(`${name}, ${title.replace(/^Every/, 'every')}`))
    }

    case 'threshold_count': {
      if (!ex) return noExtras
      const tc = ex.threshold_counts?.find((c) => c.id === spec.threshold_id) ?? (spec.threshold_id ? undefined : ex.threshold_counts?.[0])
      if (!tc) return noExtras
      const r = lineChart({
        ...common,
        layers: [{ pts: range(yearlyPts(tc.years, tc.counts)), kind: 'main' }],
        bars: true,
        unitsLabel: tc.label,
        valueUnits: 'months',
        trendEnds:
          spec.show_trend && tc.years.length > 1 ? [tc.years[0], tc.trend.line[0], tc.years[tc.years.length - 1], tc.trend.line[1]] : null,
        what: `${tc.label}: number of months in each year, as bars`,
      })
      return withKeys(r, seriesKey(`${tc.label}, per year`, 'bar'))
    }

    case 'zscore_pair': {
      const [va, vb] = spec.variables ?? [spec.variable, spec.variable]
      const sa = variables[va] ?? series
      const sb = variables[vb]
      if (!sa?.extras?.zscore_smooth12 || !sb?.extras?.zscore_smooth12) return noExtras
      const r = lineChart({
        ...common,
        layers: [
          { pts: range(monthlyPts(sa.extras.zscore_smooth12)), kind: 'main' },
          { pts: range(monthlyPts(sb.extras.zscore_smooth12)), kind: 'second' },
        ],
        zero: true,
        unitsLabel: 'standard deviations',
        valueUnits: 'standard deviations',
        title: narrow(W) ? undefined : '12-month average',
        what: `${sa.name} and ${sb.name}, both as standardised differences from the usual month (12-month average)`,
      })
      return withKeys(
        r,
        <>{seriesKey(sa.name)}<Key kind="second">{sb.name}</Key></>,
        'Both shown in the same units: how unusual each month is (0 = usual).',
      )
    }

    case 'cumulative': {
      if (!ex?.cumulative_anomaly) return noExtras
      const r = lineChart({
        ...common,
        layers: [{ pts: range(monthlyPts(ex.cumulative_anomaly)), kind: 'main' }],
        zero: true,
        area: true,
        unitsLabel: `running total, ${baseUnits(units)}`,
        what: `${name}: running total of the monthly differences from the usual month`,
      })
      return withKeys(
        r,
        <>{seriesKey(`${name}, running total`)}<Key kind="up">Total above zero</Key><Key kind="down">Total below zero</Key></>,
        'Rises while months are above usual, falls while they are below.',
      )
    }

    case 'running_mean': {
      const w = spec.window === 60 ? 60 : 12
      const rm = ex?.running_mean?.[String(w) as '12' | '60']
      if (!rm) return noExtras
      const label = w === 60 ? '5-year average' : '12-month average'
      const r = lineChart({
        ...common,
        layers: [
          { pts: range(monthlyPts(series.monthly)), kind: 'raw' },
          { pts: range(monthlyPts({ dates: series.monthly.dates, values: rm })), kind: 'thick' },
        ],
        what: `${name} in ${units}, monthly values with a ${label}`,
      })
      return withKeys(r, <><Key kind="raw">Monthly values</Key><Key kind="thick">{label}</Key></>)
    }

    case 'ranking':
      return rankingView(spec, series, W)
    case 'periods':
      return periodsView(spec, series, W)
    case 'season_scatter':
      return seasonScatterView(spec, series, variables, W)
    case 'window_trends':
      return windowTrendsView(spec, series, W)
    default:
      return { empty: `This chart type (${String(view)}) is not supported yet.` }
  }
}

const narrow = (W: number) => W < 460

/** Datasets credited under the chart: the series, plus the second variable of two-variable views */
function creditedSeries(spec: ChartSpec, series: TutorialSeries, variables: Record<string, TutorialSeries>): TutorialSeries[] {
  const out = [series]
  for (const v of spec.variables ?? []) if (variables[v] && !out.includes(variables[v])) out.push(variables[v])
  return out
}

export default function TimeSeriesChart({
  spec,
  series,
  variables,
}: {
  spec: ChartSpec
  series: TutorialSeries
  /** every variable of the case (needed by zscore_pair and season_scatter) */
  variables?: Record<string, TutorialSeries>
}) {
  const [boxRef, W] = useWidth<HTMLDivElement>(640)
  const uid = useId().replace(/:/g, '')
  const vars = variables ?? { [series.variable]: series }
  const out = renderView(spec, series, vars, W, uid)

  return (
    <figure className="casefile-chart">
      <div ref={boxRef} className="casefile-chart__box">
        {'empty' in out ? (
          <p className="casefile-chart__empty">{out.empty}</p>
        ) : (
          <svg width={W} height={out.H} viewBox={`0 0 ${W} ${out.H}`} role="img" aria-label={out.summary}>
            {out.body}
          </svg>
        )}
      </div>
      {!('empty' in out) && (
        <figcaption className="casefile-chart__caption">
          {out.keys}
          {out.note && <span className="casefile-chart__note">{out.note}</span>}
          <span className="casefile-chart__credit">{credit(...creditedSeries(spec, series, vars))}</span>
        </figcaption>
      )}
    </figure>
  )
}
