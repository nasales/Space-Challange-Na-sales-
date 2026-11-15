// The hands-on tasks of the evidence board (one small mini-game per pinned item).
// Every task checks the player's answer against the case data (taskData.ts) or the script's
// answer key, gives the task's `hint` after a wrong try (and lets them try again) and its
// `success` message with a small celebration when right. `done` re-opens a solved task in its
// solved state. Drag uses pointer events; every drag has a keyboard alternative.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { ChartSpec, EvidenceItem, EvidenceTask, Highlight, TutorialData, TutorialSeries } from '../../../shared/tutorial'
import type { ChartGeom } from '../chartKit'
import TimeSeriesChart from '../TimeSeriesChart'
import { baseUnits, sig, signed } from '../format'
import { TREND_VIEWS, keyLabel, viewTrend, yearlyValues } from './taskData'

type TaskOf<T extends EvidenceTask['type']> = Extract<EvidenceTask, { type: T }>

export interface TaskProps<T extends EvidenceTask['type'] = EvidenceTask['type']> {
  item: EvidenceItem
  task: TaskOf<T>
  data: TutorialData
  done: boolean
  onSolved: () => void
}

type Verdict = { state: 'idle' } | { state: 'wrong'; extra?: string; n: number } | { state: 'right' }

/** Hint after a wrong try (shakes again on every try), success with a burst when right */
export function Feedback({ verdict, task }: { verdict: Verdict; task: EvidenceTask }) {
  const ref = useRef<HTMLDivElement>(null)
  const tick = verdict.state === 'wrong' ? verdict.n : verdict.state
  useEffect(() => {
    if (tick !== 'idle') ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [tick])
  return (
    <div aria-live="polite" className="evtask__live" ref={ref}>
      {verdict.state === 'wrong' && (
        <p key={verdict.n} className="evtask__feedback evtask__feedback--wrong">
          <b>Not quite.</b> {verdict.extra ? `${verdict.extra} ` : ''}
          {task.hint} Try again.
        </p>
      )}
      {verdict.state === 'right' && (
        <p className="evtask__feedback evtask__feedback--right">
          <Burst />
          <b>Solved!</b> {task.success}
        </p>
      )}
    </div>
  )
}

/** Little paper confetti around the "Solved" note (hidden with reduced motion) */
export function Burst() {
  return (
    <span className="evburst" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} style={{ ['--a' as string]: `${i * 36}deg`, ['--d' as string]: `${i % 2 ? 46 : 64}px` }} />
      ))}
    </span>
  )
}

function useVerdict(done: boolean) {
  const [v, setV] = useState<Verdict>(done ? { state: 'right' } : { state: 'idle' })
  const wrong = (extra?: string) => setV((o) => ({ state: 'wrong', extra, n: o.state === 'wrong' ? o.n + 1 : 1 }))
  return [v, setV, wrong] as const
}

function seriesOf(data: TutorialData, spec?: ChartSpec): TutorialSeries | undefined {
  return spec ? data.variables[spec.variable] : undefined
}

function Chart({ spec, data, overlay }: { spec?: ChartSpec; data: TutorialData; overlay?: (g: ChartGeom) => ReactNode }) {
  const series = seriesOf(data, spec)
  if (!spec) return null
  if (!series) return <p className="evtask__msg">The data for {spec.variable} is missing from this case file.</p>
  return <TimeSeriesChart spec={spec} series={series} variables={data.variables} overlay={overlay} />
}

/** Pointer position in the chart's own pixel coordinates (the SVG is drawn 1:1) */
function svgPoint(e: { clientX: number; clientY: number; currentTarget: SVGElement }) {
  const svg = e.currentTarget.ownerSVGElement ?? e.currentTarget
  const r = svg.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}

function Prompt({ children }: { children: ReactNode }) {
  return <p className="evtask__prompt">{children}</p>
}

// ---- click_point ------------------------------------------------------------------------------

