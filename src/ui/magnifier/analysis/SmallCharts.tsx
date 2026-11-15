// Two more evidence charts (plain SVG, each fills its panel through ChartBox):
// - SeasonalChart: the 12-month cycle of the first years against the last years of the record;
// - AnnualChart: one bar per year, drawn from the average of all years (diverging colours).
// Legends and captions are drawn by ClueResult. Animation: lines revealed left to right, bars
// grow from the average line one after another (classes in ClueResult.css). Then they stay alive:
// the gap between the two seasonal cycles fills with a hatch and the recent dots pulse in turn;
// the highest and the lowest year get a star badge.
import type { CSSProperties } from 'react'
import { MONTH_NAMES, fmt, fmtSigned, fmtTick, mean, niceTicks, yearTicks, type AnnualMean, type SeasonalComparison } from './analysis'
import ChartBox from './ChartBox'
import { extremes, linePath, scale, type Frame } from './chartKit'

function YAxis({ frame, ticks, sy, units }: { frame: Frame; ticks: ReturnType<typeof niceTicks>; sy: (v: number) => number; units: string }) {
  const { W, H, l, r, t, b } = frame
  return (
    <>
      <text x={8} y={15} className="clue-result__unit-label">
        {units}
      </text>
      {ticks.values.map((v) => (
        <g key={v}>
          <line x1={l} x2={W - r} y1={sy(v)} y2={sy(v)} className="clue-result__grid" />
          <text x={l - 6} y={sy(v) + 4} textAnchor="end">
            {fmtTick(v, ticks.decimals)}
          </text>
        </g>
      ))}
      <line x1={l} x2={W - r} y1={H - b} y2={H - b} className="clue-result__axis" />
      <line x1={l} x2={l} y1={t} y2={H - b} className="clue-result__axis" />
    </>
  )
}

export function SeasonalChart({ cmp, units, title }: { cmp: SeasonalComparison | null; units: string; title: string }) {
  const nums = cmp ? [...cmp.first.months, ...cmp.last.months].filter((v): v is number => v != null) : []
  if (!cmp || nums.length === 0) {
    return <p className="clue-result__empty">The record is too short to compare its first and last years.</p>
  }
  const diff = cmp.first.mean != null && cmp.last.mean != null ? cmp.last.mean - cmp.first.mean : null
  const label =
    `Seasonal cycle of ${title} in ${units}: average of each calendar month in ${cmp.first.label} and in ${cmp.last.label}.` +
    (diff != null ? ` The last period is ${fmtSigned(diff)} ${units} compared with the first, on average.` : '')

  return (
    <ChartBox>
      {(frame) => {
        const { W, H, l, r, t, b } = frame
        const ticks = niceTicks(Math.min(...nums), Math.max(...nums), H > 300 ? 6 : 4)
        const sx = scale(0, 11, l + 14, W - r - 14)
        const sy = scale(ticks.min, ticks.max, H - b, t)
        const wide = W > 520
        return (
          <svg className="clue-result__chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label}>
            <YAxis frame={frame} ticks={ticks} sy={sy} units={units} />
            {MONTH_NAMES.map((name, m) => (
              <text key={name} x={sx(m)} y={H - 9} textAnchor="middle">
                {wide ? name.slice(0, 3) : name[0]}
              </text>
            ))}
            <defs>
              <pattern id="clue-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="7" height="7" className="clue-result__hatch-bg" />
                <line x1="0" y1="0" x2="0" y2="7" className="clue-result__hatch-line" />
              </pattern>
            </defs>
            {gap(cmp, sx, sy) && <path d={gap(cmp, sx, sy) as string} className="clue-result__gap" fill="url(#clue-hatch)" />}
            <g className="clue-result__reveal">
              <path d={linePath(cmp.first.months, sx, sy)} className="clue-result__series-a" />
            </g>
            <g className="clue-result__reveal clue-result__reveal--late">
              <path d={linePath(cmp.last.months, sx, sy)} className="clue-result__series-b" />
              {cmp.last.months.map((v, m) =>
                v == null ? null : (
                  <circle
                    key={m}
                    cx={sx(m)}
                    cy={sy(v)}
                    r={4}
                    className="clue-result__series-b-dot"
                    style={{ '--i': m } as CSSProperties}
                  />
                ),
              )}
            </g>
          </svg>
        )
      }}
    </ChartBox>
  )
}

