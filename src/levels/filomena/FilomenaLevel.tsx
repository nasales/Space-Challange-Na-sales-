// Level "Storm Filomena" (caseId "filomena_madrid").
// Lesson: one extreme cold event does not refute a warming trend.
//   Phase 1 "The zoom trap": choose the years; short windows can show anything.
//   Phase 2 "Does Filomena break the trend?": remove the Filomena month; the Sen trend barely moves.
// Official numbers come from filomena_level.json (pipeline/level_filomena.py, analyze_trend).
import { useMemo, useState } from 'react'
import { getCaseEntry } from '../data'
import type { CaseLevelProps } from '../types'
import AnomalyChart from './AnomalyChart'
import { decimalYear, FIRST_YEAR, fmtSlope, LAST_YEAR, LEVEL, windowResult } from './data'
import { senLine } from './sen'
import { S } from './strings'
import TrendPanel from './TrendPanel'
import YearRange from './YearRange'
import './filomena.css'

type Answer = 'yes' | 'no' | 'cant'
type Prediction = 'lot' | 'barely'
const MIN_LONG_YEARS = 30

const T = LEVEL.anomalies.dates.map(decimalYear)
const VALUES = LEVEL.anomalies.values
const FILOMENA_INDEX = LEVEL.anomalies.dates.indexOf(LEVEL.filomena_month)
const T_END = T[T.length - 1] + 1 / 12

function sen(pick: (i: number) => boolean) {
  const t: number[] = []
  const y: number[] = []
  VALUES.forEach((v, i) => {
    if (v !== null && pick(i)) {
      t.push(T[i])
      y.push(v)
    }
  })
  return senLine(t, y)
}

const LINE_WITH = sen(() => true)
const LINE_WITHOUT = sen((i) => i !== FILOMENA_INDEX)

function slopeOf(r: (typeof LEVEL.filomena)['with']): string {
  return r.too_short ? '?' : fmtSlope(r.slope_decade)
}