export function ClickPointTask({ item, task, data, done, onSolved }: TaskProps<'click_point'>) {
  const [verdict, setVerdict, wrong] = useVerdict(done)
  const [cursor, setCursor] = useState<number | null>(null)
  const [picked, setPicked] = useState<string | null>(done ? task.answer : null)
  const series = seriesOf(data, item.chart)
  const units = series ? series.units : ''
  const solved = verdict.state === 'right'
  // the solved chart marks the answer the usual way
  const spec: ChartSpec | undefined =
    item.chart && solved
      ? { ...item.chart, highlights: [...(item.chart.highlights ?? []), { kind: 'point', date: task.answer, label: keyLabel(task.answer) }] }
      : item.chart

  const choose = (key: string) => {
    if (solved) return
    setPicked(key)
    if (key === task.answer) {
      setVerdict({ state: 'right' })
      onSolved()
    } else wrong(`That is ${keyLabel(key)}.`)
  }

  const overlay = (g: ChartGeom) => {
    const pts = g.pts
    if (pts.length === 0) return null
    const nearest = (x: number, y: number) => {
      let best = 0
      let bd = Infinity
      pts.forEach((p, i) => {
        const d = (p.px - x) ** 2 + ((p.py - y) * 0.35) ** 2
        if (d < bd) {
          bd = d
          best = i
        }
      })
      return best
    }
    const cur = cursor != null ? pts[Math.min(cursor, pts.length - 1)] : null
    const wrongPt = !solved && picked ? pts.find((p) => p.key === picked) : null
    const onKey = (e: KeyboardEvent<SVGGElement>) => {
      const step = e.shiftKey ? 10 : 1
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setCursor((c) => Math.min(pts.length - 1, (c ?? -1) + step))
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setCursor((c) => Math.max(0, (c ?? pts.length) - step))
      else if (e.key === 'Home') setCursor(0)
      else if (e.key === 'End') setCursor(pts.length - 1)
      else if ((e.key === 'Enter' || e.key === ' ') && cur) choose(cur.key)
      else return
      e.preventDefault()
    }
    return (
      <g
        className={`evhit${solved ? ' is-solved' : ''}`}
        tabIndex={solved ? -1 : 0}
        role="slider"
        aria-label="Pick a point on the chart: arrow keys move, Enter picks"
        aria-valuemin={0}
        aria-valuemax={pts.length - 1}
        aria-valuenow={cursor ?? 0}
        aria-valuetext={cur ? `${keyLabel(cur.key)}: ${sig(cur.value)} ${units}` : 'No point selected yet'}
        onKeyDown={onKey}
        onFocus={() => cursor == null && setCursor(pts.length - 1)}
      >
        <rect
          x={g.plot.left}
          y={g.plot.top}
          width={g.plot.right - g.plot.left}
          height={g.plot.bottom - g.plot.top}
          className="evhit__area"
          onPointerMove={(e) => {
            const p = svgPoint(e)
            setCursor(nearest(p.x, p.y))
          }}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setCursor(null)}
          onClick={(e) => {
            const p = svgPoint(e)
            const i = nearest(p.x, p.y)
            setCursor(i)
            choose(pts[i].key)
          }}
        />
        {wrongPt && (
          <g className="evhit__wrong" key={`w${picked}`}>
            <path d={`M${wrongPt.px - 6},${wrongPt.py - 6}l12,12m0,-12l-12,12`} />
          </g>
        )}
        {cur && !solved && (
          <g className="evhit__cursor" pointerEvents="none">
            <line x1={cur.px} x2={cur.px} y1={g.plot.top} y2={g.plot.bottom} />
            <circle cx={cur.px} cy={cur.py} r={8} />
            <text
              x={cur.px > (g.plot.left + g.plot.right) / 2 ? cur.px - 12 : cur.px + 12}
              y={Math.max(g.plot.top + 14, cur.py - 12)}
              textAnchor={cur.px > (g.plot.left + g.plot.right) / 2 ? 'end' : 'start'}
            >
              {keyLabel(cur.key)} · {sig(cur.value)}
            </text>
          </g>
        )}
      </g>
    )
  }

  return (
    <div className="evtask">
      <Prompt>{task.prompt}</Prompt>
      <Chart spec={spec} data={data} overlay={solved ? undefined : overlay} />
      {!solved && <p className="evtask__help">Hover the chart and click a point, or Tab to the chart and use the arrow keys and Enter.</p>}
      <Feedback verdict={verdict} task={task} />
    </div>
  )
}

// ---- fit_line ---------------------------------------------------------------------------------

type End = { x: number; y: number }

