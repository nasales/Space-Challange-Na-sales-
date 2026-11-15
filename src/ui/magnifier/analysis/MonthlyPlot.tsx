// Monthly time-series chart of the evidence file (plain SVG, fills its panel through ChartBox).
// Axes with units and year ticks, gaps break the line, optional reference line (mean or zero),
// and a readout of the month under the pointer (or chosen with the arrow keys).
// Animation (CSS, ClueResult.css): the series is revealed from left to right like ink on paper;
// `over` layers (e.g. the trend line) bring their own animation classes.
import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { fmt, fmtSigned, fmtTick, monthLabel, niceTicks, yearOf, yearTicks } from './analysis'
import ChartBox from './ChartBox'
import { linePath, scale, type Frame } from './chartKit'

interface Props {
  dates: string[]
  values: (number | null)[]
  units: string
  /** Summary of the chart for screen readers */
  label: string
  /** Extra class of the series path (the path always has `clue-result__line`) */
  lineClass?: string
  /** Horizontal reference line, e.g. the series mean (dashed) or zero */
  reference?: { value: number; className: string }
  /** Values that must fit in the vertical axis besides the series (e.g. ends of the trend line) */
  include?: number[]
  /** Show values with an explicit sign (anomalies) */
  signed?: boolean
  /** Words after the value in the readout, e.g. "compared with a normal month" */
  readoutNote?: string
  /** Drawn under / over the series. sx takes a month index (may be fractional), sy a value. */
  under?: (sx: (i: number) => number, sy: (v: number) => number) => ReactNode
  over?: (sx: (i: number) => number, sy: (v: number) => number) => ReactNode
}

export default function MonthlyPlot(props: Props) {
  const [active, setActive] = useState<number | null>(null)
  const { dates, values, units, signed = false, readoutNote = '' } = props
  const n = values.length
  const hasData = values.some((v) => v != null && Number.isFinite(v)) && dates.length >= n
  if (!hasData) return <p className="clue-result__empty">No values to draw for this place.</p>

  const clamp = (i: number) => Math.min(Math.max(i, 0), n - 1)
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageUp: -12, PageDown: 12 }
    const step = steps[e.key] as number | undefined
    let next: number
    if (step != null) next = clamp((active ?? n - 1) + (e.shiftKey ? step * 12 : step))
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else return
    // The arrow keys read the chart; they must not reach the tabs, the game or the lens underneath
    e.preventDefault()
    e.stopPropagation()
    setActive(next)
  }

  const value = active != null ? values[active] : null
  const show = signed ? fmtSigned : fmt
  const readout =
    active == null
      ? null
      : value == null
        ? `${monthLabel(dates[active])}: no data`
        : `${monthLabel(dates[active])}: ${show(value)} ${units}${readoutNote && ` ${readoutNote}`}`

  return (
    <div
      className="clue-result__plot"
      role="group"
      tabIndex={0}
      aria-label="Chart. Use the left and right arrow keys to read each month."
      onKeyDown={onKey}
    >
      <ChartBox>{(frame) => <Plot {...props} frame={frame} active={active} setActive={setActive} clamp={clamp} />}</ChartBox>
      <p className={`clue-result__readout${readout ? '' : ' clue-result__readout--hint'}`} aria-live="polite">
        {readout ?? 'Point at the chart (or focus it and press ← →) to read a month.'}
      </p>
    </div>
  )
}

function Plot({
  dates,
  values,
  units,
  label,
  lineClass = '',
  reference,
  include = [],
  under,
  over,
  frame,
  active,
  setActive,
  clamp,
}: Props & {
  frame: Frame
  active: number | null
  setActive: (i: number | null) => void
  clamp: (i: number) => number
}) {
  const { W, H, l, r, t, b } = frame
  const n = values.length
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v))
  const all = [...nums, ...include.filter(Number.isFinite), ...(reference ? [reference.value] : [])]
  const ticks = niceTicks(Math.min(...all), Math.max(...all), H > 300 ? 6 : 4)
  const sx = scale(0, Math.max(n - 1, 1), l, W - r)
  const sy = scale(ticks.min, ticks.max, H - b, t)
  const years = yearTicks(yearOf(dates[0]), yearOf(dates[n - 1]), W < 420 ? 5 : W < 700 ? 8 : 12)
    .map((year) => ({ year, i: dates.findIndex((d) => d.startsWith(`${year}-01`)) }))
    .filter((tick) => tick.i >= 0)

  const onPointer = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    if (box.width === 0) return
    const vx = ((e.clientX - box.left) / box.width) * W
    setActive(clamp(Math.round(((vx - l) / (W - l - r)) * (n - 1))))
  }
  const value = active != null ? values[active] : null

  return (
    <svg
      className="clue-result__chart"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      role="img"
      aria-label={label}
      onPointerMove={onPointer}
      onPointerDown={onPointer}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
    >
      <text x={8} y={15} className="clue-result__unit-label">
        {units}
      </text>
      {ticks.values.map((v) => (
        <g key={v}>
          <line x1={l} x2={W - r} y1={sy(v)} y2={sy(v)} className="clue-result__grid" />
          <text x={l - 6} y={sy(v) + 4} textAnchor="end">
            {fmtTick(v, ticks.decimals)}
          </text>
        </g>
      ))}
      {years.map(({ year, i }) => (
        <g key={year}>
          <line x1={sx(i)} x2={sx(i)} y1={H - b} y2={H - b + 5} className="clue-result__axis" />
          <text x={sx(i)} y={H - 9} textAnchor="middle">
            {year}
          </text>
        </g>
      ))}
      <line x1={l} x2={W - r} y1={H - b} y2={H - b} className="clue-result__axis" />
      <line x1={l} x2={l} y1={t} y2={H - b} className="clue-result__axis" />
      {under && <g className="clue-result__fade-late">{under(sx, sy)}</g>}
      {reference && (
        <line
          x1={l}
          x2={W - r}
          y1={sy(reference.value)}
          y2={sy(reference.value)}
          className={`${reference.className} clue-result__fade`}
        />
      )}
      <g className="clue-result__reveal">
        <path d={linePath(values, sx, sy)} className={`clue-result__line ${lineClass}`.trim()} />
      </g>
      {over?.(sx, sy)}
      {active != null && (
        <g>
          <line x1={sx(active)} x2={sx(active)} y1={t} y2={H - b} className="clue-result__cursor" />
          {value != null && <circle cx={sx(active)} cy={sy(value)} r={5} className="clue-result__dot" />}
        </g>
      )}
    </svg>
  )
}
