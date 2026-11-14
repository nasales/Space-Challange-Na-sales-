// Level "Aneto glacier" (caseId "aneto_glacier").
// Lesson: the glacier's loss points to heat, not rain; and comparing trends needs their confidence ranges.
//   Phase 1 "Heat or rain?": temperature and precipitation charts with their official trends.
//   Phase 2 "Is Aneto the fastest?": the player orders the 7 cases with a temperature record, then a
//   dot-and-whisker chart reveals each trend with its 95 % range.
// Official numbers come from aneto_level.json (pipeline/level_aneto.py, analyze_trend).
import { useState } from 'react'
import AnomalyChart from '../common/AnomalyChart'
import { decimalYear, fmtP, fmtSlope, type TrendResult } from '../common/format'
import { senLine } from '../common/sen'
import TrendPanel from '../common/TrendPanel'
import { getCaseEntry } from '../data'
import type { CaseLevelProps } from '../types'
import { LEVEL } from './data'
import RaceChart from './RaceChart'
import RankList, { type RankItem } from './RankList'
import { S } from './strings'
import '../common/levels-common.css'
import './aneto.css'

type A1 = keyof typeof S.q1Answers
type A2 = keyof typeof S.q2Answers

function series(s: typeof LEVEL.t2m) {
  const t = s.anomalies.dates.map(decimalYear)
  const v = s.anomalies.values
  const xs: number[] = []
  const ys: number[] = []
  v.forEach((y, i) => {
    if (y !== null) {
      xs.push(t[i])
      ys.push(y)
    }
  })
  return { t, v, line: senLine(xs, ys), end: t[t.length - 1] + 1 / 12, first: s.anomalies.dates[0], last: s.anomalies.dates[s.anomalies.dates.length - 1] }
}

const T2M = series(LEVEL.t2m)
const RAIN = series(LEVEL.precip)
const FULL_T2M = LEVEL.full.t2m
const FULL_RAIN = LEVEL.full.precip
const RACE = LEVEL.race
const ME = RACE.find((r) => r.case_id === LEVEL.case_id)!
const VERDICT = LEVEL.verdict
const EXPECTED2: A2 = VERDICT.clearly_fastest ? 'clearly' : VERDICT.fastest_estimate ? 'notClearly' : 'slower'

// Starting order: south to north (a neutral order that does not give the answer away).
const START_ORDER: RankItem[] = RACE.map((r) => ({ id: r.case_id, label: r.title, lat: getCaseEntry(r.case_id)?.lat ?? 0 }))
  .sort((a, b) => a.lat - b.lat || a.label.localeCompare(b.label))
  .map(({ id, label }) => ({ id, label }))

function slopeText(r: TrendResult, digits = 2): string {
  return r.too_short ? '?' : fmtSlope(r.slope_decade, digits)
}

function pText(r: TrendResult): string {
  return r.too_short ? '?' : fmtP(r.p_value, 3)
}