export function FitLineTask({ item, task, data, done, onSolved }: TaskProps<'fit_line'>) {
  const [verdict, setVerdict, wrong] = useVerdict(done)
  const series = seriesOf(data, item.chart)
  const real = item.chart && series ? viewTrend(item.chart, series) : null
  const [ends, setEnds] = useState<[End, End] | null>(null)
  const drag = useRef<{ i: 0 | 1; id: number } | null>(null)
  const geomRef = useRef<ChartGeom | null>(null)
  const solved = verdict.state === 'right'
  const u = series ? baseUnits(series.units) : ''
  const userSlope = ends && ends[1].x !== ends[0].x ? (ends[1].y - ends[0].y) / (ends[1].x - ends[0].x) : null

  if (!item.chart || !series) return <Chart spec={item.chart} data={data} />
  if (!real) return <p className="evtask__msg">This chart has no trend line to compare a ruler with.</p>

  const check = () => {
    if (userSlope == null) return wrong('Move the ends of the ruler apart first.')
    const s = Math.sign(userSlope)
    const r = Math.sign(real.slopePerYear)
    if (s !== r) return wrong(s === 0 ? 'Your ruler is flat.' : `Your ruler goes ${s > 0 ? 'up' : 'down'}.`)
    if (task.tolerance != null && Math.abs(userSlope * 10 - real.slopePerYear * 10) > task.tolerance) {
      return wrong(`Right direction, but your ruler is too ${Math.abs(userSlope) > Math.abs(real.slopePerYear) ? 'steep' : 'flat'}.`)
    }
    setVerdict({ state: 'right' })
    onSolved()
  }

  // after solving: the real trend line drawn by the chart itself
  const spec: ChartSpec = { ...item.chart, show_trend: solved && TREND_VIEWS.includes(item.chart.view) }

  const overlay = (g: ChartGeom) => {
    geomRef.current = g
    // first draw: a flat ruler across the middle 70 % of the chart, at the mean value
    const cur: [End, End] =
      ends ??
      (() => {
        const mean = g.pts.reduce((a, p) => a + p.value, 0) / Math.max(1, g.pts.length)
        const xa = g.ix(g.plot.left + (g.plot.right - g.plot.left) * 0.15)
        const xb = g.ix(g.plot.left + (g.plot.right - g.plot.left) * 0.85)
        return [
          { x: xa, y: mean },
          { x: xb, y: mean },
        ]
      })()
    const clampPx = (x: number, y: number) => ({
      x: Math.min(g.plot.right, Math.max(g.plot.left, x)),
      y: Math.min(g.plot.bottom, Math.max(g.plot.top, y)),
    })
    const moveTo = (i: 0 | 1, px: number, py: number) => {
      const c = clampPx(px, py)
      const next: [End, End] = [cur[0], cur[1]]
      next[i] = { x: g.ix(c.x), y: g.iy(c.y) }
      setEnds(next)
      if (verdict.state === 'wrong') setVerdict({ state: 'idle' })
    }
    const pa = { x: g.sx(cur[0].x), y: g.sy(cur[0].y) }
    const pb = { x: g.sx(cur[1].x), y: g.sy(cur[1].y) }
    const handle = (i: 0 | 1, p: { x: number; y: number }) => (
      <g
        className="evruler__handle"
        tabIndex={solved ? -1 : 0}
        role="slider"
        aria-label={`${i === 0 ? 'Left' : 'Right'} end of the ruler: arrow keys move it`}
        aria-valuemin={Math.round(g.iy(g.plot.bottom) * 100) / 100}
        aria-valuemax={Math.round(g.iy(g.plot.top) * 100) / 100}
        aria-valuenow={Math.round(cur[i].y * 100) / 100}
        aria-valuetext={`${sig(cur[i].y)} ${u} in ${Math.round(cur[i].x)}`}
        onPointerDown={(e) => {
          if (solved) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { i, id: e.pointerId }
        }}
        onPointerMove={(e) => {
          if (drag.current?.i !== i) return
          const q = svgPoint(e)
          moveTo(i, q.x, q.y)
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => {
          if (solved) return
          const dy = (g.plot.bottom - g.plot.top) * (e.shiftKey ? 0.08 : 0.02)
          const dx = (g.plot.right - g.plot.left) * (e.shiftKey ? 0.08 : 0.02)
          if (e.key === 'ArrowUp') moveTo(i, p.x, p.y - dy)
          else if (e.key === 'ArrowDown') moveTo(i, p.x, p.y + dy)
          else if (e.key === 'ArrowLeft') moveTo(i, p.x - dx, p.y)
          else if (e.key === 'ArrowRight') moveTo(i, p.x + dx, p.y)
          else return
          e.preventDefault()
        }}
      >
        <circle cx={p.x} cy={p.y} r={16} className="evruler__grip" />
        <circle cx={p.x} cy={p.y} r={7} className="evruler__dot" />
      </g>
    )
    return (
      <g className={`evruler${solved ? ' is-solved' : ''}`}>
        <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} className="evruler__body" />
        <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} className="evruler__ticks" />
        {!solved && handle(0, pa)}
        {!solved && handle(1, pb)}
      </g>
    )
  }

  return (
    <div className="evtask">
      <Prompt>{task.prompt}</Prompt>
      <Chart spec={spec} data={data} overlay={overlay} />
      <div className="evtask__row">
        <p className="evtask__readout" aria-live="polite">
          {userSlope == null
            ? 'Your ruler: flat. Drag its round ends.'
            : `Your ruler: ${signed(userSlope * 10)} ${u} per decade.`}
          {solved && (
            <>
              {' '}
              <span className="evtask__real">Real trend line (red): {signed(real.slopePerYear * 10)} {u} per decade.</span>
            </>
          )}
        </p>
        {!solved && (
          <button type="button" className="evbtn evbtn--primary" onClick={check}>
            Check my ruler
          </button>
        )}
      </div>
      {!solved && <p className="evtask__help">Drag the round ends, or Tab to one and use the arrow keys (Shift = bigger steps).</p>}
      <Feedback verdict={verdict} task={task} />
    </div>
  )
}

