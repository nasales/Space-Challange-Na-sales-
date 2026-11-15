// Technique views of the featured-case tutorials that are not a line over time:
// ranking (sorted bars), periods (two histograms), season_scatter (one dot per year) and
// window_trends (one trend per start year). Same comic look as TimeSeriesChart.
import type { ChartSpec, TutorialSeries } from '../../shared/tutorial'
import { SEASON_LABEL, SEASON_NAME, frame, niceTicks, overlaps, placeLabels, textBox, yScale, type Anchor, type Box, type ChartGeom, type ViewResult } from './chartKit'
import { Key, Marks, XAxis, YGrid } from './chartParts'
import { baseUnits, formatDate, sig, signed } from './format'

const missing = (what: string): ViewResult => ({ empty: `The data for this chart (${what}) is not in the case file yet.` })

/** Years named by point highlights ("YYYY" or "YYYY-MM") with their labels */
const highlightYears = (spec: ChartSpec) =>
  new Map((spec.highlights ?? []).flatMap((h) => (h.kind === 'point' ? [[Number(h.date.slice(0, 4)), h.label] as const] : [])))

const yearRange = (spec: ChartSpec) => {
  const from = spec.range ? Number(spec.range[0].slice(0, 4)) : -Infinity
  const to = spec.range ? Number(spec.range[1].slice(0, 4)) : Infinity
  return (y: number) => y >= from && y <= to
}

// ---- ranking ---------------------------------------------------------------------------------

export function rankingView(spec: ChartSpec, series: TutorialSeries, W: number): ViewResult {
  const ys = spec.season ? series.extras?.seasons?.[spec.season] : series.annual
  if (!ys || ys.years.length === 0) return missing('ranking')
  const keep = yearRange(spec)
  const all = ys.years.map((year, i) => ({ year, value: ys.values[i] })).filter((d) => d.value != null && keep(d.year))
  if (all.length === 0) return { empty: 'No data to draw for this view.' }
  const lastYear = Math.max(...all.map((d) => d.year))
  const nRecent = Math.max(0, Math.round(spec.recent_years ?? 0))
  const recentFrom = lastYear - nRecent + 1
  const rows = [...all].sort((a, b) => b.value - a.value || b.year - a.year).slice(0, spec.top_n && spec.top_n > 0 ? spec.top_n : undefined)
  const marked = new Map([...highlightYears(spec)].filter(([yr]) => rows.some((d) => d.year === yr)))

  const narrow = W < 460
  const rowH = rows.length > 15 ? 16 : 22
  const P = { l: narrow ? 52 : 60, r: narrow ? 46 : 56, t: 54, b: 8 }
  const H = P.t + rows.length * rowH + P.b
  const plotW = W - P.l - P.r

  const vals = rows.map((d) => d.value)
  const vMin = Math.min(...vals)
  const vMax = Math.max(...vals)
  // bars start at zero when that keeps the differences visible; otherwise the axis starts lower
  const fromZero = (vMin >= 0 && vMin < vMax * 0.5) || (vMax <= 0 && vMax > vMin * 0.5)
  const span = vMax - vMin || Math.abs(vMax) || 1
  const lo = fromZero ? Math.min(0, vMin) : vMin - span * 0.25
  const hi = fromZero ? Math.max(0, vMax) : vMax + span * 0.05
  const ticks = niceTicks(lo, hi, narrow ? 3 : 5)
  const x0 = Math.min(lo, ticks[0])
  const x1 = Math.max(hi, ticks[ticks.length - 1])
  const sx = (v: number) => P.l + ((v - x0) / (x1 - x0 || 1)) * plotW
  const base = fromZero ? sx(0) : P.l
  const title = `${spec.season ? SEASON_LABEL[spec.season] : 'Yearly averages'}, highest first`

  const body = (
    <>
      <text x={4} y={14} textAnchor="start" className="casefile-chart__title">
        {title}
      </text>
      {ticks.map((v) => (
        <g key={`t${v}`}>
          <line x1={sx(v)} x2={sx(v)} y1={P.t - 4} y2={H - P.b} className="casefile-chart__grid" />
          <text x={sx(v)} y={P.t - 8} textAnchor="middle" className="casefile-chart__tick">
            {sig(v)}
          </text>
        </g>
      ))}
      <text x={4} y={31} textAnchor="start" className="casefile-chart__units">
        {series.units}
      </text>
      {rows.map((d, i) => {
        const y = P.t + i * rowH
        const recent = nRecent > 0 && d.year >= recentFrom
        const isMarked = marked.has(d.year)
        const end = sx(d.value)
        return (
          <g key={d.year} className={isMarked ? 'casefile-chart__row is-marked' : 'casefile-chart__row'}>
            <text x={P.l - 6} y={y + rowH / 2 + 4} textAnchor="end" className="casefile-chart__rowlabel">
              {isMarked ? `● ${d.year}` : d.year}
            </text>
            <rect
              x={Math.min(base, end)}
              y={y + 2}
              width={Math.max(1, Math.abs(end - base))}
              height={rowH - 4}
              className={`casefile-chart__bar${recent ? ' casefile-chart__bar--recent' : ''}`}
            />
            <text x={Math.max(base, end) + 4} y={y + rowH / 2 + 4} textAnchor="start" className="casefile-chart__tick">
              {sig(d.value)}
            </text>
          </g>
        )
      })}
      <line x1={base} x2={base} y1={P.t} y2={H - P.b} className="casefile-chart__axis" />
      {!fromZero && (
        // axis break: the bars start at the lowest tick, not at zero
        <path
          d={`M${base - 6} ${H - P.b - 4} l12 -5 M${base - 6} ${H - P.b + 2} l12 -5`}
          className="casefile-chart__break"
        />
      )}
    </>
  )

  const recentRows = rows.filter((d) => nRecent > 0 && d.year >= recentFrom).length
  const summary =
    `${series.name} in ${series.units}, ${title.replace(/^Every/, 'every')}: ${rows.length} years as bars, from ${rows[0].year} ` +
    `(${sig(rows[0].value)}) down to ${rows[rows.length - 1].year} (${sig(rows[rows.length - 1].value)}).` +
    (nRecent > 0 ? ` ${recentRows} of the bars are from the last ${nRecent} years (${recentFrom}-${lastYear}), drawn in another colour.` : '') +
    [...marked].map(([yr, l]) => ` Marked: ${yr}, ${l}.`).join('')

  const keys = (
    <>
      {nRecent > 0 && (
        <Key kind="recent">
          Last {nRecent} years ({recentFrom}-{lastYear})
        </Key>
      )}
      <Key kind="bar">{nRecent > 0 ? 'Earlier years' : series.name}</Key>
      {[...marked].map(([yr, l]) => (
        <span key={yr} className="casefile-chart__key casefile-chart__key--plain">
          ● {yr}: {l}
        </span>
      ))}
    </>
  )
  return {
    H,
    body,
    summary: fromZero ? summary : `${summary} The axis starts at ${sig(x0)}, not at zero.`,
    keys,
    note: fromZero ? undefined : `The axis does not start at 0: it starts at ${sig(x0)} ${baseUnits(series.units)}, to show the differences.`,
  }
}

