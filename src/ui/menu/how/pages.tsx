// The pages of the "How it works" walkthrough. Each page is a row of comic panels: a caption
// box, a visual and a few short sentences. Chapter 1 presents the tool; chapter 2 is the
// methods and evidence report (method, validation, results, limits and references). Its numbers
// come from docs/methods.md and, for the featured places, from the case files themselves
// (featuredResults.ts); the small drawings in art.tsx are labelled illustrations.
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
import {
  FormulaAnomaly,
  FormulaGilbertC,
  FormulaGilbertRanks,
  FormulaMannKendall,
  FormulaPrewhitening,
  FormulaSen,
  Sym,
} from './formulas'
import { FeaturedTable, ForestPlot, MapBars, type MapVariable } from './reportCharts'
import { L, LANG, fmtNumber } from '../../../shared/i18n'

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
      <Panel caption={L('The case', 'El caso')}>
        <div className="how-sources">
          <div className="how-sources__item">
            <IconSatellite />
            <span>{L('Satellites', 'Satélites')}</span>
          </div>
          <span className="how-sources__plus" aria-hidden="true">
            +
          </span>
          <div className="how-sources__item">
            <IconModel />
            <span>{L('Models', 'Modelos')}</span>
          </div>
          <span className="how-sources__plus" aria-hidden="true">
            +
          </span>
          <div className="how-sources__item">
            <IconGauge />
            <span>{L('Ground data', 'Datos de tierra')}</span>
          </div>
        </div>
        <p>
          {L(
            "You are a climate detective. Your job: find out how Spain's climate has changed.",
            'Eres detective del clima. Tu misión: averiguar cómo ha cambiado el clima de España.',
          )}
        </p>
        {LANG === 'es' ? (
          <p>
            Tus pruebas son <strong>datos reales de observación de la Tierra de la NASA</strong>: satélites, y modelos que
            combinan medidas de satélite y de tierra.
          </p>
        ) : (
          <p>
            Your evidence is real <strong>NASA Earth observation data</strong>: satellites, and models that combine satellite
            and ground measurements.
          </p>
        )}
      </Panel>
      <Panel caption={L('The evidence', 'Las pruebas')} tone="manila">
        <SpainGrid />
        {LANG === 'es' ? (
          <p>
            España está dividida en cuadrados de unos <strong>28 km</strong>. Cada cuadrado tiene{' '}
            <strong>un valor por mes</strong>, durante décadas.
          </p>
        ) : (
          <p>
            Spain is cut into squares of about <strong>28 km</strong>. Each square has <strong>one value per month</strong>,
            for decades.
          </p>
        )}
      </Panel>
    </div>
  )
}

export function PageWho() {
  return (
    <div className="how-panels">
      <Panel caption={L('Who it is for', 'Para quién es')}>
        <Bubble>
          {L(
            'No statistics background needed. If you can read a chart, you can do this.',
            'No hace falta saber estadística. Si sabes leer un gráfico, puedes hacerlo.',
          )}
        </Bubble>
        <p>{L('Made for students and anyone curious about the climate around them.', 'Hecho para estudiantes y para cualquiera con curiosidad por el clima que le rodea.')}</p>
      </Panel>
      <Panel caption={L('Why play it', 'Por qué jugar')} tone="manila">
        <div className="how-versus">
          <div className="how-versus__no">
            <span className="how-versus__note">{L('"Here is the answer."', '"Aquí tienes la respuesta."')}</span>
            <span className="how-versus__x" aria-hidden="true" />
            <span className="how-versus__label">{L('Being told', 'Que te lo cuenten')}</span>
          </div>
          <span className="how-versus__vs" aria-hidden="true">
            VS
          </span>
          <div className="how-versus__yes">
            <IconLens />
            <span className="how-versus__label">{L('Finding out', 'Descubrirlo')}</span>
          </div>
        </div>
        {LANG === 'es' ? (
          <p>
            La mayoría de apps solo te dan la respuesta. Aquí aprendes a <strong>leer una serie temporal del clima</strong> y a
            distinguir una <strong>tendencia real</strong> de la <strong>pura casualidad</strong>.
          </p>
        ) : (
          <p>
            Most apps just tell you the answer. Here you learn to <strong>read a climate time series</strong> and to tell a{' '}
            <strong>real trend</strong> from <strong>pure chance</strong>.
          </p>
        )}
      </Panel>
    </div>
  )
}

