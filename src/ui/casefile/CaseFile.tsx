// Featured-case tutorial overlay (docs/case_tutorials.md):
// intro (context + question) -> steps (chart + text + multiple-choice check). The last step closes
// the case: the statistical result is shown on the case-closed screen (CaseClosed.tsx).
// While it is open, key presses do not reach the game (window capture listener, like PointProbe).
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { TutorialData, TutorialScript, TutorialSeries, TutorialStep } from '../../shared/tutorial'
import TimeSeriesChart from './TimeSeriesChart'
import { baseUnits, credit, fixText, formatP, signed, testName } from './format'
import { loadTutorial, type LoadedTutorial } from './loader'
import { useKeyCapture } from './keys'
import Notebook, { type NotebookClue } from './Notebook'
import { L } from '../../shared/i18n'
import './CaseFile.css'

/**
 * Inside the full case flow (CaseFlow.tsx): the notebook is shown, the intro card is replaced by a
 * short question line when a witness scene already told the story, and the last step hands over
 * to the case-closed screen.
 */
export interface CaseFileFlow {
  /** The witness's claim, pinned at the top of the notebook */
  claim?: string
  witnessName?: string
  /** true when the witness scene played: no intro card */
  brief: boolean
  /** The last step was solved: close the case with these notebook clues */
  onFinished: (clues: NotebookClue[]) => void
}

interface CaseFileProps {
  caseId: string
  onClose: () => void
  /** Already loaded by the caller (skips the loading screen) */
  tutorial?: LoadedTutorial
  flow?: CaseFileFlow
}

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; tutorial: LoadedTutorial }

