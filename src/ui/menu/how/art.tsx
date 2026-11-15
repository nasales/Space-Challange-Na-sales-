// Small inline SVG drawings for the "How it works" walkthrough: comic icons and mini charts.
// All drawn here (no images, no logos). Charts take synthetic data from demoData.ts and are
// always shown inside <Illustration>, which labels them as made-up.
import type { ReactNode } from 'react'
import { ANOMALIES, ODD_INDEX, SCATTER, SEASONAL, SEN, STICKY, WHITENED } from './demoData'

const W = 300

/** Frame for a demo chart, with the "Illustration" tag so nobody reads it as a real result */
export function Illustration({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <figure className="how-fig">
      <span className="how-fig__tag">Illustration</span>
      {children}
      {note && <figcaption className="how-fig__note">{note}</figcaption>}
    </figure>
  )
}

interface LineChartProps {
  values: number[]
  label: string
  height?: number
  zero?: boolean
  tone?: 'ink' | 'red' | 'blue'
  range?: [number, number]
}

/** Ink line with an offset cyan print ghost */
export function LineChart({ values, label, height = 110, zero = false, tone = 'ink', range }: LineChartProps) {
  const lo = range ? range[0] : Math.min(...values)
  const hi = range ? range[1] : Math.max(...values)
  const pad = 10
  const x = (i: number) => pad + (i / (values.length - 1)) * (W - 2 * pad)
  const y = (v: number) => height - pad - ((v - lo) / (hi - lo || 1)) * (height - 2 * pad)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  return (
    <svg className={`how-chart how-chart--${tone}`} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label}>
      {zero && <line className="how-chart__zero" x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} />}
      <path className="how-chart__ghost" d={d} transform="translate(2.5 2)" />
      <path className="how-chart__line" d={d} />
    </svg>
  )
}

export function SeasonalChart() {
  return <LineChart values={SEASONAL} label="Made-up monthly temperatures: a big up-and-down wave every year" />
}

export function AnomalyChart() {
  return (
    <LineChart
      values={ANOMALIES}
      zero
      tone="red"
      label="The same made-up values as anomalies: small wiggles around zero, with the yearly wave gone"
    />
  )
}

const stickyRange: [number, number] = [Math.min(...STICKY, ...WHITENED), Math.max(...STICKY, ...WHITENED)]

export function StickyChart() {
  return (
    <LineChart
      values={STICKY}
      height={90}
      zero
      range={stickyRange}
      label="Made-up series with no trend whose months lean on each other: it drifts and looks like a trend"
    />
  )
}

export function WhitenedChart() {
  return (
    <LineChart
      values={WHITENED}
      height={90}
      zero
      tone="blue"
      range={stickyRange}
      label="The same series after pre-whitening: quick jumps around zero, no fake drift"
    />
  )
}

/** Scatter with a few "pair" lines and the Sen line; the odd year is circled */
export function SenScatter() {
  const h = 170
  const pad = 16
  const ys = SCATTER.map((p) => p.y)
  const lo = Math.min(...ys) - 0.05
  const hi = Math.max(...ys) + 0.05
  const last = SCATTER.length - 1
  const x = (v: number) => pad + (v / last) * (W - 2 * pad)
  const y = (v: number) => h - pad - ((v - lo) / (hi - lo)) * (h - 2 * pad)
  const pairs: [number, number][] = [
    [0, 5],
    [2, 9],
    [4, 15],
    [1, 13],
    [7, 11],
    [3, 14],
  ]
  const odd = SCATTER[ODD_INDEX]
  return (
    <svg className="how-chart" viewBox={`0 0 ${W} ${h}`} role="img" aria-label="Made-up yearly points with lines between pairs of points and the Sen trend line; one odd year sits far below the rest">
      {pairs.map(([a, b]) => (
        <line key={`${a}-${b}`} className="how-chart__pair" x1={x(SCATTER[a].x)} y1={y(SCATTER[a].y)} x2={x(SCATTER[b].x)} y2={y(SCATTER[b].y)} />
      ))}
      <line
        className="how-chart__ghost"
        x1={x(0) + 2.5}
        y1={y(SEN.intercept) + 2}
        x2={x(last) + 2.5}
        y2={y(SEN.intercept + SEN.slope * last) + 2}
      />
      <line className="how-chart__trend" x1={x(0)} y1={y(SEN.intercept)} x2={x(last)} y2={y(SEN.intercept + SEN.slope * last)} />
      {SCATTER.map((p) => (
        <circle key={p.x} className="how-chart__dot" cx={x(p.x)} cy={y(p.y)} r={4.5} />
      ))}
      <circle className="how-chart__odd" cx={x(odd.x)} cy={y(odd.y)} r={11} />
      <text className="how-chart__text how-chart__text--red" x={x(odd.x) - 16} y={y(odd.y) + 3} textAnchor="end">
        odd year
      </text>
    </svg>
  )
}

