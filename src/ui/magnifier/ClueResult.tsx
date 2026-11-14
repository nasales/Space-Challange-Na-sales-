// Evidence sheet for one clue of the hand lens: the monthly series of the chosen variable at the
// detective's point (database cell), with its definition. The statistical result (trend per decade,
// 95 % range, p-value) stays hidden until the player asks for it, so the chart never gives the
// conclusion away. Esc (or "Back to the clues") returns to the ring without closing the lens.
// Data: fetchPointAnalysis() in src/shared/pointAnalysis.ts (Supabase get_cell + trends table).
import { useEffect, useRef, useState } from 'react'
import type { PointVariable } from '../../shared/pointAnalysis'
import './ClueResult.css'

interface Props {
  variable: PointVariable
  /** Name shown in the game (src/shared/variables.ts), falls back to the database name */
  title: string
  place: string
  /** Distance from the detective to the centre of the database cell, km */
  distanceKm: number
  onBack: () => void
}

/** 3 significant figures, no exponent for normal climate numbers */
const sig = (x: number) => (Math.abs(x) >= 100 ? x.toFixed(0) : x.toPrecision(3))

export default function ClueResult({ variable, title, place, distanceKm, onBack }: Props) {
  const [revealed, setRevealed] = useState(false)
  const back = useRef<HTMLButtonElement>(null)
  const data = variable.data

  useEffect(() => {
    back.current?.focus()
  }, [])

  // Esc goes back to the clues. Capture phase on window runs before the picker's own Esc
  // handler (which would close the whole lens), and stops it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      onBack()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onBack])

  if (!data) return null
  const { extra } = variable
  const years = `${data.dates[0].slice(0, 4)}–${data.dates[data.dates.length - 1].slice(0, 4)}`

  return (
    <section className="clue-result" aria-labelledby="clue-result-title">
      <header className="clue-result__head">
        <p className="clue-result__kicker">Evidence · {place}</p>
        <h3 id="clue-result-title" className="clue-result__title">
          {title} <span className="clue-result__unit">({data.units})</span>
        </h3>
        <p className="clue-result__def">{variable.definition}</p>
      </header>

      <SeriesChart dates={data.dates} values={data.values} units={data.units} />
      <p className="clue-result__meta">
        Monthly values, {years}
        {distanceKm > 20 && ` · nearest land cell ${distanceKm.toFixed(0)} km away`} · Data: NASA{' '}
        {data.dataset.replace(/^NASA /, '')}
      </p>

      {!revealed ? (
        <div className="clue-result__ask">
          <p>Look at the chart: is it going up, going down, or is there no clear change?</p>
          <button type="button" className="clue-result__btn clue-result__btn--gold" onClick={() => setRevealed(true)}>
            I have my conclusion: show the result
          </button>
        </div>
      ) : (
        <div className="clue-result__verdict" role="status">
          <p className="clue-result__stamp">{data.significant ? `Significant · ${extra.direction}` : 'No clear trend'}</p>
          <p>
            Trend: <b>{sig(data.slope * 10)} {data.units} per decade</b>
            {extra.slopeCiLow != null &&
              extra.slopeCiHigh != null &&
              ` (95 % range ${sig(extra.slopeCiLow * 10)} to ${sig(extra.slopeCiHigh * 10)})`}
          </p>
          <p>
            {data.p_value < 0.001 ? 'p < 0.001' : `p = ${data.p_value.toFixed(3)}`} · Mann-Kendall test on monthly
            anomalies
          </p>
          {!data.significant && (
            <p className="clue-result__note">
              No clear evidence of change is not proof that nothing changed.
            </p>
          )}
        </div>
      )}

      <button ref={back} type="button" className="clue-result__btn" onClick={onBack}>
        ← Back to the clues <kbd>Esc</kbd>
      </button>
    </section>
  )
}

/** Minimal monthly line chart (no library). Gaps (null) break the line. */
function SeriesChart({ dates, values, units }: { dates: string[]; values: (number | null)[]; units: string }) {
  const W = 560
  const H = 190
  const P = { l: 48, r: 10, t: 10, b: 24 }
  const nums = values.filter((v): v is number => v != null)
  if (nums.length === 0) return <p className="clue-result__meta">No values.</p>
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1
  const x = (i: number) => P.l + (i / Math.max(values.length - 1, 1)) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - (v - min) / span) * (H - P.t - P.b)
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v == null) {
      pen = false
      return
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    pen = true
  })
  return (
    <svg className="clue-result__chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Monthly values in ${units}`}>
      <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} className="clue-result__axis" />
      <line x1={P.l} x2={P.l} y1={P.t} y2={H - P.b} className="clue-result__axis" />
      <text x={P.l - 6} y={P.t + 8} textAnchor="end">
        {sig(max)}
      </text>
      <text x={P.l - 6} y={H - P.b} textAnchor="end">
        {sig(min)}
      </text>
      <text x={P.l - 6} y={(H - P.b + P.t) / 2} textAnchor="end">
        {units}
      </text>
      <text x={P.l} y={H - 6}>
        {dates[0]?.slice(0, 4)}
      </text>
      <text x={W - P.r} y={H - 6} textAnchor="end">
        {dates[dates.length - 1]?.slice(0, 4)}
      </text>
      <path d={d} className="clue-result__line" />
    </svg>
  )
}
