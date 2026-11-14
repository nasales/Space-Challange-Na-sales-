// Level "Tablas de Daimiel" (caseId "daimiel").
// Lesson: test many things and some will be "significant" by chance.
//   Phase 1 "Dry wetland": soil moisture (significant, p just under 0.05) and rain (not significant).
//   Phase 2 "19 tests": the p-values of all featured series; how many "significant" results would
//   pure noise give? (simulated: 500 runs of 19 noise series).
//   Phase 3 "A stricter bar": which results survive the Bonferroni threshold 0.05 / 19?
// Official numbers come from daimiel_level.json (pipeline/level_daimiel.py, analyze_trend).
// The Sen lines here are for drawing only.
import { useState } from 'react'
import AnomalyChart from '../common/AnomalyChart'
import { ciIncludesZero, decimalYear, fmtP, fmtSlope, type TrendResult } from '../common/format'
import { senLine } from '../common/sen'
import TrendPanel from '../common/TrendPanel'
import { getCaseEntry } from '../data'
import type { CaseLevelProps } from '../types'
import ChanceHistogram from './ChanceHistogram'
import { DAIMIEL_SOIL, LEVEL, type ChanceOption, type Evidence, type FeaturedTest } from './data'
import { S, VARIABLE_NAMES } from './strings'
import '../common/levels-common.css'
import './daimiel.css'

type A3 = keyof typeof S.q3Answers

function prepare(series: typeof LEVEL.soilm) {
  const t = series.anomalies.dates.map(decimalYear)
  const v = series.anomalies.values
  const xs: number[] = []
  const ys: number[] = []
  v.forEach((y, i) => {
    if (y !== null) {
      xs.push(t[i])
      ys.push(y)
    }
  })
  return { t, v, line: senLine(xs, ys), range: [t[0], t[t.length - 1] + 1 / 12] as [number, number] }
}

const SOIL = prepare(LEVEL.soilm)
const RAIN = prepare(LEVEL.precip)
const SOIL_UNIT = LEVEL.soilm.units
const RAIN_UNIT = LEVEL.precip.units
const SIM = LEVEL.simulation
const N_TESTS = LEVEL.tests.length
const THRESHOLD = LEVEL.bonferroni_threshold.toFixed(4)
const EXPECTED3: A3 = DAIMIEL_SOIL?.bonferroni ? 'yes' : 'no'

const pct = (rate: number) => `${Math.round(rate * 100)}%`

function pText(r: TrendResult): string {
  return r.too_short ? '?' : fmtP(r.p_value, 3)
}

function slopeText(r: TrendResult, digits = 2): string {
  return r.too_short ? '?' : fmtSlope(r.slope_decade, digits)
}

function testLabel(t: FeaturedTest): string {
  return `${t.title}: ${VARIABLE_NAMES[t.variable] ?? t.variable}`
}

function TestGrid({ strict }: { strict: boolean }) {
  return (
    <ul className="lvdm-grid" aria-label={S.gridLabel} data-testid="test-grid">
      {LEVEL.tests.map((t) => {
        const cls = ['lvdm-grid__item']
        if (t.significant) cls.push('lvdm-grid__item--sig')
        if (strict && t.significant) cls.push(t.bonferroni ? 'lvdm-grid__item--survives' : 'lvdm-grid__item--fails')
        if (t.id === DAIMIEL_SOIL?.id) cls.push('lvdm-grid__item--here')
        return (
          <li key={t.id} className={cls.join(' ')} data-testid={`test-${t.id}`} data-bonferroni={t.bonferroni}>
            <span className="lvdm-grid__name">{testLabel(t)}</span>
            <span className="lvdm-grid__p">p = {fmtP(t.p_value, 3)}</span>
            {t.significant && !strict && <span className="lvdm-grid__tag">{S.sigTag}</span>}
            {strict && t.significant && <span className="lvdm-grid__tag">{t.bonferroni ? S.survives : S.fails}</span>}
          </li>
        )
      })}
    </ul>
  )
}

