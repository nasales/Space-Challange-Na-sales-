// Hand-made SVG chart for one ChartSpec of a featured-case tutorial (no chart library).
// Views: monthly, climatology (Jan..Dec), anomaly (with a zero line) and annual means.
// It draws at the real pixel width of its box (ResizeObserver), so text stays readable on a phone.
import { useLayoutEffect, useRef, useState } from 'react'
import type { ChartSpec, Highlight, TutorialSeries } from '../../shared/tutorial'
import { MONTH_SHORT, credit, formatDate, sig } from './format'

interface Pt {
  x: number
  y: number | null
  /** date key used to find highlights: "YYYY-MM", "YYYY" (annual) or "MM" (climatology) */
  key: string
}

const VIEW_LABEL: Record<ChartSpec['view'], string> = {
  monthly: 'monthly values',
  climatology: 'average for each month of the year',
  anomaly: 'difference from the usual value of each month',
  annual: 'yearly averages',
}

/** "YYYY-MM" -> decimal year at the middle of the month */
const monthX = (date: string) => Number(date.slice(0, 4)) + (Number(date.slice(5, 7)) - 0.5) / 12

function points(series: TutorialSeries, view: ChartSpec['view']): Pt[] {
  switch (view) {
    case 'monthly':
      return series.monthly.dates.map((d, i) => ({ x: monthX(d), y: series.monthly.values[i] ?? null, key: d }))
    case 'anomaly':
      return series.anomaly.dates.map((d, i) => ({ x: monthX(d), y: series.anomaly.values[i] ?? null, key: d }))
    case 'annual':
      return series.annual.years.map((yr, i) => ({ x: yr, y: series.annual.values[i] ?? null, key: String(yr) }))
    case 'climatology':
      return series.climatology.map((v, i) => ({ x: i, y: v, key: String(i + 1).padStart(2, '0') }))
  }
}

/** Keeps the points whose key is inside the inclusive range (works for "YYYY" or "YYYY-MM" bounds) */
function inRange(pts: Pt[], range: [string, string] | undefined): Pt[] {
  if (!range) return pts
  const [from, to] = range
  return pts.filter((p) => p.key.slice(0, from.length) >= from && p.key.slice(0, to.length) <= to)
}

