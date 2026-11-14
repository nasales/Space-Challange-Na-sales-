// Level "Doñana wetlands" (caseId "donana").
// Lesson: a result just under p = 0.05 is weak evidence; read the confidence range; compare variables
// before blaming a cause.
//   Phase 1 "On the edge": p-value meter while moving the years; small changes flip the result.
//   Phase 2 "The confidence range": does the 95 % range of the slope include zero?
//   Phase 3 "Rain or something else?": soil moisture vs precipitation.
// Official numbers come from donana_level.json (pipeline/level_donana.py, analyze_trend).
import { useMemo, useState } from 'react'
import AnomalyChart from '../common/AnomalyChart'
import { ciIncludesZero, decimalYear, fmtP, fmtSlope, type TrendResult } from '../common/format'
import PValueMeter from '../common/PValueMeter'
import { senLine } from '../common/sen'
import TrendPanel from '../common/TrendPanel'
import YearRange from '../common/YearRange'
import { getCaseEntry } from '../data'
import type { CaseLevelProps } from '../types'
import { FIRST_YEAR, LAST_YEAR, LEVEL, windowResult } from './data'
import { S } from './strings'
import '../common/levels-common.css'

type A1 = keyof typeof S.q1Answers
type A2 = keyof typeof S.q2Answers
type A3 = keyof typeof S.q3Answers
type Category = 'sig' | 'not' | 'short'

const SOIL_T = LEVEL.soilm.anomalies.dates.map(decimalYear)
const SOIL_V = LEVEL.soilm.anomalies.values
const RAIN_T = LEVEL.precip.anomalies.dates.map(decimalYear)
const RAIN_V = LEVEL.precip.anomalies.values
const SOIL_UNIT = LEVEL.soilm.units
const RAIN_UNIT = LEVEL.precip.units
const SOIL_END = SOIL_T[SOIL_T.length - 1] + 1 / 12
const RAIN_END = RAIN_T[RAIN_T.length - 1] + 1 / 12

function sen(t: number[], v: (number | null)[], pick: (tt: number) => boolean = () => true) {
  const xs: number[] = []
  const ys: number[] = []
  v.forEach((y, i) => {
    if (y !== null && pick(t[i])) {
      xs.push(t[i])
      ys.push(y)
    }
  })
  return senLine(xs, ys)
}

const SOIL_LINE = sen(SOIL_T, SOIL_V)
const RAIN_LINE = sen(RAIN_T, RAIN_V)
const FULL_SOIL = LEVEL.full.soilm
const FULL_RAIN = LEVEL.full.precip

function category(r: TrendResult): Category {
  return r.too_short ? 'short' : r.significant ? 'sig' : 'not'
}

function slopeText(r: TrendResult, digits = 2): string {
  return r.too_short ? '?' : fmtSlope(r.slope_decade, digits)
}

function pText(r: TrendResult): string {
  return r.too_short ? '?' : fmtP(r.p_value, 4)
}

interface Visits {
  seen: Record<string, Category>
  last: Category
  flips: number
}

