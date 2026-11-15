// Real-data charts of chapter 2: the forest plot and the table of the featured places, and the
// share of map cells with a significant trend. Each chart row is an HTML grid row (label + inline
// SVG), and the SVGs use percentage x positions, so the charts stay readable at phone width.
import { niceTicks, fmtSigned, fmtTick } from '../../magnifier/analysis/analysis'
import { L, fmtNumber } from '../../../shared/i18n'
import {
  CASE_VARS,
  FEATURED_ROWS,
  isBorderline,
  useIntervals,
  type CaseVar,
  type FeaturedRow,
  type Intervals,
} from './featuredResults'

// x positions run from 4 % to 96 % of the track, leaving room for dots and tick labels
const PAD = 4
const toPct = (v: number, min: number, max: number) => PAD + ((v - min) / (max - min || 1)) * (100 - 2 * PAD)
const pct = (n: number) => `${n.toFixed(2)}%`

/** Name and unit of each featured variable, in the current language */
const VAR_INFO: Record<CaseVar, { name: string; unit: string; perDecade: string }> = {
  T2M: {
    name: L('Temperature', 'Temperatura'),
    unit: '°C',
    perDecade: L('°C per decade', '°C por década'),
  },
  PRECIP: {
    name: L('Precipitation', 'Precipitación'),
    unit: L('mm/day', 'mm/día'),
    perDecade: L('mm/day per decade', 'mm/día por década'),
  },
  SOILM: {
    name: L('Soil moisture, 0–10 cm', 'Humedad del suelo, 0–10 cm'),
    unit: 'kg/m²',
    perDecade: L('kg/m² per decade', 'kg/m² por década'),
  },
}

const range = (ci: [number, number]) => `${fmtSigned(ci[0])} ${L('to', 'a')} ${fmtSigned(ci[1])}`

interface ForestPanelProps {
  letter: string
  variable: CaseVar
  rows: FeaturedRow[]
  intervals: Intervals | null
}

/** One panel of the forest plot: a row per place, dot = slope, line = 95 % interval */
function ForestPanel({ letter, variable, rows, intervals }: ForestPanelProps) {
  const { name, perDecade } = VAR_INFO[variable]
  const values = rows.flatMap((r) => [r.slope, ...(intervals?.get(r.key) ?? [])])
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values), 4)
  const x = (v: number) => pct(toPct(v, ticks.min, ticks.max))
  return (
    <figure className="how-forest__panel">
      <figcaption className="how-forest__title">
        <span className="how-forest__letter">({letter})</span> {name}
      </figcaption>
      <div className="how-forest__rows">
        {rows.map((r) => {
          const ci = intervals?.get(r.key)
          const tone = !r.significant ? 'open' : r.slope > 0 ? 'up' : 'down'
          const label = L(
            `${r.title}: ${fmtSigned(r.slope)} ${perDecade}${ci ? `, 95\u00a0% interval ${range(ci)}` : ''}, ${r.significant ? 'significant' : 'not significant'}`,
            `${r.title}: ${fmtSigned(r.slope)} ${perDecade}${ci ? `, intervalo del 95\u00a0% de ${range(ci)}` : ''}, ${r.significant ? 'significativa' : 'no significativa'}`,
          )
          return (
            <div key={r.key} className="how-forest__row">
              <span className="how-forest__label">
                {r.title}
                {isBorderline(r, ci) && <span className="how-forest__star">*</span>}
              </span>
              <svg className="how-forest__track" role="img" aria-label={label}>
                {ticks.values.map((t) => (
                  <line key={t} className="how-forest__grid" x1={x(t)} x2={x(t)} y1="0" y2="100%" />
                ))}
                <line className="how-forest__zero" x1={x(0)} x2={x(0)} y1="0" y2="100%" />
                {ci && (
                  <g className="how-forest__ci">
                    <line x1={x(ci[0])} x2={x(ci[1])} y1="50%" y2="50%" />
                    <line x1={x(ci[0])} x2={x(ci[0])} y1="30%" y2="70%" />
                    <line x1={x(ci[1])} x2={x(ci[1])} y1="30%" y2="70%" />
                  </g>
                )}
                <circle className={`how-forest__dot how-forest__dot--${tone}`} cx={x(r.slope)} cy="50%" r={6.5} />
              </svg>
            </div>
          )
        })}
        <div className="how-forest__row how-forest__row--axis" aria-hidden="true">
          <span />
          <svg className="how-forest__track">
            {ticks.values.map((t) => (
              <text key={t} className="how-forest__tick" x={x(t)} y="13" textAnchor="middle">
                {t > 0 ? `+${fmtTick(t, ticks.decimals)}` : fmtTick(t, ticks.decimals)}
              </text>
            ))}
            <text className="how-forest__unit" x="50%" y="30" textAnchor="middle">
              {perDecade}
            </text>
          </svg>
        </div>
      </div>
    </figure>
  )
}

