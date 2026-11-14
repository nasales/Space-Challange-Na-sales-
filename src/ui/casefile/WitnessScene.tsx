// Opening scene of a featured case: the witness tells the detective what happened, in speech
// bubbles above their heads plus a comic dialogue box in the lower third. The last line leads to
// the witness's claim, which the player pins into the detective's notebook.
// The game frames both characters (GameViewProps.dialogueCase) and reports where their heads are
// (onDialogueAnchors). Without anchors (game not ready, or the ?casefile preview) the bubbles use
// fixed positions: detective on the left, witness on the right.
// Keys: Enter / Space / click = finish the line or go to the next one; Esc = skip the scene.
import { useEffect, useRef, useState } from 'react'
import type { DialogueAnchors } from '../../shared/events'
import type { Outfit } from '../../shared/outfit'
import type { Witness } from '../../shared/witness'
import type { TutorialScript } from '../../shared/tutorial'
import { DetectiveFigure, WitnessFigure } from './Figure'
import { PLAIN_LOOK, prefersReducedMotion } from './sceneKit'
import type { AnchorStore } from './anchors'
import './WitnessScene.css'

export type Speaker = 'detective' | 'witness'
type Scene = NonNullable<TutorialScript['scene']>

interface Props {
  scene: Scene
  witness: Witness | undefined
  outfit: Outfit
  /** Head positions from the game; undefined = no game behind (draw stand-in figures) */
  anchors?: AnchorStore
  /** Who is talking while a line types (null when the line is complete) */
  onSpeaking: (s: Speaker | null) => void
  /** The claim is pinned: go on to the case file */
  onDone: () => void
}

/** Milliseconds per character of the typewriter */
const TYPE_MS = 24
/** Length of the "pin to notebook" flight; must match WitnessScene.css */
const PIN_MS = 750

export default function WitnessScene({ scene, witness, outfit, anchors, onSpeaking, onDone }: Props) {
  const lines = scene.lines
  const [idx, setIdx] = useState(0)
  const [typedRaw, setTyped] = useState(0)
  // talk: the lines; claim: the claim card; pinning: the card flies into the notebook
  const [mode, setMode] = useState<'talk' | 'claim' | 'pinning'>(lines.length ? 'talk' : 'claim')
  const [reduced] = useState(prefersReducedMotion)

  const line = lines[Math.min(idx, lines.length - 1)]
  const full = line?.text ?? ''
  // reduced motion: no typewriter, the whole line at once
  const typed = reduced ? full.length : typedRaw
  const typing = mode === 'talk' && typed < full.length
  const witnessName = witness?.name ?? 'The witness'

  // Typewriter (instant with reduced motion)
  useEffect(() => {
    if (mode !== 'talk' || typed >= full.length) return
    const t = window.setTimeout(() => setTyped((n) => Math.min(full.length, n + 1)), TYPE_MS)
    return () => window.clearTimeout(t)
  }, [mode, typed, full])

  const speaking = typing ? line.speaker : null
  useEffect(() => {
    onSpeaking(speaking)
  }, [speaking, onSpeaking])
  useEffect(() => () => onSpeaking(null), [onSpeaking])

  const advance = () => {
    if (mode !== 'talk') return
    if (typing) setTyped(full.length)
    else if (idx < lines.length - 1) {
      setIdx(idx + 1)
      setTyped(0)
    } else setMode('claim')
  }

  const pin = () => {
    if (mode !== 'claim') return
    if (reduced) onDone()
    else setMode('pinning')
  }
  useEffect(() => {
    if (mode !== 'pinning') return
    const t = window.setTimeout(onDone, PIN_MS)
    return () => window.clearTimeout(t)
  }, [mode, onDone])

  const skip = () => (mode === 'talk' ? setMode('claim') : mode === 'claim' ? onDone() : undefined)

  // Keyboard: capture on window, before the game; buttons keep their own Enter / Space
  const keys = useRef({ advance, skip })
  useEffect(() => {
    keys.current = { advance, skip }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation()
      if (e.key === 'Escape') {
        e.preventDefault()
        keys.current.skip()
        return
      }
      if (e.key !== 'Enter' && e.key !== ' ') return
      const el = e.target as HTMLElement | null
      if (el?.closest('button, a, input, textarea')) return
      e.preventDefault()
      if (!e.repeat) keys.current.advance()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // Focus the dialogue box so Enter / Space never land on the game canvas
  const boxRef = useRef<HTMLDivElement>(null)
  const pinRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (mode === 'talk') boxRef.current?.focus({ preventScroll: true })
    if (mode === 'claim') pinRef.current?.focus({ preventScroll: true })
  }, [mode])

  const standalone = !anchors
  const name = line?.speaker === 'detective' ? 'Detective' : witnessName
  const role = line?.speaker === 'detective' ? 'That is you' : witness?.role
  const look = witness?.look ?? PLAIN_LOOK

  return (
    <div
      className={`wscene${standalone ? ' wscene--stage' : ''}${mode !== 'talk' ? ' wscene--claim' : ''}`}
      onClick={mode === 'talk' ? advance : undefined}
    >
      {standalone && (
        <div className="wscene__stage" aria-hidden="true">
          <div className="wscene__stand wscene__stand--detective">
            <DetectiveFigure outfit={outfit} talking={speaking === 'detective'} />
          </div>
          <div className="wscene__stand wscene__stand--witness">
            <WitnessFigure look={look} talking={speaking === 'witness'} />
          </div>
        </div>
      )}

      {mode === 'talk' && line && (
        <>
          <Bubble who="detective" anchors={anchors} active={line.speaker === 'detective'} typing={typing} />
          <Bubble who="witness" anchors={anchors} active={line.speaker === 'witness'} typing={typing} />
        </>
      )}

      <button
        type="button"
        className="wscene__skip"
        onClick={(e) => {
          e.stopPropagation()
          skip()
        }}
        disabled={mode === 'pinning'}
      >
        {mode === 'talk' ? 'Skip scene' : 'Skip'}
        <kbd>Esc</kbd>
      </button>

      {mode === 'talk' && line && (
        <div
          ref={boxRef}
          className={`wscene__box wscene__box--${line.speaker}`}
          tabIndex={-1}
          role="group"
          aria-roledescription="dialogue"
          aria-label={`Conversation with ${witnessName}`}
        >
          <div className="wscene__portrait" aria-hidden="true">
            {line.speaker === 'detective' ? (
              <DetectiveFigure outfit={outfit} crop="head" talking={typing} />
            ) : (
              <WitnessFigure look={look} crop="head" talking={typing} />
            )}
          </div>
          <div className="wscene__main">
            <p className="wscene__name">
              {name}
              {role && <span className="wscene__role">{role}</span>}
            </p>
            {/* typed text for the eye; the full line for screen readers */}
            <p className="wscene__text" aria-hidden="true">
              {full.slice(0, typed)}
              <span className="wscene__ghost">{full.slice(typed)}</span>
            </p>
            <p className="wscene__sr" aria-live="polite">
              {name}: {full}
            </p>
          </div>
          <p className="wscene__count" aria-hidden="true">
            {idx + 1} / {lines.length}
          </p>
          <span className={`wscene__next${typing ? '' : ' is-ready'}`} aria-hidden="true">
            {idx < lines.length - 1 ? '▼' : '★'}
          </span>
          <p className="wscene__help">
            {typing ? 'Click or press Enter to finish the line' : idx < lines.length - 1 ? 'Click or press Enter for the next line' : 'Click or press Enter to note the claim'}
          </p>
        </div>
      )}

      {mode !== 'talk' && (
        <div className="wscene__claim-wrap">
          <figure className={`wscene__claim${mode === 'pinning' ? ' is-pinning' : ''}`} aria-live="polite">
            <span className="wscene__pin" aria-hidden="true" />
            <p className="wscene__claim-label">Witness says</p>
            <blockquote className="wscene__claim-text">&ldquo;{scene.claim}&rdquo;</blockquote>
            <figcaption className="wscene__claim-who">
              — {witnessName}
              {witness?.role ? `, ${witness.role}` : ''}
            </figcaption>
          </figure>
          <p className="wscene__claim-help">A claim is not a fact. Test it with the data.</p>
          <button
            ref={pinRef}
            type="button"
            className="wscene__pin-btn"
            onClick={pin}
            disabled={mode === 'pinning'}
          >
            Pin it to the notebook
          </button>
        </div>
      )}
    </div>
  )
}

