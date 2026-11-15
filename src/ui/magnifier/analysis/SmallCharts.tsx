// Two more evidence charts (plain SVG, each fills its panel through ChartBox):
// - SeasonalChart: the 12-month cycle of the first years against the last years of the record;
// - AnnualChart: one bar per year, drawn from the average of all years (diverging colours).
// Legends and captions are drawn by ClueResult. Animation: lines revealed left to right, bars
// grow from the average line one after another (classes in ClueResult.css).
import type { CSSProperties } from 'react'
import { MONTH_NAMES, fmt, fmtSigned, fmtTick, mean, niceTicks, yearTicks, type AnnualMean, type SeasonalComparison } from './analysis'
import ChartBox from './ChartBox'
import { linePath, scale, type Frame } from './chartKit'

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
            <g className="clue-result__reveal">
              <path d={linePath(cmp.first.months, sx, sy)} className="clue-result__series-a" />
            </g>
            <g className="clue-result__reveal clue-result__reveal--late">
              <path d={linePath(cmp.last.months, sx, sy)} className="clue-result__series-b" />
              {cmp.last.months.map((v, m) =>
                v == null ? null : <circle key={m} cx={sx(m)} cy={sy(v)} r={3.5} className="clue-result__series-b-dot" />,
              )}
            </g>
          </svg>
        )
      }}
    </ChartBox>
  )
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
          </svg>
        )
      }}
    </ChartBox>
  )
}
