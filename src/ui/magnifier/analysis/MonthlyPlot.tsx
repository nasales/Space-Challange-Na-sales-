// Monthly time-series chart of the evidence file (plain SVG, fills its panel through ChartBox).
// Axes with units and year ticks, gaps break the line, optional reference line (mean or zero),
// and a readout of the month under the pointer (or chosen with the arrow keys).
// Animation (CSS, ClueResult.css): the series is revealed from left to right like ink on paper;
// `over` layers (e.g. the trend line) bring their own animation classes. After the draw-in the
// chart stays alive: an optional magnifier glides along the 12-month running mean (`scan`) and
// the highest and lowest months get record markers (`markers`). The lens is not drawn with
// reduced motion; the markers then simply show.
import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { fmt, fmtSigned, fmtTick, monthLabel, niceTicks, yearOf, yearTicks } from './analysis'
import ChartBox from './ChartBox'
import { extremes, linePath, reducedMotion, rollingMean, scale, type Frame } from './chartKit'

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
  /** A small magnifier glides along the running mean, on a loop */
  scan?: boolean
  /** Burst markers on the highest and the lowest month */
  markers?: boolean
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
  scan = false,
  markers = false,
  signed = false,
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
      {markers && <Records values={values} dates={dates} units={units} signed={signed} sx={sx} sy={sy} frame={frame} />}
      {scan && active == null && !reducedMotion() && <ScanLens d={linePath(rollingMean(values), sx, sy)} />}
      {active != null && (
        <g>
          <line x1={sx(active)} x2={sx(active)} y1={t} y2={H - b} className="clue-result__cursor" />
          {value != null && <circle cx={sx(active)} cy={sy(value)} r={5} className="clue-result__dot" />}
        </g>
      )}
    </svg>
  )
}

/** Burst markers on the record months, with a short label kept inside the plot. */
function Records({
  values,
  dates,
  units,
  signed,
  sx,
  sy,
  frame,
}: {
  values: (number | null)[]
  dates: string[]
  units: string
  signed: boolean
  sx: (i: number) => number
  sy: (v: number) => number
  frame: Frame
}) {
  const ex = extremes(values)
  if (!ex || ex.hi === ex.lo) return null
  const show = signed ? fmtSigned : fmt
  const marks = [
    { i: ex.hi, word: 'Highest', up: true },
    { i: ex.lo, word: 'Lowest', up: false },
  ]
  return (
    <g className="clue-result__records">
      {marks.map(({ i, word, up }) => {
        const x = sx(i)
        const y = sy(values[i] as number)
        const anchor = x > frame.W - frame.r - 120 ? 'end' : x < frame.l + 120 ? 'start' : 'middle'
        const ty = up ? Math.max(y - 16, frame.t + 10) : Math.min(y + 24, frame.H - frame.b - 6)
        return (
          <g key={word} className={`clue-result__record clue-result__record--${up ? 'hi' : 'lo'}`}>
            <circle cx={x} cy={y} r={9} className="clue-result__record-ring" />
            <circle cx={x} cy={y} r={4.5} className="clue-result__record-dot" />
            <text x={x} y={ty} textAnchor={anchor} className="clue-result__record-label">
              {word}: {monthLabel(dates[i])} ({show(values[i] as number)} {units})
            </text>
          </g>
        )
      })}
    </g>
  )
}

/** The detective's magnifier sliding back and forth along a path (SVG animateMotion). */
function ScanLens({ d }: { d: string }) {
  if (!d) return null
  return (
    <g className="clue-result__scan" aria-hidden="true">
      <g>
        <line x1={8} y1={8} x2={19} y2={19} className="clue-result__scan-handle" />
        <circle r={12} className="clue-result__scan-glass" />
        <circle r={12} className="clue-result__scan-rim" />
        <path d="M-6,-5 A7,7 0 0 1 2,-8" className="clue-result__scan-glint" />
      </g>
      <animateMotion dur="10s" begin="1.9s" repeatCount="indefinite" path={d} keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" />
    </g>
  )
}
