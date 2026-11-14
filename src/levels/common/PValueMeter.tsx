// p-value meter: scale 0 to 0.2, red line at 0.05, animated needle (CSS transition).
import { fmtP } from './format'
import { C } from './strings'

const W = 520
const H = 74
const PAD = 16
const MAX = 0.2

export default function PValueMeter({ p, testId = 'p-meter' }: { p: number | null; testId?: string }) {
  const x = (v: number) => PAD + (Math.min(Math.max(v, 0), MAX) / MAX) * (W - 2 * PAD)
  const ticks = [0, 0.05, 0.1, 0.15, 0.2]
  return (
    <svg
      className="lvc-meter"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${C.meterLabel}. ${p === null ? C.tooShort : `p = ${fmtP(p, 4)}`}`}
      data-testid={testId}
      data-p={p ?? ''}
    >
      <rect className="lvc-meter__sig" x={x(0)} y={18} width={x(0.05) - x(0)} height={16} />
      <rect className="lvc-meter__bar" x={x(0.05)} y={18} width={x(MAX) - x(0.05)} height={16} />
      <line className="lvc-meter__threshold" x1={x(0.05)} x2={x(0.05)} y1={8} y2={44} />
      <text className="lvc-meter__side" x={x(0.025)} y={14} textAnchor="middle">
        {C.meterSignificantSide}
      </text>
      <text className="lvc-meter__side" x={x(0.125)} y={14} textAnchor="middle">
        {C.meterNotSignificantSide}
      </text>
      {ticks.map((v) => (
        <text key={v} className="lvc-meter__tick" x={x(v)} y={60} textAnchor="middle">
          {v === 0.05 ? C.meterThreshold : v === MAX ? '≥ 0.2' : v.toFixed(v === 0 ? 0 : 2)}
        </text>
      ))}
      {p !== null && (
        <g className="lvc-meter__needle" style={{ transform: `translateX(${x(p)}px)` }}>
          <polygon points="0,36 -7,48 7,48" />
          <line x1={0} x2={0} y1={14} y2={38} />
        </g>
      )}
    </svg>
  )
}
