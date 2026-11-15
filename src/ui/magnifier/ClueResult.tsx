// Evidence file for one clue of the hand lens: the trend analysis of the chosen variable at the
// detective's point (database cell), full screen and without scrolling.
//   left:  the detective's notebook (EvidenceNotebook.tsx): the question, the findings as clues,
//          and the verdict stamp;
//   right: one large chart at a time, picked with evidence tabs (click, keys 1-5, or ← → on a tab).
// The charts draw themselves in while the clues are written, then the stamp lands; the charts
// then stay alive (scanning magnifier, record markers, pulses). A non-significant trend is a valid result
// and is stamped as such. Esc (or "Back to the clues") returns to the ring without closing the lens.
// Data: fetchPointAnalysis() in src/shared/pointAnalysis.ts (Supabase get_cell + trends table).
// The slope, its 95 % range and the p-value come from the statistics pipeline; this file and
// ./analysis/ only display them (see ./analysis/analysis.ts for the derived display numbers).
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import type { PointVariable } from '../../shared/pointAnalysis'
import {
  annualMeans,
  anomalies,
  ciBand,
  fmt,
  fmtSigned,
  mean,
  monthLabel,
  seasonalComparison,
  testPeriod,
  validMonths,
  trendLine,
  yearOf,
  type Period,
} from './analysis/analysis'
import AnomalyChart from './analysis/AnomalyChart'
import EvidenceNotebook from './EvidenceNotebook'
import { AnnualChart, SeasonalChart } from './analysis/SmallCharts'
import MonthlyPlot from './analysis/MonthlyPlot'
import './ClueResult.css'
import { L, LANG } from '../../shared/i18n'

interface Props {
  variable: PointVariable
  /** Name shown in the game (src/shared/variables.ts), falls back to the database name */
  title: string
  place: string
  /** Distance from the detective to the centre of the database cell, km */
  distanceKm: number
  onBack: () => void
}

type TabId = 'trend' | 'series' | 'seasons' | 'years' | 'method'
const TABS: { id: TabId; label: string; short: string }[] = [
  { id: 'trend', label: L('The trend', 'La tendencia'), short: L('Trend', 'Tendencia') },
  { id: 'series', label: L('Raw measurements', 'Medidas en bruto'), short: L('Raw', 'Bruto') },
  { id: 'seasons', label: L('Seasons then and now', 'Estaciones antes y ahora'), short: L('Seasons', 'Estaciones') },
  { id: 'years', label: L('Year by year', 'Año a año'), short: L('Years', 'Años') },
  { id: 'method', label: L('How we know', 'Cómo lo sabemos'), short: L('Method', 'Método') },
]

