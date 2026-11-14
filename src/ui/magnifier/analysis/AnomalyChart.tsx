// Anomaly chart of the evidence sheet: the monthly series with its seasonal cycle removed, the
// Sen trend line and the shaded 95 % range of the slope. The slope and its range are the ones of
// the statistics pipeline; only the height of the line (its intercept) is computed here.
import type { CiBand, TrendLine } from './analysis'
import MonthlyPlot from './MonthlyPlot'

interface Props {
  dates: string[]
  anoms: (number | null)[]
  units: string
  label: string
  line: TrendLine | null
  band: CiBand | null
}

export default function AnomalyChart({ dates, anoms, units, label, line, band }: Props) {
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
      readoutNote="compared with a normal month"
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
      over={(sx, sy) =>
        line && (
          <line
            x1={sx(line.t0 * 12)}
            x2={sx(line.t1 * 12)}
            y1={sy(line.y0)}
            y2={sy(line.y1)}
            className="clue-result__trend"
          />
        )
      }
    />
  )
}