/** 100 dots, 5 of them red: "less than 5 in 100" */
export function DotGrid100() {
  const red = new Set([13, 37, 58, 72, 96])
  return (
    <svg className="how-dots" viewBox="0 0 200 200" role="img" aria-label="A grid of 100 dots with 5 of them highlighted in red">
      {Array.from({ length: 100 }, (_, i) => (
        <circle
          key={i}
          cx={10 + (i % 10) * 20}
          cy={10 + Math.floor(i / 10) * 20}
          r={6.5}
          className={red.has(i) ? 'how-dots__hit' : 'how-dots__dot'}
        />
      ))}
    </svg>
  )
}

/** A slope with its 95 % range drawn as a fan around the line */
export function SlopeFan() {
  const h = 120
  const cx = W / 2
  const cy = h / 2
  const run = W / 2 - 20
  const mid = 0.22
  const lo = 0.06
  const hi = 0.38
  const pt = (s: number, dir: 1 | -1) => `${cx + dir * run},${cy - dir * s * run}`
  return (
    <svg className="how-chart" viewBox={`0 0 ${W} ${h}`} role="img" aria-label="A trend line with a shaded fan showing the range of likely slopes">
      <polygon className="how-chart__band" points={`${pt(hi, -1)} ${cx},${cy} ${pt(lo, -1)}`} />
      <polygon className="how-chart__band" points={`${pt(lo, 1)} ${cx},${cy} ${pt(hi, 1)}`} />
      <line className="how-chart__edge" x1={cx - run} y1={cy + hi * run} x2={cx + run} y2={cy - hi * run} />
      <line className="how-chart__edge" x1={cx - run} y1={cy + lo * run} x2={cx + run} y2={cy - lo * run} />
      <line className="how-chart__trend" x1={cx - run} y1={cy + mid * run} x2={cx + run} y2={cy - mid * run} />
      <text className="how-chart__text" x={cx + run} y={cy - hi * run - 6} textAnchor="end">
        steepest likely
      </text>
      <text className="how-chart__text" x={cx + run} y={cy - lo * run + 16} textAnchor="end">
        gentlest likely
      </text>
    </svg>
  )
}

/** Ten year blocks of 12 month ticks: "at least 120 months" */
export function MonthRuler() {
  const block = 27
  return (
    <svg className="how-ruler" viewBox="0 0 300 52" role="img" aria-label="A ruler of 10 years, each with 12 month ticks: 120 months">
      {Array.from({ length: 10 }, (_, yr) => (
        <g key={yr} transform={`translate(${10 + yr * block} 6)`}>
          <rect className={yr % 2 ? 'how-ruler__year how-ruler__year--alt' : 'how-ruler__year'} width={block} height={22} />
          {Array.from({ length: 11 }, (_, m) => (
            <line key={m} className="how-ruler__tick" x1={((m + 1) * block) / 12} x2={((m + 1) * block) / 12} y1={m === 5 ? 6 : 12} y2={22} />
          ))}
        </g>
      ))}
      <text className="how-ruler__text" x={10} y={46}>
        year 1
      </text>
      <text className="how-ruler__text" x={290} y={46} textAnchor="end">
        year 10 = 120 months
      </text>
    </svg>
  )
}

