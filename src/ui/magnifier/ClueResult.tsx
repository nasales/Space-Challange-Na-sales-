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
import {
  anomalies,
  ciBand,
  fmt,
  fmtP,
  fmtSigned,
  mean,
  periodYears,
  testPeriod,
  totalChange,
  trendLine,
  yearOf,
  type Period,
} from './analysis/analysis'
import AnomalyChart from './analysis/AnomalyChart'
import MonthlyPlot from './analysis/MonthlyPlot'
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
  const nums = data.values.filter((v): v is number => v != null)
  const seriesMean = mean(nums)
  const last = data.dates.length - 1
  const years = last >= 0 ? `${yearOf(data.dates[0])}–${yearOf(data.dates[last])}` : ''
  const anoms = anomalies(data.dates, data.values, variable.climatology)
  const line = period ? trendLine(anoms, data.slope, period) : null
  const band = line ? ciBand(line, extra.slopeCiLow, extra.slopeCiHigh) : null
  const anomLabel =
    `Monthly ${title} with the seasonal cycle removed, ${years}, in ${data.units}. ` +
    (line
      ? `Trend line: ${fmtSigned(data.slope * 10)} ${data.units} per decade, ` +
        `${data.significant ? 'statistically significant' : 'not statistically significant'}.`
      : 'No trend line.')
  const seriesLabel =
    seriesMean == null
      ? `Monthly ${title}: no values`
      : `Line chart of monthly ${title} in ${data.units} at ${place}, ${years}. ` +
        `Lowest ${fmt(Math.min(...nums))}, highest ${fmt(Math.max(...nums))}, average ${fmt(seriesMean)}.`

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

      <section className="clue-result__section" aria-labelledby="clue-series-h">
        <h4 id="clue-series-h" className="clue-result__h">
          What do the measurements look like?
        </h4>
        <MonthlyPlot
          dates={data.dates}
          values={data.values}
          units={data.units}
          label={seriesLabel}
          reference={seriesMean != null ? { value: seriesMean, className: 'clue-result__mean' } : undefined}
        />
        <p className="clue-result__caption">
          Every month as measured{years && `, ${years}`}. The yearly up-and-down is the seasonal cycle.
          {seriesMean != null && ` Dashed line: average of all months (${fmt(seriesMean)} ${data.units}).`}
        </p>
      </section>

      <section className="clue-result__section" aria-labelledby="clue-anom-h">
        <h4 id="clue-anom-h" className="clue-result__h">
          Is there a trend once the seasons are removed?
        </h4>
        <AnomalyChart dates={data.dates} anoms={anoms} units={data.units} label={anomLabel} line={line} band={band} />
        <ul className="clue-result__legend">
          <li>
            <svg viewBox="0 0 26 10" aria-hidden="true">
              <line x1="0" x2="26" y1="5" y2="5" className="clue-result__line clue-result__line--thin" />
            </svg>
            monthly difference from normal
          </li>
          {line && (
            <li>
              <svg viewBox="0 0 26 10" aria-hidden="true">
                <line x1="1" x2="25" y1="5" y2="5" className="clue-result__trend" />
              </svg>
              trend line ({fmtSigned(data.slope * 10)} {data.units} per decade)
            </li>
          )}
          {band && (
            <li>
              <svg viewBox="0 0 26 10" aria-hidden="true">
                <rect width="26" height="10" className="clue-result__band" />
              </svg>
              95 % range of the trend
            </li>
          )}
        </ul>
        <p className="clue-result__caption">
          Seasonal cycle removed: each month is compared with the average for that calendar month (every January
          with the average January, and so on). Zero means a normal month.
          {band && ' The real trend is very likely inside the shaded range; if a flat line fits inside it, the trend is not clear.'}
        </p>
      </section>

      <p className="clue-result__meta">
        {distanceKm > 20 && `Nearest land cell ${distanceKm.toFixed(0)} km away · `}Data: NASA{' '}
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
