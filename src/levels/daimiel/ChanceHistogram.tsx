// Bar histogram of the pure-noise simulation: how many runs gave exactly k "significant" results,
// with the average as a dashed line and the real count as a red marker.

interface ChanceHistogramProps {
  /** histogram[k] = number of runs with exactly k results p < 0.05 */
  histogram: number[]
  mean: number
  real: number
  ariaLabel: string
  axisLabel: string
  realLabel: string
  testId?: string
}

const W = 720
const H = 250
const PAD = { left: 16, right: 16, top: 34, bottom: 46 }

export default function ChanceHistogram({ histogram, mean, real, ariaLabel, axisLabel, realLabel, testId }: ChanceHistogramProps) {
  const kMax = Math.max(histogram.length - 1, real) + 1
  const slots = kMax + 1
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const slotW = plotW / slots
  const cx = (k: number) => PAD.left + (k + 0.5) * slotW
  const top = Math.max(...histogram, 1)
  const base = H - PAD.bottom
  const ks = Array.from({ length: slots }, (_, k) => k)

  return (
    <svg className="lvdm-hist" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} data-testid={testId}>
      <line className="lvdm-hist__base" x1={PAD.left} x2={W - PAD.right} y1={base} y2={base} />
      {ks.map((k) => {
        const n = histogram[k] ?? 0
        const h = (n / top) * plotH
        return (
          <g key={k}>
            {n > 0 && (
              <>
                <rect className="lvdm-hist__bar" x={cx(k) - slotW * 0.36} y={base - h} width={slotW * 0.72} height={h} />
                <text className="lvdm-hist__count" x={cx(k)} y={base - h - 5} textAnchor="middle">
                  {n}
                </text>
              </>
            )}
            <text className="lvdm-hist__tick" x={cx(k)} y={base + 17} textAnchor="middle">
              {k}
            </text>
          </g>
        )
      })}
      <line className="lvdm-hist__mean" x1={cx(mean)} x2={cx(mean)} y1={PAD.top - 4} y2={base} />
      <g className="lvdm-hist__real" data-testid={testId && `${testId}-real`}>
        <line x1={cx(real)} x2={cx(real)} y1={PAD.top} y2={base} />
        <text x={cx(real)} y={PAD.top - 10} textAnchor="middle">
          {realLabel}
        </text>
      </g>
      <text className="lvdm-hist__tick" x={W / 2} y={H - 8} textAnchor="middle">
        {axisLabel}
      </text>
    </svg>
  )
}
