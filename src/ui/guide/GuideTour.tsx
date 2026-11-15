// The map tutorial while it runs: plays the steps of guideSteps.ts one by one. A comic dialogue
// box shows what the guide robot says (typewriter), the keys the step asks for and the progress;
// a small bubble follows the 3D robot on screen while it speaks. The box only watches the game
// (position, magnifier, travel map): the player keeps full control and does the actions himself.
// Keys: Enter = finish the line / next step (on reading steps). "Skip tutorial" ends it any time.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GuideCue, HudState, LensFocusState } from '../../shared/events'
import type { GuideAnchorStore } from './anchor'
import { GUIDE_NAME, GUIDE_ROLE, GUIDE_STEPS, type GuideStep } from './guideSteps'
import RobotFace from './RobotFace'
import { L } from '../../shared/i18n'
import './Guide.css'

/** Milliseconds per character of the typewriter */
const TYPE_MS = 20
/** World units the detective must run to pass the "Run" step (he is about 3 units long) */
const MOVE_DISTANCE = 30
/** Pause after an action is done, before the next step (ms): time to see the "Done" tick */
const DONE_PAUSE_MS = 700

/** What the tour watches in the game. */
interface Watch {
  hud: HudState | null
  focusLens: boolean
  lensState: LensFocusState
  travelMapOpen: boolean
  flying: boolean
  /** Another panel is up (pause): the box hides, the text and the Enter key wait */
  blocked: boolean
}

interface Props extends Watch {
  anchors: GuideAnchorStore
  /** What the robot should do now (null when the tour ends) */
  onCue: (cue: GuideCue | null) => void
  /** HUD part to pulse during the current step */
  onHighlight: (part: 'corner' | null) => void
  /** The tour is over (finished or skipped) */
  onDone: () => void
}