// ---- order_cards ------------------------------------------------------------------------------

export function OrderCardsTask({ item, task, data, done, onSolved }: TaskProps<'order_cards'>) {
  const [verdict, setVerdict, wrong] = useVerdict(done)
  const series = seriesOf(data, item.chart)
  const values = useMemo(() => (item.chart && series ? yearlyValues(item.chart, series) : new Map<number, number>()), [item.chart, series])
  const answer = useMemo(() => {
    const sorted = [...task.cards].sort((a, b) => (values.get(Number(a)) ?? 0) - (values.get(Number(b)) ?? 0))
    return task.order === 'desc' ? sorted.reverse() : sorted
  }, [task, values])
  const [order, setOrder] = useState<string[]>(() => {
    if (done) return answer
    // start from the script's order, unless it is already the answer
    const start = [...task.cards]
    return start.join() === answer.join() ? start.reverse() : start
  })
  const [checked, setChecked] = useState<boolean[] | null>(null)
  const [drag, setDrag] = useState<{ card: string; dx: number } | null>(null)
  const dragRef = useRef<{ card: string; startX: number; w: number; id: number } | null>(null)
  const listId = useId()
  const solved = verdict.state === 'right'
  const missing = task.cards.filter((c) => !values.has(Number(c)))
  const u = series?.units ?? ''

  const move = (card: string, by: number) => {
    setOrder((o) => {
      const i = o.indexOf(card)
      const j = i + by
      if (i < 0 || j < 0 || j >= o.length) return o
      const n = [...o]
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })
    setChecked(null)
    if (verdict.state === 'wrong') setVerdict({ state: 'idle' })
  }

  const check = () => {
    const ok = order.map((c, i) => c === answer[i] || values.get(Number(c)) === values.get(Number(answer[i])))
    setChecked(ok)
    if (ok.every(Boolean)) {
      setVerdict({ state: 'right' })
      onSolved()
    } else wrong(`${ok.filter(Boolean).length} of ${ok.length} are in the right place.`)
  }

  // the chart marks every card's year, so the player can read each value
  // (a ranking already names every year on its bars)
  const spec: ChartSpec | undefined =
    item.chart && item.chart.view !== 'ranking'
      ? {
          ...item.chart,
          highlights: [
            ...(item.chart.highlights ?? []),
            ...task.cards.map((c): Highlight => ({ kind: 'point', date: c, label: c })),
          ],
        }
      : item.chart
  const first = task.order === 'desc' ? 'Highest' : 'Lowest'
  const last = task.order === 'desc' ? 'lowest' : 'highest'

  return (
    <div className="evtask">
      <Prompt>{task.prompt}</Prompt>
      {missing.length > 0 && <p className="evtask__msg">No data for {missing.join(', ')} in this chart.</p>}
      <div className="evorder">
        <span className="evorder__end" aria-hidden="true">
          {first}
        </span>
        <ol className="evorder__row" id={listId} aria-label={`Cards in order, ${first.toLowerCase()} first`}>
          {order.map((card, i) => {
            const isDrag = drag?.card === card
            const state = checked ? (checked[i] ? 'is-ok' : 'is-off') : ''
            return (
              <li
                key={card}
                className={`evpolaroid ${state}${isDrag ? ' is-dragging' : ''}${solved ? ' is-solved' : ''}`}
                style={isDrag ? { transform: `translateX(${drag.dx}px) rotate(-3deg) scale(1.06)` } : { ['--r' as string]: `${((i * 7) % 5) - 2}deg` }}
                onPointerDown={(e) => {
                  if (solved || (e.target as HTMLElement).closest('button')) return
                  e.currentTarget.setPointerCapture(e.pointerId)
                  const w = e.currentTarget.getBoundingClientRect().width + 12
                  dragRef.current = { card, startX: e.clientX, w, id: e.pointerId }
                  setDrag({ card, dx: 0 })
                }}
                onPointerMove={(e) => {
                  const d = dragRef.current
                  if (!d || d.card !== card) return
                  let dx = e.clientX - d.startX
                  const at = order.indexOf(card)
                  if (dx > d.w / 2 && at < order.length - 1) {
                    move(card, 1)
                    d.startX += d.w
                    dx -= d.w
                  } else if (dx < -d.w / 2 && at > 0) {
                    move(card, -1)
                    d.startX -= d.w
                    dx += d.w
                  }
                  setDrag({ card, dx })
                }}
                onPointerUp={() => {
                  dragRef.current = null
                  setDrag(null)
                }}
                onPointerCancel={() => {
                  dragRef.current = null
                  setDrag(null)
                }}
              >
                <span className="evpolaroid__pic" aria-hidden="true">
                  <span className="evpolaroid__value">{solved ? `${sig(values.get(Number(card)) ?? NaN)}` : '?'}</span>
                  {solved && <span className="evpolaroid__units">{u}</span>}
                </span>
                <span className="evpolaroid__year">{card}</span>
                <span className="evpolaroid__sr">
                  Position {i + 1}: {card}
                  {solved ? `, ${sig(values.get(Number(card)) ?? NaN)} ${u}` : ''}
                  {checked ? (checked[i] ? ', right place' : ', wrong place') : ''}
                </span>
                {!solved && (
                  <span className="evpolaroid__moves">
                    <button type="button" onClick={() => move(card, -1)} disabled={i === 0} aria-label={`Move ${card} left`}>
                      ◀
                    </button>
                    <button type="button" onClick={() => move(card, 1)} disabled={i === order.length - 1} aria-label={`Move ${card} right`}>
                      ▶
                    </button>
                  </span>
                )}
              </li>
            )
          })}
        </ol>
        <span className="evorder__end" aria-hidden="true">
          {last[0].toUpperCase() + last.slice(1)}
        </span>
      </div>
      {!solved && (
        <div className="evtask__row evtask__row--end">
          <p className="evtask__help">Drag a polaroid sideways, or use its arrow buttons.</p>
          <button type="button" className="evbtn evbtn--primary" onClick={check}>
            Check the order
          </button>
        </div>
      )}
      {/* the chart comes after the cards: the player reads it to check each year */}
      <Chart spec={spec} data={data} />
      <Feedback verdict={verdict} task={task} />
    </div>
  )
}

