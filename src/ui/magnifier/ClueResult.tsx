// Evidence sheet for one clue of the hand lens: the full trend analysis of the chosen variable at
// the detective's point (database cell), shown from the moment it opens: what changes, where, how
// much (rate of change) and whether it is statistically significant, with the seasonal cycle
// removed. A non-significant trend is a valid result and is stated as such.
// Esc (or "Back to the clues") returns to the ring without closing the lens.
// Data: fetchPointAnalysis() in src/shared/pointAnalysis.ts (Supabase get_cell + trends table).
// The slope, its 95 % range and the p-value come from the statistics pipeline; this file and
// ./analysis/ only display them (see ./analysis/analysis.ts for the derived display numbers).
import { useEffect, useRef } from 'react'
import type { PointVariable } from '../../shared/pointAnalysis'
import { fmt, fmtP, fmtSigned, periodYears, testPeriod, totalChange, yearOf, type Period } from './analysis/analysis'
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

export default function ClueResult({ variable, title, place, distanceKm, onBack }: Props) {
  const back = useRef<HTMLButtonElement>(null)
  const data = variable.data

  useEffect(() => {
    // The sheet scrolls: keep it at the top (the verdict) while the Back button takes the focus
    back.current?.focus({ preventScroll: true })
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
  const period = testPeriod(data.dates, data.values, extra.periodStart, extra.periodEnd)

  return (
    <section className="clue-result" aria-labelledby="clue-result-title">
      <header className="clue-result__head">
        <p className="clue-result__kicker">Evidence · {place}</p>
        <h3 id="clue-result-title" className="clue-result__title">
          {title} <span className="clue-result__unit">({data.units})</span>
        </h3>
        <p className="clue-result__def">{variable.definition}</p>
      </header>

      <Verdict variable={variable} title={title} place={place} period={period} />

      <SeriesChart dates={data.dates} values={data.values} units={data.units} />
      <p className="clue-result__meta">
        Monthly values
        {distanceKm > 20 && ` · nearest land cell ${distanceKm.toFixed(0)} km away`} · Data: NASA{' '}
        {data.dataset.replace(/^NASA /, '')}
      </p>

      <button ref={back} type="button" className="clue-result__btn" onClick={onBack}>
        ← Back to the clues <kbd>Esc</kbd>
      </button>
    </section>
  )
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** What changed, where, how much and whether it is significant: one sentence and four figures. */
function Verdict({
  variable,
  title,
  place,
  period,
}: {
  variable: PointVariable
  title: string
  place: string
  period: Period | null
}) {
  const data = variable.data
  if (!data) return null
  const { slopeCiLow, slopeCiHigh } = variable.extra
  const units = data.units
  const perDecade = data.slope * 10
  const since = period ? ` since ${yearOf(data.dates[period.start])}` : ''
  const span = period ? `${yearOf(data.dates[period.start])}–${yearOf(data.dates[period.end])}` : null
  const p = fmtP(data.p_value)
  const verb = data.slope > 0 ? 'increased' : data.slope < 0 ? 'decreased' : 'changed'
  const hasCi = slopeCiLow != null && slopeCiHigh != null

  return (
    <div className="clue-result__verdict">
      <h4 className="clue-result__h">What changed here?</h4>
      {data.significant ? (
        <p className="clue-result__sentence">
          At {place}, {lowerFirst(title)} has {verb} by about{' '}
          <b>
            {fmt(Math.abs(perDecade))} {units} per decade
          </b>
          {since}. This trend is statistically significant ({p}).
        </p>
      ) : (
        <p className="clue-result__sentence">
          At {place}, {lowerFirst(title)} shows <b>no clear trend</b>
          {since} ({p}). No clear evidence of change is not proof that nothing changed.
        </p>
      )}

      <h4 className="clue-result__h">How much?</h4>
      <dl className="clue-result__figures">
        <div className="clue-result__figure">
          <dt>{data.significant ? 'Change per decade' : 'Best estimate per decade'}</dt>
          <dd>
            {fmtSigned(perDecade)} <small>{units}</small>
          </dd>
        </div>
        {period && (
          <div className="clue-result__figure">
            <dt>Total change, {span}</dt>
            <dd>
              {fmtSigned(totalChange(data.slope, period))} <small>{units}</small>
            </dd>
            <dd className="clue-result__sub">trend rate × {fmt(periodYears(period))} years</dd>
          </div>
        )}
        {hasCi && (
          <div className="clue-result__figure">
            <dt>95 % range per decade</dt>
            <dd>
              {fmtSigned(slopeCiLow * 10)} to {fmtSigned(slopeCiHigh * 10)} <small>{units}</small>
            </dd>
            {slopeCiLow <= 0 && slopeCiHigh >= 0 && <dd className="clue-result__sub">the range includes zero</dd>}
          </div>
        )}
        <div className="clue-result__figure">
          <dt>Is it real or noise?</dt>
          <dd>{p}</dd>
          <dd>
            <span className={`clue-result__stamp${data.significant ? '' : ' clue-result__stamp--quiet'}`}>
              {data.significant ? 'Significant' : 'Not significant'}
            </span>
          </dd>
        </div>
      </dl>
      <p className="clue-result__note">
        <b>Significant</b> means: if nothing were really changing, a trend this strong would appear by chance alone
        less than 5 % of the time (p below 0.05).
      </p>
    </div>
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
        {fmt(max)}
      </text>
      <text x={P.l - 6} y={H - P.b} textAnchor="end">
        {fmt(min)}
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