// ---- periods ---------------------------------------------------------------------------------

export function periodsView(_spec: ChartSpec, series: TutorialSeries, W: number): ViewResult {
  const p = series.extras?.periods
  if (!p || !p.bin_edges?.length || p.bin_edges.length !== p.before_counts.length + 1) return missing('before and after')
  const { narrow, H, P, plotW } = frame(W, { t: 6, b: 18 })
  const e = p.bin_edges
  const sx = (v: number) => P.l + ((v - e[0]) / (e[e.length - 1] - e[0] || 1)) * plotW
  const counts = [...p.before_counts, ...p.after_counts]
  const { ticks: yTicks, sy } = yScale(counts, P.t, H - P.b, { ticks: narrow ? 3 : 4, integer: true, pad: 0.15 })
  const xt = niceTicks(e[0], e[e.length - 1], narrow ? 4 : 6).filter((v) => v >= e[0] && v <= e[e.length - 1])
  const yrs = (a: string, b: string) => `${a.slice(0, 4)}-${b.slice(0, 4)}`
  const before = `${yrs(p.before.from, p.before.to)}`
  const after = `${yrs(p.after.from, p.after.to)}`
  const unit = baseUnits(series.units)

  // mean markers: labels at the top, the second one moves down if they would overlap
  const taken: Box[] = [textBox(4, 14, 'start', 'months')]
  const meanLabels = [
    { v: p.before.mean, cls: 'before', label: `average ${before}` },
    { v: p.after.mean, cls: 'after', label: `average ${after}` },
  ].map((m) => {
    const x = sx(m.v)
    const anchor: Anchor = x < P.l + 70 ? 'start' : x > W - P.r - 70 ? 'end' : 'middle'
    let y = P.t - 4
    for (let k = 0; k < 4 && taken.some((b) => overlaps(b, textBox(x, y, anchor, m.label))); k++) y += 15
    taken.push(textBox(x, y, anchor, m.label))
    return { ...m, x, y, anchor }
  })

  const binW = (i: number) => sx(e[i + 1]) - sx(e[i])
  const gap = (i: number) => Math.max(0.5, binW(i) * 0.06)
  const body = (
    <>
      <YGrid ticks={yTicks} sy={sy} left={P.l} right={W - P.r} fmt={String} />
      <text x={4} y={14} textAnchor="start" className="casefile-chart__units">
        months
      </text>
      {e[0] < 0 && e[e.length - 1] > 0 && <line x1={sx(0)} x2={sx(0)} y1={P.t} y2={H - P.b} className="casefile-chart__zero" />}
      {p.before_counts.map((c, i) => {
        const mid = (sx(e[i]) + sx(e[i + 1])) / 2
        const w = Math.max(1, mid - sx(e[i]) - gap(i))
        const ca = p.after_counts[i] ?? 0
        return (
          <g key={`h${i}`}>
            {c > 0 && <rect x={sx(e[i]) + gap(i)} y={sy(c)} width={w} height={sy(0) - sy(c)} className="casefile-chart__bar casefile-chart__bar--before" />}
            {ca > 0 && <rect x={mid} y={sy(ca)} width={w} height={sy(0) - sy(ca)} className="casefile-chart__bar casefile-chart__bar--after" />}
          </g>
        )
      })}
      <XAxis ticks={xt.map((v) => ({ x: v, label: signed(v) }))} sx={sx} left={P.l} right={W - P.r} y={H - P.b} />
      <text x={P.l + plotW / 2} y={H - 4} textAnchor="middle" className="casefile-chart__axis-title">
        difference from the usual month ({unit})
      </text>
      {meanLabels.map((m) => (
        <g key={m.cls} className={`casefile-chart__mean casefile-chart__mean--${m.cls}`}>
          <line x1={m.x} x2={m.x} y1={m.y + 4} y2={H - P.b} />
          <text x={m.x} y={m.y} textAnchor={m.anchor}>
            {m.label}
          </text>
        </g>
      ))}
    </>
  )

  const summary =
    `${series.name}: how often each difference from the usual month happened, as two sets of bars. ` +
    `${before}: ${p.before.n} months, average ${signed(p.before.mean)} ${unit}. ` +
    `${after}: ${p.after.n} months, average ${signed(p.after.mean)} ${unit}.`
  const keys = (
    <>
      <Key kind="before">
        {formatDate(p.before.from)} - {formatDate(p.before.to)} ({p.before.n} months)
      </Key>
      <Key kind="after">
        {formatDate(p.after.from)} - {formatDate(p.after.to)} ({p.after.n} months)
      </Key>
    </>
  )
  return { H, body, summary, keys, note: 'Dashed lines: the average of each period.' }
}


