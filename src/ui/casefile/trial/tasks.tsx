// Hands-on tasks of a trial exhibit. Evidence-board tasks (fit_line, compare, ...) are reused
// as they are (board/tasks.tsx); the trial adds three of its own:
// - translate: the "translator machine" (anomaly / typical swing = z-score, set on a dial)
// - sort_moves: on the two lines of a zscore_pair chart, say if both were drier, wetter or apart
// - missing_data: an empty folder; pick the records the court would need
// Every answer is computed from the case data (data/tutorial_data/<case>.json), never taken
// from the script. A wrong try gives the task's hint; a right one its success message.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ChartSpec, EvidenceItem, EvidenceTask, TrialExhibit, TrialMove, TrialTask, TutorialData } from '../../../shared/tutorial'
import { monthX, type ChartGeom } from '../chartKit'
import TimeSeriesChart from '../TimeSeriesChart'
import { baseUnits, fixText, sig } from '../format'
import { Burst, TaskView } from '../board/tasks'
import { keyLabel } from '../board/taskData'
import { EmptyFolder } from './art'
import { MOVE_LABEL, MOVES } from './labels'

type OwnTask = Exclude<TrialTask, EvidenceTask>
type OwnOf<T extends OwnTask['type']> = Extract<OwnTask, { type: T }>

interface Props<T extends OwnTask['type']> {
  exhibit: TrialExhibit
  task: OwnOf<T>
  data: TutorialData
  done: boolean
  onSolved: () => void
}

type Verdict = { state: 'idle' } | { state: 'wrong'; extra?: string; n: number } | { state: 'right' }

function useVerdict(done: boolean) {
  const [v, setV] = useState<Verdict>(done ? { state: 'right' } : { state: 'idle' })
  const wrong = (extra?: string) => setV((o) => ({ state: 'wrong', extra, n: o.state === 'wrong' ? o.n + 1 : 1 }))
  return [v, setV, wrong] as const
}

function Feedback({ verdict, task }: { verdict: Verdict; task: OwnTask }) {
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
          {fixText(task.hint)} Try again.
        </p>
      )}
      {verdict.state === 'right' && (
        <p className="evtask__feedback evtask__feedback--right">
          <Burst />
          <b>Solved!</b> {fixText(task.success)}
        </p>
      )}
    </div>
  )
}

function Chart({ spec, data, overlay }: { spec?: ChartSpec; data: TutorialData; overlay?: (g: ChartGeom) => ReactNode }) {
  if (!spec) return null
  const series = data.variables[spec.variable]
  if (!series) return <p className="evtask__msg">The data for {spec.variable} is missing from this case file.</p>
  return <TimeSeriesChart spec={spec} series={series} variables={data.variables} overlay={overlay} />
}

// ---- translate --------------------------------------------------------------------------------

const DIAL_MIN = -4
const DIAL_MAX = 4
const DIAL_TOL = 0.25

/** Anomaly of one month and the typical swing (population SD of all anomalies) of a variable */
function reading(data: TutorialData, variable: string, date: string) {
  const s = data.variables[variable]
  if (!s) return null
  const vals = s.anomaly.values.filter((v): v is number => v != null && Number.isFinite(v))
  const i = s.anomaly.dates.indexOf(date)
  const a = i >= 0 ? s.anomaly.values[i] : null
  if (a == null || vals.length < 2) return null
  const mean = vals.reduce((x, y) => x + y, 0) / vals.length
  const sd = Math.sqrt(vals.reduce((x, y) => x + (y - mean) ** 2, 0) / vals.length)
  return { name: s.name, units: baseUnits(s.units), anomaly: a, sd, z: a / sd }
}

const fmt1 = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(1)
const fmt2 = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2)

