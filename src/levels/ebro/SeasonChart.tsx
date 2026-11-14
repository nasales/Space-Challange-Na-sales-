// SVG chart of RAW monthly values (no anomaly assumptions: plain tick labels, any domain) with the
// typical year drawn over the series and an animated subtraction: shown = raw - k * typical, k 0 -> 1.
// The typical year comes from ebro_level.json (pipeline/level_ebro.py, same climatology as trend.py).
import { useEffect, useRef, useState } from 'react'

interface SeasonChartProps {
  t: number[]
  values: (number | null)[]
  /** Calendar month of each point, 0 = January */
  months: number[]
  /** 12 monthly means, January first */
  typical: number[]
  showTypical: boolean
  /** Start the subtraction animation */
  subtract: boolean
  onSubtracted?: () => void
  ariaLabel: string
  axisUnit: string
  height?: number
  width?: number
}

const PAD = { left: 46, right: 14, top: 14, bottom: 30 }
const STEPS = [0.5, 1, 2, 5, 10, 20, 50]
const DURATION = 1400

function useSubtraction(active: boolean, onDone?: () => void): number {
  const [k, setK] = useState(0)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  }, [onDone])
  useEffect(() => {
    if (!active) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const p = reduce ? 1 : Math.min(1, (now - start) / DURATION)
      setK(1 - (1 - p) ** 3)
      if (p < 1) frame = requestAnimationFrame(step)
      else done.current?.()
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [active])
  return active ? k : 0
}

export default function SeasonChart({
  t,
  values,
  months,
  typical,
  showTypical,
  subtract,
  onSubtracted,
  ariaLabel,
  axisUnit,
  height = 300,
  width = 720,
}: SeasonChartProps) {
  const k = useSubtraction(subtract, onSubtracted)
  const W = width
  const H = height
  const shown = values.map((v, i) => (v === null ? null : v - k * typical[months[i]]))
  const typ = months.map((m) => typical[m] * (1 - k))

  const all = [...shown.filter((v): v is number => v !== null), ...(showTypical ? typ : [])]
  const vMax = Math.max(...all)
  const vMin = Math.min(...all)
  const step = STEPS.find((s) => s >= (vMax - vMin) / 6) ?? 100
  const yMax = Math.ceil(vMax / step) * step
  const yMin = Math.floor(vMin / step) * step
  const tMin = t[0]
  const tMax = t[t.length - 1] + 1 / 12
  const x = (tt: number) => PAD.left + ((tt - tMin) / (tMax - tMin)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + ((yMax - v) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom)

  let series = ''
  let pen = false
  shown.forEach((v, i) => {
    if (v === null) {
      pen = false
      return
    }
    series += `${pen ? 'L' : 'M'}${x(t[i]).toFixed(1)},${y(v).toFixed(1)}`
    pen = true
  })
  const typicalPath = typ.map((v, i) => `${i ? 'L' : 'M'}${x(t[i]).toFixed(1)},${y(v).toFixed(1)}`).join('')

  const decades: number[] = []
  for (let yr = Math.ceil(tMin / 10) * 10; yr <= tMax; yr += 10) decades.push(yr)
  const yTicks: number[] = []
  for (let v = yMin; v <= yMax + 1e-9; v += step) yTicks.push(Number(v.toFixed(6)))
  const tickText = (v: number) => (step < 1 ? v.toFixed(1) : String(v)).replace('-', '−')

  return (
    <svg
      className="lvc-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={ariaLabel}
      data-testid="season-chart"
      data-subtracted={k >= 1}
    >
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
      <path d={series} className="lvc-chart__series" />
      {showTypical && (
        <path d={typicalPath} pathLength={1} className="lve-chart__typical" data-testid="typical-line" />
      )}
    </svg>
  )
}
