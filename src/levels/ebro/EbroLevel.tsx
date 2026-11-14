// Level "Ebro Delta" (caseId "ebro_delta").
// Lesson: remove the seasonal cycle to see the trend; turn a rate into a total change.
//   Phase 1 "Remove the seasons": raw monthly temperature -> typical year -> subtract -> anomalies.
//   Phase 2 "How much in total?": estimate the total warming over the record; reveal slope x decades.
// Official numbers (trend, typical year, totals) come from ebro_level.json (pipeline/level_ebro.py,
// analyze_trend). The Sen line here is for drawing only.
import { useCallback, useState } from 'react'
import AnomalyChart from '../common/AnomalyChart'
import { decimalYear, fmtP, fmtSlope, type TrendResult } from '../common/format'
import { senLine } from '../common/sen'
import TrendPanel from '../common/TrendPanel'
import { getCaseEntry } from '../data'
import type { CaseLevelProps } from '../types'
import { calendarMonth, GUESS, guessInRange, LEVEL, monthName } from './data'
import SeasonChart from './SeasonChart'
import { S } from './strings'
import '../common/levels-common.css'
import './ebro.css'

type A0 = keyof typeof S.q0Answers
type A1 = keyof typeof S.q1Answers
type Stage = 'raw' | 'typical' | 'subtracting' | 'anomalies'

const RAW_T = LEVEL.t2m.raw.dates.map(decimalYear)
const RAW_V = LEVEL.t2m.raw.values
const MONTHS = LEVEL.t2m.raw.dates.map((d) => Number(d.slice(5, 7)) - 1)
const TYPICAL = LEVEL.t2m.typical_year
const AN_T = LEVEL.t2m.anomalies.dates.map(decimalYear)
const AN_V = LEVEL.t2m.anomalies.values
const AN_END = AN_T[AN_T.length - 1] + 1 / 12
const T2M_UNIT = LEVEL.t2m.units
const FULL_T = LEVEL.full.t2m
const FULL_P = LEVEL.full.precip
const TOTAL = LEVEL.total
const FROM = monthName(TOTAL.first)
const TO = monthName(TOTAL.last)

const LINE = (() => {
  const xs: number[] = []
  const ys: number[] = []
  AN_V.forEach((v, i) => {
    if (v !== null) {
      xs.push(AN_T[i])
      ys.push(v)
    }
  })
  return senLine(xs, ys)
})()

const COLD = TYPICAL.indexOf(Math.min(...TYPICAL))
const HOT = TYPICAL.indexOf(Math.max(...TYPICAL))
const SWING = (TYPICAL[HOT] - TYPICAL[COLD]).toFixed(0)

const dataset = (d: string) => d.replace(/^NASA\s+/, '')
const one = (x: number) => fmtSlope(x, 1)
const two = (x: number) => fmtSlope(x, 2)

function slopeText(r: TrendResult): string {
  return r.too_short ? '?' : fmtSlope(r.slope_decade, 2)
}

function pText(r: TrendResult): string {
  return r.too_short ? '?' : fmtP(r.p_value, 3)
}

/** Phase 1 answer supported by the official trend. */
function expected1(): A1 {
  if (FULL_T.too_short || !FULL_T.significant) return 'none'
  return FULL_T.slope_decade > 0 ? 'warming' : 'cooling'
}

const SCALE = { W: 520, H: 108, left: 24, right: 24, axis: 52 }

