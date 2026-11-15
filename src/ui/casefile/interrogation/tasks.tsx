// Hands-on tasks of the interrogation room. Every evidence-board task is reused as it is
// (board/tasks.tsx); two more are made for this room:
// - season_switch: flip one chart between the whole year and each season, watch a slope bar fill
//   in for every tab you visit, then tick the seasons that match the rule;
// - proof_line: drag (or move with the buttons) each trend to its side of the p = 0.05 line.
// Answers are always computed from the case data, never from the script.
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type {
  ChartSpec,
  EvidenceItem,
  InterrogationEvidence,
  InterrogationTask,
  ProofExhibit,
  SeasonId,
  TutorialData,
  TutorialSeries,
} from '../../../shared/tutorial'
import { Feedback, TaskView, type Verdict } from '../board/tasks'
import TimeSeriesChart from '../TimeSeriesChart'
import { baseUnits, formatP } from '../format'
import { ALPHA, SEASON_MONTHS, SEASON_TAB } from './labels'
import { exhibitP, seasonSwitchAnswer, trendOf, type TaskOf } from './taskData'
import { L, LANG } from '../../../shared/i18n'

interface Props<T extends InterrogationTask['type']> {
  evidence: InterrogationEvidence
  task: TaskOf<T>
  data: TutorialData
  done: boolean
  onSolved: () => void
}

/** p-value for a proof card: exact down to 0.0001 (formatP stops at "p < 0.001") */
const pText = (p: number) => (p < 0.001 ? fmtP4(p) : formatP(p))
const fmtP4 = (p: number) => { const t = p < 0.0001 ? 'p < 0.0001' : `p = ${Number(p.toPrecision(2))}`; return LANG === 'es' ? t.replace('.', ',') : t }

/** Two decimals with a true minus sign, for slopes per decade */
const fixed2 = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2)

function useVerdict(done: boolean) {
  const [v, setV] = useState<Verdict>(done ? { state: 'right' } : { state: 'idle' })
  const wrong = (extra?: string) => setV((o) => ({ state: 'wrong', extra, n: o.state === 'wrong' ? o.n + 1 : 1 }))
  return [v, setV, wrong] as const
}

// ---- season_switch ----------------------------------------------------------------------------

type Tab = 'year' | SeasonId

const tabName = (t: Tab) => (t === 'year' ? L('Whole year', 'Todo el año') : SEASON_TAB[t])