// ---- season_scatter --------------------------------------------------------------------------

export function seasonScatterView(spec: ChartSpec, series: TutorialSeries, variables: Record<string, TutorialSeries>, W: number): ViewResult {
  const [va, vb] = spec.variables ?? [spec.variable, spec.variable]
  const sa = variables[va] ?? series
  const sb = variables[vb]
  const season = spec.season ?? 'JJA'
  const xa = sa?.extras?.seasons?.[season]
  const xb = sb?.extras?.seasons?.[season]
  if (!sa || !sb || !xa || !xb) return missing('season scatter')
  const keep = yearRange(spec)
  const byYear = new Map(xb.years.map((y, i) => [y, xb.values[i]]))
  const pts = xa.years
    .map((year, i) => ({ year, x: xa.values[i], y: byYear.get(year) }))
    .filter((d): d is { year: number; x: number; y: number } => d.y != null && d.x != null && keep(d.year))
  if (pts.length === 0) return { empty: 'No data to draw for this view.' }

  const { narrow, H, P, plotW } = frame(W, { b: 18, l: 6 })
  const { ticks: yTicks, sy } = yScale(pts.map((d) => d.y), P.t, H - P.b, { ticks: narrow ? 4 : 5, pad: 0.12 })
  const xs = pts.map((d) => d.x)
  const xSpan = Math.max(...xs) - Math.min(...xs) || 1
  const xt = niceTicks(Math.min(...xs) - xSpan * 0.08, Math.max(...xs) + xSpan * 0.08, narrow ? 4 : 6)
  const x0 = Math.min(Math.min(...xs) - xSpan * 0.08, xt[0])
  const x1 = Math.max(Math.max(...xs) + xSpan * 0.08, xt[xt.length - 1])
  const sx = (v: number) => P.l + ((v - x0) / (x1 - x0 || 1)) * plotW
  const xTicks = xt.filter((v) => v >= x0 && v <= x1).map((v) => ({ x: v, label: sig(v) }))

  const lastYear = Math.max(...pts.map((d) => d.year))
  const nRecent = Math.max(0, Math.round(spec.recent_years ?? 0))
  const isRecent = (y: number) => nRecent > 0 && y > lastYear - nRecent
  const marked = highlightYears(spec)

  const yTitle = `${sb.name}, ${baseUnits(sb.units)}`
  const xTitle = `${sa.name}, ${baseUnits(sa.units)}`
  const taken: Box[] = [textBox(4, 14, 'start', yTitle)]
  // dots are obstacles too, so labels do not cover other years
  pts.forEach((d) => taken.push({ x0: sx(d.x) - 4, x1: sx(d.x) + 4, y0: sy(d.y) - 4, y1: sy(d.y) + 4 }))
  const labelled = pts
    .filter((d) => marked.has(d.year) || isRecent(d.year))
    .sort((a, b) => Number(marked.has(b.year)) - Number(marked.has(a.year)) || b.year - a.year)
  const placed = placeLabels(
    labelled.map((d) => ({ cx: sx(d.x), cy: sy(d.y), label: marked.get(d.year) ?? String(d.year) })),
    taken,
    { left: P.l, right: W - P.r, top: 22, bottom: H - P.b },
    true,
  )
  const markedPlaced = placed.filter((_, i) => marked.has(labelled[i].year))
  const recentPlaced = placed.filter((_, i) => !marked.has(labelled[i].year))

  const body = (
    <>
      <YGrid ticks={yTicks} sy={sy} left={P.l} right={W - P.r} />
      <text x={4} y={14} textAnchor="start" className="casefile-chart__units">
        {yTitle}
      </text>
      <line x1={P.l} x2={P.l} y1={P.t} y2={H - P.b} className="casefile-chart__axis" />
      <XAxis ticks={xTicks} sx={sx} left={P.l} right={W - P.r} y={H - P.b} />
      <text x={P.l + plotW / 2} y={H - 4} textAnchor="middle" className="casefile-chart__axis-title">
        {xTitle}
      </text>
      {pts
        .filter((d) => !isRecent(d.year))
        .map((d) => (
          <circle key={d.year} cx={sx(d.x)} cy={sy(d.y)} r={narrow ? 3.5 : 4} className="casefile-chart__dot casefile-chart__dot--scatter" />
        ))}
      {pts.filter((d) => isRecent(d.year)).map((d) => (
        <circle key={d.year} cx={sx(d.x)} cy={sy(d.y)} r={narrow ? 4.5 : 5} className="casefile-chart__dot casefile-chart__dot--recent" />
      ))}
      {recentPlaced.map((m, i) => (
        <text key={`r${i}`} x={m.tx} y={m.ty} textAnchor={m.anchor} className="casefile-chart__dotlabel">
          {m.label}
        </text>
      ))}
      <Marks placed={markedPlaced} r={8} />
    </>
  )

  const name = SEASON_NAME[season]
  const summary =
    `Scatter plot, one dot per ${name} from ${Math.min(...pts.map((d) => d.year))} to ${lastYear}: ` +
    `across, ${xTitle} (${sig(Math.min(...xs))} to ${sig(Math.max(...xs))}); up, ${yTitle} ` +
    `(${sig(Math.min(...pts.map((d) => d.y)))} to ${sig(Math.max(...pts.map((d) => d.y)))}).` +
    (nRecent > 0 ? ` The last ${nRecent} years are drawn in another colour and labelled.` : '') +
    [...marked].map(([yr, l]) => ` Marked: ${yr}, ${l}.`).join('')
  const keys = (
    <>
      {nRecent > 0 && <Key kind="dot-recent">Last {nRecent} years</Key>}
      <Key kind="dot">{nRecent > 0 ? 'Earlier years' : 'One year'}</Key>
    </>
  )
  return { H, body, summary, keys, note: `Each dot is one ${name}.` }
}