// ---- slider_window ----------------------------------------------------------------------------

export function SliderWindowTask({ item, task, data, done, onSolved }: TaskProps<'slider_window'>) {
  const [verdict, setVerdict, wrong] = useVerdict(done)
  const series = seriesOf(data, item.chart)
  const wt = series?.extras?.window_trends ?? []
  const [at, setAt] = useState(0)
  const [moved, setMoved] = useState(done)
  const [picked, setPicked] = useState<number | null>(done ? task.options.findIndex((o) => o.correct) : null)
  const solved = verdict.state === 'right'
  const sliderId = useId()
  if (!series || wt.length === 0) return <p className="evtask__msg">The trend by start year is not in this case file.</p>
  const w = wt[Math.min(at, wt.length - 1)]
  const u = baseUnits(series.units)
  const spec: ChartSpec = item.chart ?? { variable: series.variable, view: 'window_trends' }

  const overlay = (g: ChartGeom) => {
    const p = g.pts.find((q) => q.key === String(w.start_year))
    if (!p) return null
    const band = (g.plot.right - g.plot.left) / Math.max(1, g.pts.length)
    return (
      <g className="evwindow" pointerEvents="none">
        <rect x={p.px - band / 2 + 2} y={g.plot.top - 6} width={band - 4} height={g.plot.bottom - g.plot.top + 12} rx={4} />
        <path d={`M${p.px - 7},${g.plot.top - 16}l7,9l7,-9z`} />
      </g>
    )
  }

  return (
    <div className="evtask">
      <Prompt>{task.prompt}</Prompt>
      <Chart spec={spec} data={data} overlay={overlay} />
      <div className="evslider">
        <label htmlFor={sliderId} className="evslider__label">
          Start year: <b>{w.start_year}</b>
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={wt.length - 1}
          step={1}
          value={at}
          aria-valuetext={`From ${w.start_year}`}
          onChange={(e) => {
            setAt(Number(e.target.value))
            setMoved(true)
          }}
        />
        <div className="evslider__scale" aria-hidden="true">
          <span>{wt[0].start_year}</span>
          <span>{wt[wt.length - 1].start_year}</span>
        </div>
        <p className="evslider__words" aria-live="polite">
          From {w.start_year} to the end of the record: <b>{signed(w.slope_per_year * 10)} {u} per decade</b>, likely between{' '}
          {signed(w.ci_low * 10)} and {signed(w.ci_high * 10)} (95% range).{' '}
          {w.significant ? 'The bar is filled: a clear trend.' : 'The bar is hollow: the trend is not clear.'} Fewer years, wider range.
        </p>
      </div>
      {moved ? (
        <Options
          prompt={task.question}
          options={task.options}
          picked={picked}
          solved={solved}
          onPick={(i) => {
            setPicked(i)
            if (task.options[i].correct) {
              setVerdict({ state: 'right' })
              onSolved()
            } else wrong()
          }}
        />
      ) : (
        <p className="evtask__help">Move the slider to see the trend from each start year; then a question appears.</p>
      )}
      <Feedback verdict={verdict} task={task} />
    </div>
  )
}