export default function DaimielLevel({ caseId, onExit, onResult }: CaseLevelProps) {
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1)
  const [a1, setA1] = useState<Evidence | null>(null)
  const [a2, setA2] = useState<ChanceOption | null>(null)
  const [a3, setA3] = useState<A3 | null>(null)

  const correct1 = a1 === LEVEL.full.evidence
  const correct2 = a2 === SIM.answer
  const correct3 = a3 === EXPECTED3
  const score = Number(correct1) + Number(correct2) + Number(correct3)

  function finish() {
    setPhase(4)
    onResult?.({ caseId, correct: score === 3, score })
  }

  const entry = getCaseEntry(caseId)
  const soilP = pText(LEVEL.full.soilm)
  const rainP = pText(LEVEL.full.precip)
  const meanText = SIM.mean.toFixed(1)

  function feedback1(): string {
    if (correct1) return S.fb1Right(soilP)
    if (a1 === 'strong') return S.fb1Strong(soilP, ciIncludesZero(LEVEL.full.soilm))
    return S.fb1None(soilP)
  }

  return (
    <section className="lvc lvl-panel" data-testid="daimiel-level">
      <p className="lvl-kicker">{S.kicker}</p>

      {phase === 1 && (
        <>
          <h2 className="lvc__title">{S.phase1Title}</h2>
          <p className="lvc__step">{S.phase1Kicker}</p>
          <p className="lvc__intro">{S.intro}</p>
          <p className="lvc__help">{S.phase1Help}</p>
          <div className="lvc__pair">
            <figure>
              <figcaption>{S.soilName}</figcaption>
              <AnomalyChart
                t={SOIL.t}
                values={SOIL.v}
                ariaLabel={S.soilChart}
                axisUnit={S.soilAxis}
                line={SOIL.line}
                lineRange={SOIL.range}
                height={300}
                width={440}
                lineTestId="soil-line"
              />
              <TrendPanel title={S.fullRecord} result={LEVEL.full.soilm} unit={SOIL_UNIT} testId="soil-panel" />
            </figure>
            <figure>
              <figcaption>{S.rainName}</figcaption>
              <AnomalyChart
                t={RAIN.t}
                values={RAIN.v}
                ariaLabel={S.rainChart}
                axisUnit={S.rainAxis}
                line={RAIN.line}
                lineRange={RAIN.range}
                height={300}
                width={440}
                lineTestId="rain-line"
              />
              <TrendPanel title={S.fullRecord} result={LEVEL.full.precip} unit={RAIN_UNIT} testId="rain-panel" pDigits={2} />
            </figure>
          </div>

          <fieldset className="lvc__question" disabled={!!a1}>
            <legend>{S.q1}</legend>
            {(Object.keys(S.q1Answers) as Evidence[]).map((a) => (
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
                {feedback1()} {S.fb1Rain(rainP)}
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
          <p className="lvc__help">{S.phase2Help(N_TESTS, LEVEL.real_significant)}</p>
          <TestGrid strict={false} />

          <fieldset className="lvc__question" disabled={!!a2}>
            <legend>{S.q2(N_TESTS)}</legend>
            {(Object.keys(S.q2Answers) as ChanceOption[]).map((a) => (
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
              <figure className="lvdm-figure">
                <figcaption>{S.histTitle(SIM.runs, SIM.n_series)}</figcaption>
                <ChanceHistogram
                  histogram={SIM.histogram}
                  mean={SIM.mean}
                  real={LEVEL.real_significant}
                  ariaLabel={S.histAria(SIM.runs, meanText)}
                  axisLabel={S.histAxis}
                  realLabel={S.realLabel(LEVEL.real_significant)}
                  testId="chance-hist"
                />
                <p className="lvc__help">{S.histLegend(meanText)}</p>
              </figure>
              <div className="lvc__feedback" role="status" data-testid="phase2-feedback">
                <p>
                  <strong>{correct2 ? S.right : S.wrong}</strong>{' '}
                  {S.fb2(meanText, pct(SIM.share_at_least_one), LEVEL.real_significant)}
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
          <p className="lvc__help">{S.phase3Help(N_TESTS, THRESHOLD, pct(SIM.share_any_bonferroni))}</p>
          <TestGrid strict={!!a3} />

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
                <strong>{correct3 ? S.right : S.wrong}</strong>{' '}
                {S.fb3(LEVEL.bonferroni_survivors, LEVEL.real_significant)}
              </p>
              <button type="button" className="lvl-button" onClick={finish}>
                {S.finish}
              </button>
            </div>
          )}
        </>
      )}

      {phase === 4 && (
        <div className="lvc__summary" data-testid="daimiel-summary">
          <p className="lvc__step">{S.summaryKicker}</p>
          <h2 className="lvc__title">{S.summaryTitle}</h2>
          <ul className="lvc__keys">
            <li>{S.key1(slopeText(LEVEL.full.soilm), SOIL_UNIT, soilP)}</li>
            <li>{S.key2(rainP)}</li>
            <li>{S.key3(meanText, SIM.n_series)}</li>
            <li>{S.key4(THRESHOLD)}</li>
          </ul>
          <p className="lvc__score" data-testid="daimiel-score">
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