// ---- window_trends ---------------------------------------------------------------------------

export function windowTrendsView(spec: ChartSpec, series: TutorialSeries, W: number): ViewResult {
  const keep = yearRange(spec)
  const wt = (series.extras?.window_trends ?? []).filter((w) => keep(w.start_year))
  if (wt.length === 0) return missing('trend by start year')
  const marked = highlightYears(spec)
  // room above the tallest whisker for up to two stacked labels
  const { narrow, H, P, plotW } = frame(W, { t: 4 + 16 * Math.min(2, marked.size) })
  const dec = (v: number) => v * 10
  const vals = wt.flatMap((w) => [dec(w.slope_per_year), dec(w.ci_low), dec(w.ci_high)])
  const { ticks: yTicks, sy, yMin, yMax } = yScale(vals, P.t, H - P.b, { ticks: narrow ? 4 : 5, zero: true })
  const band = plotW / wt.length
  const cx = (i: number) => P.l + band * (i + 0.5)
  const barW = Math.max(4, Math.min(34, band * 0.5))
  const long = band >= 64
  const every = band >= 34 ? 1 : Math.ceil(34 / band)
  const unit = `${baseUnits(series.units)} per decade`

  const taken: Box[] = [textBox(4, 14, 'start', unit)]
  // labels must not cover any bar or whisker (QA: "About 47 years of data" on a phone)
  wt.forEach((w, i) => {
    const ys = [dec(w.slope_per_year), dec(w.ci_low), dec(w.ci_high), 0].map(sy)
    taken.push({ x0: cx(i) - barW / 2 - 2, x1: cx(i) + barW / 2 + 2, y0: Math.min(...ys) - 2, y1: Math.max(...ys) + 2 })
  })
  const placed = placeLabels(
    wt.flatMap((w, i) => (marked.has(w.start_year) ? [{ cx: cx(i), cy: sy(dec(w.ci_high)), label: marked.get(w.start_year) ?? '' }] : [])),
    taken,
    { left: P.l, right: W - P.r, top: 22, bottom: H - P.b },
  )

  const body = (
    <>
      <YGrid ticks={yTicks} sy={sy} left={P.l} right={W - P.r} fmt={signed} />
      <text x={4} y={14} textAnchor="start" className="casefile-chart__units">
        {unit}
      </text>
      {wt.map((w, i) => {
        const s = dec(w.slope_per_year)
        return (
          <g key={w.start_year}>
            <rect
              x={cx(i) - barW / 2}
              y={Math.min(sy(s), sy(0))}
              width={barW}
              height={Math.max(1, Math.abs(sy(0) - sy(s)))}
              className={`casefile-chart__bar${w.significant ? '' : ' casefile-chart__bar--hollow'}`}
            />
            <g className="casefile-chart__whisker">
              <line x1={cx(i)} x2={cx(i)} y1={sy(dec(w.ci_low))} y2={sy(dec(w.ci_high))} />
              <line x1={cx(i) - barW / 4} x2={cx(i) + barW / 4} y1={sy(dec(w.ci_low))} y2={sy(dec(w.ci_low))} />
              <line x1={cx(i) - barW / 4} x2={cx(i) + barW / 4} y1={sy(dec(w.ci_high))} y2={sy(dec(w.ci_high))} />
            </g>
            {i % every === 0 && (
              <text x={cx(i)} y={H - P.b + 18} textAnchor="middle" className="casefile-chart__tick">
                {long ? `from ${w.start_year}` : w.start_year}
              </text>
            )}
          </g>
        )
      })}
      <line x1={P.l} x2={W - P.r} y1={sy(0)} y2={sy(0)} className="casefile-chart__zero" />
      <Marks placed={placed} r={0} />
    </>
  )

  const nSig = wt.filter((w) => w.significant).length
  const summary =
    `${series.name}: trend per decade measured from ${wt.length} different start years (${wt[0].start_year} to ` +
    `${wt[wt.length - 1].start_year}), each up to the end of the record, as bars with a 95% range whisker. ` +
    `${nSig} of ${wt.length} bars are filled (significant, p below 0.05), the others are hollow (not significant).` +
    placed.map((m) => ` Marked: ${m.label}.`).join('')
  const keys = (
    <>
      <Key kind="bar">Significant (p &lt; 0.05)</Key>
      <Key kind="hollow">Not significant</Key>
      <Key kind="whisker">95% range</Key>
    </>
  )
  // x in the geometry = bar index (0, 1, 2...); y = slope per decade
  const geom: ChartGeom = {
    W,
    H,
    plot: { left: P.l, right: W - P.r, top: P.t, bottom: H - P.b },
    pts: wt.map((w, i) => ({ px: cx(i), py: sy(dec(w.slope_per_year)), key: String(w.start_year), value: dec(w.slope_per_year) })),
    sx: cx,
    sy,
    ix: (px) => (px - P.l) / band - 0.5,
    iy: (py) => yMin + (1 - (py - P.t) / (H - P.b - P.t || 1)) * (yMax - yMin),
  }
  return { H, body, summary, keys, note: long ? undefined : 'Labels: the year each trend starts from.', geom }
}