/** Half-round gauge from DIAL_MIN to DIAL_MAX typical swings */
function Gauge({ value }: { value: number }) {
  const t = (value - DIAL_MIN) / (DIAL_MAX - DIAL_MIN) // 0..1
  const ang = Math.PI * (1 - t)
  const nx = 60 + 44 * Math.cos(ang)
  const ny = 60 - 44 * Math.sin(ang)
  const ticks = Array.from({ length: DIAL_MAX - DIAL_MIN + 1 }, (_, k) => DIAL_MIN + k)
  return (
    <svg className="trgauge" viewBox="0 0 120 70" aria-hidden="true">
      <path d="M8 60a52 52 0 0 1 104 0" className="trgauge__face" />
      <path d="M8 60a52 52 0 0 1 52 -52" className="trgauge__dry" />
      <path d="M60 8a52 52 0 0 1 52 52" className="trgauge__wet" />
      {ticks.map((v) => {
        const a = Math.PI * (1 - (v - DIAL_MIN) / (DIAL_MAX - DIAL_MIN))
        const r1 = v === 0 ? 38 : 44
        return (
          <g key={v}>
            <line x1={60 + r1 * Math.cos(a)} y1={60 - r1 * Math.sin(a)} x2={60 + 50 * Math.cos(a)} y2={60 - 50 * Math.sin(a)} className="trgauge__tick" />
            {v % 2 === 0 && (
              <text x={60 + 31 * Math.cos(a)} y={63 - 31 * Math.sin(a)} className="trgauge__num">
                {v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0'}
              </text>
            )}
          </g>
        )
      })}
      <line x1={60} y1={60} x2={nx} y2={ny} className="trgauge__needle" />
      <circle cx={60} cy={60} r={5} className="trgauge__hub" />
    </svg>
  )
}

export function TranslateTask({ exhibit, task, data, done, onSolved }: Props<'translate'>) {
  const [verdict, setVerdict, wrong] = useVerdict(done)
  const rows = useMemo(() => task.readings.map((r) => ({ ...r, info: reading(data, r.variable, r.date) })), [task.readings, data])
  const [dials, setDials] = useState<number[]>(() => rows.map((r) => (done && r.info ? Math.round(r.info.z * 10) / 10 : 0)))
  const [checked, setChecked] = useState<boolean[] | null>(done ? rows.map(() => true) : null)
  const solved = verdict.state === 'right'

  const set = (i: number, v: number) => {
    const c = Math.round(Math.min(DIAL_MAX, Math.max(DIAL_MIN, v)) * 10) / 10
    setDials((d) => d.map((x, j) => (j === i ? c : x)))
    setChecked(null)
    if (verdict.state === 'wrong') setVerdict({ state: 'idle' })
  }
  const check = () => {
    const ok = rows.map((r, i) => !!r.info && Math.abs(dials[i] - r.info.z) <= DIAL_TOL)
    setChecked(ok)
    if (ok.every(Boolean)) {
      setVerdict({ state: 'right' })
      onSolved()
    } else {
      const off = rows.find((r, i) => !ok[i] && r.info)
      const i = off ? rows.indexOf(off) : -1
      const dir = off?.info && i >= 0 ? (dials[i] > off.info.z ? 'too high' : 'too low') : ''
      wrong(off?.info ? `The ${off.info.name.toLowerCase()} dial is ${dir}.` : undefined)
    }
  }

  return (
    <div className="evtask">
      <p className="evtask__prompt">{fixText(task.prompt)}</p>
      <div className={`trmachine${solved ? ' is-done' : ''}`}>
        <p className="trmachine__plate" aria-hidden="true">
          <span>Translator</span> units in · &ldquo;how unusual&rdquo; out
        </p>
        <div className="trmachine__slots">
          {rows.map((r, i) =>
            r.info ? (
              <div key={`${r.variable}-${r.date}`} className={`trslot${checked ? (checked[i] ? ' is-ok' : ' is-off') : ''}`}>
                <p className="trslot__name">
                  {r.info.name} <small>{keyLabel(r.date)}</small>
                </p>
                <p className="trslot__sum">
                  <span className="trslot__chip">
                    <small>Anomaly</small>
                    {fmt2(r.info.anomaly)} {r.info.units}
                  </span>
                  <span className="trslot__op" aria-hidden="true">
                    ÷
                  </span>
                  <span className="trslot__chip">
                    <small>Typical swing</small>
                    {sig(r.info.sd)} {r.info.units}
                  </span>
                  <span className="trslot__op" aria-hidden="true">
                    =
                  </span>
                </p>
                <Gauge value={dials[i]} />
                <div className="trslot__dial">
                  <button type="button" disabled={solved} onClick={() => set(i, dials[i] - 0.1)} aria-label={`Lower the ${r.info.name} dial`}>
                    −
                  </button>
                  <input
                    type="range"
                    min={DIAL_MIN}
                    max={DIAL_MAX}
                    step={0.1}
                    value={dials[i]}
                    disabled={solved}
                    aria-label={`${r.info.name} dial, in typical swings`}
                    aria-valuetext={`${fmt1(dials[i])} typical swings`}
                    onChange={(e) => set(i, Number(e.target.value))}
                  />
                  <button type="button" disabled={solved} onClick={() => set(i, dials[i] + 0.1)} aria-label={`Raise the ${r.info.name} dial`}>
                    +
                  </button>
                </div>
                <p className="trslot__out" aria-live="polite">
                  <b>{fmt1(dials[i])}</b> typical swings
                </p>
              </div>
            ) : (
              <p key={`${r.variable}-${r.date}`} className="evtask__msg">
                No anomaly for {r.variable} in {r.date} in this case file.
              </p>
            ),
          )}
        </div>
        {!solved && (
          <div className="evtask__row evtask__row--end">
            <p className="evtask__help">Drag each dial, or use − and + (steps of 0.1).</p>
            <button type="button" className="evbtn evbtn--primary" onClick={check}>
              Translate
            </button>
          </div>
        )}
      </div>
      <Feedback verdict={verdict} task={task} />
      {solved && exhibit.chart && (
        <div className="trprintout">
          <p className="trprintout__label">The machine prints every month, translated and smoothed over 12 months:</p>
          <Chart spec={exhibit.chart} data={data} />
        </div>
      )}
    </div>
  )
}

// ---- sort_moves -------------------------------------------------------------------------------

function moveAt(data: TutorialData, spec: ChartSpec | undefined, date: string): TrialMove | null {
  const [a, b] = spec?.variables ?? []
  const za = smoothAt(data, a, date)
  const zb = smoothAt(data, b, date)
  if (za == null || zb == null) return null
  return za < 0 && zb < 0 ? 'both_dry' : za > 0 && zb > 0 ? 'both_wet' : 'apart'
}

function smoothAt(data: TutorialData, variable: string | undefined, date: string): number | null {
  const z = variable ? data.variables[variable]?.extras?.zscore_smooth12 : undefined
  if (!z) return null
  const i = z.dates.indexOf(date)
  return i >= 0 ? z.values[i] : null
}

export function SortMovesTask({ exhibit, task, data, done, onSolved }: Props<'sort_moves'>) {
  const [verdict, setVerdict, wrong] = useVerdict(done)
  const answers = useMemo(() => task.dates.map((d) => moveAt(data, exhibit.chart, d)), [task.dates, data, exhibit.chart])
  const [picks, setPicks] = useState<(TrialMove | null)[]>(() => (done ? answers : task.dates.map(() => null)))
  const [checked, setChecked] = useState<boolean[] | null>(done ? task.dates.map(() => true) : null)
  const solved = verdict.state === 'right'

  const pick = (i: number, m: TrialMove) => {
    if (solved) return
    setPicks((p) => p.map((x, j) => (j === i ? m : x)))
    setChecked(null)
    if (verdict.state === 'wrong') setVerdict({ state: 'idle' })
  }
  const check = () => {
    if (picks.some((p) => p == null)) return wrong('Pick an answer for every marked month first.')
    const ok = picks.map((p, i) => p === answers[i])
    setChecked(ok)
    if (ok.every(Boolean)) {
      setVerdict({ state: 'right' })
      onSolved()
    } else wrong(`${ok.filter(Boolean).length} of ${ok.length} are right.`)
  }

  // a dashed line and a letter tag at each marked month, through both lines
  const overlay = (g: ChartGeom) => (
    <g className="trmarks" pointerEvents="none">
      {task.dates.map((d, i) => {
        const x = g.sx(monthX(d))
        if (x < g.plot.left || x > g.plot.right) return null
        return (
          <g key={d} className={checked ? (checked[i] ? 'is-ok' : 'is-off') : undefined}>
            <line x1={x} x2={x} y1={g.plot.top + 18} y2={g.plot.bottom} />
            <rect x={x - 11} y={g.plot.top} width={22} height={18} rx={3} />
            <text x={x} y={g.plot.top + 13.5}>
              {i + 1}
            </text>
          </g>
        )
      })}
    </g>
  )

  return (
    <div className="evtask">
      <p className="evtask__prompt">{fixText(task.prompt)}</p>
      <Chart spec={exhibit.chart} data={data} overlay={overlay} />
      <ol className="trmoves">
        {task.dates.map((d, i) => (
          <li key={d} className={`trmoves__row${checked ? (checked[i] ? ' is-ok' : ' is-off') : ''}`}>
            <span className="trmoves__date">
              <b aria-hidden="true">{i + 1}</b> {keyLabel(d)}
            </span>
            <span className="trmoves__choices" role="group" aria-label={`Mark ${i + 1}, ${keyLabel(d)}`}>
              {MOVES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`trmoves__choice trmoves__choice--${m}${picks[i] === m ? ' is-on' : ''}`}
                  aria-pressed={picks[i] === m}
                  disabled={solved && picks[i] !== m}
                  onClick={() => pick(i, m)}
                >
                  {MOVE_LABEL[m]}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ol>
      {!solved && (
        <div className="evtask__row evtask__row--end">
          <p className="evtask__help">Below zero = drier than usual; above zero = wetter.</p>
          <button type="button" className="evbtn evbtn--primary" onClick={check}>
            Check my reading
          </button>
        </div>
      )}
      <Feedback verdict={verdict} task={task} />
    </div>
  )
}

// ---- missing_data -----------------------------------------------------------------------------

export function MissingDataTask({ exhibit, task, done, onSolved }: Props<'missing_data'>) {
  const [verdict, setVerdict, wrong] = useVerdict(done)
  const [on, setOn] = useState<boolean[]>(() => task.options.map((o) => done && o.needed))
  const [checked, setChecked] = useState(done)
  const solved = verdict.state === 'right'
  const toggle = (i: number) => {
    if (solved) return
    setOn((s) => s.map((x, j) => (j === i ? !x : x)))
    setChecked(false)
    if (verdict.state === 'wrong') setVerdict({ state: 'idle' })
  }
  const check = () => {
    setChecked(true)
    const need = task.options.filter((o) => o.needed).length
    const hits = task.options.filter((o, i) => o.needed && on[i]).length
    const extra = task.options.filter((o, i) => !o.needed && on[i]).length
    if (hits === need && extra === 0) {
      setVerdict({ state: 'right' })
      onSolved()
    } else
      wrong(
        `You picked ${hits} of the ${need} records the court needs${extra ? `, and ${extra} that would not test the idea` : ''}.`,
      )
  }
  return (
    <div className="evtask">
      <p className="evtask__prompt">{fixText(task.prompt)}</p>
      <EmptyFolder title={exhibit.title} />
      <fieldset className="trrequest">
        <legend>Records the court could ask for</legend>
        {task.options.map((o, i) => {
          const state = checked && on[i] ? (o.needed ? ' is-ok' : ' is-off') : ''
          return (
            <button
              key={o.text}
              type="button"
              className={`trrequest__item${on[i] ? ' is-on' : ''}${state}`}
              aria-pressed={on[i]}
              disabled={solved && !o.needed}
              onClick={() => toggle(i)}
            >
              <span className="trrequest__box" aria-hidden="true">
                {on[i] ? '✓' : ''}
              </span>
              {fixText(o.text)}
            </button>
          )
        })}
      </fieldset>
      {!solved && (
        <div className="evtask__row evtask__row--end">
          <p className="evtask__help">Pick every record that would test the idea, and nothing else.</p>
          <button type="button" className="evbtn evbtn--primary" onClick={check}>
            Request these records
          </button>
        </div>
      )}
      <Feedback verdict={verdict} task={task} />
    </div>
  )
}

// ---- dispatcher -------------------------------------------------------------------------------

/** The board's tasks read an EvidenceItem: the exhibit, seen as one */
function asItem(ex: TrialExhibit, task: EvidenceTask): EvidenceItem {
  return {
    id: ex.id,
    kind: 'chart',
    title: ex.title,
    teaser: ex.teaser,
    text: ex.text,
    chart: ex.chart,
    task,
    relation: 'neutral',
    relation_feedback: '',
    clue: ex.clue,
  }
}

export function TrialTaskView({ exhibit, data, done, onSolved }: { exhibit: TrialExhibit; data: TutorialData; done: boolean; onSolved: () => void }) {
  const t = exhibit.task
  switch (t.type) {
    case 'translate':
      return <TranslateTask exhibit={exhibit} task={t} data={data} done={done} onSolved={onSolved} />
    case 'sort_moves':
      return <SortMovesTask exhibit={exhibit} task={t} data={data} done={done} onSolved={onSolved} />
    case 'missing_data':
      return <MissingDataTask exhibit={exhibit} task={t} data={data} done={done} onSolved={onSolved} />
    default:
      return <TaskView item={asItem(exhibit, t)} data={data} done={done} onSolved={onSolved} />
  }
}