export default function CaseFile({ caseId, onClose, tutorial: given, flow }: CaseFileProps) {
  const [load, setLoad] = useState<Load>(given ? { state: 'ready', tutorial: given } : { state: 'loading' })
  const [loadedId, setLoadedId] = useState(caseId)
  if (loadedId !== caseId) {
    // a new case was opened while mounted: start again
    setLoadedId(caseId)
    setLoad({ state: 'loading' })
  }

  useEffect(() => {
    if (given) return
    let alive = true
    loadTutorial(caseId)
      .then((tutorial) => alive && setLoad({ state: 'ready', tutorial }))
      .catch((err: unknown) => alive && setLoad({ state: 'error', message: err instanceof Error ? err.message : String(err) }))
    return () => {
      alive = false
    }
  }, [caseId, given])

  // Native modal dialog: the browser keeps focus inside it and the game canvas behind is inert.
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className={`casefile${flow ? ' casefile--notebook' : ''}`}
      aria-label={L('Case file', 'Expediente')}
      // Escape is handled by our key listener (it prevents the default, so this rarely fires)
      onCancel={(e) => e.preventDefault()}
    >
      {load.state === 'ready' ? (
        <Tutorial key={caseId} tutorial={load.tutorial} onClose={onClose} flow={flow} />
      ) : (
        <div className="casefile__sheet">
          <Header label={L('Case file', 'Expediente')} onClose={onClose} />
          <div className="casefile__body">
            {load.state === 'loading' ? (
              <p className="casefile__msg">{L('Opening the case file…', 'Abriendo el expediente…')}</p>
            ) : (
              <>
                <h2 className="casefile__title">{L('Case file not found', 'Expediente no encontrado')}</h2>
                <p className="casefile__msg">
                  {load.message} {L('The detective will have to come back later. You can keep exploring.', 'El detective tendrá que volver más tarde. Puedes seguir explorando.')}
                </p>
                <div className="casefile__nav">
                  <button type="button" className="casefile__btn casefile__btn--primary" onClick={onClose}>
                    {L('Back to the map', 'Volver al mapa')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <KeyShield onEscape={onClose} enabled={load.state !== 'ready'} />
    </dialog>
  )
}

/** Blocks keys from the game while loading or showing an error (the tutorial has its own). */
function KeyShield({ onEscape, enabled }: { onEscape: () => void; enabled: boolean }) {
  useKeyCapture(enabled ? onEscape : null)
  return null
}

export function Header({
  label,
  progress,
  onClose,
}: {
  label: string
  progress?: string
  onClose: () => void
}) {
  return (
    <div className="casefile__head">
      <p className="casefile__label">
        {label}
        {progress && <span className="casefile__progress"> · {progress}</span>}
      </p>
      <button type="button" className="casefile__close" onClick={onClose}>
        <svg className="casefile__close-icon" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 4l12 12M16 4L4 16" />
        </svg>
        {L('Close', 'Cerrar')}
      </button>
    </div>
  )
}

interface Answer {
  /** last option picked (index), null before any pick */
  picked: number | null
  solved: boolean
}

function Tutorial({ tutorial, onClose, flow }: { tutorial: LoadedTutorial; onClose: () => void; flow?: CaseFileFlow }) {
  const { script, data } = tutorial
  const n = script.steps.length
  // 0 = intro, 1..n = steps
  const first = flow?.brief ? 1 : 0
  const [at, setAt] = useState(first)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [confirming, setConfirming] = useState(false)
  // steps without a question count as solved once seen
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set())
  const current = at >= 1 && at <= n ? script.steps[at - 1] : null
  if (current && !current.question && !seen.has(current.id)) setSeen(new Set(seen).add(current.id))

  const clues: NotebookClue[] = script.steps.flatMap((s, i) =>
    (s.question ? answers[s.id]?.solved : seen.has(s.id)) ? [{ id: s.id, n: i + 1, text: fixText(s.clue ?? s.takeaway) }] : [],
  )

  const midway = at > 0
  const requestClose = () => (midway ? setConfirming(true) : onClose())
  useKeyCapture(() => (confirming ? setConfirming(false) : requestClose()))

  // Move focus to the screen heading on every screen change (screen readers + keyboard)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
    bodyRef.current?.scrollTo({ top: 0 })
  }, [at])

  const go = (to: number) => {
    setConfirming(false)
    setAt(Math.max(first, Math.min(n, to)))
  }

  let progress: string | undefined
  if (at >= 1 && at <= n) progress = L(`Clue ${at} of ${n}`, `Pista ${at} de ${n}`)

  const sheet = (
    <div className="casefile__sheet">
      <Header label={flow?.brief ? L(`Case file · ${script.title}`, `Expediente · ${script.title}`) : script.title} progress={progress} onClose={requestClose} />
      {at >= 1 && at <= n && <ProgressDots total={n} current={at} />}
      {flow?.brief && at >= 1 && at <= n && (
        <p className="casefile__brief">
          <span className="casefile__brief-label">{L('The question', 'La pregunta')}</span> {script.intro.question}
        </p>
      )}

      <div className="casefile__body" ref={bodyRef}>
        {at === 0 && <Intro script={script} headingRef={headingRef} onStart={() => go(1)} />}

        {at >= 1 && at <= n && (
          <Step
            key={script.steps[at - 1].id}
            step={script.steps[at - 1]}
            data={data}
            answer={answers[script.steps[at - 1].id] ?? { picked: null, solved: false }}
            onAnswer={(a) => setAnswers((all) => ({ ...all, [script.steps[at - 1].id]: a }))}
            headingRef={headingRef}
            onBack={at > first ? () => go(at - 1) : undefined}
            onNext={() => (at < n ? go(at + 1) : flow ? flow.onFinished(clues) : onClose())}
            last={at === n}
          />
        )}

      </div>

      {confirming && (
        <div className="casefile__confirm" role="alertdialog" aria-labelledby="casefile-confirm-text">
          <p id="casefile-confirm-text">{L('Close this case file? Your answers will be lost.', '¿Cerrar este expediente? Perderás tus respuestas.')}</p>
          <div className="casefile__nav">
            <button type="button" className="casefile__btn" onClick={() => setConfirming(false)} autoFocus>
              {L('Keep investigating', 'Seguir investigando')}
            </button>
            <button type="button" className="casefile__btn casefile__btn--danger" onClick={onClose}>
              {L('Close case file', 'Cerrar expediente')}
            </button>
          </div>
        </div>
      )}
    </div>
  )

  if (!flow) return sheet
  return (
    <div className="casefile__layout">
      {sheet}
      <Notebook claim={flow.claim} witnessName={flow.witnessName} clues={clues} total={n} />
    </div>
  )
}

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <ol className="casefile__dots" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <li
          key={i}
          className={i + 1 < current ? 'is-done' : i + 1 === current ? 'is-current' : undefined}
        />
      ))}
    </ol>
  )
}

type HeadingRef = RefObject<HTMLHeadingElement | null>

function Intro({ script, headingRef, onStart }: { script: TutorialScript; headingRef: HeadingRef; onStart: () => void }) {
  return (
    <section className="casefile__screen">
      <p className="casefile__kicker">{script.place}</p>
      <h2 className="casefile__title" ref={headingRef} tabIndex={-1}>
        {script.intro.headline}
      </h2>
      {script.intro.paragraphs.map((p, i) => (
        <p key={i} className="casefile__text">
          {p}
        </p>
      ))}
      <div className="casefile__question-note">
        <p className="casefile__note-label">{L('The question', 'La pregunta')}</p>
        <p className="casefile__note-text">{script.intro.question}</p>
      </div>
      <div className="casefile__nav casefile__nav--end">
        <button type="button" className="casefile__btn casefile__btn--primary" onClick={onStart}>
          {L('Start investigating', 'Empezar a investigar')}
        </button>
      </div>
    </section>
  )
}

