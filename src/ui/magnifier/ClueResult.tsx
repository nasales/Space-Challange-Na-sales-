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
  { id: 'trend', label: 'The trend', short: 'Trend' },
  { id: 'series', label: 'Raw measurements', short: 'Raw' },
  { id: 'seasons', label: 'Seasons then and now', short: 'Seasons' },
  { id: 'years', label: 'Year by year', short: 'Years' },
  { id: 'method', label: 'How we know', short: 'Method' },
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
          Evidence file
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
          ← Back to the clues <kbd>Esc</kbd>
        </button>
      </header>

      <div className="clue-result__body">
        <EvidenceNotebook variable={variable} title={title} place={place} period={period} />

        <div className="clue-result__evidence">
          <div className="clue-result__tabs" role="tablist" aria-label="Evidence">
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
        <span>Data: NASA {dataset}</span>
        {distanceKm > 20 && <span>Nearest data cell: {distanceKm.toFixed(0)} km from here</span>}
        <span className="clue-result__foot-keys" aria-hidden="true">
          <kbd>1</kbd>–<kbd>5</kbd> evidence · <kbd>Esc</kbd> back
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
    const label =
      `Monthly ${title} with the seasonal cycle removed, ${years}, in ${units}. ` +
      (line
        ? `Trend line: ${fmtSigned(data.slope * 10)} ${units} per decade, ` +
          `${data.significant ? 'statistically significant' : 'not statistically significant'}.`
        : 'No trend line.')
    return (
      <Panel
        chart={<AnomalyChart dates={data.dates} anoms={anoms} units={units} label={label} line={line} band={band} significant={data.significant} />}
        legend={
          <>
            <Key swatch={<line x1="0" x2="26" y1="6" y2="6" className="clue-result__line clue-result__line--thin" />}>
              each month vs. normal
            </Key>
            {line && (
              <Key swatch={<line x1="2" x2="24" y1="6" y2="6" className="clue-result__trend" />}>
                trend ({fmtSigned(data.slope * 10)} {units}/decade)
              </Key>
            )}
            {band && <Key swatch={<rect width="26" height="12" className="clue-result__band" />}>95 % range</Key>}
          </>
        }
        caption={
          <>
            Seasons removed: every month is compared with its usual value, so <b>0 = a normal month</b>.
            {band && ' If a flat line fits inside the yellow range, the trend is not clear.'}
          </>
        }
      />
    )
  }

  if (tab === 'series') {
    const nums = data.values.filter((v): v is number => v != null)
    const avg = mean(nums)
    const label =
      avg == null
        ? `Monthly ${title}: no values`
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
            <Key swatch={<line x1="0" x2="26" y1="6" y2="6" className="clue-result__line" />}>every month as measured</Key>
            {avg != null && (
              <Key swatch={<line x1="0" x2="26" y1="6" y2="6" className="clue-result__mean" />}>
                average ({fmt(avg)} {units})
              </Key>
            )}
          </>
        }
        caption="The yearly up-and-down is just the seasons. That is why the trend is measured with the seasons removed."
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
                {cmp.first.label} (dashed, blue)
              </Key>
              <Key swatch={<line x1="0" x2="26" y1="6" y2="6" className="clue-result__series-b" />}>
                {cmp.last.label} (solid, orange)
              </Key>
            </>
          )
        }
        caption={
          cmp ? (
            <>
              Average of each month, January to December, in the first and the last {cmp.years} years.
              {diff != null && (
                <>
                  {' '}
                  On average: <b>{fmtSigned(diff)} {units}</b>.
                </>
              )}
            </>
          ) : (
            'Not enough years to compare.'
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
              <Key swatch={<rect width="26" height="12" className="clue-result__bar--up" />}>above average (orange)</Key>
              <Key swatch={<rect width="26" height="12" className="clue-result__bar--down" />}>below average (blue)</Key>
            </>
          )
        }
        caption={
          overall != null
            ? `One bar per year, measured from the average of all years (${fmt(overall)} ${units}, dashed). Years with fewer than 10 months of data are left out.`
            : 'Not enough complete years.'
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
    return 'Mann-Kendall trend test, corrected for the memory between one month and the next (pre-whitening, Yue & Wang 2002)'
  }
  if (id.includes('mann-kendall') || id.includes('mann_kendall')) return 'Mann-Kendall trend test'
  return test
}

const STEPS: { title: string; text: string }[] = [
  { title: 'Collect', text: 'One value per month for this place, from NASA data.' },
  { title: 'Remove the seasons', text: 'Each month minus the usual value of that month. What is left shows how unusual it was.' },
  { title: 'Measure the rate', text: 'Sen slope: the middle of the slopes between every pair of months, so odd months cannot bend it.' },
  { title: 'Check against chance', text: 'A test asks how often noise alone gives a trend this strong: the p-value. Below 0.05 = significant.' },
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
              <dt>Months used</dt>
              <dd>{validMonths(data.values, period)} (at least 120 needed)</dd>
            </div>
            <div>
              <dt>Period</dt>
              <dd>
                {monthLabel(data.dates[period.start])} to {monthLabel(data.dates[period.end])}
              </dd>
            </div>
          </>
        )}
        <div>
          <dt>Test</dt>
          <dd>{testInWords(data.test)}</dd>
        </div>
        <div>
          <dt>Dataset</dt>
          <dd>{data.dataset}</dd>
        </div>
        {distanceKm > 20 && (
          <div>
            <dt>Nearest data cell</dt>
            <dd>{distanceKm.toFixed(0)} km from here</dd>
          </div>
        )}
        <div>
          <dt>What is measured</dt>
          <dd>{variable.definition}</dd>
        </div>
      </dl>
    </div>
  )
}
