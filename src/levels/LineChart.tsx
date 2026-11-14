// Small line chart of one monthly series, plain SVG. Gaps (null) break the line.
// It shows the data only: no trend line and no statistical result (the player draws the conclusion).

interface LineChartProps {
  dates: string[]
  values: (number | null)[]
  label: string
  width?: number
  height?: number
}

const PAD = { left: 44, right: 10, top: 10, bottom: 22 }

export default function LineChart({ dates, values, label, width = 520, height = 180 }: LineChartProps) {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length === 0) return <p className="lvl-chart__empty">No data</p>

  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const span = max - min || 1
  const innerW = width - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (values.length > 1 ? (i / (values.length - 1)) * innerW : innerW / 2)
  const y = (v: number) => PAD.top + (1 - (v - min) / span) * innerH

  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v === null) {
      pen = false
      return
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `
    pen = true
  })

  const fmt = (v: number) => (Math.abs(span) < 1 ? v.toFixed(2) : v.toFixed(1))

  return (
    <svg
      className="lvl-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label}, ${dates[0]} to ${dates[dates.length - 1]}`}
    >
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={height - PAD.bottom} className="lvl-chart__axis" />
      <line
        x1={PAD.left}
        y1={height - PAD.bottom}
        x2={width - PAD.right}
        y2={height - PAD.bottom}
        className="lvl-chart__axis"
      />
      <text x={PAD.left - 6} y={PAD.top + 4} textAnchor="end" className="lvl-chart__tick">
        {fmt(max)}
      </text>
      <text x={PAD.left - 6} y={height - PAD.bottom} textAnchor="end" className="lvl-chart__tick">
        {fmt(min)}
      </text>
      <text x={PAD.left} y={height - 6} className="lvl-chart__tick">
        {dates[0]?.slice(0, 4)}
      </text>
      <text x={width - PAD.right} y={height - 6} textAnchor="end" className="lvl-chart__tick">
        {dates[dates.length - 1]?.slice(0, 4)}
      </text>
      <path d={d} className="lvl-chart__line" />
    </svg>
  )
}
