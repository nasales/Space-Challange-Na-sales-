// The two half-width charts of the evidence sheet (plain SVG):
// - SeasonalChart: the 12-month cycle of the first years against the last years of the record;
// - AnnualChart: one bar per year, drawn from the average of all years (diverging colours).
import {
  MONTH_NAMES,
  fmt,
  fmtSigned,
  fmtTick,
  mean,
  niceTicks,
  yearTicks,
  type AnnualMean,
  type SeasonalComparison,
} from './analysis'
import { COMPACT, linePath, scale } from './chartKit'

const { W, H, l, r, t, b } = COMPACT

function YAxis({ ticks, sy, units }: { ticks: ReturnType<typeof niceTicks>; sy: (v: number) => number; units: string }) {
  return (
    <>
      <text x={6} y={13}>
        {units}
      </text>
      {ticks.values.map((v) => (
        <g key={v}>
          <line x1={l} x2={W - r} y1={sy(v)} y2={sy(v)} className="clue-result__grid" />
          <text x={l - 5} y={sy(v) + 4} textAnchor="end">
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
  const ticks = niceTicks(Math.min(...nums), Math.max(...nums), 4)
  const sx = scale(0, 11, l + 8, W - r - 8)
  const sy = scale(ticks.min, ticks.max, H - b, t)
  const diff = cmp.first.mean != null && cmp.last.mean != null ? cmp.last.mean - cmp.first.mean : null
  const label =
    `Seasonal cycle of ${title} in ${units}: average of each calendar month in ${cmp.first.label} and in ${cmp.last.label}.` +
    (diff != null ? ` The last period is ${fmtSigned(diff)} ${units} compared with the first, on average.` : '')

  return (
    <>
      <svg className="clue-result__chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <YAxis ticks={ticks} sy={sy} units={units} />
        {MONTH_NAMES.map((name, m) => (
          <text key={name} x={sx(m)} y={H - 7} textAnchor="middle">
            {name[0]}
          </text>
        ))}
        <path d={linePath(cmp.first.months, sx, sy)} className="clue-result__series-a" />
        <path d={linePath(cmp.last.months, sx, sy)} className="clue-result__series-b" />
      </svg>
      <ul className="clue-result__legend">
        <li>
          <svg viewBox="0 0 26 10" aria-hidden="true">
            <line x1="0" x2="26" y1="5" y2="5" className="clue-result__series-a" />
          </svg>
          {cmp.first.label} (dashed, blue)
        </li>
        <li>
          <svg viewBox="0 0 26 10" aria-hidden="true">
            <line x1="0" x2="26" y1="5" y2="5" className="clue-result__series-b" />
          </svg>
          {cmp.last.label} (solid, orange)
        </li>
      </ul>
      <p className="clue-result__caption">
        Average of each calendar month, January to December, in the first and the last {cmp.years} years.
        {diff != null &&
          cmp.first.mean != null &&
          cmp.last.mean != null &&
          ` Average of all months: ${fmt(cmp.first.mean)} then ${fmt(cmp.last.mean)} ${units} (${fmtSigned(diff)}).`}
      </p>
    </>
  )
}

export function AnnualChart({ annual, units, title }: { annual: AnnualMean[]; units: string; title: string }) {
  const overall = mean(annual.map((a) => a.mean))
  if (annual.length < 2 || overall == null) {
    return <p className="clue-result__empty">Not enough complete years (10 months or more) to draw yearly averages.</p>
  }
  const first = annual[0].year
  const last = annual[annual.length - 1].year
  const values = annual.map((a) => a.mean)
  const ticks = niceTicks(Math.min(...values), Math.max(...values), 4)
  const slot = (W - l - r) / (last - first + 1)
  const sx = (year: number) => l + (year - first + 0.5) * slot
  const sy = scale(ticks.min, ticks.max, H - b, t)
  const base = sy(overall)
  const above = annual.filter((a) => a.mean > overall).length
  const label =
    `Bar chart of the yearly average of ${title} in ${units}, ${first} to ${last}. ` +
    `${above} of ${annual.length} years are above the average of all years (${fmt(overall)} ${units}).`

  return (
    <>
      <svg className="clue-result__chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <YAxis ticks={ticks} sy={sy} units={units} />
        {yearTicks(first, last, 5).map((year) => (
          <text key={year} x={sx(year)} y={H - 7} textAnchor="middle">
            {year}
          </text>
        ))}
        {annual.map((a) => {
          const y = sy(a.mean)
          return (
            <rect
              key={a.year}
              x={sx(a.year) - slot * 0.4}
              width={slot * 0.8}
              y={Math.min(y, base)}
              height={Math.max(Math.abs(y - base), 0.5)}
              className={a.mean > overall ? 'clue-result__bar--up' : 'clue-result__bar--down'}
            >
              <title>{`${a.year}: ${fmt(a.mean)} ${units}`}</title>
            </rect>
          )
        })}
        <line x1={l} x2={W - r} y1={base} y2={base} className="clue-result__mean" />
      </svg>
      <ul className="clue-result__legend">
        <li>
          <svg viewBox="0 0 26 10" aria-hidden="true">
            <rect width="26" height="10" className="clue-result__bar--up" />
          </svg>
          above average (orange, bar goes up)
        </li>
        <li>
          <svg viewBox="0 0 26 10" aria-hidden="true">
            <rect width="26" height="10" className="clue-result__bar--down" />
          </svg>
          below average (blue, bar goes down)
        </li>
      </ul>
      <p className="clue-result__caption">
        One bar per year, measured from the average of all years ({fmt(overall)} {units}, dashed line). Years with
        fewer than 10 months of data are left out.
      </p>
    </>
  )
}
