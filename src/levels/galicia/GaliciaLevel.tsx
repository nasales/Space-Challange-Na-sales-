// Level "Galicia fires" (caseId "galicia_fires").
// Lesson: the p-value is not the size of the change.
//   Phase 1 "Twin forests": Galicia and Sierra de la Culebra topsoil moisture side by side, no numbers.
//   Phase 2 "Why the difference?": slope, noise and months of both; why is Galicia not significant?
//   Phase 3 "The other clue": Galicia's air temperature.
// Official numbers and the right answers come from galicia_level.json (pipeline/level_galicia.py,
// analyze_trend). The Sen lines here are for drawing only.
import { useState } from 'react'
import AnomalyChart from '../common/AnomalyChart'
import { decimalYear, fmtP, fmtSlope, type TrendResult } from '../common/format'
import { senLine } from '../common/sen'
import TrendPanel from '../common/TrendPanel'
import { getCaseEntry } from '../data'
import type { CaseLevelProps } from '../types'
import { LEVEL, type Series, type TwinsAnswer, type WarmingAnswer, type WhyAnswer } from './data'
import { S } from './strings'
import '../common/levels-common.css'
import './galicia.css'

const SOIL_SHORT = 'kg/m²'

function prepare(series: Series) {
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

const G_SOIL = prepare(LEVEL.galicia_soilm)
const C_SOIL = prepare(LEVEL.culebra_soilm)
const G_TEMP = prepare(LEVEL.galicia_t2m)
const TR = LEVEL.trends
const WHY = LEVEL.why

function pText(r: TrendResult): string {
  return r.too_short ? '?' : fmtP(r.p_value, 3)
}

function slopeText(r: TrendResult, digits = 2): string {
  return r.too_short ? '?' : fmtSlope(r.slope_decade, digits)
}

function slopeAbs(r: TrendResult): number {
  return r.too_short ? 0 : Math.abs(r.slope_decade)
}

interface BarRowProps {
  label: string
  galicia: number
  culebra: number
  galiciaText: string
  culebraText: string
  testId: string
}

function BarRow({ label, galicia, culebra, galiciaText, culebraText, testId }: BarRowProps) {
  const max = Math.max(galicia, culebra) || 1
  return (
    <div className="lvga-row" data-testid={testId}>
      <p className="lvga-row__label">{label}</p>
      {[
        { name: S.galiciaName, value: galicia, text: galiciaText, cls: 'lvga-bar__fill lvga-bar__fill--g' },
        { name: S.culebraName, value: culebra, text: culebraText, cls: 'lvga-bar__fill lvga-bar__fill--c' },
      ].map((b) => (
        <div className="lvga-bar" key={b.name}>
          <span className="lvga-bar__name">{b.name}</span>
          <span className="lvga-bar__track">
            <span className={b.cls} style={{ width: `${(b.value / max) * 100}%` }} />
          </span>
          <strong className="lvga-bar__value">{b.text}</strong>
        </div>
      ))}
    </div>
  )
}

export default function GaliciaLevel({ caseId, onExit, onResult }: CaseLevelProps) {
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1)
  const [a1, setA1] = useState<TwinsAnswer | null>(null)
  const [a2, setA2] = useState<WhyAnswer | null>(null)
  const [a3, setA3] = useState<WarmingAnswer | null>(null)

  const correct1 = a1 === LEVEL.twins.answer
  const correct2 = a2 === WHY.answer
  const correct3 = a3 === LEVEL.warming.answer
  const score = Number(correct1) + Number(correct2) + Number(correct3)

  function finish() {
    setPhase(4)
    onResult?.({ caseId, correct: score === 3, score })
  }

  const entry = getCaseEntry(caseId)
  const gs = TR.galicia_soilm
  const cs = TR.culebra_soilm
  const f = WHY.factors

  return (
    <section className="lvc lvl-panel" data-testid="galicia-level">
      <p className="lvl-kicker">{S.kicker}</p>

      {phase === 1 && (
        <>
          <h2 className="lvc__title">{S.phase1Title}</h2>
          <p className="lvc__step">{S.phase1Kicker}</p>
          <p className="lvc__intro">{S.intro}</p>
          <p className="lvc__help">{S.phase1Help}</p>
          <div className="lvc__pair">
            <figure>
              <figcaption>{S.galiciaName}</figcaption>
              <AnomalyChart
                t={G_SOIL.t}
                values={G_SOIL.v}
                ariaLabel={S.soilChart(S.galiciaName)}
                axisUnit={S.soilAxis}
                line={G_SOIL.line}
                lineRange={G_SOIL.range}
                height={300}
                width={440}
                lineTestId="galicia-line"
              />
              {a1 && <TrendPanel title={S.soilVar} result={gs} unit={LEVEL.galicia_soilm.units} testId="galicia-panel" />}
            </figure>
            <figure>
              <figcaption>{S.culebraName}</figcaption>
              <AnomalyChart
                t={C_SOIL.t}
                values={C_SOIL.v}
                ariaLabel={S.soilChart(S.culebraName)}
                axisUnit={S.soilAxis}
                line={C_SOIL.line}
                lineRange={C_SOIL.range}
                height={300}
                width={440}
                lineTestId="culebra-line"
              />
              {a1 && <TrendPanel title={S.soilVar} result={cs} unit={LEVEL.culebra_soilm.units} testId="culebra-panel" />}
            </figure>
          </div>

          <fieldset className="lvc__question" disabled={!!a1}>
            <legend>{S.q1}</legend>
            {(Object.keys(S.q1Answers) as TwinsAnswer[]).map((a) => (
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
                {S.fb1(slopeText(gs), pText(gs), slopeText(cs), pText(cs), SOIL_SHORT)} {S.fb1Note}
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
          <p className="lvc__help">{S.phase2Help}</p>
          <div className="lvga-compare lvl-panel" aria-label={S.compareTitle}>
            <p className="lvga-compare__title">{S.compareTitle}</p>
            <BarRow
              label={S.rowSlope}
              galicia={slopeAbs(gs)}
              culebra={slopeAbs(cs)}
              galiciaText={`${slopeText(gs)} ${SOIL_SHORT}`}
              culebraText={`${slopeText(cs)} ${SOIL_SHORT}`}
              testId="row-slope"
            />
            <BarRow
              label={S.rowNoise}
              galicia={WHY.galicia.residual_sd}
              culebra={WHY.culebra.residual_sd}
              galiciaText={`${WHY.galicia.residual_sd.toFixed(2)} ${SOIL_SHORT}`}
              culebraText={`${WHY.culebra.residual_sd.toFixed(2)} ${SOIL_SHORT}`}
              testId="row-noise"
            />
            <BarRow
              label={S.rowData}
              galicia={WHY.galicia.n_months}
              culebra={WHY.culebra.n_months}
              galiciaText={String(WHY.galicia.n_months)}
              culebraText={String(WHY.culebra.n_months)}
              testId="row-data"
            />
          </div>

          <fieldset className="lvc__question" disabled={!!a2}>
            <legend>{S.q2}</legend>
            {(Object.keys(S.q2Answers) as WhyAnswer[]).map((a) => (
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
                {S.fbSlope(S.cmp(f.slope, 'bigger than', `${Math.round((1 - f.slope) * 100)}% smaller than`), slopeText(gs), slopeText(cs), SOIL_SHORT)}{' '}
                {S.fbNoise(S.cmp(1 / f.noise, 'bigger than', 'smaller than'), WHY.galicia.residual_sd.toFixed(2), WHY.culebra.residual_sd.toFixed(2), SOIL_SHORT)}{' '}
                {S.fbData(S.cmp(f.data, 'more', 'fewer'), WHY.galicia.n_months, WHY.culebra.n_months)}{' '}
                {S.fbAnswer(S.q2Answers[WHY.answer])}
                {WHY.galicia.rho > WHY.culebra.rho + 0.05 && <> {S.fbRho(WHY.galicia.rho.toFixed(2), WHY.culebra.rho.toFixed(2))}</>}
              </p>
              <p>{S.fbLesson(pText(gs), pText(cs))}</p>
              <button type="button" className="lvl-button" onClick={() => setPhase(3)}>
                {S.next}
              </button>
            </div>
          )}
        </>
      )}

      {phase === 3 && (
        <>
          <h2 className="lvc__title">{S.phase3Title}</h2>
          <p className="lvc__step">{S.phase3Kicker}</p>
          <p className="lvc__help">{S.phase3Help}</p>
          <figure className="lvga-figure">
            <figcaption>{S.tempVar}</figcaption>
            <AnomalyChart
              t={G_TEMP.t}
              values={G_TEMP.v}
              ariaLabel={S.tempChart}
              axisUnit={S.tempAxis}
              line={G_TEMP.line}
              lineRange={G_TEMP.range}
              lineTestId="temp-line"
            />
          </figure>
          {a3 && <TrendPanel title={S.fullRecord} result={TR.galicia_t2m} unit={LEVEL.galicia_t2m.units} testId="temp-panel" />}

          <fieldset className="lvc__question" disabled={!!a3}>
            <legend>{S.q3}</legend>
            {(Object.keys(S.q3Answers) as WarmingAnswer[]).map((a) => (
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
                <strong>{correct3 ? S.right : S.wrong}</strong> {S.fb3(slopeText(TR.galicia_t2m), pText(TR.galicia_t2m))}
              </p>
              <button type="button" className="lvl-button" onClick={finish}>
                {S.finish}
              </button>
            </div>
          )}
        </>
      )}

      {phase === 4 && (
        <div className="lvc__summary" data-testid="galicia-summary">
          <p className="lvc__step">{S.summaryKicker}</p>
          <h2 className="lvc__title">{S.summaryTitle}</h2>
          <ul className="lvc__keys">
            <li>{S.key1(slopeText(TR.galicia_t2m), pText(TR.galicia_t2m))}</li>
            <li>{S.key2(slopeText(gs), pText(gs), SOIL_SHORT)}</li>
            <li>{S.key3(slopeText(cs), pText(cs), SOIL_SHORT)}</li>
            <li>{S.key4}</li>
          </ul>
          <p className="lvc__score" data-testid="galicia-score">
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

      <p className="lvc__credit">{S.credit(LEVEL.galicia_t2m.dataset, LEVEL.galicia_soilm.dataset)}</p>
    </section>
  )
}