export default function FilomenaLevel({ caseId, onExit, onResult }: CaseLevelProps) {
  const [phase, setPhase] = useState<1 | 2 | 3>(1)
  const [range, setRange] = useState<[number, number]>([2018, 2021])
  const [answer, setAnswer] = useState<{ value: Answer; start: number; end: number } | null>(null)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [removed, setRemoved] = useState(false)
  const [toggled, setToggled] = useState(false)

  const [start, end] = range
  const result = windowResult(start, end)
  const windowLine = useMemo(() => sen((i) => T[i] >= start && T[i] < end + 1), [start, end])

  const answerYears = answer ? answer.end - answer.start + 1 : 0
  const phase1Correct = !!answer && answer.value === 'yes' && answerYears >= MIN_LONG_YEARS
  const phase2Correct = prediction === 'barely'
  const score = Number(phase1Correct) + Number(phase2Correct)

  const fWith = LEVEL.filomena.with
  const fWithout = LEVEL.filomena.without
  const filomenaAnomaly = VALUES[FILOMENA_INDEX]

  function phase1Feedback(): string {
    if (!answer) return ''
    if (answerYears < MIN_LONG_YEARS) return S.fbShort(answerYears)
    if (answer.value === 'yes') {
      const r = windowResult(answer.start, answer.end)
      return !r.too_short && r.significant ? S.fbYesLong : S.fbYesLongWeak
    }
    return answer.value === 'no' ? S.fbNoLong : S.fbCantLong
  }

  function finish() {
    setPhase(3)
    onResult?.({ caseId, correct: score === 2, score })
  }

  const facts = getCaseEntry(caseId)?.facts?.T2M ?? ''

  return (
    <section className="flm lvl-panel" data-testid="filomena-level">
      <p className="lvl-kicker">{S.kicker}</p>

      {phase === 1 && (
        <>
          <h2 className="flm__title">{S.phase1Title}</h2>
          <p className="flm__step">{S.phase1Kicker}</p>
          <p className="flm__intro">{S.intro}</p>
          <p className="flm__help">{S.phase1Help}</p>
          <AnomalyChart t={T} values={VALUES} window={[start, end]} line={windowLine} lineRange={[Math.max(start, T[0]), Math.min(end + 1, T_END)]} />
          <YearRange min={FIRST_YEAR} max={LAST_YEAR} start={start} end={end} onChange={(s, e) => setRange([s, e])} />
          <TrendPanel title={S.panelTitle} result={result} testId="window-panel" />

          <fieldset className="flm__question" disabled={!!answer}>
            <legend>{S.question}</legend>
            {(Object.keys(S.answers) as Answer[]).map((a) => (
              <button
                key={a}
                type="button"
                className={answer?.value === a ? 'lvl-button flm__choice flm__choice--picked' : 'lvl-button flm__choice'}
                onClick={() => setAnswer({ value: a, start, end })}
              >
                {S.answers[a]}
              </button>
            ))}
          </fieldset>

          {answer && (
            <div className="flm__feedback" role="status" data-testid="phase1-feedback">
              <p>{S.answeredWith(`${answer.start}–${answer.end}`)}</p>
              <p>{phase1Feedback()}</p>
              <button type="button" className="lvl-button" onClick={() => setPhase(2)}>
                {S.next}
              </button>
            </div>
          )}
        </>
      )}

      {phase === 2 && (
        <>
          <h2 className="flm__title">{S.phase2Title}</h2>
          <p className="flm__step">{S.phase2Kicker}</p>
          <p className="flm__help">{S.phase2Help(filomenaAnomaly === null ? '?' : fmtSlope(filomenaAnomaly))}</p>
          <AnomalyChart
            t={T}
            values={VALUES}
            line={removed ? LINE_WITHOUT : LINE_WITH}
            lineRange={[T[0], T_END]}
            filomenaIndex={FILOMENA_INDEX}
            filomenaRemoved={removed}
          />

          <fieldset className="flm__question" disabled={!!prediction}>
            <legend>{S.predict}</legend>
            {(Object.keys(S.predictions) as Prediction[]).map((p) => (
              <button
                key={p}
                type="button"
                className={prediction === p ? 'lvl-button flm__choice flm__choice--picked' : 'lvl-button flm__choice'}
                onClick={() => setPrediction(p)}
              >
                {S.predictions[p]}
              </button>
            ))}
          </fieldset>

          {prediction && (
            <>
              <button
                type="button"
                className="lvl-button flm__toggle"
                aria-pressed={removed}
                data-testid="filomena-toggle"
                onClick={() => {
                  setRemoved((r) => !r)
                  setToggled(true)
                }}
              >
                {removed ? S.restore : S.remove}
              </button>
              {toggled && (
                <>
                  <div className="flm__compare">
                    <TrendPanel title={S.withF} result={fWith} testId="with-panel" />
                    <TrendPanel title={S.withoutF} result={fWithout} testId="without-panel" />
                  </div>
                  <div className="flm__feedback" role="status" data-testid="phase2-feedback">
                    <p>
                      <strong>{phase2Correct ? S.fbPredictRight : S.fbPredictWrong}</strong>{' '}
                      {S.fbMedian(slopeOf(fWith), slopeOf(fWithout))}
                    </p>
                    <button type="button" className="lvl-button" onClick={finish}>
                      {S.finish}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {phase === 3 && (
        <div data-testid="filomena-summary">
          <p className="flm__step">{S.summaryKicker}</p>
          <h2 className="flm__title">{S.summaryTitle}</h2>
          <ul className="flm__keys">
            <li>{S.key1(slopeOf(fWith))}</li>
            <li>{S.key2}</li>
          </ul>
          <p className="flm__score" data-testid="filomena-score">
            {S.score(score)}
          </p>
          {facts && (
            <details className="flm__facts">
              <summary>{S.factsTitle}</summary>
              <pre>{facts}</pre>
            </details>
          )}
          <button type="button" className="lvl-button" onClick={onExit}>
            {S.exit}
          </button>
        </div>
      )}

      <p className="flm__credit">{S.credit(LEVEL.dataset)}</p>
    </section>
  )
}
