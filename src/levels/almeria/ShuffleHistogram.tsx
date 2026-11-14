// Dot histogram of the Sen slopes of the shuffled series: one dot per shuffle, stacked in its bin,
// with the real slope as a red marker. The layout (bins, dot size) uses all the slopes from the start,
// so adding shuffles never rescales the chart.
import { useMemo } from 'react'

interface ShuffleHistogramProps {
  /** All shuffled slopes (per decade); only the first `shown` are drawn */
  slopes: number[]
  shown: number
  real: number
  ariaLabel: string
  realLabel: string
  axisLabel: string
  testId?: string
}

const W = 720
const H = 260
const PAD = { left: 16, right: 16, top: 34, bottom: 44 }
const BINS = 31
const STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5]

function tickText(v: number, step: number): string {
  const digits = Math.max(0, -Math.floor(Math.log10(step) + 1e-9))
  const s = Math.abs(v).toFixed(digits)
  return v > 0 ? `+${s}` : v < 0 ? `−${s}` : '0'
}

export default function ShuffleHistogram({ slopes, shown, real, ariaLabel, realLabel, axisLabel, testId }: ShuffleHistogramProps) {
  const layout = useMemo(() => {
    const span = Math.max(Math.abs(real), ...slopes.map(Math.abs)) * 1.08
    const bw = (2 * span) / BINS
    const bin = (s: number) => Math.min(BINS - 1, Math.max(0, Math.floor((s + span) / bw)))
    const counts = new Array(BINS).fill(0)
    const slots = slopes.map((s) => counts[bin(s)]++)
    const maxCount = Math.max(...counts, 1)
    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom
    const r = Math.max(1.5, Math.min(plotW / BINS / 2 - 0.6, plotH / maxCount / 2))
    const step = STEPS.find((s) => span / s <= 4) ?? 10
    const ticks: number[] = []
    for (let v = -Math.floor(span / step) * step; v <= span + 1e-9; v += step) ticks.push(Number(v.toFixed(6)))
    return { span, bin, slots, r, ticks, step }
  }, [slopes, real])

  const { span, bin, slots, r, ticks, step } = layout
  const x = (v: number) => PAD.left + ((v + span) / (2 * span)) * (W - PAD.left - PAD.right)
  const binX = (b: number) => x(-span + (b + 0.5) * ((2 * span) / BINS))
  const base = H - PAD.bottom
  const steep = (s: number) => Math.abs(s) >= Math.abs(real)

  return (
    <svg className="lva-hist" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} data-testid={testId} data-shown={shown}>
      <line className="lva-hist__base" x1={PAD.left} x2={W - PAD.right} y1={base} y2={base} />
      {ticks.map((v) => (
        <g key={v}>
          <line className={v === 0 ? 'lva-hist__zero' : 'lva-hist__tickline'} x1={x(v)} x2={x(v)} y1={PAD.top} y2={base + 5} />
          <text className="lva-hist__tick" x={x(v)} y={base + 19} textAnchor="middle">
            {tickText(v, step)}
          </text>
        </g>
      ))}
      <text className="lva-hist__tick" x={W / 2} y={H - 6} textAnchor="middle">
        {axisLabel}
      </text>

      {slopes.slice(0, shown).map((s, i) => (
        <circle
          key={i}
          className={steep(s) ? 'lva-hist__dot lva-hist__dot--steep' : 'lva-hist__dot'}
          cx={binX(bin(s))}
          cy={base - r - slots[i] * 2 * r}
          r={r - 0.4}
        />
      ))}

      <g className="lva-hist__real" data-testid={testId && `${testId}-real`}>
        <line x1={x(real)} x2={x(real)} y1={PAD.top - 6} y2={base} />
        <text x={x(real)} y={PAD.top - 12} textAnchor="middle">
          {realLabel} {tickText(real, step / 10)}
        </text>
      </g>
    </svg>
  )
}