/** Round axis ticks (1, 2, 2.5, 5 x 10^n) */
function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min || Math.abs(max) || 1
  const raw = span / Math.max(count, 1)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(Number(v.toFixed(10)))
  return out
}

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(Math.max(260, Math.round(el.clientWidth)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

export default function TimeSeriesChart({ spec, series }: { spec: ChartSpec; series: TutorialSeries }) {
  const [boxRef, W] = useWidth<HTMLDivElement>(640)
  const narrow = W < 460
  const H = Math.round(Math.min(300, Math.max(210, W * 0.48)))
  const P = { l: narrow ? 40 : 50, r: 14, t: 28, b: 28 }
  const plotW = W - P.l - P.r
  const plotH = H - P.t - P.b

  const view = spec.view
  const isTime = view !== 'climatology'
  const step = view === 'annual' ? 1 : view === 'climatology' ? 1 : 1 / 12
  const pts = view === 'climatology' ? points(series, view) : inRange(points(series, view), spec.range)
  const nums = pts.filter((p): p is Pt & { y: number } => p.y != null)

  if (nums.length === 0) {
    return <p className="casefile-chart__empty">No data to draw for this view.</p>
  }

  // ---- x domain
  const x0 = pts[0].x - step / 2
  const x1 = pts[pts.length - 1].x + step / 2
  const sx = (x: number) => P.l + ((x - x0) / (x1 - x0 || 1)) * plotW

  // ---- trend line (endpoints from the data file, clipped to the visible window)
  let trend: { xa: number; ya: number; xb: number; yb: number } | null = null
  if (spec.show_trend && view !== 'climatology') {
    const t = series.trend
    const [la, lb] = view === 'annual' ? t.annual_line : view === 'anomaly' ? t.anomaly_line : t.monthly_line
    const ta = view === 'annual' ? series.annual.years[0] : monthX(series.monthly.dates[0])
    const tb =
      view === 'annual'
        ? series.annual.years[series.annual.years.length - 1]
        : monthX(series.monthly.dates[series.monthly.dates.length - 1])
    const at = (x: number) => la + ((lb - la) * (x - ta)) / (tb - ta || 1)
    const xa = Math.max(ta, pts[0].x)
    const xb = Math.min(tb, pts[pts.length - 1].x)
    if (xb > xa) trend = { xa, ya: at(xa), xb, yb: at(xb) }
  }

  // ---- y domain
  const ys = nums.map((p) => p.y)
  if (trend) ys.push(trend.ya, trend.yb)
  if (view === 'anomaly') ys.push(0)
  let yMin = Math.min(...ys)
  let yMax = Math.max(...ys)
  const pad = (yMax - yMin || Math.abs(yMax) || 1) * 0.08
  yMin -= pad
  yMax += pad
  const yTicks = niceTicks(yMin, yMax, narrow ? 4 : 5)
  yMin = Math.min(yMin, yTicks[0])
  yMax = Math.max(yMax, yTicks[yTicks.length - 1])
  const sy = (y: number) => P.t + (1 - (y - yMin) / (yMax - yMin || 1)) * plotH

  // ---- series path; a null or a missing month breaks the line
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
  const dots = view === 'annual' || view === 'climatology'

  // ---- x ticks
  const xTicks: { x: number; label: string }[] = []
  if (isTime) {
    const firstYear = Math.ceil(view === 'annual' ? pts[0].x : x0)
    const lastYear = Math.floor(view === 'annual' ? pts[pts.length - 1].x : x1)
    const maxLabels = Math.max(2, Math.floor(plotW / (narrow ? 44 : 56)))
    const yStep = [1, 2, 5, 10, 20, 50].find((s) => (lastYear - firstYear) / s + 1 <= maxLabels) ?? 50
    for (let yr = Math.ceil(firstYear / yStep) * yStep; yr <= lastYear; yr += yStep) {
      // monthly views: the tick sits on 1 January, the label is the year that starts there
      xTicks.push({ x: yr, label: String(yr) })
    }
  } else {
    MONTH_SHORT.forEach((m, i) => xTicks.push({ x: i, label: narrow ? m[0] : m }))
  }

  // ---- highlights
  const findPt = (date: string) => {
    const key = view === 'annual' ? date.slice(0, 4) : date
    return pts.find((p) => p.key === key && p.y != null) as (Pt & { y: number }) | undefined
  }
  const marks: { x: number; y: number; label: string }[] = []
  const bands: { xa: number; xb: number; label: string }[] = []
  const addHighlight = (h: Highlight) => {
    if (view === 'climatology') return
    if (h.kind === 'point') {
      const p = findPt(h.date)
      if (p) marks.push({ x: p.x, y: p.y, label: h.label })
    } else {
      const toX = (date: string) => (view === 'annual' ? Number(date.slice(0, 4)) : monthX(date.length === 4 ? `${date}-01` : date))
      const to = h.to.length === 4 && view !== 'annual' ? monthX(`${h.to}-12`) : toX(h.to)
      const xa = Math.max(x0, toX(h.from) - step / 2)
      const xb = Math.min(x1, to + step / 2)
      if (xb > xa) bands.push({ xa, xb, label: h.label })
    }
  }
  if (spec.highlight_max && (view === 'monthly' || view === 'anomaly')) {
    const p = findPt(series.max.date)
    if (p) marks.push({ x: p.x, y: p.y, label: `Highest month: ${formatDate(series.max.date)}` })
  }
  spec.highlights?.forEach(addHighlight)

  // ---- accessible summary (describes the picture, never the statistical result)
  const first = pts[0].key
  const last = pts[pts.length - 1].key
  const summary =
    `${series.name} in ${series.units}, ${VIEW_LABEL[view]}` +
    (isTime ? `, from ${formatDate(first)} to ${formatDate(last)}` : ', January to December') +
    `. Values range from ${sig(Math.min(...nums.map((p) => p.y)))} to ${sig(Math.max(...nums.map((p) => p.y)))} ${series.units}.` +
    (trend ? ' A straight trend line is drawn over the data.' : '') +
    marks.map((m) => ` Marked: ${m.label}.`).join('') +
    bands.map((b) => ` Shaded: ${b.label}.`).join('')

  const labelAnchor = (px: number): 'start' | 'end' | 'middle' => (px < P.l + 70 ? 'start' : px > W - P.r - 70 ? 'end' : 'middle')

  // ---- point labels: try above, below, then further up/down until no label box overlaps another
  // (two marks on the same chart, e.g. highlight_max + a point highlight, must stay readable)
  type Box = { x0: number; x1: number; y0: number; y1: number }
  const LABEL_H = 14
  const boxOf = (cx: number, baseline: number, anchor: string, text: string): Box => {
    const w = text.length * 7.2 + 6
    const x0 = anchor === 'start' ? cx - 3 : anchor === 'end' ? cx - w + 3 : cx - w / 2
    return { x0, x1: x0 + w, y0: baseline - LABEL_H + 2, y1: baseline + 3 }
  }
  const hits = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
  const taken: Box[] = bands.map((b) => {
    const mid = (sx(b.xa) + sx(b.xb)) / 2
    return boxOf(mid, P.t + 13, labelAnchor(mid), b.label)
  })
  const placed = marks.map((m) => {
    const cx = sx(m.x)
    const cy = sy(m.y)
    const anchor = labelAnchor(cx)
    const candidates = [cy - 11, cy + 20, cy - 27, cy + 36, cy - 43, cy + 52]
    const inside = candidates.filter((ty) => ty - LABEL_H >= 0 && ty + 3 <= H - P.b)
    const ty =
      inside.find((t) => !taken.some((b) => hits(b, boxOf(cx, t, anchor, m.label)))) ??
      inside[0] ??
      Math.max(LABEL_H, Math.min(H - P.b - 4, cy - 11))
    taken.push(boxOf(cx, ty, anchor, m.label))
    return { cx, cy, ty, anchor, label: m.label }
  })

  return (
    <figure className="casefile-chart">
      <div ref={boxRef} className="casefile-chart__box">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
          {/* bands under everything */}
          {bands.map((b, i) => (
            <g key={`b${i}`} className="casefile-chart__band">
              <rect x={sx(b.xa)} y={P.t} width={Math.max(2, sx(b.xb) - sx(b.xa))} height={plotH} />
              <text x={(sx(b.xa) + sx(b.xb)) / 2} y={P.t + 13} textAnchor={labelAnchor((sx(b.xa) + sx(b.xb)) / 2)}>
                {b.label}
              </text>
            </g>
          ))}

          {/* y grid + labels */}
          {yTicks.map((v) => (
            <g key={`y${v}`}>
              <line x1={P.l} x2={W - P.r} y1={sy(v)} y2={sy(v)} className="casefile-chart__grid" />
              <text x={P.l - 6} y={sy(v) + 4} textAnchor="end" className="casefile-chart__tick">
                {sig(v)}
              </text>
            </g>
          ))}
          <text x={4} y={14} textAnchor="start" className="casefile-chart__units">
            {series.units}
          </text>

          {view === 'anomaly' && (
            <line x1={P.l} x2={W - P.r} y1={sy(0)} y2={sy(0)} className="casefile-chart__zero" />
          )}

          {/* x axis */}
          <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} className="casefile-chart__axis" />
          {xTicks.map((t) => (
            <g key={`x${t.x}`}>
              <line x1={sx(t.x)} x2={sx(t.x)} y1={H - P.b} y2={H - P.b + 5} className="casefile-chart__axis" />
              <text x={sx(t.x)} y={H - P.b + 18} textAnchor="middle" className="casefile-chart__tick">
                {t.label}
              </text>
            </g>
          ))}

          <path d={d} className="casefile-chart__line" />
          {dots &&
            nums.map((p) => <circle key={p.key} cx={sx(p.x)} cy={sy(p.y)} r={narrow ? 2.5 : 3} className="casefile-chart__dot" />)}

          {trend && (
            <line
              x1={sx(trend.xa)}
              y1={sy(trend.ya)}
              x2={sx(trend.xb)}
              y2={sy(trend.yb)}
              className="casefile-chart__trend"
            />
          )}

          {placed.map((m, i) => (
            <g key={`m${i}`} className="casefile-chart__mark">
              <circle cx={m.cx} cy={m.cy} r={6} />
              <text x={m.cx} y={m.ty} textAnchor={m.anchor}>
                {m.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <figcaption className="casefile-chart__caption">
        <span className="casefile-chart__key casefile-chart__key--series">{series.name}</span>
        {trend && <span className="casefile-chart__key casefile-chart__key--trend">Trend line</span>}
        <span className="casefile-chart__credit">{credit(series)}</span>
      </figcaption>
    </figure>
  )
}