/** The three-panel forest plot of the featured series (temperature, precipitation, soil moisture) */
export function ForestPlot() {
  const intervals = useIntervals()
  return (
    <div className="how-forest" aria-busy={intervals === null}>
      <ul className="how-legend" aria-hidden="true">
        <li>
          <span className="how-legend__dot how-legend__dot--up" />
          {L('Significant rise', 'Subida significativa')}
        </li>
        <li>
          <span className="how-legend__dot how-legend__dot--down" />
          {L('Significant fall', 'Bajada significativa')}
        </li>
        <li>
          <span className="how-legend__dot" />
          {L('Not significant', 'No significativa')}
        </li>
        <li>
          <span className="how-legend__ci" />
          {L('95 % interval', 'Intervalo del 95 %')}
        </li>
        <li>
          <span className="how-legend__zero" />
          {L('No change', 'Sin cambio')}
        </li>
      </ul>
      {CASE_VARS.map((v, i) => (
        <ForestPanel
          key={v}
          letter={'abc'[i]}
          variable={v}
          rows={FEATURED_ROWS.filter((r) => r.variable === v)}
          intervals={intervals}
        />
      ))}
    </div>
  )
}

const fmtP = (p: number) => (p < 0.001 ? `< ${fmtNumber(0.001, 3)}` : fmtNumber(p, 3))