function TotalScale({ guess, ci, total }: { guess: number; ci: [number, number]; total: number }) {
  const x = (v: number) => SCALE.left + ((v - GUESS.min) / (GUESS.max - GUESS.min)) * (SCALE.W - SCALE.left - SCALE.right)
  const ticks: number[] = []
  for (let v = GUESS.min; v <= GUESS.max; v += 1) ticks.push(v)
  return (
    <svg
      className="lve-scale"
      viewBox={`0 0 ${SCALE.W} ${SCALE.H}`}
      role="img"
      aria-label={S.scaleAria(one(guess), two(ci[0]), two(ci[1]))}
      data-testid="total-scale"
    >
      <line x1={x(GUESS.min)} x2={x(GUESS.max)} y1={SCALE.axis} y2={SCALE.axis} className="lve-scale__axis" />
      {ticks.map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={SCALE.axis - 4} y2={SCALE.axis + 4} className="lve-scale__axis" />
          <text x={x(v)} y={SCALE.axis + 20} textAnchor="middle" className="lvc-chart__tick">
            {v === 0 ? '0' : `${one(v)} °C`}
          </text>
        </g>
      ))}
      <rect x={x(ci[0])} y={SCALE.axis - 14} width={x(ci[1]) - x(ci[0])} height={28} className="lve-scale__range" />
      <text x={(x(ci[0]) + x(ci[1])) / 2} y={SCALE.axis + 40} textAnchor="middle" className="lve-scale__label">
        {S.scaleRange}
      </text>
      <line x1={x(total)} x2={x(total)} y1={SCALE.axis - 14} y2={SCALE.axis + 14} className="lve-scale__total" />
      <g className="lve-scale__guess">
        <polygon points={`${x(guess) - 7},${SCALE.axis - 34} ${x(guess) + 7},${SCALE.axis - 34} ${x(guess)},${SCALE.axis - 22}`} />
        <text x={x(guess)} y={SCALE.axis - 38} textAnchor="middle" className="lve-scale__label">
          {S.scaleGuess}
        </text>
      </g>
    </svg>
  )
}

