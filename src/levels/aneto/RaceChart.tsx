// Dot-and-whisker chart: trend and 95 % range of every case (per decade), fastest first, with the
// range of the highlighted case drawn as a band so overlaps are easy to see.
import { fmtSlope } from '../common/format'
import type { RaceRow } from './data'
import { S } from './strings'

interface RaceChartProps {
  rows: RaceRow[]
  highlight: string
  /** Rank the player gave to each case id (1 = fastest), shown next to the name */
  playerRank?: Record<string, number>
}

const W = 640
const ROW = 40
const PAD = { left: 170, right: 70, top: 14, bottom: 34 }
const STEP = 0.1

export default function RaceChart({ rows, highlight, playerRank }: RaceChartProps) {
  const H = PAD.top + rows.length * ROW + PAD.bottom
  const lo = Math.min(0, ...rows.map((r) => r.ci_decade[0]))
  const hi = Math.max(...rows.map((r) => r.ci_decade[1]))
  const x0 = Math.floor(lo / STEP) * STEP
  const x1 = Math.ceil(hi / STEP) * STEP
  const x = (v: number) => PAD.left + ((v - x0) / (x1 - x0)) * (W - PAD.left - PAD.right)
  const ticks: number[] = []
  for (let v = x0; v <= x1 + 1e-9; v += STEP) ticks.push(Math.round(v * 10) / 10)
  const me = rows.find((r) => r.case_id === highlight)

  return (
    <svg className="lvc-chart lva-race" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={S.raceChart} data-testid="race-chart">
      {me && (
        <rect
          className="lva-race__band"
          x={x(me.ci_decade[0])}
          y={PAD.top - 6}
          width={x(me.ci_decade[1]) - x(me.ci_decade[0])}
          height={rows.length * ROW + 6}
          data-testid="race-band"
        />
      )}
      {ticks.map((v) => (
        <g key={v}>
          <line className={v === 0 ? 'lvc-chart__zero' : 'lvc-chart__grid'} x1={x(v)} x2={x(v)} y1={PAD.top - 6} y2={H - PAD.bottom} />
          <text className="lvc-chart__tick" x={x(v)} y={H - PAD.bottom + 16} textAnchor="middle">
            {v.toFixed(1)}
          </text>
        </g>
      ))}
      <text className="lvc-chart__tick" x={(PAD.left + W - PAD.right) / 2} y={H - 4} textAnchor="middle">
        {S.raceAxis}
      </text>
      {rows.map((r, i) => {
        const y = PAD.top + i * ROW + ROW / 2
        const mine = r.case_id === highlight
        return (
          <g key={r.case_id} className={mine ? 'lva-race__row lva-race__row--me' : 'lva-race__row'} data-testid={`race-row-${r.case_id}`}>
            <text className="lva-race__name" x={PAD.left - 10} y={y - 3} textAnchor="end">
              {r.title}
            </text>
            {playerRank?.[r.case_id] && (
              <text className="lva-race__yours" x={PAD.left - 10} y={y + 12} textAnchor="end">
                {S.yourRank(playerRank[r.case_id])}
              </text>
            )}
            <line className="lva-race__whisker" x1={x(r.ci_decade[0])} x2={x(r.ci_decade[1])} y1={y} y2={y} />
            <line className="lva-race__whisker" x1={x(r.ci_decade[0])} x2={x(r.ci_decade[0])} y1={y - 6} y2={y + 6} />
            <line className="lva-race__whisker" x1={x(r.ci_decade[1])} x2={x(r.ci_decade[1])} y1={y - 6} y2={y + 6} />
            <circle className="lva-race__dot" cx={x(r.slope_decade)} cy={y} r={mine ? 8 : 6} />
            <text className="lva-race__value" x={x(r.ci_decade[1]) + 10} y={y + 4}>
              {fmtSlope(r.slope_decade, 2)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
