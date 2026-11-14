// Grouped bar chart: one group per decade, one bar per series (e.g. warm and cold records), with the
// value written on top. "Expected" series are drawn hollow and dashed.
export interface BarSeries {
  key: string
  label: string
  values: number[]
  /** CSS modifier: warm, cold, warm-expected, cold-expected */
  kind: 'warm' | 'cold' | 'warm-expected' | 'cold-expected'
  /** Decimals of the value labels */
  digits?: number
}

interface DecadeBarsProps {
  groups: string[]
  series: BarSeries[]
  ariaLabel: string
  testId: string
}

const W = 720
const H = 270
const PAD = { left: 16, right: 16, top: 26, bottom: 44 }

export default function DecadeBars({ groups, series, ariaLabel, testId }: DecadeBarsProps) {
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const groupW = plotW / groups.length
  const barW = Math.min(44, (groupW * 0.8) / series.length)
  const base = PAD.top + plotH
  const h = (v: number) => (v / max) * plotH

  return (
    <figure className="lvh-bars">
      <svg className="lvc-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} data-testid={testId}>
        <line className="lvc-chart__zero" x1={PAD.left} x2={W - PAD.right} y1={base} y2={base} />
        {groups.map((g, gi) => {
          const x0 = PAD.left + gi * groupW + (groupW - barW * series.length) / 2
          return (
            <g key={g}>
              {series.map((s, si) => {
                const v = s.values[gi]
                const bx = x0 + si * barW
                return (
                  <g key={s.key} data-testid={`${testId}-${s.key}-${gi}`} data-value={v}>
                    <rect className={`lvh-bar lvh-bar--${s.kind}`} x={bx + 2} y={base - h(v)} width={barW - 4} height={h(v)} />
                    <text className="lvh-bar__value" x={bx + barW / 2} y={base - h(v) - 6} textAnchor="middle">
                      {v.toFixed(s.digits ?? 0)}
                    </text>
                  </g>
                )
              })}
              <text className="lvh-bar__group" x={PAD.left + gi * groupW + groupW / 2} y={H - 16} textAnchor="middle">
                {g}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="lvh-legend">
        {series.map((s) => (
          <span key={s.key} className="lvh-legend__item">
            <svg width="16" height="12" aria-hidden="true">
              <rect className={`lvh-bar lvh-bar--${s.kind}`} x="1" y="1" width="14" height="10" />
            </svg>
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