// Coarse pixel outline of Spain (not to scale), one character per square
const SPAIN_MASK = [
  '.###########....',
  '##############..',
  '.##############.',
  '..#############.',
  '..############..',
  '..###########...',
  '..##########....',
  '.###########....',
  '..#########.....',
  '....#####.......',
]
const ISLANDS: [number, number][] = [
  [14, 5],
  [15, 5],
  [13, 6],
]
const PICKED: [number, number] = [8, 4]

/** Spain cut into squares, one picked, with "one value per month" bars */
export function SpainGrid() {
  const c = 13
  const cells: [number, number][] = []
  SPAIN_MASK.forEach((row, r) => [...row].forEach((ch, col) => ch === '#' && cells.push([col, r])))
  cells.push(...ISLANDS)
  const bars = [3, 4, 6, 8, 10, 13, 15, 14, 11, 8, 5, 3]
  return (
    <svg className="how-grid" viewBox="0 0 300 150" role="img" aria-label="Spain drawn as a grid of squares, one square picked, with twelve bars for its twelve monthly values">
      <g transform="translate(4 8)">
        {cells.map(([col, r]) => {
          const picked = col === PICKED[0] && r === PICKED[1]
          return (
            <rect
              key={`${col}-${r}`}
              className={picked ? 'how-grid__cell how-grid__cell--picked' : 'how-grid__cell'}
              x={col * c}
              y={r * c}
              width={c}
              height={c}
            />
          )
        })}
        <path className="how-grid__lead" d={`M${PICKED[0] * c + c} ${PICKED[1] * c + c / 2} L 222 80`} />
      </g>
      <g transform="translate(226 74)">
        <rect className="how-grid__card" width={70} height={64} />
        {bars.map((b, i) => (
          <rect key={i} className="how-grid__bar" x={5 + i * 5} y={50 - b * 2.6} width={4} height={b * 2.6} />
        ))}
        <text className="how-grid__text" x={35} y={60} textAnchor="middle">
          12 months
        </text>
      </g>
      <text className="how-grid__text how-grid__text--big" x={226} y={30}>
        ~28 km
      </text>
      <text className="how-grid__text" x={226} y={44}>
        per square
      </text>
    </svg>
  )
}

// ---- Icons (comic ink, 64 x 64) ----
interface IconProps {
  label?: string
}

function Icon({ label, children }: IconProps & { children: ReactNode }) {
  return (
    <svg className="how-icon" viewBox="0 0 64 64" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {children}
    </svg>
  )
}

export function IconSatellite(props: IconProps) {
  return (
    <Icon {...props}>
      <rect className="how-icon__fill-paper" x={4} y={22} width={16} height={20} transform="rotate(-20 12 32)" />
      <rect className="how-icon__fill-paper" x={44} y={22} width={16} height={20} transform="rotate(-20 52 32)" />
      <path className="how-icon__thin" d="M8 26l9 14M48 22l9 14" />
      <rect className="how-icon__fill-gold" x={23} y={22} width={18} height={20} rx={2} transform="rotate(-20 32 32)" />
      <path className="how-icon__line" d="M20 30h4M40 34h4" />
      <path className="how-icon__beam" d="M30 46l-8 14M34 46l8 14" />
    </Icon>
  )
}

export function IconModel(props: IconProps) {
  return (
    <Icon {...props}>
      <circle className="how-icon__fill-sea" cx={32} cy={32} r={24} />
      <path className="how-icon__thin" d="M8 32h48M32 8v48M14 18h36M14 46h36" />
      <ellipse className="how-icon__thin" cx={32} cy={32} rx={11} ry={24} />
      <circle className="how-icon__line" cx={32} cy={32} r={24} />
    </Icon>
  )
}

export function IconGauge(props: IconProps) {
  return (
    <Icon {...props}>
      <rect className="how-icon__fill-paper" x={26} y={6} width={12} height={40} rx={6} />
      <circle className="how-icon__fill-red" cx={32} cy={50} r={9} />
      <path className="how-icon__red" d="M32 46V22" />
      <path className="how-icon__thin" d="M40 14h5M40 22h5M40 30h5" />
    </Icon>
  )
}

