// Level "Valencia DANA" (caseId "dana_valencia").
// Lesson: a record event is not a trend; a warming background is.
//   Phase 1 "Find the flood": the player picks the month they think is October 2024 on the rain chart,
//   then it is revealed; is there a significant rain trend (with and without that month)?
//   Phase 2 "The warm background": air temperature anomalies; is the air warming?
// Score: 1 point for finding the flood month (within FIND_TOLERANCE months) + 1 per question.
// onResult "correct" = both trend questions right (the lesson). Official numbers come from
// dana_level.json (pipeline/level_dana.py, analyze_trend). The Sen lines here are for drawing only.
import { useRef, useState, type MouseEvent } from 'react'
import AnomalyChart from '../common/AnomalyChart'
import { decimalYear, fmtP, fmtSlope, type TrendResult } from '../common/format'
import { senLine } from '../common/sen'
import TrendPanel from '../common/TrendPanel'
import { getCaseEntry } from '../data'
import type { CaseLevelProps } from '../types'
import { FIND_TOLERANCE, LEVEL, monthLabel } from './data'
import { S } from './strings'
import '../common/levels-common.css'
import './dana.css'

type A1 = keyof typeof S.q1Answers
type A2 = keyof typeof S.q2Answers

// Chart geometry: same viewBox and padding as ../common/AnomalyChart (PAD left 46, right 14, top 14, bottom 30).
const CHART_W = 720
const CHART_H = 300
const PAD_L = 46
const PAD_R = 14
const PAD_T = 14
const PAD_B = 30

function prepare(series: typeof LEVEL.precip) {
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
  return { t, v, dates: series.anomalies.dates, line: senLine(xs, ys), end: t[t.length - 1] + 1 / 12 }
}

const RAIN = prepare(LEVEL.precip)
const TEMP = prepare(LEVEL.t2m)
const RAIN_UNIT = LEVEL.precip.units
const FLOOD = LEVEL.flood
const N_RAIN = RAIN.dates.length
const WITH = LEVEL.precip_trend.with_flood
const WITHOUT = LEVEL.precip_trend.without_flood
const T2M = LEVEL.t2m_trend.full

/** x of month index i in the chart, as a percentage of the chart width. */
function xPercent(i: number): number {
  return ((PAD_L + (i / N_RAIN) * (CHART_W - PAD_L - PAD_R)) / CHART_W) * 100
}

function pText(r: TrendResult): string {
  return r.too_short ? '?' : fmtP(r.p_value, 3)
}

function slopeText(r: TrendResult, digits = 2): string {
  return r.too_short ? '?' : fmtSlope(r.slope_decade, digits)
}

const num = (x: number, digits = 1) => x.toFixed(digits)

/** Phase 1 answer supported by the rain trends (with and without the flood). */
function expected1(): A1 {
  const sig = [WITH, WITHOUT].filter((r) => !r.too_short && r.significant)
  if (sig.length === 0) return 'no'
  return sig.every((r) => !r.too_short && r.slope_decade > 0) ? 'up' : 'down'
}

/** Phase 2 answer supported by the temperature trend. */
function expected2(): A2 {
  if (T2M.too_short) return 'unsure'
  if (!T2M.significant) return 'unsure'
  return T2M.slope_decade > 0 ? 'yes' : 'no'
}

