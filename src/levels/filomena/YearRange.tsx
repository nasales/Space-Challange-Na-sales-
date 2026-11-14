// Two-handle year range slider: two native range inputs on one track (keyboard accessible:
// Tab to a handle, arrows / Page Up / Page Down / Home / End to move it).
import { S } from './strings'

interface YearRangeProps {
  min: number
  max: number
  start: number
  end: number
  onChange: (start: number, end: number) => void
}

export default function YearRange({ min, max, start, end, onChange }: YearRangeProps) {
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  return (
    <div className="flm-range">
      <div className="flm-range__label">
        <span>{S.rangeLabel}</span>
        <strong data-testid="range-value">
          {start} – {end} ({S.years(end - start + 1)})
        </strong>
      </div>
      <div className="flm-range__track">
        <div className="flm-range__fill" style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={start}
          aria-label={S.startHandle}
          aria-valuetext={`${S.startHandle} ${start}`}
          data-testid="range-start"
          onChange={(e) => onChange(Math.min(Number(e.target.value), end), end)}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={end}
          aria-label={S.endHandle}
          aria-valuetext={`${S.endHandle} ${end}`}
          data-testid="range-end"
          onChange={(e) => onChange(start, Math.max(Number(e.target.value), start))}
        />
      </div>
    </div>
  )
}