export default function GuideTour({ anchors, onCue, onHighlight, onDone, ...watch }: Props) {
  const [index, setIndex] = useState(0)
  const step = GUIDE_STEPS[index]
  const next = useCallback(() => {
    if (index + 1 >= GUIDE_STEPS.length) onDone()
    else setIndex(index + 1)
  }, [index, onDone])

  useEffect(() => {
    onHighlight(step.highlight ?? null)
    return () => onHighlight(null)
  }, [step, onHighlight])
  // The robot leaves when the tour unmounts
  useEffect(() => () => onCue(null), [onCue])

  return (
    <GuideStepBox
      key={step.id}
      step={step}
      index={index}
      total={GUIDE_STEPS.length}
      anchors={anchors}
      onCue={onCue}
      onNext={next}
      onSkip={onDone}
      {...watch}
    />
  )
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

interface StepProps extends Watch {
  step: GuideStep
  index: number
  total: number
  anchors: GuideAnchorStore
  onCue: (cue: GuideCue | null) => void
  onNext: () => void
  onSkip: () => void
}

/** One step. Mounted fresh for each step (key), so its state starts clean. */
function GuideStepBox({ step, index, total, anchors, onCue, onNext, onSkip, hud, focusLens, lensState, travelMapOpen, flying, blocked }: StepProps) {
  const text = step.textInCaseRing && hud?.caseZone ? step.textInCaseRing : step.text
  const [typed, setTyped] = useState(() => (prefersReducedMotion() ? Number.MAX_SAFE_INTEGER : 0))
  const typing = typed < text.length
  // Where the detective stood when the step began (for the "Run" step)
  const [start] = useState(() => (hud ? { x: hud.x, z: hud.z } : null))
  const [wheelUsed, setWheelUsed] = useState(false)

  // Typewriter (waits while another panel is up)
  useEffect(() => {
    if (!typing || blocked) return
    const timer = setInterval(() => setTyped((n) => n + 1), TYPE_MS)
    return () => clearInterval(timer)
  }, [typing, blocked])

  // Tell the game where the robot goes and whether it is speaking
  const talking = typing && !blocked
  useEffect(() => {
    onCue({ at: step.at, hold: !!step.hold, talking })
  }, [step, talking, onCue])

  // Has the player done what the step asks?
  const reached =
    step.goal === 'move' ? !!start && !!hud && Math.hypot(hud.x - start.x, hud.z - start.z) >= MOVE_DISTANCE
    : step.goal === 'wheel' ? wheelUsed
    : step.goal === 'travelOpen' ? travelMapOpen
    : step.goal === 'travelClose' ? !travelMapOpen && !flying
    : step.goal === 'lensOpen' ? focusLens
    : step.goal === 'lensClose' ? !focusLens && lensState === 'out'
    : false
  // The timer depends only on `reached`: the HUD re-renders this box every frame while the
  // player moves, and a new onNext each render would restart the pause forever.
  const onNextRef = useRef(onNext)
  useEffect(() => {
    onNextRef.current = onNext
  })
  useEffect(() => {
    if (!reached) return
    const timer = setTimeout(() => onNextRef.current(), DONE_PAUSE_MS)
    return () => clearTimeout(timer)
  }, [reached])

  useEffect(() => {
    if (step.goal !== 'wheel') return
    const onWheel = () => setWheelUsed(true)
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [step.goal])

  // Enter: finish the line first; on reading steps (and the wheel step) it then goes on
  const canNext = step.goal === 'enter' || step.goal === 'wheel'
  const advance = useCallback(() => {
    if (typing) setTyped(Number.MAX_SAFE_INTEGER)
    else if (canNext) onNext()
  }, [typing, canNext, onNext])
  useEffect(() => {
    if (blocked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Enter' && e.code !== 'NumpadEnter') return
      if (e.repeat || e.defaultPrevented) return
      // Enter on a focused button or field belongs to it (travel map, magnifier, this box's buttons)
      const target = e.target as HTMLElement | null
      if (target?.closest?.('button, a, input, textarea, select')) return
      advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [blocked, advance])

  // Speech bubble that follows the robot on screen while it speaks
  const bubble = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const place = (a: { x: number; y: number } | null) => {
      const el = bubble.current
      if (!el) return
      el.style.display = a ? '' : 'none'
      if (a) el.style.transform = `translate(${a.x}px, ${a.y}px)`
    }
    place(anchors.get())
    return anchors.subscribe(place)
  }, [anchors])

  // No focus on mouse press: the game listens to the keyboard on the window, and a focused
  // button would take Space and Enter for itself
  const noFocus = (e: React.MouseEvent) => e.preventDefault()

  return (
    <>
      <div ref={bubble} className={`guide-bubble${talking ? ' is-talking' : ''}`} style={{ display: 'none' }} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <section className={`guide-tour${step.dock === 'top' ? ' guide-tour--top' : ''}${blocked ? ' is-hidden' : ''}`} aria-label="Tutorial">
        <div className="guide-tour__box">
          <p className="guide-tour__name">
            {GUIDE_NAME} <span>{GUIDE_ROLE}</span>
          </p>
          <RobotFace className="guide-tour__face" talking={talking} />
          <div className="guide-tour__body">
            <h2 className="guide-tour__title">{step.title}</h2>
            {/* The whole line is laid out from the start (the part not typed yet is invisible), so the box never jumps */}
            <p className="guide-tour__text" aria-hidden="true">
              {text.slice(0, typed)}
              <span className="guide-tour__rest">{text.slice(typed)}</span>
            </p>
            <p className="guide-sr-only" aria-live="polite">
              {text}
            </p>
            {step.keys && (
              <p className={`guide-tour__task${reached ? ' is-done' : ''}`}>
                <span className="guide-tour__keys">
                  {step.keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </span>
                <span>{step.action}</span>
                <span className="guide-tour__tick" aria-live="polite">
                  {reached ? L('Done!', '¡Hecho!') : ''}
                </span>
              </p>
            )}
          </div>
          <div className="guide-tour__footer">
            <button type="button" className="guide-button guide-button--small" onMouseDown={noFocus} onClick={onSkip}>
              {L('Skip tutorial', 'Saltar tutorial')}
            </button>
            <span className="guide-tour__progress" aria-label={L(`Step ${index + 1} of ${total}`, `Paso ${index + 1} de ${total}`)}>
              {Array.from({ length: total }, (_, i) => (
                <i key={i} className={i < index ? 'is-past' : i === index ? 'is-now' : ''} />
              ))}
            </span>
            {canNext && (
              <button type="button" className="guide-button guide-button--small guide-button--main" onMouseDown={noFocus} onClick={advance}>
                {index + 1 >= total ? L('Finish', 'Terminar') : L('Next', 'Siguiente')} <kbd>Enter</kbd>
              </button>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
