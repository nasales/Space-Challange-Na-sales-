// SVG chart of the monthly anomalies: optional highlighted window, Sen line (display only) and
// the Filomena snowflake. The Sen line endpoints animate when they change.
import { useEffect, useRef, useState } from 'react'
import type { Line } from './sen'
import { S } from './strings'

interface AnomalyChartProps {
  t: number[]
  values: (number | null)[]
  /** Highlighted years [start, end] (inclusive), if any */
  window?: [number, number]
  /** Sen line drawn between t0 and t1 */
  line: Line | null
  lineRange: [number, number]
  /** Index of the Filomena month: a snowflake is drawn there */
  filomenaIndex?: number
  /** Hide the Filomena point (phase 2 toggle) */
  filomenaRemoved?: boolean
}

const W = 720
const H = 300
const PAD = { left: 46, right: 14, top: 14, bottom: 30 }

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
  window: win,
  line,
  lineRange,
  filomenaIndex,
  filomenaRemoved = false,
}: AnomalyChartProps) {
  const valid = values.filter((v): v is number => v !== null)
  const yMax = Math.ceil(Math.max(...valid))
  const yMin = Math.floor(Math.min(...valid))
  const tMin = t[0]
  const tMax = t[t.length - 1] + 1 / 12
  const x = (tt: number) => PAD.left + ((tt - tMin) / (tMax - tMin)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + ((yMax - v) / (yMax - yMin)) * (H - PAD.top - PAD.bottom)

  const inWindow = (tt: number) => !win || (tt >= win[0] && tt < win[1] + 1)
  const path = (pick: (i: number) => boolean) => {
    let d = ''
    let pen = false
    values.forEach((v, i) => {
      if (v === null || !pick(i) || (filomenaRemoved && i === filomenaIndex)) {
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
  for (let v = yMin; v <= yMax; v += 2) yTicks.push(v)

  const fv = filomenaIndex !== undefined ? values[filomenaIndex] : null

  return (
    <svg className="flm-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={S.chartLabel}>
      {win && (
        <rect
          className="flm-chart__window"
          x={x(Math.max(win[0], tMin))}
          y={PAD.top}
          width={Math.max(0, x(Math.min(win[1] + 1, tMax)) - x(Math.max(win[0], tMin)))}
          height={H - PAD.top - PAD.bottom}
        />
      )}
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className={v === 0 ? 'flm-chart__zero' : 'flm-chart__grid'} />
          <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="flm-chart__tick">
            {v > 0 ? `+${v}` : v}
          </text>
        </g>
      ))}
      {decades.map((yr) => (
        <text key={yr} x={x(yr)} y={H - 10} textAnchor="middle" className="flm-chart__tick">
          {yr}
        </text>
      ))}
      <text x={6} y={PAD.top - 2} className="flm-chart__tick">
        {S.axisUnit}
      </text>

      <path d={path((i) => !inWindow(t[i]))} className="flm-chart__series flm-chart__series--out" />
      <path d={path((i) => inWindow(t[i]))} className="flm-chart__series" />

      {line && (
        <line
          data-testid="sen-line"
          data-slope={line.slope.toFixed(6)}
          className="flm-chart__sen"
          x1={x(lineRange[0])}
          x2={x(lineRange[1])}
          y1={y(ends.y0)}
          y2={y(ends.y1)}
        />
      )}

      {filomenaIndex !== undefined && fv !== null && (
        <g className={filomenaRemoved ? 'flm-chart__flake flm-chart__flake--removed' : 'flm-chart__flake'}>
          <circle cx={x(t[filomenaIndex])} cy={y(fv)} r={5} />
          <text x={x(t[filomenaIndex])} y={y(fv) + 26} textAnchor="middle" aria-label={S.filomenaLabel}>
            ❄
          </text>
        </g>
      )}
    </svg>
  )
}
