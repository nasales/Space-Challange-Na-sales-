// Anomaly chart of the evidence file: the monthly series with its seasonal cycle removed, the
// Sen trend line and the shaded 95 % range of the slope. The slope and its range are the ones of
// the statistics pipeline; only the height of the line (its intercept) is computed here.
// Animation: the months are revealed first, then the trend line is drawn on top like a red
// marker stroke and the 95 % range fades in (classes in ClueResult.css). Then it stays alive: the
// range breathes, the line glows, an arrowhead shows the direction (only for a significant trend,
// so no direction is suggested that the test does not back), a magnifier scans the months and
// the record months are marked.
import type { CiBand, TrendLine } from './analysis'
import MonthlyPlot from './MonthlyPlot'
import { L } from '../../../shared/i18n'

interface Props {
  dates: string[]
  anoms: (number | null)[]
  units: string
  label: string
  line: TrendLine | null
  band: CiBand | null
  /** The trend passed the significance test: draw the direction arrow */
  significant: boolean
}

export default function AnomalyChart({ dates, anoms, units, label, line, band, significant }: Props) {
  const include = [
    ...(line ? [line.y0, line.y1] : []),
    ...(band ? [band.low0, band.low1, band.high0, band.high1] : []),
  ]
  return (
    <MonthlyPlot
      dates={dates}
      values={anoms}
      units={units}
      label={label}
      lineClass="clue-result__line--thin"
      reference={{ value: 0, className: 'clue-result__zero' }}
      include={include}
      signed
      readoutNote={L('compared with a normal month', 'frente a un mes normal')}

      scan
      markers
      under={(sx, sy) => {
        if (!line || !band) return null
        // Two triangles that meet at the middle point of the trend line (a bow tie)
        const x0 = sx(line.t0 * 12).toFixed(1)
        const x1 = sx(line.t1 * 12).toFixed(1)
        const mid = `${sx(band.tMid * 12).toFixed(1)},${sy(band.yMid).toFixed(1)}`
        const d =
          `M${x0},${sy(band.low0).toFixed(1)}L${x0},${sy(band.high0).toFixed(1)}L${mid}Z` +
          `M${x1},${sy(band.low1).toFixed(1)}L${x1},${sy(band.high1).toFixed(1)}L${mid}Z`
        return <path d={d} className="clue-result__band" />
      }}
      over={(sx, sy) => {
        if (!line) return null
        const x0 = sx(line.t0 * 12)
        const x1 = sx(line.t1 * 12)
        const y0 = sy(line.y0)
        const y1 = sy(line.y1)
        const angle = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI
        return (
          <g className="clue-result__trend-group">
            <line x1={x0} x2={x1} y1={y0} y2={y1} className="clue-result__trend-glow" />
            {/* Ink outline under the red stroke, comic style */}
            <line
              x1={x0}
              x2={x1}
              y1={y0}
              y2={y1}
              pathLength={1}
              className="clue-result__trend-ink clue-result__draw"
            />
            <line
              x1={x0}
              x2={x1}
              y1={y0}
              y2={y1}
              pathLength={1}
              className="clue-result__trend clue-result__draw"
            />
            {significant && (
              <g transform={`translate(${x1.toFixed(1)},${y1.toFixed(1)}) rotate(${angle.toFixed(1)})`}>
                <path d="M-4,-9 L12,0 L-4,9 Z" className="clue-result__trend-arrow" />
              </g>
            )}
          </g>
        )
      }}
    />
  )
}