export default function ClueResult({ variable, title, place, distanceKm, onBack }: Props) {
  const back = useRef<HTMLButtonElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [tab, setTab] = useState<TabId>('trend')
  const data = variable.data

  useEffect(() => {
    back.current?.focus({ preventScroll: true })
  }, [])

  // Esc goes back to the clues; keys 1-5 pick a tab. Capture phase on window runs before the
  // picker's own Esc handler (which would close the whole lens), and stops it.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onBack()
        return
      }
      const digit = /^Digit([1-5])$/.exec(e.code)
      if (digit && !e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        e.stopImmediatePropagation()
        setTab(TABS[Number(digit[1]) - 1].id)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onBack])

  if (!data) return null
  const { extra } = variable
  const period = testPeriod(data.dates, data.values, extra.periodStart, extra.periodEnd)
  const last = data.dates.length - 1
  const years = last >= 0 ? `${yearOf(data.dates[0])}–${yearOf(data.dates[last])}` : ''
  const dataset = data.dataset.replace(/^NASA /, '')

  // Arrow keys move between tabs (roving focus, WAI-ARIA tabs pattern)
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    e.stopPropagation()
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : (index + delta + TABS.length) % TABS.length
    setTab(TABS[next].id)
    tabRefs.current[next]?.focus()
  }

  return (
    <section className="clue-result" aria-labelledby="clue-result-title">
      <header className="clue-result__head">
        <span className="clue-result__folder-tab" aria-hidden="true">
          {L('Evidence file', 'Expediente')}
        </span>
        <div className="clue-result__head-text">
          <p className="clue-result__kicker">
            {place}
            {years && ` · ${years}`}
          </p>
          <h3 id="clue-result-title" className="clue-result__title">
            {title} <span className="clue-result__unit">({data.units})</span>
          </h3>
        </div>
        <button ref={back} type="button" className="clue-result__btn" onClick={onBack} data-sfx="close">
          ← {L('Back to the clues', 'Volver a las pistas')} <kbd>Esc</kbd>
        </button>
      </header>

      <div className="clue-result__body">
        <EvidenceNotebook variable={variable} title={title} place={place} period={period} />

        <div className="clue-result__evidence">
          <div className="clue-result__tabs" role="tablist" aria-label={L('Evidence', 'Pruebas')}>
            {TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el
                }}
                type="button"
                role="tab"
                id={`clue-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="clue-tabpanel"
                tabIndex={tab === t.id ? 0 : -1}
                className="clue-result__tab"
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                <span className="clue-result__tab-n" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="clue-result__tab-long">{t.label}</span>
                <span className="clue-result__tab-short">{t.short}</span>
              </button>
            ))}
          </div>
          <div
            key={tab}
            id="clue-tabpanel"
            className="clue-result__panel"
            role="tabpanel"
            aria-labelledby={`clue-tab-${tab}`}
          >
            <EvidencePanel tab={tab} variable={variable} title={title} place={place} period={period} years={years} distanceKm={distanceKm} />
          </div>
        </div>
      </div>

      <footer className="clue-result__foot">
        <span>
          {L('Data: NASA', 'Datos: NASA')} {dataset}
        </span>
        {distanceKm > 20 && (
          <span>
            {L('Nearest data cell', 'Celda de datos más cercana')}: {distanceKm.toFixed(0)} {L('km from here', 'km de aquí')}
          </span>
        )}
        <span className="clue-result__foot-keys" aria-hidden="true">
          <kbd>1</kbd>–<kbd>5</kbd> {L('evidence', 'pruebas')} · <kbd>Esc</kbd> {L('back', 'volver')}
        </span>
      </footer>
    </section>
  )
}

/* ---------------------------------------------------------------------------------------------
   Evidence tabs
--------------------------------------------------------------------------------------------- */

function Panel({ chart, legend, caption }: { chart: ReactNode; legend?: ReactNode; caption: ReactNode }) {
  return (
    <>
      <div className="clue-result__chart-area">{chart}</div>
      <div className="clue-result__panel-foot">
        {legend && <ul className="clue-result__legend">{legend}</ul>}
        <p className="clue-result__caption">{caption}</p>
      </div>
    </>
  )
}

function Key({ children, swatch }: { children: ReactNode; swatch: ReactNode }) {
  return (
    <li>
      <svg viewBox="0 0 26 12" aria-hidden="true">
        {swatch}
      </svg>
      {children}
    </li>
  )
}

function EvidencePanel({
  tab,
  variable,
  title,
  place,
  period,
  years,
  distanceKm,
}: {
  tab: TabId
  variable: PointVariable
  title: string
  place: string
  period: Period | null
  years: string
  distanceKm: number
}) {
  const data = variable.data
  if (!data) return null
  const units = data.units

  if (tab === 'trend') {
    const anoms = anomalies(data.dates, data.values, variable.climatology)
    const line = period ? trendLine(anoms, data.slope, period) : null
    const band = line ? ciBand(line, variable.extra.slopeCiLow, variable.extra.slopeCiHigh) : null
    const slope10 = fmtSigned(data.slope * 10)
    const label =
      LANG === 'es'
        ? `${title} mensual sin el ciclo estacional, ${years}, en ${units}. ` +
          (line
            ? `Línea de tendencia: ${slope10} ${units} por década, ` +
              `${data.significant ? 'estadísticamente significativa' : 'no estadísticamente significativa'}.`
            : 'Sin línea de tendencia.')
        : `Monthly ${title} with the seasonal cycle removed, ${years}, in ${units}. ` +
          (line
            ? `Trend line: ${slope10} ${units} per decade, ` +
              `${data.significant ? 'statistically significant' : 'not statistically significant'}.`
            : 'No trend line.')
    return (
      <Panel
        chart={<AnomalyChart dates={data.dates} anoms={anoms} units={units} label={label} line={line} band={band} significant={data.significant} />}
        legend={
          <>
            <Key swatch={<line x1="0" x2="26" y1="6" y2="6" className="clue-result__line clue-result__line--thin" />}>
              {L('each month vs. normal', 'cada mes frente a lo normal')}
            </Key>
            {line && (
              <Key swatch={<line x1="2" x2="24" y1="6" y2="6" className="clue-result__trend" />}>
                {L('trend', 'tendencia')} ({slope10} {units}/{L('decade', 'década')})
              </Key>
            )}
            {band && <Key swatch={<rect width="26" height="12" className="clue-result__band" />}>{L('95 % range', 'intervalo del 95 %')}</Key>}
          </>
        }
        caption={
          LANG === 'es' ? (
            <>
              Sin estaciones: cada mes se compara con su valor habitual, así que <b>0 = un mes normal</b>.
              {band && ' Si una línea plana cabe dentro de la franja amarilla, la tendencia no está clara.'}
            </>
          ) : (
            <>
              Seasons removed: every month is compared with its usual value, so <b>0 = a normal month</b>.
              {band && ' If a flat line fits inside the yellow range, the trend is not clear.'}
            </>
          )
        }
      />
    )
  }

  if (tab === 'series') {
    const nums = data.values.filter((v): v is number => v != null)
    const avg = mean(nums)
    const label =
      avg == null
        ? L(`Monthly ${title}: no values`, `${title} mensual: sin valores`)
        : LANG === 'es'
          ? `Gráfico de líneas de ${title} mensual en ${units} en ${place}, ${years}. ` +
            `Mínimo ${fmt(Math.min(...nums))}, máximo ${fmt(Math.max(...nums))}, media ${fmt(avg)}.`
          : `Line chart of monthly ${title} in ${units} at ${place}, ${years}. ` +
            `Lowest ${fmt(Math.min(...nums))}, highest ${fmt(Math.max(...nums))}, average ${fmt(avg)}.`
    return (
      <Panel
        chart={
          <MonthlyPlot
            dates={data.dates}
            values={data.values}
            units={units}
            label={label}
            reference={avg != null ? { value: avg, className: 'clue-result__mean clue-result__mean--march' } : undefined}
            scan
            markers
          />
        }
        legend={
          <>
            <Key swatch={<line x1="0" x2="26" y1="6" y2="6" className="clue-result__line" />}>{L('every month as measured', 'cada mes tal como se midió')}</Key>
            {avg != null && (
              <Key swatch={<line x1="0" x2="26" y1="6" y2="6" className="clue-result__mean" />}>
                {L('average', 'media')} ({fmt(avg)} {units})
              </Key>
            )}
          </>
        }
        caption={L(
          'The yearly up-and-down is just the seasons. That is why the trend is measured with the seasons removed.',
          'El sube y baja de cada año son solo las estaciones. Por eso la tendencia se mide sin ellas.',
        )}
      />
    )
  }

  if (tab === 'seasons') {
    const cmp = period ? seasonalComparison(data.dates, data.values, period) : null
    const diff = cmp && cmp.first.mean != null && cmp.last.mean != null ? cmp.last.mean - cmp.first.mean : null
    return (
      <Panel
        chart={<SeasonalChart cmp={cmp} units={units} title={title} />}
        legend={
          cmp && (
            <>
              <Key swatch={<line x1="0" x2="26" y1="6" y2="6" className="clue-result__series-a" />}>
                {cmp.first.label} ({L('dashed, blue', 'discontinua, azul')})
              </Key>
              <Key swatch={<line x1="0" x2="26" y1="6" y2="6" className="clue-result__series-b" />}>
                {cmp.last.label} ({L('solid, orange', 'continua, naranja')})
              </Key>
            </>
          )
        }
        caption={
          cmp ? (
            <>
              {L(
                `Average of each month, January to December, in the first and the last ${cmp.years} years.`,
                `Media de cada mes, de enero a diciembre, en los primeros y los últimos ${cmp.years} años.`,
              )}
              {diff != null && (
                <>
                  {' '}
                  {L('On average:', 'De media:')} <b>{fmtSigned(diff)} {units}</b>.
                </>
              )}
            </>
          ) : (
            L('Not enough years to compare.', 'No hay años suficientes para comparar.')
          )
        }
      />
    )
  }

  if (tab === 'years') {
    const annual = annualMeans(data.dates, data.values)
    const overall = mean(annual.map((a) => a.mean))
    return (
      <Panel
        chart={<AnnualChart annual={annual} units={units} title={title} />}
        legend={
          overall != null && (
            <>
              <Key swatch={<rect width="26" height="12" className="clue-result__bar--up" />}>{L('above average (orange)', 'por encima de la media (naranja)')}</Key>
              <Key swatch={<rect width="26" height="12" className="clue-result__bar--down" />}>{L('below average (blue)', 'por debajo de la media (azul)')}</Key>
            </>
          )
        }
        caption={
          overall != null
            ? L(
                `One bar per year, measured from the average of all years (${fmt(overall)} ${units}, dashed). Years with fewer than 10 months of data are left out.`,
                `Una barra por año, medida desde la media de todos los años (${fmt(overall)} ${units}, discontinua). Se quitan los años con menos de 10 meses de datos.`,
              )
            : L('Not enough complete years.', 'No hay años completos suficientes.')
        }
      />
    )
  }

  return <Method variable={variable} period={period} distanceKm={distanceKm} />
}

/** Name of the significance test in plain words (CaseData.test is a machine id). */
function testInWords(test: string): string {
  const id = test.toLowerCase()
  if (id.includes('prewhitening') || id.includes('pre-whitening')) {
    return L(
      'Mann-Kendall trend test, corrected for the memory between one month and the next (pre-whitening, Yue & Wang 2002)',
      'Test de tendencia de Mann-Kendall, corregido por la memoria entre un mes y el siguiente (pre-whitening, Yue & Wang 2002)',
    )
  }
  if (id.includes('mann-kendall') || id.includes('mann_kendall')) return L('Mann-Kendall trend test', 'Test de tendencia de Mann-Kendall')
  return test
}

const STEPS: { title: string; text: string }[] = [
  {
    title: L('Collect', 'Recoger'),
    text: L('One value per month for this place, from NASA data.', 'Un valor por mes para este lugar, con datos de la NASA.'),
  },
  {
    title: L('Remove the seasons', 'Quitar las estaciones'),
    text: L(
      'Each month minus the usual value of that month. What is left shows how unusual it was.',
      'Cada mes menos el valor habitual de ese mes. Lo que queda muestra lo raro que fue.',
    ),
  },
  {
    title: L('Measure the rate', 'Medir el ritmo'),
    text: L(
      'Sen slope: the middle of the slopes between every pair of months, so odd months cannot bend it.',
      'Pendiente de Sen: la mediana de las pendientes entre cada par de meses, así los meses raros no la tuercen.',
    ),
  },
  {
    title: L('Check against chance', 'Descartar el azar'),
    text: L(
      'A test asks how often noise alone gives a trend this strong: the p-value. Below 0.05 = significant.',
      'Un test mira cada cuánto el puro ruido da una tendencia así de fuerte: el valor p. Por debajo de 0,05 = significativa.',
    ),
  },
]

function Method({ variable, period, distanceKm }: { variable: PointVariable; period: Period | null; distanceKm: number }) {
  const data = variable.data
  if (!data) return null
  return (
    <div className="clue-result__method">
      <ol className="clue-result__steps">
        {STEPS.map((s, i) => (
          <li key={s.title} style={{ '--i': i } as CSSProperties}>
            <span className="clue-result__step-n" aria-hidden="true">
              {i + 1}
            </span>
            <b>{s.title}</b>
            <span>{s.text}</span>
          </li>
        ))}
      </ol>
      <dl className="clue-result__facts">
        {period && (
          <>
            <div>
              <dt>{L('Months used', 'Meses usados')}</dt>
              <dd>
                {validMonths(data.values, period)} {L('(at least 120 needed)', '(hacen falta al menos 120)')}
              </dd>
            </div>
            <div>
              <dt>{L('Period', 'Periodo')}</dt>
              <dd>
                {monthLabel(data.dates[period.start])} {L('to', 'a')} {monthLabel(data.dates[period.end])}
              </dd>
            </div>
          </>
        )}
        <div>
          <dt>{L('Test', 'Prueba')}</dt>
          <dd>{testInWords(data.test)}</dd>
        </div>
        <div>
          <dt>{L('Dataset', 'Conjunto de datos')}</dt>
          <dd>{data.dataset}</dd>
        </div>
        {distanceKm > 20 && (
          <div>
            <dt>{L('Nearest data cell', 'Celda de datos más cercana')}</dt>
            <dd>
              {distanceKm.toFixed(0)} {L('km from here', 'km de aquí')}
            </dd>
          </div>
        )}
        <div>
          <dt>{L('What is measured', 'Qué se mide')}</dt>

          <dd>{variable.definition}</dd>
        </div>
      </dl>
    </div>
  )
}
