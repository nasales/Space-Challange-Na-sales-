// Level "Córdoba heat" (caseId "cordoba_heat"). Lesson: in a warming climate, warm records outnumber
// cold records.
//   Phase 1 "Record hunters": predict which decade had the most warm records (records of each
//     calendar month, counted from 1990 on), then see the records on the chart and the warm vs cold
//     bars per decade.
//   Phase 2 "Without a trend?": are the warm records more than chance? Then compare with the records
//     expected in the same series with its trend removed and the years shuffled.
// Official numbers come from cordoba_level.json (pipeline/level_cordoba.py, analyze_trend).
import { useState } from 'react'
import { decimalYear, fmtP, fmtSlope } from '../common/format'
import { getCaseEntry } from '../data'
import type { CaseLevelProps } from '../types'
import { LEVEL } from './data'
import DecadeBars, { type BarSeries } from './DecadeBars'
import RecordChart from './RecordChart'
import { S } from './strings'
import '../common/levels-common.css'
import './cordoba.css'

type A2 = keyof typeof S.q2Answers

const T = LEVEL.t2m.anomalies.dates.map(decimalYear)
const V = LEVEL.t2m.anomalies.values
const REC = LEVEL.records
const SIM = LEVEL.simulation
const FULL = LEVEL.full
const DECADES = LEVEL.decades
const LABELS = DECADES.map((d) => (d.partial ? `${d.label}*` : d.label))
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function monthText(ym: string): string {
  return `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
}

function listText(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const OBSERVED: BarSeries[] = [
  { key: 'warm', label: S.warmLabel, values: REC.warm, kind: 'warm' },
  { key: 'cold', label: S.coldLabel, values: REC.cold, kind: 'cold' },
]
const COMPARED: BarSeries[] = [
  { key: 'warm', label: S.warmLabel, values: REC.warm, kind: 'warm' },
  { key: 'warm-exp', label: S.warmExpected, values: SIM.expected_warm, kind: 'warm-expected', digits: 1 },
  { key: 'cold', label: S.coldLabel, values: REC.cold, kind: 'cold' },
  { key: 'cold-exp', label: S.coldExpected, values: SIM.expected_cold, kind: 'cold-expected', digits: 1 },
]

export default function CordobaLevel({ caseId, onExit, onResult }: CaseLevelProps) {
  const [phase, setPhase] = useState<1 | 2 | 3>(1)
  const [a1, setA1] = useState<number | null>(null)
  const [a2, setA2] = useState<A2 | null>(null)
  const [score, setScore] = useState(0)

  const correct1 = a1 !== null && REC.top_share_decades.includes(a1)
  const correct2 = a2 === (SIM.more_than_chance ? 'yes' : 'no')
  const topIdx = DECADES.flatMap((d, i) => (REC.top_share_decades.includes(d.start) ? [i] : []))
  const topLabels = topIdx.map((i) => DECADES[i].label)
  const shareText = DECADES.map((d, i) => `${d.label} ${REC.warm[i]} of ${REC.warm[i] + REC.cold[i]}`).join(', ')
  const topIsPartial = topIdx.some((i) => DECADES[i].partial)
  const partial = DECADES.find((d) => d.partial)
  const sharePct = (SIM.share_at_least_observed * 100).toFixed(1)

  function finish() {
    const s = Number(correct1) + Number(correct2)
    setScore(s)
    setPhase(3)
    onResult?.({ caseId, correct: s === 2, score: s })
  }

  const entry = getCaseEntry(caseId)
  const p = FULL.too_short ? '?' : fmtP(FULL.p_value)
  const pPhrase = p.startsWith('<') ? p : `= ${p}`

  return (
    <section className="lvc lvl-panel" data-testid="cordoba-level">
      <p className="lvl-kicker">{S.kicker}</p>

      {phase === 1 && (
        <>
          <h2 className="lvc__title">{S.phase1Title}</h2>
          <p className="lvc__step">{S.phase1Kicker}</p>
          <p className="lvc__intro">{S.intro}</p>
          <p className="lvc__help">{S.phase1Help(REC.first_year)}</p>
          <RecordChart
            t={T}
            values={V}
            warm={REC.warm_idx}
            cold={REC.cold_idx}
            showRecords={a1 !== null}
            firstYear={REC.first_year}
            ariaLabel={S.chart}
            axisUnit={S.axis}
            historyLabel={S.history}
          />
          <fieldset className="lvc__question" disabled={a1 !== null}>
            <legend>{S.q1}</legend>
            {DECADES.map((d, i) => (
              <button
                key={d.start}
                type="button"
                className={a1 === d.start ? 'lvl-button lvc__choice lvc__choice--picked' : 'lvl-button lvc__choice'}
                onClick={() => setA1(d.start)}
              >
                {LABELS[i]}
              </button>
            ))}
          </fieldset>
          {partial?.last_month && <p className="lvc__help">* {S.partialNote(partial.label, monthText(partial.last_month))}</p>}
          {a1 !== null && (
            <>
              <p className="lvc__counter" data-testid="record-count">
                {S.recordsShown(REC.warm_idx.length, REC.cold_idx.length)}
              </p>
              <DecadeBars groups={LABELS} series={OBSERVED} ariaLabel={S.bars1} testId="bars-observed" />
              <div className="lvc__feedback" role="status" data-testid="phase1-feedback">
                <p>
                  <strong>{correct1 ? S.right : S.wrong}</strong>{' '}
                  {topLabels.length > 1
                    ? S.fb1Tie(listText(topLabels))
                    : S.fb1Top(topLabels[0], REC.warm[topIdx[0]], REC.cold[topIdx[0]])}{' '}
                  {S.fb1Shares(shareText)}{' '}
                  {partial && topIsPartial && S.fb1Partial(partial.label)}{' '}
                  {S.fb1Cold(REC.cold[0], REC.cold[REC.cold.length - 1])}
                </p>
                <button type="button" className="lvl-button" onClick={() => setPhase(2)}>
                  {S.next}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {phase === 2 && (
        <>
          <h2 className="lvc__title">{S.phase2Title}</h2>
          <p className="lvc__step">{S.phase2Kicker}</p>
          <p className="lvc__help">{S.phase2Help(SIM.n, fmtSlope(SIM.slope_removed_decade, 2))}</p>
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
              <DecadeBars groups={LABELS} series={COMPARED} ariaLabel={S.bars2} testId="bars-compared" />
              <p className="lvc__counter" data-testid="chance-line">
                {S.chance(SIM.n, SIM.total_warm_mean.toFixed(1), SIM.total_warm_p95.toFixed(0), SIM.observed_total_warm)}
              </p>
              <div className="lvc__feedback" role="status" data-testid="phase2-feedback">
                <p>
                  <strong>{correct2 ? S.right : S.wrong}</strong>{' '}
                  {SIM.more_than_chance ? S.fb2Yes(sharePct) : S.fb2No(sharePct)} {S.fb2Note}
                </p>
                <button type="button" className="lvl-button" onClick={finish}>
                  {S.finish}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {phase === 3 && (
        <div className="lvc__summary" data-testid="cordoba-summary">
          <p className="lvc__step">{S.summaryKicker}</p>
          <h2 className="lvc__title">{S.summaryTitle}</h2>
          <ul className="lvc__keys">
            <li>{S.key1(SIM.observed_total_warm, SIM.observed_total_cold, REC.first_year)}</li>
            <li>{S.key2(SIM.observed_total_warm, SIM.total_warm_mean.toFixed(0))}</li>
            <li>{S.key3(FULL.too_short ? '?' : fmtSlope(FULL.slope_decade, 2), pPhrase)}</li>
            {entry?.context && <li>{entry.context}</li>}
          </ul>
          <p className="lvc__score" data-testid="cordoba-score">
            {S.score(score, 2)}
          </p>
          {entry?.facts?.T2M && (
            <details className="lvc__facts">
              <summary>{S.facts}</summary>
              <pre>{entry.facts.T2M}</pre>
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
