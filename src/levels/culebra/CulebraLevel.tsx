// Level "Sierra de la Culebra fire" (caseId "sierra_culebra").
// Lesson: detecting a trend depends on how big it is compared with the noise.
//   Phase 1 "Two clues": temperature and topsoil moisture before the June 2022 fire.
//   Phase 2 "Signal vs noise": fake series = real soil-moisture trend + more and more noise; how often
//   is the trend still detected?
// Official numbers (trends and detection rates) come from culebra_level.json (pipeline/level_culebra.py,
// analyze_trend). The Sen lines here are for drawing only.
import { useMemo, useState } from 'react'
import AnomalyChart from '../common/AnomalyChart'
import { decimalYear, fmtP, fmtSlope, type TrendResult } from '../common/format'
import { senLine } from '../common/sen'
import TrendPanel from '../common/TrendPanel'
import { getCaseEntry } from '../data'
import type { CaseLevelProps } from '../types'
import { LEVEL, noiseIndex } from './data'
import { S } from './strings'
import '../common/levels-common.css'
import './culebra.css'

type A1 = keyof typeof S.q1Answers
type A2 = keyof typeof S.q2Answers

const FIRE_T = decimalYear(LEVEL.fire.month)

function prepare(series: typeof LEVEL.t2m) {
  const t = series.anomalies.dates.map(decimalYear)
  const v = series.anomalies.values
  const xs: number[] = []
  const ys: number[] = []
  v.forEach((y, i) => {
    if (y !== null && t[i] < FIRE_T) {
      xs.push(t[i])
      ys.push(y)
    }
  })
  return { t, v, line: senLine(xs, ys), fireIndex: series.anomalies.dates.indexOf(LEVEL.fire.month) }
}

const TEMP = prepare(LEVEL.t2m)
const SOIL = prepare(LEVEL.soilm)
const SOIL_UNIT = LEVEL.soilm.units
const TEMP_UNIT = LEVEL.t2m.units

const NOISE = LEVEL.noise
const NOISE_T = NOISE.dates.map(decimalYear)
const NOISE_END = NOISE_T[NOISE_T.length - 1] + 1 / 12
const SIGNAL = { slope: NOISE.slope_decade / 10, intercept: NOISE.intercept }
const I1 = noiseIndex(1)
const I2 = noiseIndex(2)
const RATE1 = NOISE.levels[I1].rate
const RATE2 = NOISE.levels[I2].rate

const pct = (rate: number) => `${Math.round(rate * 100)}%`

function pText(r: TrendResult): string {
  return r.too_short ? '?' : fmtP(r.p_value, 3)
}

function slopeText(r: TrendResult, digits = 2): string {
  return r.too_short ? '?' : fmtSlope(r.slope_decade, digits)
}

/** Phase 1 answer supported by the pre-fire trends. */
function expected1(): A1 {
  const t = LEVEL.fire.t2m
  const s = LEVEL.fire.soilm
  const hot = !t.too_short && t.significant && t.slope_decade > 0
  const dry = !s.too_short && s.significant && s.slope_decade < 0
  return hot && dry ? 'yes' : hot || dry ? 'onlyOne' : 'no'
}

/** Phase 2 answer supported by the precomputed detection rates. */
function expected2(): A2 {
  if (Math.abs(RATE2 - RATE1) <= 0.05) return 'same'
  return RATE2 > 0.5 ? 'most' : 'few'
}