/** Multiple choice (slider_window question, compare) */
function Options({
  prompt,
  options,
  picked,
  solved,
  onPick,
}: {
  prompt?: string
  options: { text: string; correct: boolean }[]
  picked: number | null
  solved: boolean
  onPick: (i: number) => void
}) {
  return (
    <fieldset className="evoptions">
      {prompt && <legend className="evoptions__prompt">{prompt}</legend>}
      {options.map((o, i) => {
        const state = picked === i ? (o.correct ? 'right' : 'wrong') : undefined
        return (
          <button
            key={i}
            type="button"
            className={`casefile__option${state ? ` is-${state}` : ''}`}
            aria-pressed={picked === i}
            disabled={solved && !o.correct}
            onClick={() => !solved && onPick(i)}
          >
            <span className="casefile__option-letter" aria-hidden="true">
              {String.fromCharCode(65 + i)}
            </span>
            {o.text}
          </button>
        )
      })}
    </fieldset>
  )
}

// ---- tally ------------------------------------------------------------------------------------

/** A threshold written in the rule ("above 4.5 °C", "below 0"), drawn as a dashed line */
function ruleLine(rule: string): number | null {
  const m = rule.match(/(?:above|below|over|under|more than|less than|warmer than|colder than|>|<)\s*(−|-)?\s*(\d+(?:[.,]\d+)?)/i)
  if (!m) return null
  const v = Number(m[2].replace(',', '.'))
  return m[1] ? -v : v
}