export function SeasonSwitchTask({ task, data, done, onSolved }: Props<'season_switch'>) {
  const series = data.variables[task.variable]
  const tabs: Tab[] = useMemo(() => ['year', ...task.seasons], [task.seasons])
  const [tab, setTab] = useState<Tab>('year')
  const [seen, setSeen] = useState<ReadonlySet<Tab>>(() => new Set(done ? tabs : ['year']))
  const answer = useMemo(() => (series ? seasonSwitchAnswer(task, series) : new Set<SeasonId>()), [task, series])
  const [ticked, setTicked] = useState<ReadonlySet<SeasonId>>(() => (done ? answer : new Set()))
  const [none, setNone] = useState(done && answer.size === 0)
  const [verdict, setVerdict, wrong] = useVerdict(done)
  const tabRefs = useRef(new Map<Tab, HTMLButtonElement>())
  const solved = verdict.state === 'right'
  if (!series)
    return (
      <p className="evtask__msg">
        {L(`The data for ${task.variable} is missing from this case file.`, `Faltan los datos de ${task.variable} en este expediente.`)}
      </p>
    )
  const u = baseUnits(series.units)

  const open = (t: Tab) => {
    setTab(t)
    setSeen((s) => (s.has(t) ? s : new Set(s).add(t)))
  }
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = tabs.indexOf(tab)
    let j: number
    if (e.key === 'ArrowRight') j = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = tabs.length - 1
    else return
    e.preventDefault()
    open(tabs[j])
    tabRefs.current.get(tabs[j])?.focus()
  }

  const spec: ChartSpec =
    tab === 'year'
      ? { variable: task.variable, view: 'annual', show_trend: true }
      : { variable: task.variable, view: 'season', season: tab, show_trend: true }
  const tr = trendOf(series, tab === 'year' ? undefined : tab)

  const toggle = (s: SeasonId) => {
    if (solved) return
    setNone(false)
    setTicked((t) => {
      const n = new Set(t)
      if (n.has(s)) n.delete(s)
      else n.add(s)
      return n
    })
    if (verdict.state === 'wrong') setVerdict({ state: 'idle' })
  }
  const check = () => {
    if (!none && ticked.size === 0) return wrong(L('Tick at least one box, or "None of them".', 'Marca al menos una casilla, o «Ninguna».'))
    const ok = none ? answer.size === 0 : answer.size === ticked.size && [...ticked].every((s) => answer.has(s))
    if (ok) {
      setVerdict({ state: 'right' })
      onSolved()
      return
    }
    if (none) return wrong(L('At least one season matches.', 'Al menos una estación cumple.'))
    const hits = [...ticked].filter((s) => answer.has(s)).length
    const missing = answer.size - hits
    wrong(
      L(
        `${hits} of your ${ticked.size} ${ticked.size === 1 ? 'tick is' : 'ticks are'} right${missing > 0 ? `, and ${missing === 1 ? 'one season is' : `${missing} seasons are`} missing` : ''}.`,
        `${hits} de tus ${ticked.size} ${ticked.size === 1 ? 'marca es correcta' : 'marcas son correctas'}${missing > 0 ? `, y ${missing === 1 ? 'falta una estación' : `faltan ${missing} estaciones`}` : ''}.`,
      ),
    )
  }

  return (
    <div className="evtask ixtask">
      <p className="evtask__prompt">{task.prompt}</p>
      <div className="ixtabs" role="tablist" aria-label={L('Whole year or one season', 'Todo el año o una estación')}>
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            ref={(el) => {
              if (el) tabRefs.current.set(t, el)
              else tabRefs.current.delete(t)
            }}
            className={`ixtabs__tab${tab === t ? ' is-on' : ''}${seen.has(t) ? ' is-seen' : ''}`}
            aria-selected={tab === t}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => open(t)}
            onKeyDown={onTabKey}
          >
            {tabName(t)}
            <small>{t === 'year' ? L('all months', 'todos los meses') : SEASON_MONTHS[t]}</small>
          </button>
        ))}
      </div>
      <div className="ixtabs__panel" role="tabpanel" aria-label={tabName(tab)}>
        <TimeSeriesChart spec={spec} series={series} variables={data.variables} />
        {tr && (
          <p className="ixreadout" aria-live="polite">
            <b className="ixreadout__slope">
              {fixed2(tr.slope)} {u} {L('per decade', 'por década')}
            </b>
            <span>
              {L(`95% range ${fixed2(tr.lo)} to ${fixed2(tr.hi)}`, `Rango del 95 %: de ${fixed2(tr.lo)} a ${fixed2(tr.hi)}`)}
            </span>
            <span className={`ixreadout__p${tr.p < ALPHA ? ' is-sig' : ''}`}>
              {formatP(tr.p)} · {tr.p < ALPHA ? L('significant', 'significativa') : L('not significant', 'no significativa')}
            </span>
          </p>
        )}
      </div>
      <SlopeBars tabs={tabs} seen={seen} current={tab} series={series} rule={task.rule} units={u} onPick={open} />

      <fieldset className="ixticks">
        <legend className="evoptions__prompt">{task.question}</legend>
        <div className="ixticks__row">
          {task.seasons.map((s) => (
            <label key={s} className={`ixtick${ticked.has(s) ? ' is-on' : ''}`}>
              <input type="checkbox" checked={ticked.has(s)} disabled={solved} onChange={() => toggle(s)} />
              <span>{SEASON_TAB[s]}</span>
            </label>
          ))}
          <label className={`ixtick ixtick--none${none ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={none}
              disabled={solved}
              onChange={() => {
                setNone((n) => !n)
                setTicked(new Set())
                if (verdict.state === 'wrong') setVerdict({ state: 'idle' })
              }}
            />
            <span>{L('None of them', 'Ninguna')}</span>
          </label>
        </div>
        {!solved && (
          <div className="evtask__row evtask__row--end">
            <p className="evtask__help">
              {seen.size < tabs.length
                ? L(`Visit every tab first: ${seen.size} of ${tabs.length} seen.`, `Primero visita todas las pestañas: ${seen.size} de ${tabs.length} vistas.`)
                : L('Every tab seen. Tick your answer.', 'Todas las pestañas vistas. Marca tu respuesta.')}
            </p>
            <button type="button" className="evbtn evbtn--primary" onClick={check}>
              {L('Check', 'Comprobar')}
            </button>
          </div>
        )}
      </fieldset>
      <Feedback verdict={verdict} task={task} />
    </div>
  )
}

/** One bar per tab (slope per decade, whisker = 95% range, filled if significant), shown once visited */
function SlopeBars({
  tabs,
  seen,
  current,
  series,
  rule,
  units,
  onPick,
}: {
  tabs: Tab[]
  seen: ReadonlySet<Tab>
  current: Tab
  series: TutorialSeries
  rule: 'faster_than_year' | 'significant'
  units: string
  onPick: (t: Tab) => void
}) {
  const trends = tabs.map((t) => trendOf(series, t === 'year' ? undefined : t))
  const lo = Math.min(0, ...trends.map((t) => t?.lo ?? 0))
  const hi = Math.max(0, ...trends.map((t) => t?.hi ?? 0))
  const W = 560
  const H = 150
  const top = 16
  const bottom = 118
  const y = (v: number) => bottom - ((v - lo) / (hi - lo || 1)) * (bottom - top)
  const col = W / tabs.length
  const year = trends[0]
  return (
    <figure className="ixbars">
      <figcaption className="ixbars__cap">
        {L(`Trend of each tab, ${units} per decade`, `Tendencia de cada pestaña, ${units} por década`)}
        {rule === 'faster_than_year'
          ? L(' (dashed line: the whole year)', ' (línea discontinua: todo el año)')
          : L(' (filled = significant)', ' (rellena = significativa)')}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L('Trend of every tab you visited', 'Tendencia de cada pestaña que has visitado')}>
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="ixbars__zero" />
        <text x={4} y={y(0) - 4} className="ixbars__axis">
          0
        </text>
        {rule === 'faster_than_year' && year && seen.has('year') && (
          <line x1={0} x2={W} y1={y(year.slope)} y2={y(year.slope)} className="ixbars__ref" />
        )}
        {tabs.map((t, i) => {
          const tr = trends[i]
          const cx = col * i + col / 2
          const show = seen.has(t) && tr
          return (
            <g key={t} className={`ixbars__col${current === t ? ' is-on' : ''}`} onClick={() => onPick(t)}>
              <rect x={col * i + 4} y={top - 10} width={col - 8} height={H - top + 6} className="ixbars__hit" />
              {show ? (
                <>
                  <line x1={cx} x2={cx} y1={y(tr.lo)} y2={y(tr.hi)} className="ixbars__whisker" />
                  <rect
                    x={cx - 16}
                    y={Math.min(y(tr.slope), y(0))}
                    width={32}
                    height={Math.max(1.5, Math.abs(y(tr.slope) - y(0)))}
                    className={`ixbars__bar${tr.p < ALPHA ? ' is-sig' : ''}`}
                  />
                  <text x={cx} y={Math.min(y(tr.hi), y(tr.slope)) - 5} textAnchor="middle" className="ixbars__val">
                    {fixed2(tr.slope)}
                  </text>
                </>
              ) : (
                <text x={cx} y={(top + bottom) / 2 + 8} textAnchor="middle" className="ixbars__unknown">
                  ?
                </text>
              )}
              <text x={cx} y={H - 6} textAnchor="middle" className="ixbars__label">
                {tabName(t)}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

// ---- proof_line -------------------------------------------------------------------------------

type Side = 'proven' | 'doubt'

export function ProofLineTask({ evidence, task, data, done, onSolved }: Props<'proof_line'>) {
  const ps = useMemo(() => task.exhibits.map((x) => exhibitP(x, data)), [task.exhibits, data])
  const answer = ps.map((p): Side => (p != null && p < ALPHA ? 'proven' : 'doubt'))
  const [place, setPlace] = useState<(Side | null)[]>(() => (done ? answer : task.exhibits.map(() => null)))
  const [checked, setChecked] = useState<boolean[] | null>(done ? answer.map(() => true) : null)
  const [verdict, setVerdict, wrong] = useVerdict(done)
  const [drag, setDrag] = useState<{ i: number; dx: number; dy: number; over: Side | 'tray' | null } | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const solved = verdict.state === 'right'

  const put = (i: number, side: Side | null) => {
    if (solved) return
    setPlace((p) => p.map((s, j) => (j === i ? side : s)))
    setChecked(null)
    if (verdict.state === 'wrong') setVerdict({ state: 'idle' })
  }
  const zoneAt = (x: number, y: number): Side | 'tray' | null => {
    for (const el of document.elementsFromPoint(x, y)) {
      const z = (el as HTMLElement).dataset?.zone
      if (z === 'proven' || z === 'doubt' || z === 'tray') return z
    }
    return null
  }
  const pointer = (i: number) => ({
    onPointerDown: (e: PointerEvent<HTMLLIElement>) => {
      if (solved || (e.target as HTMLElement).closest('button')) return
      e.currentTarget.setPointerCapture(e.pointerId)
      start.current = { x: e.clientX, y: e.clientY }
      setDrag({ i, dx: 0, dy: 0, over: null })
    },
    onPointerMove: (e: PointerEvent<HTMLLIElement>) => {
      if (!start.current || drag?.i !== i) return
      setDrag({ i, dx: e.clientX - start.current.x, dy: e.clientY - start.current.y, over: zoneAt(e.clientX, e.clientY) })
    },
    onPointerUp: (e: PointerEvent<HTMLLIElement>) => {
      if (!start.current) return
      const z = zoneAt(e.clientX, e.clientY)
      start.current = null
      setDrag(null)
      if (z === 'proven' || z === 'doubt') put(i, z)
      else if (z === 'tray') put(i, null)
    },
    onPointerCancel: () => {
      start.current = null
      setDrag(null)
    },
  })

  const check = () => {
    if (place.some((s) => s == null)) return wrong(L('Put every card on one side of the line first.', 'Primero pon cada tarjeta a un lado de la línea.'))
    const ok = place.map((s, i) => s === answer[i])
    setChecked(ok)
    if (ok.every(Boolean)) {
      setVerdict({ state: 'right' })
      onSolved()
    } else wrong(L(`${ok.filter(Boolean).length} of ${ok.length} are on the right side.`, `${ok.filter(Boolean).length} de ${ok.length} están en el lado correcto.`))
  }

  const chip = (i: number) => {
    const x = task.exhibits[i]
    const p = ps[i]
    const isDrag = drag?.i === i
    const state = checked ? (checked[i] ? ' is-ok' : ' is-off') : ''
    return (
      <li
        key={x.label}
        className={`ixchip${isDrag ? ' is-dragging' : ''}${state}${solved ? ' is-solved' : ''}`}
        style={isDrag ? { transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(-2deg) scale(1.05)` } : undefined}
        {...pointer(i)}
      >
        <span className="ixchip__label">{x.label}</span>
        <span className="ixchip__p">{p == null ? L('no data', 'sin datos') : pText(p)}</span>
        {!solved && (
          <span className="ixchip__moves">
            <button type="button" onClick={() => put(i, 'proven')} disabled={place[i] === 'proven'} aria-label={L(`Put ${x.label} beyond reasonable doubt`, `Poner ${x.label} en más allá de toda duda razonable`)}>
              ◀
            </button>
            <button type="button" onClick={() => put(i, 'doubt')} disabled={place[i] === 'doubt'} aria-label={L(`Put ${x.label} on reasonable doubt`, `Poner ${x.label} en duda razonable`)}>
              ▶
            </button>
          </span>
        )}
        <span className="ixchip__sr">
          {place[i] === 'proven'
            ? L('beyond reasonable doubt', 'más allá de toda duda razonable')
            : place[i] === 'doubt'
              ? L('reasonable doubt', 'duda razonable')
              : L('not placed yet', 'aún sin colocar')}
          {checked ? (checked[i] ? L(', right side', ', lado correcto') : L(', wrong side', ', lado equivocado')) : ''}
        </span>
      </li>
    )
  }
  const idx = task.exhibits.map((_, i) => i)
  const over = drag?.over

  return (
    <div className="evtask ixtask">
      <p className="evtask__prompt">{task.prompt}</p>
      {evidence.chart && data.variables[evidence.chart.variable] && (
        <TimeSeriesChart spec={evidence.chart} series={data.variables[evidence.chart.variable]} variables={data.variables} />
      )}
      {idx.some((i) => place[i] == null) && (
        <ul className={`ixtray${over === 'tray' ? ' is-over' : ''}`} data-zone="tray" aria-label={L('Trends not placed yet', 'Tendencias aún sin colocar')}>
          {idx.filter((i) => place[i] == null).map(chip)}
        </ul>
      )}
      <div className="ixproof">
        <section className={`ixproof__zone ixproof__zone--proven${over === 'proven' ? ' is-over' : ''}`} data-zone="proven">
          <h4>
            {L('Beyond reasonable doubt', 'Más allá de toda duda razonable')} <small>{L('p < 0.05 · significant', 'p < 0,05 · significativa')}</small>
          </h4>
          <ul aria-label={L('Beyond reasonable doubt', 'Más allá de toda duda razonable')}>{idx.filter((i) => place[i] === 'proven').map(chip)}</ul>
        </section>
        <div className="ixproof__line" aria-hidden="true">
          <span>{L('p = 0.05', 'p = 0,05')}</span>
        </div>
        <section className={`ixproof__zone ixproof__zone--doubt${over === 'doubt' ? ' is-over' : ''}`} data-zone="doubt">
          <h4>
            {L('Reasonable doubt', 'Duda razonable')} <small>{L('p ≥ 0.05 · not significant', 'p ≥ 0,05 · no significativa')}</small>
          </h4>
          <ul aria-label={L('Reasonable doubt', 'Duda razonable')}>{idx.filter((i) => place[i] === 'doubt').map(chip)}</ul>
        </section>
      </div>
      {solved && <PScale exhibits={task.exhibits} ps={ps} />}
      {!solved && (
        <div className="evtask__row evtask__row--end">
          <p className="evtask__help">{L('Drag each card to a side, or use its arrow buttons.', 'Arrastra cada tarjeta a un lado, o usa sus botones de flecha.')}</p>
          <button type="button" className="evbtn evbtn--primary" onClick={check}>
            {L('Check the line', 'Comprobar la línea')}
          </button>
        </div>
      )}
      <Feedback verdict={verdict} task={task} />
    </div>
  )
}