/** Fixed bubble spots when the game sends no anchors (fractions of the viewport) */
const FALLBACK: Record<Speaker, { x: number; y: number }> = {
  detective: { x: 0.3, y: 0.35 },
  witness: { x: 0.7, y: 0.36 },
}
/** Phones: the stand-ins are smaller and closer to the centre (WitnessScene.css) */
const FALLBACK_PHONE: Record<Speaker, { x: number; y: number }> = {
  detective: { x: 0.27, y: 0.31 },
  witness: { x: 0.73, y: 0.32 },
}

function Bubble({ who, anchors, active, typing }: { who: Speaker; anchors?: AnchorStore; active: boolean; typing: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const place = (a: DialogueAnchors | null) => {
      const w = window.innerWidth
      const h = window.innerHeight
      const f = (w <= 600 ? FALLBACK_PHONE : FALLBACK)[who]
      const p = a?.[who] ?? { x: f.x * w, y: f.y * h }
      const x = Math.min(w - 40, Math.max(40, p.x))
      const y = Math.min(h * 0.6, Math.max(56, p.y))
      el.style.transform = `translate(${x}px, ${y}px)`
      // In the game, hide the bubbles until the camera has framed both characters (anchors arrive)
      el.style.visibility = anchors && !a ? 'hidden' : 'visible'
    }
    place(anchors?.get() ?? null)
    const off = anchors?.subscribe(place)
    const onResize = () => place(anchors?.get() ?? null)
    window.addEventListener('resize', onResize)
    return () => {
      off?.()
      window.removeEventListener('resize', onResize)
    }
  }, [who, anchors])

  return (
    <div ref={ref} className={`wbubble wbubble--${who}${active ? ' is-active' : ''}`} aria-hidden="true">
      <div className="wbubble__body">
        <span className={`wbubble__dots${active && typing ? ' is-typing' : ''}`}>
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  )
}