export function IconCar(props: IconProps) {
  return (
    <Icon {...props}>
      <path className="how-icon__fill-paper" d="M6 40l6-12h28l10 12h8v8H6z" />
      <path className="how-icon__fill-sea" d="M16 30h10v9H12zM30 30h8l7 9H30z" />
      <rect className="how-icon__fill-red" x={24} y={20} width={8} height={6} />
      <circle className="how-icon__fill-ink" cx={18} cy={48} r={6} />
      <circle className="how-icon__fill-ink" cx={46} cy={48} r={6} />
      <path className="how-icon__speed" d="M0 30h6M2 36h4" />
    </Icon>
  )
}

export function IconPin(props: IconProps) {
  return (
    <Icon {...props}>
      <ellipse className="how-icon__fill-ink-soft" cx={32} cy={56} rx={14} ry={4} />
      <path className="how-icon__fill-red" d="M32 56C20 40 14 32 14 24a18 18 0 0 1 36 0c0 8-6 16-18 32z" />
      <circle className="how-icon__fill-paper" cx={32} cy={24} r={7} />
    </Icon>
  )
}

export function IconLens(props: IconProps) {
  return (
    <Icon {...props}>
      <path className="how-icon__handle" d="M42 40l14 14" />
      <circle className="how-icon__fill-glass" cx={28} cy={26} r={18} />
      <path className="how-icon__thin" d="M18 20a12 12 0 0 1 8-6" />
      <rect className="how-icon__fill-paper" x={4} y={50} width={34} height={12} rx={2} />
      <text className="how-icon__key" x={21} y={59.5} textAnchor="middle">
        SPACE
      </text>
    </Icon>
  )
}

export function IconChart(props: IconProps) {
  return (
    <Icon {...props}>
      <rect className="how-icon__fill-paper" x={6} y={8} width={52} height={48} />
      <path className="how-icon__thin" d="M12 48h40M12 14v34" />
      <path className="how-icon__red" d="M14 40l7-8 6 5 7-12 6 6 7-10 5 4" />
      <text className="how-icon__q" x={48} y={26} textAnchor="middle">
        ?
      </text>
    </Icon>
  )
}

export function IconPencil(props: IconProps) {
  return (
    <Icon {...props}>
      <rect className="how-icon__fill-paper" x={6} y={10} width={38} height={46} transform="rotate(-4 25 33)" />
      <path className="how-icon__thin" d="M12 22h24M12 30h26M12 38h18" />
      <path className="how-icon__fill-gold" d="M40 50l16-26 6 4-16 26-8 3z" />
      <path className="how-icon__line" d="M54 26l6 4" />
    </Icon>
  )
}

export function IconStamp(props: IconProps) {
  return (
    <Icon {...props}>
      <path className="how-icon__fill-ink-soft" d="M26 6h12v14l8 8v8H18v-8l8-8z" />
      <rect className="how-icon__fill-paper" x={10} y={42} width={44} height={16} transform="rotate(-6 32 50)" />
      <text className="how-icon__stamp" x={32} y={54} textAnchor="middle" transform="rotate(-6 32 50)">
        CHECK
      </text>
    </Icon>
  )
}

/** A detective's face under a hat, for speech bubbles */
export function IconDetective(props: IconProps) {
  return (
    <Icon {...props}>
      <circle className="how-icon__fill-skin" cx={32} cy={38} r={16} />
      <path className="how-icon__fill-ink-soft" d="M12 28h40l-4-4-3-16c-6 3-20 3-26 0l-3 16z" />
      <path className="how-icon__fill-red" d="M17 22h30v4H17z" />
      <circle className="how-icon__fill-ink" cx={26} cy={38} r={2.2} />
      <circle className="how-icon__fill-ink" cx={38} cy={38} r={2.2} />
      <path className="how-icon__line" d="M27 46c3 2 7 2 10 0" />
    </Icon>
  )
}