/** After solving: every exhibit on a logarithmic p-value ruler, with the 0.05 line */
function PScale({ exhibits, ps }: { exhibits: ProofExhibit[]; ps: (number | null)[] }) {
  const W = 600
  const PL = 20
  const R = W - 20
  const min = -4 // 0.0001
  const x = (p: number) => PL + ((Math.max(min, Math.log10(Math.max(p, 1e-12))) - min) / (0 - min)) * (R - PL)
  const ticks = [0.0001, 0.001, 0.01, 0.05, 0.1, 1]
  const rows = exhibits.map((e, i) => ({ e, p: ps[i] })).filter((r): r is { e: ProofExhibit; p: number } => r.p != null)
  const H = 46 + rows.length * 20
  return (
    <figure className="ixpscale">
      <figcaption className="ixbars__cap">
        {L(
          'Where each p-value falls (log scale: each step is 10 times smaller)',
          'Dónde cae cada valor p (escala logarítmica: cada paso es 10 veces más pequeño)',
        )}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={L('p-values on a scale with the 0.05 line', 'Valores p en una escala con la línea de 0,05')}>
        <rect x={PL} y={8} width={x(ALPHA) - PL} height={H - 30} className="ixpscale__proven" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={8} y2={H - 22} className={t === ALPHA ? 'ixpscale__alpha' : 'ixpscale__tick'} />
            <text x={x(t)} y={H - 8} textAnchor={t === 0.0001 ? 'start' : 'middle'} className={`ixbars__axis${t === ALPHA ? ' is-alpha' : ''}`}>
              {t === 0.0001 ? '≤ 0.0001' : String(t)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const px = x(r.p)
          const right = px > W * 0.6
          return (
            <g key={r.e.label}>
              <circle cx={px} cy={22 + i * 20} r={6} className={r.p < ALPHA ? 'ixpscale__dot is-sig' : 'ixpscale__dot'} />
              <text x={right ? px - 10 : px + 10} y={26 + i * 20} textAnchor={right ? 'end' : 'start'} className="ixpscale__label">
                {r.e.label} ({pText(r.p)})
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}

// ---- any task ---------------------------------------------------------------------------------

/** The board's task components take an EvidenceItem: the folder seen as one */
function asItem(ev: InterrogationEvidence, task: EvidenceItem['task']): EvidenceItem {
  return {
    id: ev.id,
    kind: 'chart',
    title: ev.title,
    teaser: ev.teaser,
    text: ev.text,
    chart: ev.chart,
    task,
    relation: 'neutral',
    relation_feedback: ev.verdict_feedback,
    clue: ev.clue,
  }
}

export function InterrogationTaskView(p: { evidence: InterrogationEvidence; data: TutorialData; done: boolean; onSolved: () => void }) {
  const t = p.evidence.task
  if (t.type === 'season_switch') return <SeasonSwitchTask {...p} task={t} />
  if (t.type === 'proof_line') return <ProofLineTask {...p} task={t} />
  return <TaskView item={asItem(p.evidence, t)} data={p.data} done={p.done} onSolved={p.onSolved} />
}
