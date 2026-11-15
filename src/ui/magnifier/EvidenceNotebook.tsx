// Left side of the evidence file: the detective's notebook, in the look of the featured cases'
// notebook (src/ui/casefile/Notebook.tsx: spiral rings, ruled paper, pinned yellow note, red
// "Clue n" ink stamps, hand lettering). The case question is pinned at the top, the findings are
// written one by one as numbered clues while the charts draw, and the verdict stamp lands across
// the bottom of the page at the end. A non-significant trend is a valid result and is stamped so.
// The numbers are the pipeline's (slope, 95 % range, p-value); see ./analysis/analysis.ts.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { PointVariable } from '../../shared/pointAnalysis'
import { fmt, fmtP, fmtSigned, periodYears, totalChange, yearOf, type Period } from './analysis/analysis'
import { reducedMotion } from './analysis/chartKit'
import './EvidenceNotebook.css'

interface Props {
  variable: PointVariable
  title: string
  place: string
  period: Period | null
}

/** Counts a number up from zero once, then shows the exact formatted value. */
function CountUp({ value, format, delay = 0 }: { value: number; format: (x: number) => string; delay?: number }) {
  // Progress of the count, 0 to 1 (already 1 with reduced motion)
  const [k, setK] = useState(() => (reducedMotion() || !Number.isFinite(value) ? 1 : 0))
  useEffect(() => {
    if (k >= 1) return
    let frame = 0
    const start = performance.now() + delay
    const DURATION = 800
    const tick = (now: number) => {
      const next = Math.min(Math.max((now - start) / DURATION, 0), 1)
      setK(next)
      if (next < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // Runs once on mount; k only goes up to 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay])
  return <>{k >= 1 ? format(value) : format(value * (1 - (1 - k) ** 3))}</>
}

/** Where the p-value sits on the evidence meter: 0 = pure noise (p = 1), 1 = very strong (p ≤ 0.0001). */
const meterPos = (p: number) => Math.min(Math.max(-Math.log10(Math.max(p, 1e-12)) / 4, 0), 1)

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** Delay (ms) at which clue n is written: in step with the chart drawing on the right */
const clueAt = (n: number) => 250 + n * 260

function Clue({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="enb__clue" style={{ '--at': `${clueAt(n)}ms` } as CSSProperties}>
      <span className="enb__stamp" aria-hidden="true">
        Clue {n}
      </span>
      <span className="enb__clue-text">{children}</span>
    </li>
  )
}

export default function EvidenceNotebook({ variable, title, place, period }: Props) {
  const data = variable.data
  if (!data) return null
  const { slopeCiLow, slopeCiHigh } = variable.extra
  const units = data.units
  const perDecade = data.slope * 10
  const first = period ? yearOf(data.dates[period.start]) : data.dates.length ? yearOf(data.dates[0]) : null
  const p = fmtP(data.p_value)
  const up = data.slope > 0
  const kind = !data.significant ? 'flat' : up ? 'up' : 'down'
  const stampWord = kind === 'flat' ? 'No clear trend' : up ? 'Increasing' : 'Decreasing'
  const hasCi = slopeCiLow != null && slopeCiHigh != null
  const ciHasZero = hasCi && slopeCiLow <= 0 && slopeCiHigh >= 0
  let n = 0

  return (
    <aside className={`enb clue-result__verdict clue-result__verdict--${kind}`} aria-label="Detective's notebook">
      <div className="enb__page">
        <span className="enb__rings" aria-hidden="true" />
        <h4 className="enb__title">Detective&rsquo;s notebook</h4>

        <figure className="enb__question">
          <span className="enb__pin" aria-hidden="true" />
          <p className="enb__question-label">The question</p>
          <blockquote className="enb__question-text">
            Has {lowerFirst(title)} changed at {place}
            {first != null && ` since ${first}`}?
          </blockquote>
        </figure>

        <ol className="enb__clues">
          <Clue n={++n}>
            {data.significant ? (
              <>
                Goes {up ? 'up' : 'down'} by about{' '}
                <b>
                  <CountUp value={Math.abs(perDecade)} format={fmt} delay={clueAt(1)} /> {units}
                </b>{' '}
                every 10 years.
              </>
            ) : (
              <>
                No clear direction. Best estimate:{' '}
                <b>
                  {fmtSigned(perDecade)} {units}
                </b>{' '}
                per decade.
              </>
            )}
          </Clue>
          {period && (
            <Clue n={++n}>
              <b>
                <CountUp value={totalChange(data.slope, period)} format={fmtSigned} delay={clueAt(2)} /> {units}
              </b>{' '}
              in total since {first} <span className="enb__aside">(rate × {fmt(periodYears(period))} years)</span>.
            </Clue>
          )}
          {hasCi && (
            <Clue n={++n}>
              95 % sure the rate is between <b>{fmtSigned(slopeCiLow * 10)}</b> and <b>{fmtSigned(slopeCiHigh * 10)}</b> per
              decade{ciHasZero ? ', and that range includes zero.' : '.'}
            </Clue>
          )}
          <Clue n={n + 1}>
            Real or just noise? <b>{p}</b>
            <span className="enb__meter" aria-hidden="true">
              <span className="enb__meter-track">
                <span className="enb__meter-line" style={{ '--x': meterPos(0.05) } as CSSProperties}>
                  <i>0.05</i>
                </span>
                <span className="enb__meter-needle" style={{ '--x': meterPos(data.p_value) } as CSSProperties} />
              </span>
              <span className="enb__meter-ends">
                <span>could be noise</span>
                <span>clear signal</span>
              </span>
            </span>
          </Clue>
        </ol>

        <div className="enb__verdict">
          <div className="enb__verdict-stamp" role="img" aria-label={`Verdict: ${stampWord}`}>
            <span className="enb__verdict-word">
              <span aria-hidden="true">{kind === 'flat' ? '≈ ' : up ? '▲ ' : '▼ '}</span>
              {stampWord}
            </span>
            <span className="enb__verdict-sub">{data.significant ? 'Statistically significant' : 'Not significant'}</span>
          </div>
          <p className="enb__verdict-text">
            {data.significant
              ? `At ${place}, ${lowerFirst(title)} has ${up ? 'increased' : 'decreased'} by about ${fmt(Math.abs(perDecade))} ${units} per decade${first != null ? ` since ${first}` : ''}.`
              : 'No clear trend is a real answer, not proof that nothing changed.'}
          </p>
        </div>
      </div>
    </aside>
  )
}
