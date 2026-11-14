// Featured-case tutorial overlay (docs/case_tutorials.md):
// intro (context + question) -> steps (chart + text + multiple-choice check) -> the player's own
// conclusion -> reveal (what the statistics say). The statistical result is only shown on the reveal.
// While it is open, key presses do not reach the game (window capture listener, like PointProbe),
// but typing in the conclusion box still works (the default action is not prevented).
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { TutorialData, TutorialScript, TutorialSeries, TutorialStep } from '../../shared/tutorial'
import TimeSeriesChart from './TimeSeriesChart'
import { credit, formatP, signed, testName } from './format'
import { loadTutorial, type LoadedTutorial } from './loader'
import './CaseFile.css'

interface CaseFileProps {
  caseId: string
  onClose: () => void
}

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; tutorial: LoadedTutorial }

/** Shortest conclusion that enables Submit (characters, after trimming) */
const MIN_CONCLUSION = 12
const MAX_CONCLUSION = 1500

export default function CaseFile({ caseId, onClose }: CaseFileProps) {
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [loadedId, setLoadedId] = useState(caseId)
  if (loadedId !== caseId) {
    // a new case was opened while mounted: start again
    setLoadedId(caseId)
    setLoad({ state: 'loading' })
  }

  useEffect(() => {
    let alive = true
    loadTutorial(caseId)
      .then((tutorial) => alive && setLoad({ state: 'ready', tutorial }))
      .catch((err: unknown) => alive && setLoad({ state: 'error', message: err instanceof Error ? err.message : String(err) }))
    return () => {
      alive = false
    }
  }, [caseId])

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
      className="casefile"
      aria-label="Case file"
      // Escape is handled by our key listener (it prevents the default, so this rarely fires)
      onCancel={(e) => e.preventDefault()}
    >
      {load.state === 'ready' ? (
        <Tutorial key={caseId} tutorial={load.tutorial} onClose={onClose} />
      ) : (
        <div className="casefile__sheet">
          <Header label="Case file" onClose={onClose} />
          <div className="casefile__body">
            {load.state === 'loading' ? (
              <p className="casefile__msg">Opening the case file…</p>
            ) : (
              <>
                <h2 className="casefile__title">Case file not found</h2>
                <p className="casefile__msg">
                  {load.message} The detective will have to come back later. You can keep driving.
                </p>
                <div className="casefile__nav">
                  <button type="button" className="casefile__btn casefile__btn--primary" onClick={onClose}>
                    Back to the map
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

/**
 * Window capture listener: runs before the game's keydown listener and stops it.
 * onEscape(null) still blocks keys but ignores Escape.
 */
function useKeyCapture(onEscape: (() => void) | null) {
  const handler = useRef(onEscape)
  useEffect(() => {
    handler.current = onEscape
  })
  const active = onEscape !== null
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault() // stops the dialog's own cancel/close
        handler.current?.()
      } else if (e.key === 'Enter' && e.repeat) {
        e.preventDefault() // a held Enter (used to open the case) must not click through the screens
      }
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [active])
}

function Header({
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
        Close
      </button>
    </div>
  )
}

interface Answer {
  /** last option picked (index), null before any pick */
  picked: number | null
  solved: boolean
}

function Tutorial({ tutorial, onClose }: { tutorial: LoadedTutorial; onClose: () => void }) {
  const { script, data } = tutorial
  const n = script.steps.length
  // 0 = intro, 1..n = steps, n + 1 = conclusion, n + 2 = reveal
  const [at, setAt] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [text, setText] = useState('')
  const [confirming, setConfirming] = useState(false)

  const midway = at > 0 && at <= n + 1
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
    setAt(Math.max(0, Math.min(n + 2, to)))
  }

  let progress: string | undefined
  if (at >= 1 && at <= n) progress = `Clue ${at} of ${n}`
  else if (at === n + 1) progress = 'Your conclusion'
  else if (at === n + 2) progress = 'Case solved'

  return (
    <div className="casefile__sheet">
      <Header label={script.title} progress={progress} onClose={requestClose} />
      {at >= 1 && at <= n + 1 && <ProgressDots total={n + 1} current={at} />}

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
            onBack={() => go(at - 1)}
            onNext={() => go(at + 1)}
            last={at === n}
          />
        )}

        {at === n + 1 && (
          <Conclusion
            script={script}
            text={text}
            onText={setText}
            headingRef={headingRef}
            onBack={() => go(n)}
            onSubmit={() => go(n + 2)}
          />
        )}

        {at === n + 2 && <Reveal script={script} data={data} text={text} headingRef={headingRef} onClose={onClose} />}
      </div>

      {confirming && (
        <div className="casefile__confirm" role="alertdialog" aria-labelledby="casefile-confirm-text">
          <p id="casefile-confirm-text">Close this case file? Your answers will be lost.</p>
          <div className="casefile__nav">
            <button type="button" className="casefile__btn" onClick={() => setConfirming(false)} autoFocus>
              Keep investigating
            </button>
            <button type="button" className="casefile__btn casefile__btn--danger" onClick={onClose}>
              Close case file
            </button>
          </div>
        </div>
      )}
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
        <p className="casefile__note-label">The question</p>
        <p className="casefile__note-text">{script.intro.question}</p>
      </div>
      <div className="casefile__nav casefile__nav--end">
        <button type="button" className="casefile__btn casefile__btn--primary" onClick={onStart}>
          Start investigating
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
  onBack: () => void
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
        <TimeSeriesChart spec={step.chart} series={series} />
      ) : (
        <p className="casefile__msg">The data for {step.chart.variable} is missing from this case file.</p>
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
                <b>Not quite.</b> {picked.feedback} Try another answer.
              </p>
            )}
          </div>
        </fieldset>
      )}

      <div aria-live="polite">
        {solved && (
          <div className="casefile__takeaway">
            <p className="casefile__note-label">Clue noted</p>
            <p className="casefile__note-text">{step.takeaway}</p>
          </div>
        )}
      </div>

      <div className="casefile__nav">
        <button type="button" className="casefile__btn" onClick={onBack}>
          Back
        </button>
        <button type="button" className="casefile__btn casefile__btn--primary" onClick={onNext} disabled={!solved}>
          {last ? 'Write my conclusion' : 'Next clue'}
        </button>
      </div>
    </section>
  )
}

