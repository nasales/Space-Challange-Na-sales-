// The pages of the "How it works" walkthrough. Each page is a row of comic panels: a caption
// box, a visual and two or three short sentences. Chapter 2 uses only facts from
// docs/methods.md and docs/methods_plain.md; its charts are labelled illustrations.
import type { CSSProperties, ReactNode } from 'react'
import {
  AnomalyChart,
  DotGrid100,
  IconCar,
  IconChart,
  IconDetective,
  IconGauge,
  IconLens,
  IconModel,
  IconPencil,
  IconPin,
  IconSatellite,
  IconStamp,
  Illustration,
  MonthRuler,
  SeasonalChart,
  SenScatter,
  SlopeFan,
  SpainGrid,
  StickyChart,
  WhitenedChart,
} from './art'

interface PanelProps {
  caption: string
  children: ReactNode
  wide?: boolean
  tone?: 'paper' | 'manila' | 'sea'
}

function Panel({ caption, children, wide = false, tone = 'paper' }: PanelProps) {
  return (
    <section className={`how-panel how-panel--${tone}${wide ? ' how-panel--wide' : ''}`}>
      <h3 className="how-panel__cap">{caption}</h3>
      <div className="how-panel__body">{children}</div>
    </section>
  )
}

function Bubble({ children }: { children: ReactNode }) {
  return (
    <div className="how-say">
      <IconDetective />
      <p className="how-say__bubble">{children}</p>
    </div>
  )
}

// ---- Chapter 1: the tool ----

export function PageWhat() {
  return (
    <div className="how-panels">
      <Panel caption="The case">
        <div className="how-sources">
          <div className="how-sources__item">
            <IconSatellite />
            <span>Satellites</span>
          </div>
          <span className="how-sources__plus" aria-hidden="true">
            +
          </span>
          <div className="how-sources__item">
            <IconModel />
            <span>Models</span>
          </div>
          <span className="how-sources__plus" aria-hidden="true">
            +
          </span>
          <div className="how-sources__item">
            <IconGauge />
            <span>Ground data</span>
          </div>
        </div>
        <p>You are a climate detective. Your job: find out how Spain's climate has changed.</p>
        <p>
          Your evidence is real <strong>NASA Earth observation data</strong>: satellites, and models that combine satellite
          and ground measurements.
        </p>
      </Panel>
      <Panel caption="The evidence" tone="manila">
        <SpainGrid />
        <p>
          Spain is cut into squares of about <strong>28 km</strong>. Each square has <strong>one value per month</strong>,
          for decades.
        </p>
      </Panel>
    </div>
  )
}

export function PageWho() {
  return (
    <div className="how-panels">
      <Panel caption="Who it is for">
        <Bubble>No statistics background needed. If you can read a chart, you can do this.</Bubble>
        <p>Made for students and anyone curious about the climate around them.</p>
      </Panel>
      <Panel caption="Why play it" tone="manila">
        <div className="how-versus">
          <div className="how-versus__no">
            <span className="how-versus__note">"Here is the answer."</span>
            <span className="how-versus__x" aria-hidden="true" />
            <span className="how-versus__label">Being told</span>
          </div>
          <span className="how-versus__vs" aria-hidden="true">
            VS
          </span>
          <div className="how-versus__yes">
            <IconLens />
            <span className="how-versus__label">Finding out</span>
          </div>
        </div>
        <p>
          Most apps just tell you the answer. Here you learn to <strong>read a climate time series</strong> and to tell a{' '}
          <strong>real trend</strong> from <strong>pure chance</strong>.
        </p>
      </Panel>
    </div>
  )
}

