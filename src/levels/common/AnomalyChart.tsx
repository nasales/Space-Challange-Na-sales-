// SVG chart of monthly anomalies, shared by the statistics levels: optional highlighted window,
// Sen line (display only, it animates when it changes), optional confidence fan and an optional
// marked month (e.g. the Filomena snowflake) that can be removed.
import { useEffect, useRef, useState } from 'react'
import type { Line } from './sen'

export interface ChartMarker {
  index: number
  icon: string
  label: string
  ariaLabel: string
  removed?: boolean
  testId?: string
}

interface AnomalyChartProps {
  t: number[]
  values: (number | null)[]
  ariaLabel: string
  /** Text of the y axis, e.g. "°C vs normal" */
  axisUnit: string
  /** Highlighted years [start, end] (inclusive), if any */
  window?: [number, number]
  /** Sen line drawn between lineRange[0] and lineRange[1] */
  line: Line | null
  lineRange: [number, number]
  /** Slopes (units per year) of the 95 % range: drawn as a fan around the Sen line */
  fan?: [number, number]
  marker?: ChartMarker
  height?: number
  /** viewBox width: smaller values make the text relatively bigger in narrow layouts */
  width?: number
  lineTestId?: string
}

const PAD = { left: 46, right: 14, top: 14, bottom: 30 }
const STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50]

type Ends = { y0: number; y1: number }

function useAnimatedEnds(target: Ends): Ends {
  const [ends, setEnds] = useState(target)
  const from = useRef(target)
  const shown = useRef(target)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    from.current = shown.current
    const start = performance.now()
    const duration = reduce ? 0 : 700
    let frame = 0
    const step = (now: number) => {
      const k = duration === 0 ? 1 : Math.min(1, (now - start) / duration)
      const e = 1 - (1 - k) ** 3
      const next = {
        y0: from.current.y0 + (target.y0 - from.current.y0) * e,
        y1: from.current.y1 + (target.y1 - from.current.y1) * e,
      }
      shown.current = next
      setEnds(next)
      if (k < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target.y0, target.y1])
  return ends
}

export default function AnomalyChart({
  t,
  values,
  ariaLabel,
  axisUnit,
  window: win,
  line,
  lineRange,
  fan,
  marker,
  height = 300,
  width = 720,
  lineTestId = 'sen-line',
}: AnomalyChartProps) {
  const H = height
  const W = width
  const valid = values.filter((v): v is number => v !== null)
  const vMax = Math.max(...valid)
  const vMin = Math.min(...valid)
  const step = STEPS.find((s) => s >= (Math.ceil(vMax) - Math.floor(vMin)) / 6) ?? 100
  // Whole-number domain for steps >= 1 (as before), multiples of the step below 1.
  const yMax = step >= 1 ? Math.ceil(vMax) : Math.ceil(vMax / step) * step
  const yMin = step >= 1 ? Math.floor(vMin) : Math.floor(vMin / step) * step
  const tMin = t[0]
  const tMax = t[t.length - 1] + 1 / 12
  const x = (tt: number) => PAD.left + ((tt - tMin) / (tMax - tMin)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + ((yMax - v) / (yMax - yMin)) * (H - PAD.top - PAD.bottom)

  const hidden = marker?.removed ? marker.index : -1
  const inWindow = (tt: number) => !win || (tt >= win[0] && tt < win[1] + 1)
  const path = (pick: (i: number) => boolean) => {
    let d = ''
    let pen = false
    values.forEach((v, i) => {
      if (v === null || !pick(i) || i === hidden) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${x(t[i]).toFixed(1)},${y(v).toFixed(1)}`
      pen = true
    })
    return d
  }

  const target = line
    ? { y0: line.intercept + line.slope * lineRange[0], y1: line.intercept + line.slope * lineRange[1] }
    : { y0: 0, y1: 0 }
  const ends = useAnimatedEnds(target)

  const decades: number[] = []
  for (let yr = Math.ceil(tMin / 10) * 10; yr <= tMax; yr += 10) decades.push(yr)
  const yTicks: number[] = []
  for (let v = Math.ceil(yMin / step) * step; v <= yMax + 1e-9; v += step) yTicks.push(Number(v.toFixed(6)))
  const tickText = (v: number) => {
    const s = step < 1 ? Math.abs(v).toFixed(1) : String(Math.abs(v))
    return v > 0 ? `+${s}` : v < 0 ? `-${s}` : '0'
  }

  let fanPoints = ''
  if (line && fan) {
    const tm = (lineRange[0] + lineRange[1]) / 2
    const ym = line.intercept + line.slope * tm
    const at = (s: number, tt: number) => `${x(tt).toFixed(1)},${y(ym + s * (tt - tm)).toFixed(1)}`
    fanPoints = [at(fan[0], lineRange[0]), at(fan[0], lineRange[1]), at(fan[1], lineRange[1]), at(fan[1], lineRange[0])].join(' ')
  }

  const mv = marker ? values[marker.index] : null

  return (
    <svg className="lvc-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
      {win && (
        <rect
          className="lvc-chart__window"
          x={x(Math.max(win[0], tMin))}
          y={PAD.top}
          width={Math.max(0, x(Math.min(win[1] + 1, tMax)) - x(Math.max(win[0], tMin)))}
          height={H - PAD.top - PAD.bottom}
        />
      )}
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className={v === 0 ? 'lvc-chart__zero' : 'lvc-chart__grid'} />
          <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="lvc-chart__tick">
            {tickText(v)}
          </text>
        </g>
      ))}
      {decades.map((yr) => (
        <text key={yr} x={x(yr)} y={H - 10} textAnchor="middle" className="lvc-chart__tick">
          {yr}
        </text>
      ))}
      <text x={6} y={PAD.top - 2} className="lvc-chart__tick">
        {axisUnit}
      </text>

      {fanPoints && <polygon points={fanPoints} className="lvc-chart__fan" data-testid="ci-fan" />}

      <path d={path((i) => !inWindow(t[i]))} className="lvc-chart__series lvc-chart__series--out" />
      <path d={path((i) => inWindow(t[i]))} className="lvc-chart__series" />

      {line && (
        <line
          data-testid={lineTestId}
          data-slope={line.slope.toFixed(6)}
          className="lvc-chart__sen"
          x1={x(lineRange[0])}
          x2={x(lineRange[1])}
          y1={y(ends.y0)}
          y2={y(ends.y1)}
        />
      )}

      {marker && mv !== null && (
        <g
          className={marker.removed ? 'lvc-chart__marker lvc-chart__marker--removed' : 'lvc-chart__marker'}
          data-testid={marker.testId}
          data-removed={!!marker.removed}
          aria-label={marker.ariaLabel}
        >
          <circle cx={x(t[marker.index])} cy={y(mv)} r={7} />
          <text className="lvc-chart__marker-icon" x={x(t[marker.index])} y={y(mv) + 36} textAnchor="middle">
            {marker.icon}
          </text>
          <text className="lvc-chart__marker-label" x={x(t[marker.index])} y={y(mv) + 52} textAnchor="middle">
            {marker.label}
          </text>
        </g>
      )}
    </svg>
  )
}