export default function AnetoLevel({ caseId, onExit, onResult }: CaseLevelProps) {
  const [phase, setPhase] = useState<1 | 2 | 3>(1)
  const [a1, setA1] = useState<A1 | null>(null)
  const [order, setOrder] = useState<RankItem[]>(START_ORDER)
  const [revealed, setRevealed] = useState(false)
  const [a2, setA2] = useState<A2 | null>(null)

  const correct1 = a1 === 'temperature'
  const correct2 = a2 === EXPECTED2
  const score = Number(correct1) + Number(correct2)

  const playerRank = Object.fromEntries(order.map((it, i) => [it.id, i + 1]))
  const hits = RACE.filter((r, i) => playerRank[r.case_id] === i + 1).length

  function finish() {
    setPhase(3)
    onResult?.({ caseId, correct: score === 2, score })
  }

  const entry = getCaseEntry(caseId)
  const rainP = pText(FULL_RAIN)

  return (
    <section className="lvc lvl-panel" data-testid="aneto-level">
      <p className="lvl-kicker">{S.kicker}</p>

      {phase === 1 && (
        <>
          <h2 className="lvc__title">{S.phase1Title}</h2>
          <p className="lvc__step">{S.phase1Kicker}</p>
          {entry && <p className="lvc__intro">{entry.question}</p>}
          {entry && <p className="lvc__help">{entry.context}</p>}
          <p className="lvc__help">{S.phase1Help}</p>
          <div className="lvc__pair">
            <figure>
              <figcaption>{S.t2mName}</figcaption>
              <AnomalyChart
                t={T2M.t}
                values={T2M.v}
                ariaLabel={S.t2mChart}
                axisUnit={S.t2mAxis}
                line={T2M.line}
                lineRange={[T2M.t[0], T2M.end]}
                height={300}
                width={440}
                lineTestId="t2m-line"
              />
              <TrendPanel title={S.fullRecord(T2M.first, T2M.last)} result={FULL_T2M} unit={LEVEL.t2m.units} testId="t2m-panel" />
            </figure>
            <figure>
              <figcaption>{S.rainName}</figcaption>
              <AnomalyChart
                t={RAIN.t}
                values={RAIN.v}
                ariaLabel={S.rainChart}
                axisUnit={S.rainAxis}
                line={RAIN.line}
                lineRange={[RAIN.t[0], RAIN.end]}
                height={300}
                width={440}
                lineTestId="rain-line"
              />
              <TrendPanel title={S.fullRecord(RAIN.first, RAIN.last)} result={FULL_RAIN} unit={LEVEL.precip.units} testId="rain-panel" digits={3} />
            </figure>
          </div>
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
              <p>
                <strong>{correct1 ? S.right : S.wrong}</strong>{' '}
                {a1 === 'temperature' ? S.fb1Right(slopeText(FULL_T2M), rainP) : a1 === 'rain' ? S.fb1Rain(rainP) : S.fb1Both(rainP)}
              </p>
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
          <p className="lvc__help">{S.phase2Help(RACE.length)}</p>
          {!revealed ? (
            <>
              <RankList items={order} onChange={setOrder} />
              <div className="lvc__actions">
                <button type="button" className="lvl-button" data-testid="reveal" onClick={() => setRevealed(true)}>
                  {S.reveal}
                </button>
              </div>
            </>
          ) : (
            <>
              <RaceChart rows={RACE} highlight={LEVEL.case_id} playerRank={playerRank} />
              <p className="lvc__counter" data-testid="rank-feedback">
                {S.rankFeedback(hits, RACE.length, playerRank[ME.case_id])}
              </p>
              <p className="lvc__help">{S.raceHelp}</p>
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
                <div className="lvc__feedback" role="status" data-testid="phase2-feedback">
                  <p>
                    <strong>{correct2 ? S.right : S.wrong}</strong>{' '}
                    {EXPECTED2 === 'clearly'
                      ? S.fb2Clearly(fmtSlope(ME.ci_decade[0]), fmtSlope(ME.ci_decade[1]))
                      : EXPECTED2 === 'notClearly'
                        ? S.fb2NotClearly(fmtSlope(ME.ci_decade[0]), fmtSlope(ME.ci_decade[1]), VERDICT.overlapping.length, RACE.length - 1)
                        : S.fb2Slower}
                  </p>
                  <button type="button" className="lvl-button" onClick={finish}>
                    {S.finish}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {phase === 3 && (
        <div className="lvc__summary" data-testid="aneto-summary">
          <p className="lvc__step">{S.summaryKicker}</p>
          <h2 className="lvc__title">{S.summaryTitle}</h2>
          <ul className="lvc__keys">
            <li>{S.key1(slopeText(FULL_T2M), VERDICT.fastest_estimate)}</li>
            <li>{S.key2(rainP)}</li>
            <li>{S.key3}</li>
          </ul>
          <p className="lvc__score" data-testid="aneto-score">
            {S.score(score)}
          </p>
          {entry?.facts?.T2M && (
            <details className="lvc__facts">
              <summary>{S.factsT2m}</summary>
              <pre>{entry.facts.T2M}</pre>
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
