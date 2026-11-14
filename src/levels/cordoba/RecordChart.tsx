// Monthly temperature anomalies with the record warm (red) and record cold (blue) months marked as
// dots. The years before the first record year are shaded: they only build the history.
interface RecordChartProps {
  t: number[]
  values: (number | null)[]
  warm: number[]
  cold: number[]
  /** Draw the record dots (after the player's prediction) */
  showRecords: boolean
  firstYear: number
  ariaLabel: string
  axisUnit: string
  historyLabel: string
}

const W = 720
const H = 300
const PAD = { left: 46, right: 14, top: 18, bottom: 30 }

export default function RecordChart({ t, values, warm, cold, showRecords, firstYear, ariaLabel, axisUnit, historyLabel }: RecordChartProps) {
  const valid = values.filter((v): v is number => v !== null)
  const yMax = Math.ceil(Math.max(...valid))
  const yMin = Math.floor(Math.min(...valid))
  const tMin = t[0]
  const tMax = t[t.length - 1] + 1 / 12
  const x = (tt: number) => PAD.left + ((tt - tMin) / (tMax - tMin)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + ((yMax - v) / (yMax - yMin)) * (H - PAD.top - PAD.bottom)

  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v === null) {
      pen = false
      return
    }
    d += `${pen ? 'L' : 'M'}${x(t[i]).toFixed(1)},${y(v).toFixed(1)}`
    pen = true
  })

  const yTicks: number[] = []
  for (let v = yMin; v <= yMax; v += 1) yTicks.push(v)
  const decades: number[] = []
  for (let yr = Math.ceil(tMin / 10) * 10; yr <= tMax; yr += 10) decades.push(yr)
  const dot = (i: number, cls: string) => {
    const v = values[i]
    return v === null ? null : <circle key={`${cls}-${i}`} className={cls} cx={x(t[i])} cy={y(v)} r={5} />
  }

  return (
    <svg className="lvc-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} data-testid="record-chart" data-records={showRecords}>
      <rect className="lvh-chart__history" x={x(tMin)} y={PAD.top} width={x(firstYear) - x(tMin)} height={H - PAD.top - PAD.bottom} />
      <text className="lvc-chart__tick" x={(x(tMin) + x(firstYear)) / 2} y={PAD.top + 14} textAnchor="middle">
        {historyLabel}
      </text>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className={v === 0 ? 'lvc-chart__zero' : 'lvc-chart__grid'} />
          <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="lvc-chart__tick">
            {v > 0 ? `+${v}` : v < 0 ? `-${-v}` : '0'}
          </text>
        </g>
      ))}
      {decades.map((yr) => (
        <text key={yr} x={x(yr)} y={H - 10} textAnchor="middle" className="lvc-chart__tick">
          {yr}
        </text>
      ))}
      <text x={6} y={PAD.top - 5} className="lvc-chart__tick">
        {axisUnit}
      </text>
      <path d={d} className="lvc-chart__series lvh-chart__series" />
      {showRecords && (
        <g data-testid="record-dots">
          {cold.map((i) => dot(i, 'lvh-dot lvh-dot--cold'))}
          {warm.map((i) => dot(i, 'lvh-dot lvh-dot--warm'))}
        </g>
      )}
    </svg>
  )
}