const LOOP: { n: number; title: string; text: string; icon: ReactNode }[] = [
  { n: 1, title: 'Drive', text: 'Drive your detective across the 3D map of Spain.', icon: <IconCar /> },
  { n: 2, title: 'Stop', text: 'Stop anywhere you want to investigate.', icon: <IconPin /> },
  {
    n: 3,
    title: 'Pick a clue',
    text: 'Press Space for the magnifying glass. Pick temperature, rain, soil moisture, wind, evaporation…',
    icon: <IconLens />,
  },
  { n: 4, title: 'Read', text: 'Read the charts. They show the evidence, not the answer.', icon: <IconChart /> },
  { n: 5, title: 'Conclude', text: 'Write your own conclusion.', icon: <IconPencil /> },
  { n: 6, title: 'Check', text: 'The check reveals what the statistics say.', icon: <IconStamp /> },
]

export function PageLoop() {
  return (
    <ol className="how-strip">
      {LOOP.map((step) => (
        <li key={step.n} className="how-strip__step">
          <span className="how-strip__n">{step.n}</span>
          <div className="how-strip__art">{step.icon}</div>
          <h3 className="how-strip__title">{step.title}</h3>
          <p>{step.text}</p>
        </li>
      ))}
    </ol>
  )
}

const CASES = ['Valencia DANA', 'Storm Filomena (Madrid)', 'Córdoba heat', 'Aneto glacier', 'Doñana wetlands']

export function PageCases() {
  return (
    <div className="how-panels">
      <Panel caption="5 featured case files" tone="manila">
        <ul className="how-folders">
          {CASES.map((name, i) => (
            <li key={name} className="how-folders__item" style={{ '--i': i } as CSSProperties}>
              <span className="how-folders__no">No. {i + 1}</span>
              {name}
            </li>
          ))}
        </ul>
        <p>
          Each case has a <strong>witness</strong>, a <strong>story</strong> and a <strong>tutorial</strong> that walks you
          through the clues.
        </p>
      </Panel>
      <Panel caption="Any point on the map">
        <div className="how-anywhere">
          <IconPin />
          <span className="how-anywhere__q">?</span>
        </div>
        <p>Stop anywhere else and open the same clues for that square.</p>
        <p>No story this time: just you and the data.</p>
      </Panel>
    </div>
  )
}

// ---- Chapter 2: statistical rigour ----

export function PageSeasons() {
  return (
    <div className="how-panels">
      <Panel caption="1 · Raw months">
        <Illustration note="Made-up monthly temperatures">
          <SeasonalChart />
        </Illustration>
        <p>Summer is always hotter than winter. That big yearly wave can hide, or fake, a slow change.</p>
      </Panel>
      <Panel caption="2 · Anomalies" tone="manila">
        <Illustration note="Same values, seasons removed">
          <AnomalyChart />
        </Illustration>
        <p>
          So each value is compared with the usual value for its calendar month: <strong>this July minus the average July</strong>.
        </p>
        <p>What is left is "warmer or colder than normal".</p>
      </Panel>
    </div>
  )
}

export function PageSlope() {
  return (
    <div className="how-panels">
      <Panel caption="Sen slope">
        <Illustration note="Made-up yearly values; thin lines are a few of the pairs">
          <SenScatter />
        </Illustration>
        <p>
          Join every pair of points and measure each slope. The <strong>Sen slope</strong> is the middle value (the{' '}
          <strong>median</strong>) of all of them.
        </p>
      </Panel>
      <Panel caption="Why the middle value?" tone="manila">
        <Bubble>One odd year can't drag the median around.</Bubble>
        <p>The result is given per decade, in the variable's own units:</p>
        <p className="how-big">
          +0.3 °C <small>every 10 years</small>
        </p>
        <p className="how-small">Example of the format, not a result.</p>
      </Panel>
    </div>
  )
}