/** Area between the first and the last seasonal cycle (only when both have all 12 months). */
function gap(cmp: SeasonalComparison, sx: (m: number) => number, sy: (v: number) => number): string | null {
  const a = cmp.first.months
  const b = cmp.last.months
  if (a.length !== 12 || b.length !== 12 || a.some((v) => v == null) || b.some((v) => v == null)) return null
  const pts = [...a.map((v, m) => [sx(m), sy(v as number)]), ...b.map((v, m) => [sx(m), sy(v as number)]).reverse()]
  return `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`
}

/** Average of all yearly means (the zero line of the bar chart), or null. */
const annualOverall = (annual: AnnualMean[]) => mean(annual.map((a) => a.mean))

export function AnnualChart({ annual, units, title }: { annual: AnnualMean[]; units: string; title: string }) {
  const overall = annualOverall(annual)
  if (annual.length < 2 || overall == null) {
    return <p className="clue-result__empty">Not enough complete years (10 months or more) to draw yearly averages.</p>
  }
  const first = annual[0].year
  const last = annual[annual.length - 1].year
  const values = annual.map((a) => a.mean)
  const above = annual.filter((a) => a.mean > overall).length
  const label =
    `Bar chart of the yearly average of ${title} in ${units}, ${first} to ${last}. ` +
    `${above} of ${annual.length} years are above the average of all years (${fmt(overall)} ${units}).`

  return (
    <ChartBox>
      {(frame) => {
        const { W, H, l, r, t, b } = frame
        const ticks = niceTicks(Math.min(...values, overall), Math.max(...values, overall), H > 300 ? 6 : 4)
        const slot = (W - l - r) / (last - first + 1)
        const sx = (year: number) => l + (year - first + 0.5) * slot
        const sy = scale(ticks.min, ticks.max, H - b, t)
        const base = sy(overall)
        return (
          <svg className="clue-result__chart" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label}>
            <YAxis frame={frame} ticks={ticks} sy={sy} units={units} />
            {yearTicks(first, last, W < 420 ? 5 : 10).map((year) => (
              <text key={year} x={sx(year)} y={H - 9} textAnchor="middle">
                {year}
              </text>
            ))}
            {annual.map((a, i) => {
              const y = sy(a.mean)
              const up = a.mean > overall
              return (
                <rect
                  key={a.year}
                  x={sx(a.year) - slot * 0.38}
                  width={slot * 0.76}
                  y={Math.min(y, base)}
                  height={Math.max(Math.abs(y - base), 0.5)}
                  className={`clue-result__bar ${up ? 'clue-result__bar--up' : 'clue-result__bar--down'}`}
                  style={{ '--i': i } as CSSProperties}
                >
                  <title>{`${a.year}: ${fmt(a.mean)} ${units}`}</title>
                </rect>
              )
            })}
            <line x1={l} x2={W - r} y1={base} y2={base} className="clue-result__mean" />
            {(() => {
              const ex = extremes(values)
              if (!ex || ex.hi === ex.lo) return null
              return [
                { a: annual[ex.hi], word: 'Highest', up: true },
                { a: annual[ex.lo], word: 'Lowest', up: false },
              ].map(({ a, word, up }) => {
                const x = sx(a.year)
                const barEnd = sy(a.mean)
                const y = up ? Math.max(barEnd - 20, t + 12) : Math.min(barEnd + 20, H - b - 12)
                const anchor = x > W - r - 80 ? 'end' : x < l + 80 ? 'start' : 'middle'
                return (
                  <g key={word} className={`clue-result__badge clue-result__badge--${up ? 'hi' : 'lo'}`}>
                    <g transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
                      <path
                        d="M0,-9 L2.6,-3 L9,-2.8 L4,1.4 L5.6,8 L0,4.4 L-5.6,8 L-4,1.4 L-9,-2.8 L-2.6,-3 Z"
                        className="clue-result__badge-star"
                      />
                    </g>
                    <text x={x} y={up ? y - 13 : y + 22} textAnchor={anchor} className="clue-result__record-label">
                      {word}: {a.year}
                    </text>
                  </g>
                )
              })
            })()}
          </svg>
        )
      }}
    </ChartBox>
  )
}