function Step({
  step,
  data,
  answer,
  onAnswer,
  headingRef,
  onBack,
  onNext,
  last,
}: {
  step: TutorialStep
  data: TutorialData
  answer: Answer
  onAnswer: (a: Answer) => void
  headingRef: HeadingRef
  /** undefined on the first screen of a brief case file (nothing to go back to) */
  onBack?: () => void
  onNext: () => void
  last: boolean
}) {
  const series = data.variables[step.chart.variable]
  const q = step.question
  const solved = !q || answer.solved
  const picked = q && answer.picked != null ? q.options[answer.picked] : null

  return (
    <section className="casefile__screen">
      <h2 className="casefile__title casefile__title--step" ref={headingRef} tabIndex={-1}>
        {step.title}
      </h2>
      <p className="casefile__text">{step.text}</p>

      {series ? (
        <TimeSeriesChart spec={step.chart} series={series} variables={data.variables} />
      ) : (
        <p className="casefile__msg">
          {L(`The data for ${step.chart.variable} is missing from this case file.`, `Faltan los datos de ${step.chart.variable} en este expediente.`)}
        </p>
      )}

      {q && (
        <fieldset className="casefile__quiz">
          <legend className="casefile__quiz-prompt">{q.prompt}</legend>
          <div className="casefile__options">
            {q.options.map((o, i) => {
              const state = answer.picked === i ? (o.correct ? 'right' : 'wrong') : undefined
              return (
                <button
                  key={i}
                  type="button"
                  className={`casefile__option${state ? ` is-${state}` : ''}`}
                  aria-pressed={answer.picked === i}
                  disabled={answer.solved && !o.correct}
                  onClick={() => !answer.solved && onAnswer({ picked: i, solved: o.correct })}
                >
                  <span className="casefile__option-letter" aria-hidden="true">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {o.text}
                </button>
              )
            })}
          </div>
          <div aria-live="polite">
            {picked && !picked.correct && (
              <p className="casefile__feedback">
                <b>{L('Not quite.', 'No exactamente.')}</b> {picked.feedback} {L('Try another answer.', 'Prueba otra respuesta.')}
              </p>
            )}
          </div>
        </fieldset>
      )}

      <div aria-live="polite">
        {solved && (
          <div className="casefile__takeaway">
            <p className="casefile__note-label">{L('Clue noted', 'Pista anotada')}</p>
            <p className="casefile__note-text">{step.takeaway}</p>
          </div>
        )}
      </div>

      <div className={onBack ? 'casefile__nav' : 'casefile__nav casefile__nav--end'}>
        {onBack && (
          <button type="button" className="casefile__btn" onClick={onBack}>
            {L('Back', 'Atrás')}
          </button>
        )}
        <button type="button" className="casefile__btn casefile__btn--primary" onClick={onNext} disabled={!solved}>
          {last ? L('Close the case', 'Cerrar el caso') : L('Next clue', 'Siguiente pista')}
        </button>
      </div>
    </section>
  )
}

function StatsLine({ series }: { series: TutorialSeries }) {
  const t = series.trend
  if (!t || !Number.isFinite(t.slope_per_year)) return <p className="casefile__stats">{credit(series)}</p>
  const u = baseUnits(series.units)
  return (
    <p className="casefile__stats">
      {L('Trend:', 'Tendencia:')} <b>{signed(t.slope_per_year * 10)} {u} {L('per decade', 'por década')}</b> ({L('95% range', 'rango del 95 %')} {signed(t.ci_low * 10)} {L('to', 'a')}{' '}
      {signed(t.ci_high * 10)}) · {formatP(t.p_value)} ·{' '}
      <b className={t.significant ? 'is-sig' : 'is-nosig'}>{t.significant ? L('significant', 'significativa') : L('not significant', 'no significativa')}</b>
      <span className="casefile__stats-test">
        {' '}
        ({testName(t.test)}, {L('5% level', 'nivel del 5 %')}). {credit(series)}
      </span>
    </p>
  )
}

/** What the statistics say per variable (reveal.by_variable + trend numbers) and the lesson */
export function StatsReveal({ script, data }: { script: TutorialScript; data: TutorialData }) {
  // The conclusion's variable goes first
  // One entry per variable of the reveal; if the script lists none, every variable of the data
  const listed = Object.keys(script.reveal.by_variable ?? {})
  const vars = (listed.length ? listed : Object.keys(data.variables)).sort(
    (a, b) => Number(b === script.conclusion.variable) - Number(a === script.conclusion.variable),
  )
  return (
    <>
      {vars.map((v) => {
        const series = data.variables[v]
        return (
          <article key={v} className="casefile__verdict">
            <h3 className="casefile__verdict-name">{series?.name ?? v}</h3>
            {script.reveal.by_variable?.[v] && <p className="casefile__text">{script.reveal.by_variable[v]}</p>}
            {series && <StatsLine series={series} />}
          </article>
        )
      })}

      <div className="casefile__lesson">
        <p className="casefile__note-label">{L('Lesson', 'Lección')}</p>
        <p className="casefile__note-text">{script.reveal.lesson}</p>
      </div>
    </>
  )
}
