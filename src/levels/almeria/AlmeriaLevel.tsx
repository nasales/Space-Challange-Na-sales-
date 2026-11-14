// Level "Almería-Murcia drylands" (caseId "almeria_murcia"), the project's non-significant case.
// Lesson: absence of evidence is not evidence of absence.
//   Phase 1 "Negative but not proven": soil moisture trend is negative but p = 0.15 and the 95 % range
//     includes zero. Is the soil drying? Yes / No / We can't claim it.
//   Phase 2 "Shuffle the years": the player adds year shuffles to a dot histogram; the real slope sits
//     inside the cloud. Soil moisture first, then a quicker precipitation round.
// Official numbers come from almeria_level.json (pipeline/level_almeria.py, analyze_trend).
import { useEffect, useRef, useState } from 'react'
import AnomalyChart from '../common/AnomalyChart'
import { decimalYear, fmtP, fmtSlope, type TrendResult } from '../common/format'
import PValueMeter from '../common/PValueMeter'
import { senLine } from '../common/sen'
import TrendPanel from '../common/TrendPanel'
import { getCaseEntry } from '../data'
import type { CaseLevelProps } from '../types'
import { LEVEL, type ShuffleSet } from './data'
import ShuffleHistogram from './ShuffleHistogram'
import { S } from './strings'
import '../common/levels-common.css'
import './almeria.css'

type A1 = keyof typeof S.q1Answers
type A2 = keyof typeof S.q2Answers

const SOIL_T = LEVEL.soilm.anomalies.dates.map(decimalYear)
const SOIL_V = LEVEL.soilm.anomalies.values
const SOIL_END = SOIL_T[SOIL_T.length - 1] + 1 / 12
const SOIL_UNIT = LEVEL.soilm.units
const RAIN_UNIT = LEVEL.precip.units
const FULL_SOIL = LEVEL.full.soilm
const FULL_RAIN = LEVEL.full.precip
const N = LEVEL.shuffles.n

const SOIL_LINE = (() => {
  const xs: number[] = []
  const ys: number[] = []
  SOIL_V.forEach((v, i) => {
    if (v !== null) {
      xs.push(SOIL_T[i])
      ys.push(v)
    }
  })
  return senLine(xs, ys)
})()

function pText(r: TrendResult): string {
  return r.too_short ? '?' : fmtP(r.p_value, 2)
}

/** The answer the full record supports: significant -> its direction, otherwise "can't claim". */
function expected1(r: TrendResult): A1 {
  if (r.too_short || !r.significant) return 'cant'
  return r.slope_decade < 0 ? 'yes' : 'no'
}

function reducedMotion(): boolean {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

interface RoundProps {
  index: 1 | 2
  name: string
  unit: string
  set: ShuffleSet
  /** Quick round: a single "Shuffle all" button */
  quick?: boolean
  testId: string
  onDone: (correct: boolean) => void
  doneLabel: string
}

function ShuffleRound({ index, name, unit, set, quick, testId, onDone, doneLabel }: RoundProps) {
  const [answer, setAnswer] = useState<A2 | null>(null)
  const [shown, setShown] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearInterval(timer.current), [])

  const add = (k: number) => setShown((n) => Math.min(N, n + k))
  function addAll() {
    if (reducedMotion()) return setShown(N)
    window.clearInterval(timer.current)
    timer.current = window.setInterval(() => {
      setShown((n) => {
        const next = Math.min(N, n + 8)
        if (next >= N) window.clearInterval(timer.current)
        return next
      })
    }, 30)
  }

  const steep = set.slopes_decade.slice(0, shown).filter((s) => Math.abs(s) >= Math.abs(set.real_decade)).length
  const done = shown >= N
  const correct = answer === (set.stands_out ? 'yes' : 'no')
  const totalSteep = Math.round(set.share_as_steep * N)
  const pct = (set.share_as_steep * 100).toFixed(0)

  return (
    <div className="lva-round" data-testid={testId}>
      <h3 className="lva-round__title">{S.round(index, name)}</h3>
      <ShuffleHistogram
        slopes={set.slopes_decade}
        shown={shown}
        real={set.real_decade}
        ariaLabel={S.histogram(name)}
        realLabel={S.realLabel}
        axisLabel={S.axis(unit)}
        testId={`${testId}-hist`}
      />
      <fieldset className="lvc__question" disabled={!!answer}>
        <legend>{S.q2}</legend>
        {(Object.keys(S.q2Answers) as A2[]).map((a) => (
          <button
            key={a}
            type="button"
            className={answer === a ? 'lvl-button lvc__choice lvc__choice--picked' : 'lvl-button lvc__choice'}
            onClick={() => setAnswer(a)}
          >
            {S.q2Answers[a]}
          </button>
        ))}
      </fieldset>
      {!answer && <p className="lvc__help">{S.shuffleAfter}</p>}
      {answer && !done && (
        <div className="lvc__actions">
          {quick ? (
            <button type="button" className="lvl-button" onClick={addAll} data-testid={`${testId}-all`}>
              {S.shuffleAll(N)}
            </button>
          ) : (
            <>
              <button type="button" className="lvl-button" onClick={() => add(1)} data-testid={`${testId}-one`}>
                {S.shuffleOne}
              </button>
              <button type="button" className="lvl-button" onClick={() => add(20)} data-testid={`${testId}-many`}>
                {S.shuffleMany(20)}
              </button>
            </>
          )}
        </div>
      )}
      {answer && (
        <p className="lvc__counter" data-testid={`${testId}-counter`} aria-live="polite">
          {S.counter(shown, N, steep)}
        </p>
      )}
      {answer && done && (
        <div className="lvc__feedback" role="status" data-testid={`${testId}-feedback`}>
          <p>
            <strong>{correct ? S.right : S.wrong}</strong>{' '}
            {set.stands_out ? S.fb2Out(pct, totalSteep, N) : S.fb2Inside(pct, totalSteep, N)} {S.fb2Note}
          </p>
          <button type="button" className="lvl-button" onClick={() => onDone(correct)}>
            {doneLabel}
          </button>
        </div>
      )}
    </div>
  )
}