export function PageLuck() {
  return (
    <div className="how-panels how-panels--four">
      <Panel caption="Mann-Kendall test">
        <DotGrid100 />
        <p>Weather goes up and down by chance. The test asks: could a change this big appear by pure luck?</p>
        <p>
          If that is <strong>less than 5 in 100</strong> (α = 0.05), the trend is called <strong>significant</strong>.
        </p>
      </Panel>
      <Panel caption="Pre-whitening" tone="manila">
        <Illustration note="No real trend in either line">
          <span className="how-mini-label">Sticky months</span>
          <StickyChart />
          <span className="how-mini-label how-mini-label--blue">After pre-whitening</span>
          <WhitenedChart />
        </Illustration>
        <p>
          One month resembles the next. That stickiness can fake a trend, so it is removed first (Yue &amp; Wang, 2002).
        </p>
      </Panel>
      <Panel caption="95 % confidence range">
        <Illustration>
          <SlopeFan />
        </Illustration>
        <p>
          Every slope comes with a range where the true value probably lies (Gilbert's rank method, widened for sticky months).
        </p>
      </Panel>
      <Panel caption="Enough evidence" tone="sea">
        <MonthRuler />
        <p>
          A trend is only tested with at least <strong>120 valid months</strong> (10 years). Gaps are allowed.
        </p>
      </Panel>
    </div>
  )
}

const STATS: { value: string; label: string; detail: string }[] = [
  { value: '4.7–5.6 %', label: 'false alarms', detail: 'Close to the 5 % expected. Rain: 6.8 %, slightly above.' },
  { value: '93.9–95.8 %', label: 'range coverage', detail: 'How often the 95 % range held the true slope.' },
  { value: '±3 %', label: 'slope error', detail: 'The measured slope stays within 3 % of the true one.' },
  { value: 'Always', label: 'strong trends caught', detail: 'Strong trends were always detected.' },
]

export function PageTested() {
  return (
    <div className="how-tested">
      <Panel caption="The test drive" wide tone="manila">
        <p className="how-tested__lead">
          Before trusting the detective, we gave it <strong>7104 fake series</strong> where we knew the answer.
        </p>
        <p>1184 squares × 6 variables, with real lengths, seasons, sticky noise, gaps, and half with no trend at all.</p>
      </Panel>
      <ul className="how-cards">
        {STATS.map((s) => (
          <li key={s.label} className="how-card">
            <span className="how-card__stamp">Verified</span>
            <span className="how-card__value">{s.value}</span>
            <span className="how-card__label">{s.label}</span>
            <span className="how-card__detail">{s.detail}</span>
          </li>
        ))}
        <li className="how-card how-card--alt">
          <span className="how-card__stamp">Match</span>
          <span className="how-card__value">1e-9</span>
          <span className="how-card__label">game = database</span>
          <span className="how-card__detail">The game pipeline and the database script give the same numbers.</span>
        </li>
        <li className="how-card how-card--alt">
          <span className="how-card__stamp">Real data</span>
          <span className="how-card__value">7090</span>
          <span className="how-card__label">series on the map</span>
          <span className="how-card__detail">Every one checked: 0 errors.</span>
        </li>
      </ul>
    </div>
  )
}

const LIMITS: { title: string; text: string }[] = [
  {
    title: 'No trend is a real answer',
    text: '"No significant trend" does not prove nothing changed. Any change may be too small to tell apart from normal ups and downs.',
  },
  { title: 'A trend is not a cause', text: 'The data can say that something changed, not why.' },
  { title: 'Short series', text: 'Some series start in 1998 or 2000, so they cover only about 26 to 28 years.' },
  { title: 'Squares, not towns', text: 'Each square averages about 28 km. A single town can be different.' },
  {
    title: 'Many squares, a few flukes',
    text: 'With so many squares, about 5 in 100 can look significant by chance. A pattern over a whole region is stronger evidence than one square.',
  },
]

export function PageLimits() {
  return (
    <div className="how-limits">
      <ul className="how-notes">
        {LIMITS.map((l, i) => (
          <li key={l.title} className="how-note" style={{ '--i': i } as CSSProperties}>
            <h3 className="how-note__title">{l.title}</h3>
            <p>{l.text}</p>
          </li>
        ))}
      </ul>
      <footer className="how-credits">
        <p className="how-credits__data">Data: NASA MERRA-2, NASA GPM IMERG, NASA GLDAS</p>
        <p>Methods: Mann (1945), Kendall (1975), Sen (1968), Yue &amp; Wang (2002), Gilbert (1987).</p>
      </footer>
    </div>
  )
}