/** The table of the featured series: one row per series, grouped by place */
export function FeaturedTable() {
  const intervals = useIntervals()
  return (
    <div
      className="how-table"
      tabIndex={0}
      role="region"
      aria-label={L('Table of the featured series', 'Tabla de las series destacadas')}
    >
      <table>
        <thead>
          <tr>
            <th scope="col">{L('Place', 'Lugar')}</th>
            <th scope="col">{L('Variable', 'Variable')}</th>
            <th scope="col">{L('Slope per decade', 'Pendiente por década')}</th>
            <th scope="col">{L('95 % interval', 'Intervalo del 95 %')}</th>
            <th scope="col">
              <i>p</i>
            </th>
            <th scope="col">{L('Significant', 'Significativa')}</th>
          </tr>
        </thead>
        <tbody>
          {FEATURED_ROWS.map((r, i) => {
            const first = i === 0 || FEATURED_ROWS[i - 1].caseId !== r.caseId
            const span = FEATURED_ROWS.filter((o) => o.caseId === r.caseId).length
            const ci = intervals?.get(r.key)
            const info = VAR_INFO[r.variable]
            const unit = r.variable === 'SOILM' ? `${info.unit} (0–10 cm)` : info.unit
            return (
              <tr key={r.key} className={first ? 'how-table__first' : undefined}>
                {first && (
                  <th scope="rowgroup" rowSpan={span}>
                    {r.title}
                  </th>
                )}
                <td>
                  <abbr title={info.name}>{r.variable}</abbr>
                </td>
                <td className="how-table__num">
                  {fmtSigned(r.slope)} {unit}
                </td>
                <td className="how-table__num">{ci ? range(ci) : intervals === null ? '…' : '–'}</td>
                <td className="how-table__num">{fmtP(r.p)}</td>
                <td className={r.significant ? 'how-table__yes' : undefined}>
                  {r.significant ? L('yes', 'sí') : 'no'}
                  {isBorderline(r, ci) && '*'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export interface MapVariable {
  name: string
  source: string
  cells: number
  up: number
  down: number
}

/** Share of cells, one decimal below 1 % and above 99 %, else whole numbers */
function share(n: number, of: number): string {
  const v = (100 * n) / of
  const digits = v > 0 && (v < 1 || v > 99) ? 1 : 0
  return `${fmtNumber(Math.floor(v * 10 ** digits + 0.5) / 10 ** digits, digits)}\u00a0%`
}

const CHANCE = 5

/** Horizontal stacked bars: significant increase, significant decrease, no significant trend */
export function MapBars({ rows }: { rows: MapVariable[] }) {
  return (
    <div className="how-bars">
      {/* dot texture of the "no significant trend" part, shared by every bar */}
      <svg className="how-bars__defs" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="how-bars-dots" width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="#fff" />
            <circle className="how-bars__dot" cx="2.5" cy="2.5" r="0.9" />
          </pattern>
        </defs>
      </svg>
      <ul className="how-legend" aria-hidden="true">
        <li>
          <span className="how-legend__box how-legend__box--up" />
          {L('Significant increase', 'Aumento significativo')}
        </li>
        <li>
          <span className="how-legend__box how-legend__box--down" />
          {L('Significant decrease', 'Descenso significativo')}
        </li>
        <li>
          <span className="how-legend__box how-legend__box--none" />
          {L('No significant trend', 'Sin tendencia significativa')}
        </li>
        <li>
          <span className="how-legend__zero" />
          {L('5 % expected by chance', '5 % esperado por azar')}
        </li>
      </ul>
      <div className="how-bars__rows">
        {rows.map((r) => {
          const up = (100 * r.up) / r.cells
          const down = (100 * r.down) / r.cells
          const label = L(
            `${r.name} (${r.source}), ${r.cells} cells: significant increase in ${r.up}, significant decrease in ${r.down}, ${share(r.up + r.down, r.cells)} significant`,
            `${r.name} (${r.source}), ${r.cells} celdas: aumento significativo en ${r.up}, descenso significativo en ${r.down}, ${share(r.up + r.down, r.cells)} significativas`,
          )
          return (
            <div key={r.name} className="how-bars__row">
              <span className="how-bars__label">
                {r.name}
                <small>{r.source}</small>
              </span>
              <svg className="how-bars__track" role="img" aria-label={label}>
                <rect className="how-bars__none" x="0" y="18%" width="100%" height="64%" />
                <rect className="how-bars__up" x="0" y="18%" width={pct(up)} height="64%" />
                <rect className="how-bars__down" x={pct(up)} y="18%" width={pct(down)} height="64%" />
                <rect className="how-bars__frame" x="0" y="18%" width="100%" height="64%" />
                <line className="how-bars__chance" x1={pct(CHANCE)} x2={pct(CHANCE)} y1="0" y2="100%" />
              </svg>
              <span className="how-bars__value">{share(r.up + r.down, r.cells)}</span>
            </div>
          )
        })}
        <div className="how-bars__row how-bars__row--axis" aria-hidden="true">
          <span />
          <svg className="how-bars__track">
            {[0, 25, 50, 75, 100].map((t) => (
              <text
                key={t}
                className="how-bars__tick"
                x={pct(t)}
                y="13"
                textAnchor={t === 0 ? 'start' : t === 100 ? 'end' : 'middle'}
              >
                {`${t}\u00a0%`}
              </text>
            ))}
            <text className="how-bars__unit" x="50%" y="30" textAnchor="middle">
              {L('share of map cells', 'porcentaje de celdas del mapa')}
            </text>
          </svg>
          <span />
        </div>
      </div>
    </div>
  )
}