function Conclusion({
  script,
  text,
  onText,
  headingRef,
  onBack,
  onSubmit,
}: {
  script: TutorialScript
  text: string
  onText: (t: string) => void
  headingRef: HeadingRef
  onBack: () => void
  onSubmit: () => void
}) {
  const ready = text.trim().length >= MIN_CONCLUSION
  return (
    <section className="casefile__screen">
      <h2 className="casefile__title casefile__title--step" ref={headingRef} tabIndex={-1}>
        Your conclusion
      </h2>
      {/* the question again, unless the prompt already repeats it */}
      {!script.conclusion.prompt.includes(script.intro.question) && (
        <div className="casefile__question-note">
          <p className="casefile__note-label">The question</p>
          <p className="casefile__note-text">{script.intro.question}</p>
        </div>
      )}
      <form
        className="casefile__form"
        onSubmit={(e) => {
          e.preventDefault()
          if (ready) onSubmit()
        }}
      >
        <label htmlFor="casefile-conclusion" className="casefile__text casefile__label-text">
          {script.conclusion.prompt}
        </label>
        <textarea
          id="casefile-conclusion"
          className="casefile__textarea"
          value={text}
          onChange={(e) => onText(e.target.value)}
          placeholder={script.conclusion.placeholder}
          maxLength={MAX_CONCLUSION}
          rows={5}
          aria-describedby="casefile-conclusion-hint"
        />
        <p id="casefile-conclusion-hint" className="casefile__hint">
          {ready
            ? 'The statistics stay hidden until you submit.'
            : 'Write a sentence or two in your own words.'}{' '}
          <span className="casefile__count">
            {text.length} / {MAX_CONCLUSION}
          </span>
        </p>
        <div className="casefile__nav">
          <button type="button" className="casefile__btn" onClick={onBack}>
            Back
          </button>
          <button type="submit" className="casefile__btn casefile__btn--primary" disabled={!ready}>
            Submit conclusion
          </button>
        </div>
      </form>
    </section>
  )
}

function StatsLine({ series }: { series: TutorialSeries }) {
  const t = series.trend
  const u = series.units
  return (
    <p className="casefile__stats">
      Trend: <b>{signed(t.slope_per_year * 10)} {u} per decade</b> (95% range {signed(t.ci_low * 10)} to{' '}
      {signed(t.ci_high * 10)}) · {formatP(t.p_value)} ·{' '}
      <b className={t.significant ? 'is-sig' : 'is-nosig'}>{t.significant ? 'significant' : 'not significant'}</b>
      <span className="casefile__stats-test">
        {' '}
        ({testName(t.test)}, 5% level). {credit(series)}
      </span>
    </p>
  )
}

function Reveal({
  script,
  data,
  text,
  headingRef,
  onClose,
}: {
  script: TutorialScript
  data: TutorialData
  text: string
  headingRef: HeadingRef
  onClose: () => void
}) {
  // The conclusion's variable goes first
  const vars = Object.keys(script.reveal.by_variable).sort(
    (a, b) => Number(b === script.conclusion.variable) - Number(a === script.conclusion.variable),
  )
  return (
    <section className="casefile__screen">
      <h2 className="casefile__title casefile__title--step" ref={headingRef} tabIndex={-1}>
        What the statistics say
      </h2>

      <blockquote className="casefile__yours">
        <p className="casefile__note-label">Your conclusion</p>
        <p className="casefile__yours-text">{text.trim()}</p>
      </blockquote>

      {/*
        TODO(ai-checker): the AI checker verdict goes here, above the statistics.
        Call the checker with { case_id: script.case_id, variable: script.conclusion.variable,
        conclusion: text } and show its verdict. If it fails or takes more than 8 s, show nothing
        extra: the statistical result below is the fallback (docs/agents/interface.md, check 5).
      */}

      {vars.map((v) => {
        const series = data.variables[v]
        return (
          <article key={v} className="casefile__verdict">
            <h3 className="casefile__verdict-name">{series?.name ?? v}</h3>
            <p className="casefile__text">{script.reveal.by_variable[v]}</p>
            {series && <StatsLine series={series} />}
          </article>
        )
      })}

      <div className="casefile__lesson">
        <p className="casefile__note-label">Lesson</p>
        <p className="casefile__note-text">{script.reveal.lesson}</p>
      </div>

      <div className="casefile__nav casefile__nav--end">
        <button type="button" className="casefile__btn casefile__btn--primary" onClick={onClose}>
          Close case file
        </button>
      </div>
    </section>
  )
}