export default function CulebraLevel({ caseId, onExit, onResult }: CaseLevelProps) {
  const [phase, setPhase] = useState<1 | 2 | 3>(1)
  const [a1, setA1] = useState<A1 | null>(null)
  const [a2, setA2] = useState<A2 | null>(null)
  const [level, setLevel] = useState(I1)

  const correct1 = a1 === expected1()
  const correct2 = a2 === expected2()
  const score = Number(correct1) + Number(correct2)

  const current = NOISE.levels[level]
  const example = useMemo(() => current.example as (number | null)[], [current])

  function answer2(a: A2) {
    setA2(a)
    setLevel(I2)
  }

  function finish() {
    setPhase(3)
    onResult?.({ caseId, correct: score === 2, score })
  }

  const entry = getCaseEntry(caseId)
  const preTitle = S.preFire(LEVEL.fire.pre_last)
  const fireMarker = (index: number) => ({
    index,
    icon: '🔥',
    label: S.fireLabel,
    ariaLabel: S.fireAria,
  })

  return (
    <section className="lvc lvl-panel" data-testid="culebra-level">
      <p className="lvl-kicker">{S.kicker}</p>

      {phase === 1 && (
        <>
          <h2 className="lvc__title">{S.phase1Title}</h2>
          <p className="lvc__step">{S.phase1Kicker}</p>
          <p className="lvc__intro">{S.intro}</p>
          <p className="lvc__help">{S.phase1Help}</p>
          <div className="lvc__pair">
            <figure>
              <figcaption>{S.tempName}</figcaption>
              <AnomalyChart
                t={TEMP.t}
                values={TEMP.v}
                ariaLabel={S.tempChart}
                axisUnit={S.tempAxis}
                line={TEMP.line}
                lineRange={[TEMP.t[0], FIRE_T]}
                marker={TEMP.fireIndex >= 0 ? { ...fireMarker(TEMP.fireIndex), testId: 'temp-fire' } : undefined}
                height={300}
                width={440}
                lineTestId="temp-line"
              />
              {a1 && <TrendPanel title={preTitle} result={LEVEL.fire.t2m} unit={TEMP_UNIT} testId="temp-panel" />}
            </figure>
            <figure>
              <figcaption>{S.soilName}</figcaption>
              <AnomalyChart
                t={SOIL.t}
                values={SOIL.v}
                ariaLabel={S.soilChart}
                axisUnit={S.soilAxis}
                line={SOIL.line}
                lineRange={[SOIL.t[0], FIRE_T]}
                marker={SOIL.fireIndex >= 0 ? { ...fireMarker(SOIL.fireIndex), testId: 'soil-fire' } : undefined}
                height={300}
                width={440}
                lineTestId="soil-line"
              />
              {a1 && <TrendPanel title={preTitle} result={LEVEL.fire.soilm} unit={SOIL_UNIT} testId="soil-panel" />}
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
                {(correct1 ? S.fb1Right : S.fb1Wrong)(pText(LEVEL.fire.t2m), pText(LEVEL.fire.soilm))} {S.fb1Note}
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
          <p className="lvc__help">{S.phase2Help(NOISE.runs)}</p>
          <figure className="lvcu-figure">
            <figcaption data-testid="noise-caption">{S.exampleChart(S.factor(current.factor))}</figcaption>
            <AnomalyChart
              t={NOISE_T}
              values={example}
              ariaLabel={S.exampleChart(S.factor(current.factor))}
              axisUnit={S.soilAxis}
              line={SIGNAL}
              lineRange={[NOISE_T[0], NOISE_END]}
              lineTestId="signal-line"
            />
          </figure>

          {a2 && (
            <div className="lvcu-noise">
              <label className="lvcu-noise__label" htmlFor="lvcu-noise">
                <span>{S.noiseLabel}</span>
                <strong>{S.factor(current.factor)}</strong>
              </label>
              <input
                id="lvcu-noise"
                data-testid="noise-slider"
                type="range"
                min={0}
                max={NOISE.levels.length - 1}
                step={1}
                value={level}
                aria-valuetext={S.factor(current.factor)}
                onChange={(e) => setLevel(Number(e.target.value))}
              />
              <p className="lvcu-noise__rate" data-testid="noise-rate" aria-live="polite">
                {S.detected(current.detected, current.runs, pct(current.rate))}
              </p>
              <p className="lvc__help">{S.ratesTitle}</p>
              <div className="lvcu-bars" data-testid="noise-bars">
                {NOISE.levels.map((l, i) => (
                  <button
                    key={l.factor}
                    type="button"
                    className={i === level ? 'lvcu-bars__item lvcu-bars__item--on' : 'lvcu-bars__item'}
                    onClick={() => setLevel(i)}
                    aria-label={`${S.factor(l.factor)}: ${pct(l.rate)}`}
                    aria-pressed={i === level}
                  >
                    <span className="lvcu-bars__track">
                      <span className="lvcu-bars__fill" style={{ height: `${l.rate * 100}%` }} />
                    </span>
                    <span className="lvcu-bars__pct">{pct(l.rate)}</span>
                    <span className="lvcu-bars__factor">{S.factorShort(l.factor)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <fieldset className="lvc__question" disabled={!!a2}>
            <legend>{S.q2}</legend>
            {(Object.keys(S.q2Answers) as A2[]).map((a) => (
              <button
                key={a}
                type="button"
                className={a2 === a ? 'lvl-button lvc__choice lvc__choice--picked' : 'lvl-button lvc__choice'}
                onClick={() => answer2(a)}
              >
                {S.q2Answers[a]}
              </button>
            ))}
          </fieldset>
          {a2 && (
            <div className="lvc__feedback" role="status" data-testid="phase2-feedback">
              <p>
                <strong>{correct2 ? S.right : S.wrong}</strong> {S.fb2(pct(RATE1), pct(RATE2))} {S.fb2Help}
              </p>
              <button type="button" className="lvl-button" onClick={finish}>
                {S.finish}
              </button>
            </div>
          )}
        </>
      )}

      {phase === 3 && (
        <div className="lvc__summary" data-testid="culebra-summary">
          <p className="lvc__step">{S.summaryKicker}</p>
          <h2 className="lvc__title">{S.summaryTitle}</h2>
          <ul className="lvc__keys">
            <li>{S.key1(slopeText(LEVEL.full.t2m), pText(LEVEL.full.t2m))}</li>
            <li>{S.key2(slopeText(LEVEL.full.soilm), SOIL_UNIT, pText(LEVEL.full.soilm))}</li>
            <li>{S.key3(pct(RATE1))}</li>
            <li>{S.key4}</li>
          </ul>
          <p className="lvc__score" data-testid="culebra-score">
            {S.score(score)}
          </p>
          {entry?.facts?.T2M && (
            <details className="lvc__facts">
              <summary>{S.factsTemp}</summary>
              <pre>{entry.facts.T2M}</pre>
            </details>
          )}
          {entry?.facts?.SOILM && (
            <details className="lvc__facts">
              <summary>{S.factsSoil}</summary>
              <pre>{entry.facts.SOILM}</pre>
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