export default function DonanaLevel({ caseId, onExit, onResult }: CaseLevelProps) {
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1)
  const [range, setRange] = useState<[number, number]>([FIRST_YEAR, LAST_YEAR])
  const [visits, setVisits] = useState<Visits>(() => ({
    seen: { [`${FIRST_YEAR}-${LAST_YEAR}`]: category(windowResult(FIRST_YEAR, LAST_YEAR)) },
    last: category(windowResult(FIRST_YEAR, LAST_YEAR)),
    flips: 0,
  }))
  const [a1, setA1] = useState<A1 | null>(null)
  const [a2, setA2] = useState<A2 | null>(null)
  const [a3, setA3] = useState<A3 | null>(null)

  const [start, end] = range
  const result = windowResult(start, end)
  const windowLine = useMemo(() => sen(SOIL_T, SOIL_V, (tt) => tt >= start && tt < end + 1), [start, end])

  function changeRange(s: number, e: number) {
    setRange([s, e])
    const cat = category(windowResult(s, e))
    setVisits((v) => ({
      seen: { ...v.seen, [`${s}-${e}`]: cat },
      // too-short windows say nothing: flips count only significant <-> not significant
      last: cat === 'short' ? v.last : cat,
      flips: v.flips + (cat !== 'short' && v.last !== 'short' && cat !== v.last ? 1 : 0),
    }))
  }

  const seen = Object.values(visits.seen)
  const count = (c: Category) => seen.filter((x) => x === c).length

  const includesZero = ciIncludesZero(FULL_SOIL)
  const expected2: A2 = includesZero ? 'yes' : 'no'
  const disagree = !FULL_SOIL.too_short && FULL_SOIL.significant === includesZero

  const correct1 = a1 === 'weak'
  const correct2 = a2 === expected2
  const correct3 = a3 === 'other'
  const score = Number(correct1) + Number(correct2) + Number(correct3)

  function finish() {
    setPhase(4)
    onResult?.({ caseId, correct: score === 3, score })
  }

  const entry = getCaseEntry(caseId)
  const lo = FULL_SOIL.too_short ? '?' : fmtSlope(FULL_SOIL.ci_decade[0], 3)
  const hi = FULL_SOIL.too_short ? '?' : fmtSlope(FULL_SOIL.ci_decade[1], 3)
  const fan: [number, number] | undefined = FULL_SOIL.too_short
    ? undefined
    : [FULL_SOIL.ci_decade[0] / 10, FULL_SOIL.ci_decade[1] / 10]

  return (
    <section className="lvc lvl-panel" data-testid="donana-level">
      <p className="lvl-kicker">{S.kicker}</p>

      {phase === 1 && (
        <>
          <h2 className="lvc__title">{S.phase1Title}</h2>
          <p className="lvc__step">{S.phase1Kicker}</p>
          <p className="lvc__intro">{S.intro}</p>
          <p className="lvc__help">{S.phase1Help}</p>
          <AnomalyChart
            t={SOIL_T}
            values={SOIL_V}
            ariaLabel={S.soilChart}
            axisUnit={S.soilAxis}
            window={[start, end]}
            line={windowLine}
            lineRange={[Math.max(start, SOIL_T[0]), Math.min(end + 1, SOIL_END)]}
          />
          <YearRange min={FIRST_YEAR} max={LAST_YEAR} start={start} end={end} onChange={changeRange} />
          <PValueMeter p={result.too_short ? null : result.p_value} />
          <TrendPanel title={S.panelTitle} result={result} unit={SOIL_UNIT} testId="window-panel" pDigits={4} />
          <p className="lvc__help">
            <strong>{S.task}</strong>
          </p>
          <p className="lvc__counter" data-testid="flip-counter" aria-live="polite">
            {S.counter(seen.length, count('sig'), count('not'), count('short'), visits.flips)}
          </p>

          <fieldset className="lvc__question" disabled={!!a1}>
            <legend>{S.q1}</legend>
            {(Object.keys(S.q1Answers) as A1[]).map((a) => (
              <button
                key={a}
                type="button"
                className={a1 === a ? 'lvl-button lvc__choice lvc__choice--picked' : 'lvl-button lvc__choice'}
                onClick={() => setA1(a)}
              >
                {S.q1Answers[a]}
              </button>
            ))}
          </fieldset>
          {a1 && (
            <div className="lvc__feedback" role="status" data-testid="phase1-feedback">
              <p>{a1 === 'weak' ? S.fb1Right(pText(FULL_SOIL)) : a1 === 'strong' ? S.fb1Strong(pText(FULL_SOIL)) : S.fb1None}</p>
              <button type="button" className="lvl-button" onClick={() => setPhase(2)}>
                {S.next}
              </button>
            </div>
          )}
        </>
      )}

      {phase === 2 && (
        <>
          <h2 className="lvc__title">{S.phase2Title}</h2>
          <p className="lvc__step">{S.phase2Kicker}</p>
          <p className="lvc__help">{S.phase2Help}</p>
          <AnomalyChart
            t={SOIL_T}
            values={SOIL_V}
            ariaLabel={S.soilChart}
            axisUnit={S.soilAxis}
            line={SOIL_LINE}
            lineRange={[SOIL_T[0], SOIL_END]}
            fan={a2 ? fan : undefined}
          />
          <fieldset className="lvc__question" disabled={!!a2}>
            <legend>{S.q2}</legend>
            {(Object.keys(S.q2Answers) as A2[]).map((a) => (
              <button
                key={a}
                type="button"
                className={a2 === a ? 'lvl-button lvc__choice lvc__choice--picked' : 'lvl-button lvc__choice'}
                onClick={() => setA2(a)}
              >
                {S.q2Answers[a]}
              </button>
            ))}
          </fieldset>
          {a2 && (
            <>
              <TrendPanel title={S.rangeTitle} result={FULL_SOIL} unit={SOIL_UNIT} testId="full-panel" digits={3} pDigits={4} />
              <div className="lvc__feedback" role="status" data-testid="phase2-feedback">
                <p>
                  <strong>{correct2 ? S.right : S.wrong}</strong>{' '}
                  {includesZero ? S.fb2Includes(lo, hi, SOIL_UNIT) : S.fb2Excludes(lo, hi, SOIL_UNIT)}
                  {disagree && <> {S.fb2Disagree}</>}
                </p>
                <button type="button" className="lvl-button" onClick={() => setPhase(3)}>
                  {S.next}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {phase === 3 && (
        <>
          <h2 className="lvc__title">{S.phase3Title}</h2>
          <p className="lvc__step">{S.phase3Kicker}</p>
          <p className="lvc__help">{S.phase3Help}</p>
          <div className="lvc__pair">
            <figure>
              <figcaption>{S.rainName}</figcaption>
              <AnomalyChart
                t={RAIN_T}
                values={RAIN_V}
                ariaLabel={S.rainChart}
                axisUnit={S.rainAxis}
                line={RAIN_LINE}
                lineRange={[RAIN_T[0], RAIN_END]}
                height={300}
                width={440}
                lineTestId="rain-line"
              />
              <TrendPanel title={S.fullRecord} result={FULL_RAIN} unit={RAIN_UNIT} testId="rain-panel" digits={3} pDigits={4} />
            </figure>
            <figure>
              <figcaption>{S.soilName}</figcaption>
              <AnomalyChart
                t={SOIL_T}
                values={SOIL_V}
                ariaLabel={S.soilChart}
                axisUnit={S.soilAxis}
                line={SOIL_LINE}
                lineRange={[SOIL_T[0], SOIL_END]}
                height={300}
                width={440}
                lineTestId="soil-line"
              />
              <TrendPanel title={S.fullRecord} result={FULL_SOIL} unit={SOIL_UNIT} testId="soil-panel" digits={3} pDigits={4} />
            </figure>
          </div>
          <p className="lvc__counter">
            {S.commonNote(LEVEL.common.first, LEVEL.common.last, pText(LEVEL.common.soilm), pText(LEVEL.common.precip))}
          </p>
          <fieldset className="lvc__question" disabled={!!a3}>
            <legend>{S.q3}</legend>
            {(Object.keys(S.q3Answers) as A3[]).map((a) => (
              <button
                key={a}
                type="button"
                className={a3 === a ? 'lvl-button lvc__choice lvc__choice--picked' : 'lvl-button lvc__choice'}
                onClick={() => setA3(a)}
              >
                {S.q3Answers[a]}
              </button>
            ))}
          </fieldset>
          {a3 && (
            <div className="lvc__feedback" role="status" data-testid="phase3-feedback">
              <p>
                <strong>{correct3 ? S.right : S.wrong}</strong> {a3 === 'wrongData' && <>{S.fb3WrongData} </>}
                {S.fb3}
              </p>
              <button type="button" className="lvl-button" onClick={finish}>
                {S.finish}
              </button>
            </div>
          )}
        </>
      )}

      {phase === 4 && (
        <div className="lvc__summary" data-testid="donana-summary">
          <p className="lvc__step">{S.summaryKicker}</p>
          <h2 className="lvc__title">{S.summaryTitle}</h2>
          <ul className="lvc__keys">
            <li>{S.key1(slopeText(FULL_SOIL), SOIL_UNIT, pText(FULL_SOIL))}</li>
            <li>{S.key2}</li>
            <li>{S.key3}</li>
          </ul>
          <p className="lvc__score" data-testid="donana-score">
            {S.score(score)}
          </p>
          {entry?.facts?.SOILM && (
            <details className="lvc__facts">
              <summary>{S.factsSoil}</summary>
              <pre>{entry.facts.SOILM}</pre>
            </details>
          )}
          {entry?.facts?.PRECIP && (
            <details className="lvc__facts">
              <summary>{S.factsRain}</summary>
              <pre>{entry.facts.PRECIP}</pre>
            </details>
          )}
          <button type="button" className="lvl-button" onClick={onExit}>
            {S.exit}
          </button>
        </div>
      )}

      <p className="lvc__credit">{S.credit}</p>
    </section>
  )
}