export function TallyTask({ item, task, data, done, onSolved }: TaskProps<'tally'>) {
  const [verdict, setVerdict, wrong] = useVerdict(done)
  const [counts, setCounts] = useState<string[]>(() => task.periods.map((_, i) => (done ? String(task.answers[i] ?? '') : '')))
  const [checked, setChecked] = useState<boolean[] | null>(done ? task.periods.map(() => true) : null)
  const solved = verdict.state === 'right'
  const baseId = useId()
  // a count chart (threshold_count) has counts on its y axis, not the rule's threshold
  const line = item.chart?.view === 'threshold_count' ? null : ruleLine(task.rule)

  const spec: ChartSpec | undefined = item.chart
    ? {
        ...item.chart,
        highlights: [
          ...(item.chart.highlights ?? []),
          ...task.periods.map((p): Highlight => ({ kind: 'band', from: p.from, to: p.to, label: p.label })),
        ],
      }
    : undefined

  const overlay = (g: ChartGeom) => {
    if (line == null) return null
    const y = g.sy(line)
    if (y < g.plot.top || y > g.plot.bottom) return null
    return (
      <g className="evrule" pointerEvents="none">
        <line x1={g.plot.left} x2={g.plot.right} y1={y} y2={y} />
        <text x={g.plot.right - 4} y={y - 5} textAnchor="end">
          {task.rule}
        </text>
      </g>
    )
  }

  const check = () => {
    const ok = task.periods.map((_, i) => counts[i].trim() !== '' && Number(counts[i]) === task.answers[i])
    setChecked(ok)
    if (ok.every(Boolean)) {
      setVerdict({ state: 'right' })
      onSolved()
    } else wrong(task.periods.length > 1 ? `${ok.filter(Boolean).length} of ${ok.length} counts are right.` : undefined)
  }

  const setAt = (i: number, v: string) => {
    setCounts((c) => c.map((x, j) => (j === i ? v : x)))
    setChecked(null)
    if (verdict.state === 'wrong') setVerdict({ state: 'idle' })
  }

  return (
    <div className="evtask">
      <Prompt>{task.prompt}</Prompt>
      <p className="evtally__rule">
        <span>Rule</span> {task.rule}
      </p>
      <Chart spec={spec} data={data} overlay={overlay} />
      <form
        className="evtally"
        onSubmit={(e) => {
          e.preventDefault()
          if (!solved) check()
        }}
      >
        {task.periods.map((p, i) => (
          <div key={p.label} className={`evtally__field${checked ? (checked[i] ? ' is-ok' : ' is-off') : ''}`}>
            <label htmlFor={`${baseId}-${i}`}>{p.label}</label>
            <div className="evtally__input">
              <button
                type="button"
                aria-label={`One less for ${p.label}`}
                disabled={solved}
                onClick={() => setAt(i, String(Math.max(0, (Number(counts[i]) || 0) - 1)))}
              >
                −
              </button>
              <input
                id={`${baseId}-${i}`}
                type="number"
                inputMode="numeric"
                min={0}
                value={counts[i]}
                readOnly={solved}
                onChange={(e) => setAt(i, e.target.value)}
              />
              <button
                type="button"
                aria-label={`One more for ${p.label}`}
                disabled={solved}
                onClick={() => setAt(i, String((Number(counts[i]) || 0) + 1))}
              >
                +
              </button>
            </div>
          </div>
        ))}
        {!solved && (
          <button type="submit" className="evbtn evbtn--primary">
            Check my counts
          </button>
        )}
      </form>
      <Feedback verdict={verdict} task={task} />
    </div>
  )
}

// ---- compare ----------------------------------------------------------------------------------

export function CompareTask({ item, task, data, done, onSolved }: TaskProps<'compare'>) {
  const [verdict, setVerdict, wrong] = useVerdict(done)
  const [picked, setPicked] = useState<number | null>(done ? task.options.findIndex((o) => o.correct) : null)
  const solved = verdict.state === 'right'
  return (
    <div className="evtask">
      <Prompt>{task.prompt}</Prompt>
      <Chart spec={item.chart} data={data} />
      <Options
        options={task.options}
        picked={picked}
        solved={solved}
        onPick={(i) => {
          setPicked(i)
          if (task.options[i].correct) {
            setVerdict({ state: 'right' })
            onSolved()
          } else wrong()
        }}
      />
      <Feedback verdict={verdict} task={task} />
    </div>
  )
}

/** The task component of an item */
export function TaskView(p: { item: EvidenceItem; data: TutorialData; done: boolean; onSolved: () => void }) {
  const t = p.item.task
  switch (t.type) {
    case 'click_point':
      return <ClickPointTask {...p} task={t} />
    case 'fit_line':
      return <FitLineTask {...p} task={t} />
    case 'order_cards':
      return <OrderCardsTask {...p} task={t} />
    case 'slider_window':
      return <SliderWindowTask {...p} task={t} />
    case 'tally':
      return <TallyTask {...p} task={t} />
    case 'compare':
      return <CompareTask {...p} task={t} />
    default:
      return <p className="evtask__msg">This task type is not supported yet.</p>
  }
}