export default function DanaLevel({ caseId, onExit, onResult }: CaseLevelProps) {
  const [phase, setPhase] = useState<1 | 2 | 3>(1)
  const [pick, setPick] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)
  const [a1, setA1] = useState<A1 | null>(null)
  const [a2, setA2] = useState<A2 | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  const distance = pick === null ? null : Math.abs(pick - FLOOD.index)
  const found = distance !== null && distance <= FIND_TOLERANCE
  const correct1 = a1 === expected1()
  const correct2 = a2 === expected2()
  const score = Number(locked && found) + Number(correct1) + Number(correct2)

  function pickAt(e: MouseEvent<HTMLDivElement>) {
    if (locked) return
    const svg = chartRef.current?.querySelector('svg')
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * CHART_W
    const i = Math.round(((px - PAD_L) / (CHART_W - PAD_L - PAD_R)) * N_RAIN)
    setPick(Math.min(N_RAIN - 1, Math.max(0, i)))
  }

  function finish() {
    setPhase(3)
    onResult?.({ caseId, correct: correct1 && correct2, score })
  }

  const entry = getCaseEntry(caseId)
  const pickMonth = pick === null ? '' : monthLabel(RAIN.dates[pick])
  const pickText =
    distance === null
      ? ''
      : distance === 0
        ? S.found(pickMonth)
        : found
          ? S.close(pickMonth, distance)
          : S.far(pickMonth, distance)

  return (
    <section className="lvc lvl-panel" data-testid="dana-level">
      <p className="lvl-kicker">{S.kicker}</p>

      {phase === 1 && (
        <>
          <h2 className="lvc__title">{S.phase1Title}</h2>
          <p className="lvc__step">{S.phase1Kicker}</p>
          <p className="lvc__intro">{S.intro}</p>
          <p className="lvc__help">{S.phase1Help}</p>

          <div
            ref={chartRef}
            className={locked ? 'lvd-pick' : 'lvd-pick lvd-pick--open'}
            data-testid="flood-chart"
            onClick={pickAt}
          >
            <AnomalyChart
              t={RAIN.t}
              values={RAIN.v}
              ariaLabel={S.rainChart}
              axisUnit={S.rainAxis}
              line={a1 ? RAIN.line : null}
              lineRange={[RAIN.t[0], RAIN.end]}
              marker={
                locked
                  ? { index: FLOOD.index, icon: '🌧️', label: S.floodLabel, ariaLabel: S.floodAria, testId: 'flood-marker' }
                  : undefined
              }
              height={CHART_H}
              width={CHART_W}
              lineTestId="rain-line"
            />
            {pick !== null && (
              <span
                className="lvd-pick__line"
                data-testid="pick-line"
                aria-hidden="true"
                style={{
                  left: `${xPercent(pick)}%`,
                  top: `${(PAD_T / CHART_H) * 100}%`,
                  height: `${((CHART_H - PAD_T - PAD_B) / CHART_H) * 100}%`,
                }}
              >
                <span className={xPercent(pick) > 75 ? 'lvd-pick__label lvd-pick__label--left' : 'lvd-pick__label'}>
                  {pickMonth}
                </span>
              </span>
            )}
          </div>

          {!locked && (
            <div className="lvd-controls">
              <label className="lvd-controls__label" htmlFor="lvd-month">
                <span>{S.pickSlider}</span>
                <strong data-testid="pick-month">{pick === null ? S.noPick : pickMonth}</strong>
              </label>
              <input
                id="lvd-month"
                data-testid="pick-slider"
                type="range"
                min={0}
                max={N_RAIN - 1}
                step={1}
                value={pick ?? Math.floor(N_RAIN / 2)}
                aria-valuetext={pick === null ? S.noPick : S.pickAria(pickMonth)}
                onChange={(e) => setPick(Number(e.target.value))}
              />
              <button type="button" className="lvl-button" disabled={pick === null} onClick={() => setLocked(true)}>
                {S.confirmPick}
              </button>
            </div>
          )}

          {locked && (
            <>
              <div className="lvc__feedback" role="status" data-testid="pick-feedback">
                <p>
                  <strong>{pickText}</strong>{' '}
                  {S.reveal(num(FLOOD.value), RAIN_UNIT, num(FLOOD.same_month_mean), FLOOD.rank, FLOOD.n_months)}{' '}
                  {S.revealWhy(monthLabel(FLOOD.wettest_month))}
                </p>
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
            </>
          )}

          {a1 && (
            <>
              <div className="lvc__compare">
                <TrendPanel title={S.withFlood} result={WITH} unit={RAIN_UNIT} testId="with-panel" />
                <TrendPanel title={S.withoutFlood} result={WITHOUT} unit={RAIN_UNIT} testId="without-panel" />
              </div>
              <div className="lvc__feedback" role="status" data-testid="phase1-feedback">
                <p>{(correct1 ? S.fb1Right : S.fb1Wrong)(pText(WITH), pText(WITHOUT))}</p>
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
          <p className="lvc__help">{S.phase2Help}</p>
          <AnomalyChart
            t={TEMP.t}
            values={TEMP.v}
            ariaLabel={S.tempChart}
            axisUnit={S.tempAxis}
            line={TEMP.line}
            lineRange={[TEMP.t[0], TEMP.end]}
            lineTestId="temp-line"
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
              <TrendPanel title={S.tempPanel} result={T2M} unit={LEVEL.t2m.units} testId="temp-panel" />
              <div className="lvc__feedback" role="status" data-testid="phase2-feedback">
                <p>
                  <strong>{correct2 ? S.right : S.wrong}</strong>{' '}
                  {S.fb2(num(LEVEL.t2m_trend.total_change), String(Math.round(LEVEL.t2m_trend.water_capacity_gain * 100)))}
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
        <div className="lvc__summary" data-testid="dana-summary">
          <p className="lvc__step">{S.summaryKicker}</p>
          <h2 className="lvc__title">{S.summaryTitle}</h2>
          <ul className="lvc__keys">
            <li>{S.key1(slopeText(WITH), RAIN_UNIT, pText(WITH))}</li>
            <li>{S.key2(slopeText(T2M), pText(T2M))}</li>
            <li>{S.key3}</li>
          </ul>
          <p className="lvc__score" data-testid="dana-score">
            {S.score(score, 3)}
          </p>
          {entry?.facts?.PRECIP && (
            <details className="lvc__facts">
              <summary>{S.factsRain}</summary>
              <pre>{entry.facts.PRECIP}</pre>
            </details>
          )}
          {entry?.facts?.T2M && (
            <details className="lvc__facts">
              <summary>{S.factsTemp}</summary>
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