export default function AlmeriaLevel({ caseId, onExit, onResult }: CaseLevelProps) {
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1) // 2 = soil round, 3 = rain round, 4 = summary
  const [a1, setA1] = useState<A1 | null>(null)
  const [soilOk, setSoilOk] = useState(false)

  const correct1 = a1 === expected1(FULL_SOIL)
  const fan: [number, number] | undefined = FULL_SOIL.too_short
    ? undefined
    : [FULL_SOIL.ci_decade[0] / 10, FULL_SOIL.ci_decade[1] / 10]
  const [score, setScore] = useState(0)

  function finish(rainOk: boolean) {
    const s = Number(correct1) + Number(soilOk) + Number(rainOk)
    setScore(s)
    setPhase(4)
    onResult?.({ caseId, correct: s === 3, score: s })
  }

  const entry = getCaseEntry(caseId)
  const p1 = pText(FULL_SOIL)

  return (
    <section className="lvc lvl-panel" data-testid="almeria-level">
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
            line={SOIL_LINE}
            lineRange={[SOIL_T[0], SOIL_END]}
            fan={a1 ? fan : undefined}
          />
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
            <>
              <TrendPanel title={S.panelTitle} result={FULL_SOIL} unit={SOIL_UNIT} testId="soil-panel" digits={2} pDigits={2} />
              <PValueMeter p={FULL_SOIL.too_short ? null : FULL_SOIL.p_value} />
              <div className="lvc__feedback" role="status" data-testid="phase1-feedback">
                <p>
                  {!FULL_SOIL.too_short && FULL_SOIL.significant
                    ? S.fb1Sig(p1)
                    : a1 === 'cant'
                      ? S.fb1Right(p1)
                      : a1 === 'yes'
                        ? S.fb1Yes(p1)
                        : S.fb1No}
                </p>
                <button type="button" className="lvl-button" onClick={() => setPhase(2)}>
                  {S.next}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {(phase === 2 || phase === 3) && (
        <>
          <h2 className="lvc__title">{S.phase2Title}</h2>
          <p className="lvc__step">{S.phase2Kicker}</p>
          <p className="lvc__help">{S.phase2Help}</p>
          {phase === 2 ? (
            <ShuffleRound
              key="soil"
              index={1}
              name={S.soilName}
              unit={SOIL_UNIT}
              set={LEVEL.shuffles.soilm}
              testId="soil-round"
              doneLabel={S.nextRound}
              onDone={(ok) => {
                setSoilOk(ok)
                setPhase(3)
              }}
            />
          ) : (
            <ShuffleRound
              key="rain"
              index={2}
              name={S.rainName}
              unit={RAIN_UNIT}
              set={LEVEL.shuffles.precip}
              quick
              testId="rain-round"
              doneLabel={S.finish}
              onDone={finish}
            />
          )}
        </>
      )}

      {phase === 4 && (
        <div className="lvc__summary" data-testid="almeria-summary">
          <p className="lvc__step">{S.summaryKicker}</p>
          <h2 className="lvc__title">{S.summaryTitle}</h2>
          <ul className="lvc__keys">
            <li>{S.key1(FULL_SOIL.too_short ? '?' : fmtSlope(FULL_SOIL.slope_decade, 2), SOIL_UNIT, p1)}</li>
            <li>{S.key2(pText(FULL_RAIN))}</li>
            <li>{S.key3}</li>
          </ul>
          <p className="lvc__score" data-testid="almeria-score">
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