const LOOP: { n: number; title: string; text: string; icon: ReactNode }[] = [
  {
    n: 1,
    title: L('Drive', 'Recorre'),
    text: L('Drive your detective across the 3D map of Spain.', 'Lleva a tu detective por el mapa 3D de España.'),
    icon: <IconCar />,
  },
  { n: 2, title: L('Stop', 'Para'), text: L('Stop anywhere you want to investigate.', 'Párate donde quieras investigar.'), icon: <IconPin /> },
  {
    n: 3,
    title: L('Pick a clue', 'Elige una pista'),
    text: L(
      'Press Space for the magnifying glass. Pick temperature, rain, soil moisture, wind, evaporation…',
      'Pulsa Espacio para sacar la lupa. Elige temperatura, lluvia, humedad del suelo, viento, evaporación…',
    ),
    icon: <IconLens />,
  },
  {
    n: 4,
    title: L('Read', 'Lee'),
    text: L('Read the charts. They show the evidence, not the answer.', 'Lee los gráficos. Muestran las pruebas, no la respuesta.'),
    icon: <IconChart />,
  },
  { n: 5, title: L('Conclude', 'Concluye'), text: L('Write your own conclusion.', 'Escribe tu propia conclusión.'), icon: <IconPencil /> },
  {
    n: 6,
    title: L('Check', 'Comprueba'),
    text: L('The check reveals what the statistics say.', 'La comprobación revela lo que dice la estadística.'),
    icon: <IconStamp />,
  },
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

const CASES = [
  L('Valencia DANA', 'DANA de Valencia'),
  L('Storm Filomena (Madrid)', 'Borrasca Filomena (Madrid)'),
  L('Córdoba heat', 'Calor en Córdoba'),
  L('Aneto glacier', 'Glaciar del Aneto'),
  L('Doñana wetlands', 'Humedales de Doñana'),
]

export function PageCases() {
  return (
    <div className="how-panels">
      <Panel caption={L('5 featured case files', '5 expedientes destacados')} tone="manila">
        <ul className="how-folders">
          {CASES.map((name, i) => (
            <li key={name} className="how-folders__item" style={{ '--i': i } as CSSProperties}>
              <span className="how-folders__no">
                {L('No.', 'N.º')} {i + 1}
              </span>
              {name}
            </li>
          ))}
        </ul>
        {LANG === 'es' ? (
          <p>
            Cada caso tiene un <strong>testigo</strong>, una <strong>historia</strong> y un <strong>tutorial</strong> que te
            guía por las pistas.
          </p>
        ) : (
          <p>
            Each case has a <strong>witness</strong>, a <strong>story</strong> and a <strong>tutorial</strong> that walks you
            through the clues.
          </p>
        )}
      </Panel>
      <Panel caption={L('Any point on the map', 'Cualquier punto del mapa')}>
        <div className="how-anywhere">
          <IconPin />
          <span className="how-anywhere__q">?</span>
        </div>
        <p>{L('Stop anywhere else and open the same clues for that square.', 'Párate en cualquier otro sitio y abre las mismas pistas para ese cuadrado.')}</p>
        <p>{L('No story this time: just you and the data.', 'Esta vez sin historia: solo tú y los datos.')}</p>
      </Panel>
    </div>
  )
}

// ---- Chapter 2: statistical rigour (the methods and evidence report) ----

/** A key number: big value, short label, optional detail and stamp */
interface Fact {
  value: string
  label: string
  detail?: string
  stamp?: string
}

function Facts({ facts, alt = false, five = false }: { facts: Fact[]; alt?: boolean; five?: boolean }) {
  return (
    <ul className={five ? 'how-cards how-cards--five' : 'how-cards'}>
      {facts.map((f) => (
        <li key={f.label} className={`how-card${alt ? ' how-card--alt' : ''}`}>
          {f.stamp && <span className="how-card__stamp">{f.stamp}</span>}
          <span className="how-card__value">{f.value}</span>
          <span className="how-card__label">{f.label}</span>
          {f.detail && <span className="how-card__detail">{f.detail}</span>}
        </li>
      ))}
    </ul>
  )
}

/** A chart with its caption below, framed like a printed figure */
function Figure({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="how-figure">
      {children}
      <figcaption className="how-figure__cap">{caption}</figcaption>
    </figure>
  )
}

const VERDICTS: { stamp: string; value: string; text: string }[] = [
  {
    stamp: L('Temperature', 'Temperatura'),
    value: L('Warmer', 'Más calor'),
    text: L('Warming almost everywhere.', 'Calentamiento casi en todas partes.'),
  },
  {
    stamp: L('Top soil', 'Suelo superficial'),
    value: L('Drier', 'Más seco'),
    text: L(
      'Drying of the top soil layer in about half of Spain.',
      'Secado de la capa superior del suelo en aproximadamente la mitad de España.',
    ),
  },
  {
    stamp: L('Precipitation', 'Precipitación'),
    value: L('No change', 'Sin cambio'),
    text: L('No change that chance cannot explain.', 'Ningún cambio que el azar no pueda explicar.'),
  },
]

export function PageReport() {
  return (
    <div className="how-stack">
      <Panel caption={L('Abstract', 'Resumen')} wide tone="manila">
        {LANG === 'es' ? (
          <>
            <p className="how-lead">
              Este capítulo es nuestro <strong>informe de métodos y pruebas</strong>. Explica cómo decide John Datason
              si una variable climática mensual ha cambiado en un lugar de España, y hasta qué punto podemos fiarnos de
              esa decisión.
            </p>
            <p>
              Se eliminan los ciclos estacionales, el ritmo de cambio se estima con la <strong>pendiente de Sen</strong>{' '}
              y su significación se comprueba con un <strong>test de Mann-Kendall</strong> corregido por la memoria de
              los datos mensuales.
            </p>
            <p>
              Antes de tocar datos reales, probamos el método con <strong>7104 series sintéticas</strong> y se comportó
              como debe hacerlo un test al 5&nbsp;%. Aplicado a las <strong>7090 series</strong> del mapa del juego,
              construidas con NASA GLDAS, GPM IMERG y MERRA-2, encuentra:
            </p>
          </>
        ) : (
          <>
            <p className="how-lead">
              This chapter is our <strong>methods and evidence report</strong>. It explains how John Datason decides
              whether a monthly climate variable has changed at a place in Spain, and how far that decision can be
              trusted.
            </p>
            <p>
              Seasonal cycles are removed, the rate of change is estimated with the <strong>Sen slope</strong>, and its
              significance is tested with a <strong>Mann-Kendall test</strong> that is corrected for the memory of
              monthly data.
            </p>
            <p>
              Before touching real data we ran the method on <strong>7104 synthetic series</strong>, and it behaved as a
              5&nbsp;% test should. Applied to the <strong>7090 series</strong> of the game map, built from NASA GLDAS,
              GPM IMERG and MERRA-2, it finds:
            </p>
          </>
        )}
      </Panel>
      <ul className="how-cards how-cards--three">
        {VERDICTS.map((v) => (
          <li key={v.stamp} className="how-card">
            <span className="how-card__stamp">{v.stamp}</span>
            <span className="how-card__value">{v.value}</span>
            <span className="how-card__detail">{v.text}</span>
          </li>
        ))}
      </ul>
      <Bubble>
        {L(
          'The 10 places featured in the game tell the same story.',
          'Los 10 lugares destacados del juego cuentan la misma historia.',
        )}
      </Bubble>
      <footer className="how-credits">
        <p>
          {L(
            'NASA Space Apps Challenge 2026 · Challenge "Be An Earth System Trend Detective!"',
            'NASA Space Apps Challenge 2026 · Reto "Be An Earth System Trend Detective!"',
          )}
        </p>
        <p className="how-credits__data">
          {L('Data: NASA GLDAS, NASA GPM IMERG, NASA MERRA-2', 'Datos: NASA GLDAS, NASA GPM IMERG, NASA MERRA-2')}
        </p>
      </footer>
    </div>
  )
}

export function PageQuestion() {
  return (
    <div className="how-panels">
      <Panel caption={L('The question', 'La pregunta')}>
        {LANG === 'es' ? (
          <p>
            John Datason se creó para el reto <strong>"Be An Earth System Trend Detective!"</strong> del NASA Space Apps
            Challenge 2026. Quien juega elige un lugar de España y una variable, mira las pruebas y escribe una
            conclusión, que luego se compara con un resultado estadístico.
          </p>
        ) : (
          <p>
            John Datason was built for the NASA Space Apps Challenge 2026 problem{' '}
            <strong>"Be An Earth System Trend Detective!"</strong>. The player picks a place in Spain and a variable,
            looks at the evidence and writes a conclusion, which is then compared with a statistical result.
          </p>
        )}
        <p>
          {L(
            'That result has to answer one question honestly:',
            'Ese resultado tiene que responder con honestidad a una pregunta:',
          )}
        </p>
        <Bubble>
          {L(
            'Has this variable changed over the last decades by more than natural ups and downs would produce?',
            '¿Ha cambiado esta variable en las últimas décadas más de lo que producirían sus subidas y bajadas naturales?',
          )}
        </Bubble>
      </Panel>
      <Panel caption={L('The answer, in three parts', 'La respuesta, en tres partes')} tone="manila">
        <ol className="how-parts">
          <li>
            <strong>{L('A rate of change', 'Un ritmo de cambio')}</strong>{' '}
            {L('per decade, in the units of the variable.', 'por década, en las unidades de la variable.')}
          </li>
          <li>
            <strong>{L('A 95 % confidence interval', 'Un intervalo de confianza del 95 %')}</strong>{' '}
            {L('around that rate.', 'alrededor de ese ritmo.')}
          </li>
          <li>
            <strong>{L('A significance test', 'Un test de significación')}</strong>
            {L(': real change, or noise?', ': ¿cambio real o ruido?')}
          </li>
        </ol>
        {LANG === 'es' ? (
          <p>
            Un resultado <strong>no significativo</strong> también es un resultado, y el juego nunca empuja a nadie
            hacia una tendencia que los datos no respaldan.
          </p>
        ) : (
          <p>
            A result that is <strong>not significant</strong> is still a result, and the game never pushes the player
            towards a trend that the data do not support.
          </p>
        )}
      </Panel>
    </div>
  )
}

const SOURCES: {
  name: string
  kind: string
  what: string
  from: string
  grid: string
}[] = [
  {
    name: 'GLDAS-2.1 Noah',
    kind: L('Land surface model', 'Modelo de superficie terrestre'),
    what: L(
      'Air temperature, wind speed, soil moisture in the top 10 cm, evapotranspiration',
      'Temperatura del aire, velocidad del viento, humedad de los 10 cm superiores del suelo, evapotranspiración',
    ),
    from: L('from 2000', 'desde 2000'),
    grid: '0.25°',
  },
  {
    name: 'GPM IMERG Final',
    kind: L('Satellites + rain gauges', 'Satélites + pluviómetros'),
    what: L(
      'Precipitation, aggregated from 0.1° to the same 0.25° grid',
      'Precipitación, agregada de 0,1° a la misma malla de 0,25°',
    ),
    from: L('from 1998', 'desde 1998'),
    grid: L('0.1° → 0.25°', '0,1° → 0,25°'),
  },
  {
    name: 'MERRA-2',
    kind: L('Reanalysis', 'Reanálisis'),
    what: L('A longer 2 m temperature record', 'Un registro más largo de temperatura a 2 m'),
    from: L('from 1980', 'desde 1980'),
    grid: L('about 55 km', 'unos 55 km'),
  },
]

export function PageData() {
  return (
    <div className="how-stack">
      <ul className="how-cards how-cards--three">
        {SOURCES.map((s) => (
          <li key={s.name} className="how-card how-card--src">
            <span className="how-card__stamp">{s.kind}</span>
            <span className="how-card__value">{s.name}</span>
            <span className="how-card__label">
              {s.from} · {s.grid}
            </span>
            <span className="how-card__detail">{s.what}</span>
          </li>
        ))}
      </ul>
      <div className="how-panels">
        <Panel caption={L('The game map', 'El mapa del juego')}>
          <p>
            {L(
              'Spain is divided into land cells of 0.25°, roughly 28 km across. Every cell carries the full monthly series of all six variables, except seven coastal cells where GLDAS has no soil moisture or evapotranspiration.',
              'España se divide en celdas de tierra de 0,25°, de unos 28 km de lado. Cada celda tiene la serie mensual completa de las seis variables, salvo siete celdas costeras donde GLDAS no da humedad del suelo ni evapotranspiración.',
            )}
          </p>
          <dl className="how-sum">
            <div>
              <dt>{L('1184 cells × 6 variables', '1184 celdas × 6 variables')}</dt>
              <dd>7104</dd>
            </div>
            <div>
              <dt>{L('7 coastal cells × 2 variables', '7 celdas costeras × 2 variables')}</dt>
              <dd>−14</dd>
            </div>
            <div className="how-sum__total">
              <dt>{L('Series on the map', 'Series en el mapa')}</dt>
              <dd>7090</dd>
            </div>
          </dl>
        </Panel>
        <Panel caption={L('The featured places', 'Los lugares destacados')} tone="manila">
          <div className="how-bigs">
            <p className="how-big">
              10 <small>{L('places', 'lugares')}</small>
            </p>
            <p className="how-big">
              19 <small>{L('series', 'series')}</small>
            </p>
          </div>
          <p>
            {L(
              'Each featured place uses the original pixel of the same products that contains the point: series of temperature, precipitation and soil moisture.',
              'Cada lugar destacado usa el píxel original de los mismos productos que contiene el punto: series de temperatura, precipitación y humedad del suelo.',
            )}
          </p>
        </Panel>
      </div>
    </div>
  )
}

const xBar = (
  <Sym>
    x̄<sub>m</sub>
  </Sym>
)

export function PageTestSlope() {
  return (
    <div className="how-panels">
      <Panel caption={L('1 · Seasons out', '1 · Fuera las estaciones')}>
        {LANG === 'es' ? (
          <p>
            Una serie mensual está dominada por las estaciones, así que el primer paso es quitarlas. Si{' '}
            <Sym>
              x<sub>t</sub>
            </Sym>{' '}
            es el valor en el instante <Sym>t</Sym> (en años decimales), cada valor se sustituye por su{' '}
            <strong>anomalía</strong> respecto a la media {xBar} de su mes del calendario en todo el registro:
          </p>
        ) : (
          <p>
            A monthly series is dominated by the seasons, so the first step is to remove them. If{' '}
            <Sym>
              x<sub>t</sub>
            </Sym>{' '}
            is the value at time <Sym>t</Sym> (in decimal years), each value is replaced by its <strong>anomaly</strong>{' '}
            with respect to the mean {xBar} of its own calendar month over the whole record:
          </p>
        )}
        <FormulaAnomaly />
        <Illustration
          note={L('Made-up monthly values, before and after', 'Valores mensuales inventados, antes y después')}
        >
          <span className="how-mini-label">{L('Raw months', 'Meses en bruto')}</span>
          <SeasonalChart />
          <span className="how-mini-label how-mini-label--red">{L('Anomalies', 'Anomalías')}</span>
          <AnomalyChart />
        </Illustration>
      </Panel>
      <Panel caption={L('Enough evidence', 'Pruebas suficientes')} tone="sea">
        <MonthRuler />
        {LANG === 'es' ? (
          <p>
            Los meses que faltan simplemente se saltan, pero solo analizamos una serie con al menos{' '}
            <strong>diez años (120 meses)</strong> de datos válidos.
          </p>
        ) : (
          <p>
            Missing months are simply skipped, but we only analyse a series with at least{' '}
            <strong>ten years (120 months)</strong> of valid data.
          </p>
        )}
      </Panel>
      <Panel caption={L('2 · The Sen slope', '2 · La pendiente de Sen')} tone="manila">
        {LANG === 'es' ? (
          <p>
            El ritmo de cambio es la <strong>pendiente de Sen</strong> (Theil, 1950; Sen, 1968): la mediana de las
            pendientes entre cada par de anomalías. Unos pocos meses extremos no pueden arrastrarla como arrastrarían
            una recta de mínimos cuadrados.
          </p>
        ) : (
          <p>
            The rate of change is the <strong>Sen slope</strong> (Theil, 1950; Sen, 1968): the median of the slopes
            between every pair of anomalies. A few extreme months cannot drag it around the way they would drag a
            least-squares line.
          </p>
        )}
        <FormulaSen />
        <Illustration
          note={L(
            'Made-up yearly values; thin lines are a few of the pairs',
            'Valores anuales inventados; las líneas finas son algunos de los pares',
          )}
        >
          <SenScatter />
        </Illustration>
        <p>
          {L(
            'We report it per decade, in the units of the variable.',
            'La damos por década, en las unidades de la variable.',
          )}
        </p>
      </Panel>
    </div>
  )
}

export function PageTestSignificance() {
  return (
    <div className="how-panels">
      <Panel caption={L('3 · Months have memory', '3 · Los meses tienen memoria')}>
        {LANG === 'es' ? (
          <p>
            Si la pendiente es real o solo ruido lo decide el <strong>test de Mann-Kendall</strong> (Mann, 1945;
            Kendall, 1975). Pero las anomalías climáticas tienen memoria: a un mes cálido suele seguirle otro mes
            cálido, y entonces el test clásico encuentra tendencias que no existen.
          </p>
        ) : (
          <p>
            Whether that slope is real or just noise is decided by the <strong>Mann-Kendall test</strong> (Mann, 1945;
            Kendall, 1975). Climate anomalies have memory, though: a warm month tends to follow a warm month, and the
            classic test then finds trends that are not there.
          </p>
        )}
        <Illustration note={L('No real trend in either line', 'Ninguna de las dos líneas tiene tendencia real')}>
          <span className="how-mini-label">{L('Months with memory', 'Meses con memoria')}</span>
          <StickyChart />
          <span className="how-mini-label how-mini-label--blue">{L('After pre-whitening', 'Tras el preblanqueo')}</span>
          <WhitenedChart />
        </Illustration>
        {LANG === 'es' ? (
          <p>
            Seguimos a Yue y Wang (2002) y <strong>preblanqueamos</strong> las anomalías con su autocorrelación de
            retardo uno{' '}
            <Sym>
              r<sub>1</sub>
            </Sym>{' '}
            antes del test:
          </p>
        ) : (
          <p>
            We follow Yue and Wang (2002) and <strong>pre-whiten</strong> the anomalies with their lag-one
            autocorrelation{' '}
            <Sym>
              r<sub>1</sub>
            </Sym>{' '}
            before testing:
          </p>
        )}
        <FormulaPrewhitening />
      </Panel>
      <Panel caption={L('4 · The Mann-Kendall test', '4 · El test de Mann-Kendall')} tone="manila">
        {LANG === 'es' ? (
          <p>
            El test se calcula sobre los <Sym>n′</Sym> valores resultantes:
          </p>
        ) : (
          <p>
            The test is computed on the resulting <Sym>n′</Sym> values:
          </p>
        )}
        <FormulaMannKendall />
        <div className="how-verdict">
          <DotGrid100 />
          <div>
            <p className="how-big">
              <Sym>p</Sym> <span className="how-big__op">&lt;</span> {fmtNumber(0.05, 2)}
            </p>
            {LANG === 'es' ? (
              <p>
                Una tendencia cuenta como <strong>significativa</strong> cuando <Sym>p</Sym> &lt; {fmtNumber(0.05, 2)}:
                sin tendencia, algo así de fuerte saldría por azar menos de 5 veces de cada 100.
              </p>
            ) : (
              <p>
                A trend counts as <strong>significant</strong> when <Sym>p</Sym> &lt; {fmtNumber(0.05, 2)}: with no
                trend, a result this strong would turn up by chance less than 5 times in 100.
              </p>
            )}
          </div>
        </div>
      </Panel>
    </div>
  )
}

export function PageTestInterval() {
  return (
    <div className="how-stack">
      <Panel caption={L("5 · Gilbert's interval", '5 · El intervalo de Gilbert')} wide>
        {LANG === 'es' ? (
          <p>
            La incertidumbre de la pendiente sale del método de rangos de <strong>Gilbert (1987)</strong>. De las{' '}
            <Sym>N′</Sym> pendientes entre pares, ordenadas, el intervalo del 95&nbsp;% va de la que ocupa la posición{' '}
            <Sym>
              k<sub>inf</sub>
            </Sym>{' '}
            a la de la posición{' '}
            <Sym>
              k<sub>sup</sub>
            </Sym>
            :
          </p>
        ) : (
          <p>
            The uncertainty of the slope comes from <strong>Gilbert's (1987)</strong> rank method. Out of the{' '}
            <Sym>N′</Sym> sorted pairwise slopes, the 95&nbsp;% interval runs from the one at position{' '}
            <Sym>
              k<sub>low</sub>
            </Sym>{' '}
            to the one at position{' '}
            <Sym>
              k<sub>high</sub>
            </Sym>
            :
          </p>
        )}
        <div className="how-eqs">
          <FormulaGilbertRanks />
        </div>
        <p>{L('with', 'con')}</p>
        <FormulaGilbertC />
      </Panel>
      <div className="how-panels">
        <Panel caption={L('Wider for memory', 'Más ancho por la memoria')} tone="manila">
          <Illustration>
            <SlopeFan />
          </Illustration>
          {LANG === 'es' ? (
            <p>
              El segundo factor ensancha el intervalo por esa misma memoria de los datos: <Sym>ρ</Sym> es la
              autocorrelación de retardo uno de lo que queda tras quitar la tendencia, limitada entre 0 y 0,95. Las
              posiciones se <strong>redondean hacia fuera</strong>, para que el intervalo peque de ancho.
            </p>
          ) : (
            <p>
              The second factor widens the interval for the same memory in the data: <Sym>ρ</Sym> is the lag-one
              autocorrelation of what is left after removing the trend, kept between 0 and 0.95. The positions are{' '}
              <strong>rounded outwards</strong>, so that the interval errs on the wide side.
            </p>
          )}
        </Panel>
        <Panel caption={L('At the 5 % boundary', 'En el límite del 5 %')} tone="sea">
          <p>
            {L(
              'The test and the interval deal with memory in two different ways, so right at the 5 % boundary they can disagree: a significant slope can have an interval that still touches zero.',
              'El test y el intervalo tratan la memoria de dos formas distintas, así que justo en el límite del 5 % pueden discrepar: una pendiente significativa puede tener un intervalo que aún toca el cero.',
            )}
          </p>
          <p className="how-big">
            3{' '}
            <small>
              {L(
                'of our series: marked with an asterisk later',
                'de nuestras series: las marcamos con un asterisco más adelante',
              )}
            </small>
          </p>
          <p>
            {L(
              'The same code computes every number shown in the game, in the data pipeline and in the database.',
              'El mismo código calcula cada número que se ve en el juego, en el proceso de datos y en la base de datos.',
            )}
          </p>
        </Panel>
      </div>
    </div>
  )
}

const UNIT_FACTS: Fact[] = [
  {
    value: '3 %',
    label: L('false alarms, white noise', 'falsas alarmas, ruido blanco'),
    detail: L('200 trend-free series of white noise.', '200 series de ruido blanco sin tendencia.'),
  },
  {
    value: '4 %',
    label: L('false alarms, memory', 'falsas alarmas, con memoria'),
    detail: L(
      `Strongly autocorrelated noise (φ = ${fmtNumber(0.6, 1)}). Both under the nominal 5\u00a0%.`,
      `Ruido muy autocorrelacionado (φ = ${fmtNumber(0.6, 1)}). Ambas por debajo del 5\u00a0% nominal.`,
    ),
  },
]

const REHEARSAL_FACTS: Fact[] = [
  {
    value: L('4.7–5.6 %', '4,7–5,6 %'),
    label: L('false alarms', 'falsas alarmas'),
    detail: L(
      'Where there was no trend: close to the 5 % it promises.',
      'Donde no había tendencia: cerca del 5 % que promete.',
    ),
    stamp: L('Verified', 'Verificado'),
  },
  {
    value: L('6.8 %', '6,8 %'),
    label: L('precipitation', 'precipitación'),
    detail: L(
      'A little higher, probably because rainfall is so skewed.',
      'Algo más alto, probablemente porque la lluvia es muy asimétrica.',
    ),
  },
  {
    value: L('93.9–95.8 %', '93,9–95,8 %'),
    label: L('interval coverage', 'cobertura del intervalo'),
    detail: L(
      'How often the 95 % interval contained the true slope.',
      'Con qué frecuencia el intervalo del 95 % contuvo la pendiente real.',
    ),
    stamp: L('Verified', 'Verificado'),
  },
  {
    value: '±3 %',
    label: L('slope bias', 'sesgo de la pendiente'),
    detail: L('The slopes were unbiased to within 3 %.', 'Las pendientes no tenían sesgo, con un margen del 3 %.'),
    stamp: L('Verified', 'Verificado'),
  },
  {
    value: '0',
    label: L('strong trends missed', 'tendencias fuertes perdidas'),
    detail: L('Strong trends were never missed.', 'Nunca se escapó una tendencia fuerte.'),
    stamp: L('Verified', 'Verificado'),
  },
]

const CODE_FACTS: Fact[] = [
  {
    value: '9',
    label: L('significant figures', 'cifras significativas'),
    detail: L(
      'The Python code and the database script agree to nine significant figures.',
      'El código Python y el script de la base de datos coinciden en nueve cifras significativas.',
    ),
    stamp: L('Match', 'Coinciden'),
  },
  {
    value: '7090',
    label: L('real results checked', 'resultados reales revisados'),
    detail: L(
      'Checked one by one, with no errors, before they were uploaded.',
      'Revisados uno a uno, sin errores, antes de subirlos.',
    ),
    stamp: L('0 errors', '0 errores'),
  },
]

const POWER_FACTS: Fact[] = [
  {
    value: '14 / 18',
    label: L('same direction', 'misma dirección'),
    detail: L('The direction of the trend matched.', 'La dirección de la tendencia coincidió.'),
  },
  {
    value: '13 / 13',
    label: L('same significance', 'misma significación'),
    detail: L('All temperature and precipitation cases.', 'Todos los casos de temperatura y precipitación.'),
  },
]

export function PageChecking() {
  return (
    <div className="how-stack">
      <Panel caption={L('Unit tests', 'Tests unitarios')} wide>
        {LANG === 'es' ? (
          <p>
            No queríamos fiarnos del método a ciegas, así que lo probamos con datos cuya respuesta conocíamos. Los tests
            unitarios le dan series con una tendencia conocida, al alza o a la baja, y comprueban que la pendiente
            vuelve dentro de la tolerancia; le dan series estacionales sin tendencia y comprueban que se queda callado,
            incluso con un <strong>10&nbsp;% de meses perdidos</strong>.
          </p>
        ) : (
          <p>
            We did not want to trust the method on faith, so it was tested on data whose answer we knew. The unit tests
            feed it series with a known upward or downward trend and check that the slope comes back within tolerance;
            they feed it seasonal series with no trend and check that it stays quiet, even when{' '}
            <strong>ten per cent of the months</strong> are missing.
          </p>
        )}
        <Facts facts={UNIT_FACTS} />
      </Panel>
      <Panel caption={L('Full dress rehearsal', 'Ensayo general')} wide tone="manila">
        {LANG === 'es' ? (
          <p className="how-lead">
            <strong>7104 series sintéticas</strong> con las mismas longitudes que el mapa real, ciclo estacional, ruido
            autocorrelacionado, huecos y una tendencia real solo en la mitad de ellas.
          </p>
        ) : (
          <p className="how-lead">
            <strong>7104 synthetic series</strong> with the same lengths as the real map, a seasonal cycle,
            autocorrelated noise, gaps, and a real trend in only half of them.
          </p>
        )}
        <Facts facts={REHEARSAL_FACTS} five />
        <Facts facts={CODE_FACTS} alt />
      </Panel>
      <Panel caption={L('A second opinion: NASA POWER', 'Una segunda opinión: NASA POWER')} wide tone="sea">
        <p>
          {L(
            'As a last check we compared each featured series with NASA POWER at the same point, over the period both cover.',
            'Como última comprobación, comparamos cada serie destacada con NASA POWER en el mismo punto, en el periodo que cubren ambos.',
          )}
        </p>
        <Facts facts={POWER_FACTS} />
        <Bubble>
          {L(
            'The temperature match is less impressive than it sounds: POWER temperature is itself derived from MERRA-2. The precipitation and soil moisture comparisons, which use different products, are the more telling ones.',
            'La coincidencia en temperatura impresiona menos de lo que parece: la temperatura de POWER sale a su vez de MERRA-2. Las comparaciones de precipitación y humedad del suelo, que usan productos distintos, son las que más dicen.',
          )}
        </Bubble>
      </Panel>
    </div>
  )
}

const FEATURED_VERDICTS: Fact[] = [
  {
    value: '7 / 7',
    label: L('temperature rises', 'la temperatura sube'),
    detail: L(
      `Significant everywhere we tested it, by +${fmtNumber(0.26, 2)} to +${fmtNumber(0.39, 2)} °C per decade.`,
      `Significativa en todos los lugares donde la probamos, de +${fmtNumber(0.26, 2)} a +${fmtNumber(0.39, 2)} °C por década.`,
    ),
  },
  {
    value: '0 / 7',
    label: L('precipitation trends', 'tendencias de precipitación'),
    detail: L(
      'No significant trend at any of the 7 places.',
      'Ninguna tendencia significativa en ninguno de los 7 lugares.',
    ),
  },
  {
    value: '5 / 5',
    label: L('soil moisture falls', 'la humedad del suelo baja'),
    detail: L('Significant at 3 places, but only just.', 'Significativa en 3 lugares, pero por muy poco.'),
  },
]

export function PageFeatured() {
  return (
    <div className="how-stack">
      <Facts facts={FEATURED_VERDICTS} />
      <Panel caption={L('A consistent picture', 'Una imagen coherente')} wide tone="manila">
        {LANG === 'es' ? (
          <p>
            En los humedales de Doñana, el incendio de la Sierra de la Culebra y las Tablas de Daimiel, la bajada de la
            humedad del suelo es significativa, pero por muy poco: los valores de <Sym>p</Sym> son {fmtNumber(0.05, 3)},{' '}
            {fmtNumber(0.026, 3)} y {fmtNumber(0.047, 3)}, y los intervalos aún llegan a cero. Son los casos límite del
            capítulo anterior, y los leemos como <strong>indicios débiles de secado</strong>, no como un resultado
            firme.
          </p>
        ) : (
          <p>
            At Doñana wetlands, Sierra de la Culebra fire and Tablas de Daimiel the fall in soil moisture is
            significant, but only just: the <Sym>p</Sym>-values are 0.050, 0.026 and 0.047, and the intervals still
            reach zero. These are the boundary cases described earlier, and we read them as{' '}
            <strong>weak evidence of drying</strong> rather than as a firm result.
          </p>
        )}
      </Panel>
      <Figure
        caption={L(
          'Slope and 95 % interval of each featured series. Filled circles are significant at the 5 % level, open circles are not; the dashed line marks no change. * Significant, but the interval still includes zero.',
          'Pendiente e intervalo del 95 % de cada serie destacada. Los círculos rellenos son significativos al 5 %, los vacíos no; la línea discontinua marca "sin cambio". * Significativa, pero el intervalo aún incluye el cero.',
        )}
      >
        <ForestPlot />
      </Figure>
    </div>
  )
}

export function PageTable() {
  return (
    <div className="how-stack">
      <p className="how-intro">
        {LANG === 'es' ? (
          <>
            Pendientes e intervalos del 95&nbsp;% por década; <Sym>p</Sym> del test de Mann-Kendall con preblanqueo. El
            asterisco marca las series significativas cuyo intervalo aún incluye el cero.
          </>
        ) : (
          <>
            Slopes and 95&nbsp;% intervals per decade; <Sym>p</Sym> from the pre-whitened Mann-Kendall test. The
            asterisk marks significant series whose interval still includes zero.
          </>
        )}
      </p>
      <FeaturedTable />
      <p className="how-small how-swipe" aria-hidden="true">
        {L('Swipe the table sideways to see every column.', 'Desliza la tabla de lado para ver todas las columnas.')}
      </p>
      <p className="how-small">
        {L(
          'T2M: 2 m temperature (MERRA-2) · PRECIP: precipitation (GPM IMERG) · SOILM: soil moisture, 0–10 cm (GLDAS)',
          'T2M: temperatura a 2 m (MERRA-2) · PRECIP: precipitación (GPM IMERG) · SOILM: humedad del suelo, 0–10 cm (GLDAS)',
        )}
      </p>
    </div>
  )
}

// Share of map cells with a significant trend, per variable: the "Results on the map" table of
// docs/methods.md (pipeline/fill_trends.py on the full database export, 7090 series).
const MAP_VARIABLES: MapVariable[] = [
  {
    name: L('Air temperature', 'Temperatura del aire'),
    source: 'GLDAS',
    cells: 1184,
    up: 1081,
    down: 15,
  },
  {
    name: L('2 m temperature', 'Temperatura a 2 m'),
    source: 'MERRA-2',
    cells: 1184,
    up: 1181,
    down: 0,
  },
  {
    name: L('Soil moisture, 0–10 cm', 'Humedad del suelo, 0–10 cm'),
    source: 'GLDAS',
    cells: 1177,
    up: 0,
    down: 633,
  },
  {
    name: L('Evapotranspiration', 'Evapotranspiración'),
    source: 'GLDAS',
    cells: 1177,
    up: 260,
    down: 136,
  },
  {
    name: L('Wind speed', 'Velocidad del viento'),
    source: 'GLDAS',
    cells: 1184,
    up: 392,
    down: 550,
  },
  {
    name: L('Precipitation', 'Precipitación'),
    source: 'GPM IMERG',
    cells: 1184,
    up: 1,
    down: 1,
  },
]

const MAP_FACTS: Fact[] = [
  {
    value: '1181 / 1184',
    label: L('cells warming, MERRA-2', 'celdas que se calientan, MERRA-2'),
    detail: L(
      `The long 2 m temperature record rises significantly; median +${fmtNumber(0.33, 2)} °C per decade.`,
      `El registro largo de temperatura a 2 m sube de forma significativa; mediana de +${fmtNumber(0.33, 2)} °C por década.`,
    ),
  },
  {
    value: '1081 / 1184',
    label: L('cells warming, GLDAS', 'celdas que se calientan, GLDAS'),
    detail: L(
      'GLDAS air temperature rises significantly.',
      'La temperatura del aire de GLDAS sube de forma significativa.',
    ),
  },
  {
    value: '633 / 1177',
    label: L('cells with drier top soil', 'celdas con el suelo más seco'),
    detail: L(
      'Top-layer soil moisture decreases; it increases in none.',
      'La humedad de la capa superior baja; no sube en ninguna.',
    ),
  },
  {
    value: '2',
    label: L('cells with a rain trend', 'celdas con tendencia de lluvia'),
    detail: L(
      'Fewer than the roughly 59 per variable that chance alone would flag: no sign of a trend.',
      'Menos que las unas 59 por variable que marcaría el azar por sí solo: ninguna señal de tendencia.',
    ),
  },
]

const SOURCE_FACTS: Fact[] = [
  { value: '97 %', label: L('same sign of trend', 'mismo signo de tendencia') },
  { value: '92 %', label: L('same verdict', 'mismo veredicto') },
  {
    value: L('+0.89 vs +0.65', '+0,89 frente a +0,65'),
    label: L('median °C per decade', 'mediana, °C por década'),
    detail: L('GLDAS warms faster than MERRA-2.', 'GLDAS se calienta más rápido que MERRA-2.'),
  },
  {
    value: `r = ${fmtNumber(0.42, 2)}`,
    label: L('slope correlation', 'correlación de pendientes'),
    detail: L('From cell to cell.', 'De celda a celda.'),
  },
]

export function PageMap() {
  return (
    <div className="how-stack">
      <p className="how-intro">
        {L(
          'The map tells the same story at scale. All 7090 series were long enough to analyse.',
          'El mapa cuenta la misma historia a gran escala. Las 7090 series eran lo bastante largas para analizarlas.',
        )}
      </p>
      <Facts facts={MAP_FACTS} />
      <Figure
        caption={L(
          'Share of map cells with a significant increase (red), a significant decrease (blue) or no significant trend (dots). The dashed line is the 5 % that chance alone would produce. Wind speed and evapotranspiration move in both directions depending on the region.',
          'Porcentaje de celdas del mapa con un aumento significativo (rojo), un descenso significativo (azul) o sin tendencia significativa (puntos). La línea discontinua es el 5 % que produciría el azar por sí solo. El viento y la evapotranspiración se mueven en los dos sentidos según la región.',
        )}
      >
        <MapBars rows={MAP_VARIABLES} />
      </Figure>
      <Panel caption={L('Two temperature sources', 'Dos fuentes de temperatura')} wide tone="manila">
        {LANG === 'es' ? (
          <p>
            GLDAS y MERRA-2 coinciden en lo grande pero no en el detalle. En los años que comparten,{' '}
            <strong>de 2000 a 2026</strong>:
          </p>
        ) : (
          <p>
            GLDAS and MERRA-2 agree on the big picture but not in detail. Over the years they share,{' '}
            <strong>2000 to 2026</strong>:
          </p>
        )}
        <Facts facts={SOURCE_FACTS} />
        <Bubble>
          {L(
            'A useful reminder: each cell is an estimate, not a measurement.',
            'Un recordatorio útil: cada celda es una estimación, no una medida.',
          )}
        </Bubble>
      </Panel>
    </div>
  )
}

const LIMITS: { title: string; text: string }[] = [
  {
    title: L('Many tests at once', 'Muchos tests a la vez'),
    text: L(
      'With some 7000 tests at the 5 % level, a few hundred cells will look significant by chance. We do not correct for multiple testing (Benjamini and Hochberg, 1995; Wilks, 2016), so one significant cell on its own is weak evidence; a coherent pattern over a whole region is not. For temperature and soil moisture the share of significant cells is far above 5 %; for precipitation it is below.',
      'Con unos 7000 tests al 5 %, unos cientos de celdas parecerán significativas por azar. No corregimos por comparaciones múltiples (Benjamini y Hochberg, 1995; Wilks, 2016), así que una celda significativa por sí sola es una prueba débil; un patrón coherente en toda una región, no. En temperatura y humedad del suelo, el porcentaje de celdas significativas está muy por encima del 5 %; en precipitación, por debajo.',
    ),
  },
  {
    title: L('Short records', 'Registros cortos'),
    text: L(
      'GLDAS and IMERG begin in 2000 and 1998, so their trends cover 26 to 28 years and can be shaped by a few unusual years at either end. MERRA-2, from 1980, is the long-term reference.',
      'GLDAS e IMERG empiezan en 2000 y 1998, así que sus tendencias cubren de 26 a 28 años y unos pocos años raros en cualquiera de los extremos pueden moldearlas. MERRA-2, desde 1980, es la referencia a largo plazo.',
    ),
  },
  {
    title: L('Different end dates', 'Fechas de fin distintas'),
    text: L(
      'Publication delays mean the products do not even end in the same month: from September 2025 for IMERG to September 2026 for MERRA-2.',
      'Por los retrasos de publicación, los productos ni siquiera terminan el mismo mes: desde septiembre de 2025 en IMERG hasta septiembre de 2026 en MERRA-2.',
    ),
  },
  {
    title: L('Models, not measurements', 'Modelos, no medidas'),
    text: L(
      'GLDAS is a land surface model driven by observations, MERRA-2 is a reanalysis and IMERG merges satellites with rain gauges. All three are validated, and all three have their own biases, as the disagreement between the two temperature sources shows.',
      'GLDAS es un modelo de superficie terrestre alimentado con observaciones, MERRA-2 es un reanálisis e IMERG combina satélites con pluviómetros. Los tres están validados y los tres tienen sus propios sesgos, como muestra el desacuerdo entre las dos fuentes de temperatura.',
    ),
  },
  {
    title: L('Cells, not towns', 'Celdas, no pueblos'),
    text: L(
      "A cell is an area average of about 28 km, or 55 km for MERRA-2, whose nearest point near the coast may lie over the sea. It cannot see a city's heat island.",
      'Una celda es un promedio de una zona de unos 28 km, o 55 km en MERRA-2, cuyo punto más cercano junto a la costa puede caer sobre el mar. No puede ver la isla de calor de una ciudad.',
    ),
  },
  {
    title: L('A trend is a summary', 'Una tendencia es un resumen'),
    text: L(
      'The Sen slope is a single average rate, blind to changes in extremes, sudden jumps or cycles that last several years.',
      'La pendiente de Sen es un único ritmo medio, ciego a cambios en los extremos, saltos bruscos o ciclos de varios años.',
    ),
  },
  {
    title: L('Significant is not a cause', 'Significativa no es una causa'),
    text: L(
      'A significant trend says that something changed, not why. The game asks the player about the data, not about causes.',
      'Una tendencia significativa dice que algo cambió, no por qué. El juego pregunta por los datos, no por las causas.',
    ),
  },
  {
    title: L('Not significant is not "no change"', 'No significativa no es "sin cambio"'),
    text: L(
      'A trend that is not significant does not prove that nothing changed; it only means the data do not show it clearly enough.',
      'Una tendencia no significativa no prueba que nada haya cambiado; solo significa que los datos no lo muestran con suficiente claridad.',
    ),
  },
]

export function PageLimits() {
  return (
    <div className="how-limits">
      <ul className="how-notes">
        {LIMITS.map((l, i) => (
          <li key={l.title} className="how-note" style={{ '--i': i % 5 } as CSSProperties}>
            <h3 className="how-note__title">{l.title}</h3>
            <p>{l.text}</p>
          </li>
        ))}
      </ul>
      <footer className="how-credits">
        {LANG === 'es' ? (
          <p>
            Todo este informe se puede reproducir desde el repositorio del proyecto: el análisis está en{' '}
            <code>pipeline/</code>, sus tests en <code>pipeline/tests/</code> y <code>tests/stats/</code>, y las tablas
            en <code>docs/methods.md</code>.
          </p>
        ) : (
          <p>
            Everything in this report can be reproduced from the project repository: the analysis lives in{' '}
            <code>pipeline/</code>, its tests in <code>pipeline/tests/</code> and <code>tests/stats/</code>, and the
            tables in <code>docs/methods.md</code>.
          </p>
        )}
      </footer>
    </div>
  )
}

interface Reference {
  text: ReactNode
  doi?: string
  url?: string
}

const REFERENCES: Reference[] = [
  {
    text: (
      <>
        Benjamini, Y. and Hochberg, Y. (1995). Controlling the false discovery rate: a practical and powerful approach
        to multiple testing. <i>Journal of the Royal Statistical Society B</i> 57(1), 289-300.
      </>
    ),
    doi: '10.1111/j.2517-6161.1995.tb02031.x',
  },
  {
    text: (
      <>
        Gelaro, R. et al. (2017). The Modern-Era Retrospective Analysis for Research and Applications, Version 2
        (MERRA-2). <i>Journal of Climate</i> 30(14), 5419-5454.
      </>
    ),
    doi: '10.1175/JCLI-D-16-0758.1',
  },
  {
    text: (
      <>
        Gilbert, R. O. (1987). <i>Statistical Methods for Environmental Pollution Monitoring</i>. Van Nostrand Reinhold.
      </>
    ),
  },
  {
    text: (
      <>
        Huffman, G. J., Stocker, E. F., Bolvin, D. T., Nelkin, E. J. and Tan, J. (2023). GPM IMERG Final Precipitation
        L3 1 month 0.1 degree x 0.1 degree V07. Goddard Earth Sciences Data and Information Services Center (GES DISC).
      </>
    ),
    doi: '10.5067/GPM/IMERG/3B-MONTH/07',
  },
  {
    text: (
      <>
        Kendall, M. G. (1975). <i>Rank Correlation Methods</i>, 4th ed. Charles Griffin, London.
      </>
    ),
  },
  {
    text: (
      <>
        Mann, H. B. (1945). Nonparametric tests against trend. <i>Econometrica</i> 13(3), 245-259.
      </>
    ),
    doi: '10.2307/1907187',
  },
  {
    text: L(
      'NASA POWER (fallback source for the featured cases, not used in the current files): data obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program.',
      'NASA POWER (fuente de reserva para los casos destacados, no usada en los archivos actuales): data obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program.',
    ),
    url: 'https://power.larc.nasa.gov/',
  },
  {
    text: (
      <>
        Rodell, M. et al. (2004). The Global Land Data Assimilation System.{' '}
        <i>Bulletin of the American Meteorological Society</i> 85(3), 381-394.
      </>
    ),
    doi: '10.1175/BAMS-85-3-381',
  },
  {
    text: (
      <>
        Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's tau.{' '}
        <i>Journal of the American Statistical Association</i> 63(324), 1379-1389.
      </>
    ),
    doi: '10.1080/01621459.1968.10480934',
  },
  {
    text: (
      <>
        Theil, H. (1950). A rank-invariant method of linear and polynomial regression analysis, I, II, III.{' '}
        <i>Proceedings of the Koninklijke Nederlandse Akademie van Wetenschappen</i> 53, 386-392, 521-525, 1397-1412.
      </>
    ),
  },
  {
    text: (
      <>
        Wilks, D. S. (2016). "The stippling shows statistically significant grid points": how research results are
        routinely overstated and overinterpreted, and what to do about it.{' '}
        <i>Bulletin of the American Meteorological Society</i> 97(12), 2263-2273.
      </>
    ),
    doi: '10.1175/BAMS-D-15-00267.1',
  },
  {
    text: (
      <>
        Yue, S. and Wang, C. (2002). Applicability of prewhitening to eliminate the influence of serial correlation on
        the Mann-Kendall test. <i>Water Resources Research</i> 38(6), 1068.
      </>
    ),
    doi: '10.1029/2001WR000861',
  },
]

const DATASETS: { name: string; doi: string }[] = [
  { name: 'GLDAS_NOAH025_M v2.1', doi: '10.5067/SXAVCZFAQLNO' },
  { name: 'GPM_3IMERGM V07', doi: '10.5067/GPM/IMERG/3B-MONTH/07' },
  { name: 'M2TMNXSLV 5.12.4', doi: '10.5067/AP1B0BA5PD2K' },
]

function Link({ href }: { href: string }) {
  return (
    <a className="how-refs__link" href={href} target="_blank" rel="noreferrer">
      {href}
    </a>
  )
}

export function PageReferences() {
  return (
    <div className="how-stack">
      <ol className="how-refs">
        {REFERENCES.map((r, i) => (
          <li key={i}>
            {r.text} {r.doi && <Link href={`https://doi.org/${r.doi}`} />}
            {r.url && <Link href={r.url} />}
          </li>
        ))}
      </ol>
      <footer className="how-credits">
        <p className="how-credits__data">{L('Datasets', 'Conjuntos de datos')}</p>
        <ul className="how-refs how-refs--data">
          {DATASETS.map((d) => (
            <li key={d.name}>
              {d.name}: <Link href={`https://doi.org/${d.doi}`} />
            </li>
          ))}
        </ul>
        <p className="how-credits__data">
          {L('Data: NASA GLDAS, NASA GPM IMERG, NASA MERRA-2', 'Datos: NASA GLDAS, NASA GPM IMERG, NASA MERRA-2')}
        </p>
      </footer>
    </div>
  )
}