export default function EbroLevel({ caseId, onExit, onResult }: CaseLevelProps) {
  const [phase, setPhase] = useState<1 | 2 | 3>(1)
  const [stage, setStage] = useState<Stage>('raw')
  const [a0, setA0] = useState<A0 | null>(null)
  const [a1, setA1] = useState<A1 | null>(null)
  const [guess, setGuess] = useState(GUESS.start)
  const [locked, setLocked] = useState(false)

  const correct1 = a1 === expected1()
  const correct2 = locked && guessInRange(guess)
  const score = Number(correct1) + Number(correct2)

  const subtracted = useCallback(() => setStage('anomalies'), [])

  function finish() {
    setPhase(3)
    onResult?.({ caseId, correct: score === 2, score })
  }

  const entry = getCaseEntry(caseId)
  const firstYear = TOTAL.first.slice(0, 4)
  const lastYear = TOTAL.last.slice(0, 4)
  const decades = TOTAL.decades.toFixed(1)

  return (
    <section className="lvc lvl-panel" data-testid="ebro-level">
      <p className="lvl-kicker">{S.kicker}</p>

      {phase === 1 && (
        <>
          <h2 className="lvc__title">{S.phase1Title}</h2>
          <p className="lvc__step">{S.phase1Kicker}</p>
          <p className="lvc__intro">{S.intro}</p>
          <p className="lvc__help">{S.phase1Help(FROM, TO)}</p>

          {stage === 'anomalies' ? (
            <AnomalyChart
              t={AN_T}
              values={AN_V}
              ariaLabel={S.anomalyChart}
              axisUnit={S.anomalyAxis}
              line={LINE}
              lineRange={[AN_T[0], AN_END]}
            />
          ) : (
            <SeasonChart
              t={RAW_T}
              values={RAW_V}
              months={MONTHS}
              typical={TYPICAL}
              showTypical={stage !== 'raw'}
              subtract={stage === 'subtracting'}
              onSubtracted={subtracted}
              ariaLabel={S.rawChart}
              axisUnit={S.rawAxis}
            />
          )}

          <fieldset className="lvc__question" disabled={!!a0}>
            <legend>{S.q0}</legend>
            {(Object.keys(S.q0Answers) as A0[]).map((a) => (
              <button
                key={a}
                type="button"
                className={a0 === a ? 'lvl-button lvc__choice lvc__choice--picked' : 'lvl-button lvc__choice'}
                onClick={() => setA0(a)}
              >
                {S.q0Answers[a]}
              </button>
            ))}
          </fieldset>
          {!a0 && <p className="lvc__help">{S.q0Note}</p>}

          {a0 && stage === 'raw' && (
            <div className="lvc__feedback" data-testid="build-step">
              <p>{S.buildHelp}</p>
              <button type="button" className="lvl-button" onClick={() => setStage('typical')}>
                {S.build}
              </button>
            </div>
          )}
          {stage === 'typical' && (
            <div className="lvc__feedback" data-testid="typical-step">
              <p>{S.typicalHelp(calendarMonth(COLD), TYPICAL[COLD].toFixed(1), calendarMonth(HOT), TYPICAL[HOT].toFixed(1))}</p>
              <button type="button" className="lvl-button" onClick={() => setStage('subtracting')}>
                {S.subtract}
              </button>
            </div>
          )}
          {stage === 'subtracting' && (
            <p className="lvc__help" role="status">
              {S.subtracting}
            </p>
          )}

          {stage === 'anomalies' && (
            <>
              <p className="lvc__help">{S.anomalyHelp}</p>
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
            </>
          )}
          {a1 && (
            <>
              <div className="lvc__feedback" role="status" data-testid="phase1-feedback">
                <p>
                  {a0 && S.before[a0]} {(correct1 ? S.fb1Right : S.fb1Wrong)(slopeText(FULL_T), SWING)}
                </p>
                <button type="button" className="lvl-button" onClick={() => setPhase(2)}>
                  {S.next}
                </button>
              </div>
              <TrendPanel title={S.panelTitle(FROM, TO)} result={FULL_T} unit={T2M_UNIT} testId="t2m-panel" />
            </>
          )}
        </>
      )}

      {phase === 2 && (
        <>
          <h2 className="lvc__title">{S.phase2Title}</h2>
          <p className="lvc__step">{S.phase2Kicker}</p>
          <p className="lvc__help">{S.phase2Help(slopeText(FULL_T), FROM, TO, decades)}</p>

          <fieldset className="lve-guess" disabled={locked}>
            <legend>{S.q2(FROM, TO)}</legend>
            <label className="lve-guess__label" htmlFor="lve-guess">
              <span>{S.guessLabel}</span>
              <strong data-testid="guess-value">{S.guessValue(one(guess))}</strong>
            </label>
            <input
              id="lve-guess"
              data-testid="guess-slider"
              type="range"
              min={GUESS.min}
              max={GUESS.max}
              step={GUESS.step}
              value={guess}
              aria-valuetext={S.guessValue(one(guess))}
              onChange={(e) => setGuess(Math.round(Number(e.target.value) * 10) / 10)}
            />
            {!locked && (
              <button type="button" className="lvl-button lve-guess__lock" onClick={() => setLocked(true)}>
                {S.lock}
              </button>
            )}
          </fieldset>

          {locked && (
            <>
              <TotalScale guess={guess} ci={TOTAL.ci} total={TOTAL.change} />
              <div className="lve-total" data-testid="total-reveal">
                <p className="lve-total__main">{S.totalLine(slopeText(FULL_T), TOTAL.decades.toFixed(2), two(TOTAL.change))}</p>
                <p>{S.rangeLine(two(TOTAL.ci[0]), two(TOTAL.ci[1]))}</p>
              </div>
              <div className="lvc__feedback" role="status" data-testid="phase2-feedback">
                <p>
                  <strong>{correct2 ? S.right : S.wrong}</strong>{' '}
                  {(correct2 ? S.fb2Right : S.fb2Wrong)(one(guess))} {S.fb2Help}
                </p>
                <p data-testid="precip-line">
                  {S.precipLine(pText(FULL_P), LEVEL.precip.first.slice(0, 4), LEVEL.precip.last.slice(0, 4), dataset(LEVEL.precip.dataset))}
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
        <div className="lvc__summary" data-testid="ebro-summary">
          <p className="lvc__step">{S.summaryKicker}</p>
          <h2 className="lvc__title">{S.summaryTitle}</h2>
          {entry?.question && <p className="lvc__intro">{entry.question}</p>}
          <ul className="lvc__keys">
            <li>{S.key1(SWING)}</li>
            <li>{S.key2(slopeText(FULL_T), pText(FULL_T))}</li>
            <li>{S.key3(two(TOTAL.change), two(TOTAL.ci[0]), two(TOTAL.ci[1]), firstYear, lastYear)}</li>
            <li>{S.key4(pText(FULL_P))}</li>
          </ul>
          <p className="lvc__score" data-testid="ebro-score">
            {S.score(score)}
          </p>
          {entry?.facts?.T2M && (
            <details className="lvc__facts">
              <summary>{S.factsTemp}</summary>
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

      <p className="lvc__credit">{S.credit(dataset(LEVEL.t2m.dataset), dataset(LEVEL.precip.dataset))}</p>
    </section>
  )
}
