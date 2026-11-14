// Variable picker drawn inside a giant magnifier. While the detective is stopped (magnifier out),
// Space makes the lens pop up and grow over the map; Esc shrinks it away and goes back to the map.
// The variable buttons are placeholders for now: visible but disabled (nothing to open yet).
import { useEffect, useRef, useState } from 'react'
import { CLIMATE_VARIABLES } from '../../shared/variables'
import './VariablePicker.css'

type Phase = 'closed' | 'open' | 'closing'

/** Must match the shrink animation length in VariablePicker.css */
const CLOSE_MS = 220

interface Props {
  /** The detective is stopped, so Space may open the picker */
  canOpen: boolean
  /** Told whenever the picker starts covering the map (true) and when it is fully gone (false) */
  onOpenChange?: (open: boolean) => void
}

export default function VariablePicker({ canOpen, onOpenChange }: Props) {
  const [phase, setPhase] = useState<Phase>('closed')
  const dialog = useRef<HTMLDivElement>(null)

  // Latest values for the window key handler, which is attached only once
  const state = useRef({ phase, canOpen })
  useEffect(() => {
    state.current = { phase, canOpen }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { phase, canOpen } = state.current
      if (e.code === 'Space') {
        if (phase !== 'closed' || canOpen) e.preventDefault() // no page scroll, no button "click"
        if (phase === 'closed' && canOpen && !e.repeat) setPhase('open')
      } else if (e.code === 'Escape' && phase === 'open') {
        e.preventDefault()
        setPhase('closing')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Shrink, then remove the overlay. Reduced motion has no animation, so it closes at once
  useEffect(() => {
    if (phase !== 'closing') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => setPhase('closed'), reduced ? 0 : CLOSE_MS)
    return () => window.clearTimeout(timer)
  }, [phase])

  const covering = phase !== 'closed'
  useEffect(() => {
    onOpenChange?.(covering)
    if (phase === 'open') dialog.current?.focus()
  }, [covering, phase, onOpenChange])

  if (!covering) return null

  return (
    <div className={`variable-picker variable-picker--${phase}`}>
      <div
        ref={dialog}
        className="variable-picker__lens"
        role="dialog"
        aria-modal="true"
        aria-labelledby="variable-picker-title"
        tabIndex={-1}
      >
        <div className="variable-picker__handle" aria-hidden="true" />
        <div className="variable-picker__glass">
          <p className="variable-picker__kicker">Magnifier</p>
          <h2 id="variable-picker-title" className="variable-picker__title">
            What do you want to investigate?
          </h2>
          <ul className="variable-picker__list">
            {CLIMATE_VARIABLES.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className="variable-picker__option"
                  disabled
                  aria-disabled="true"
                  title="Coming soon"
                >
                  <span className="variable-picker__name">{v.name}</span>
                  <span className="variable-picker__unit">{v.unit}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="variable-picker__hint">Coming soon: these clues are not open yet.</p>
          <p className="variable-picker__back">
            <kbd>Esc</kbd> Back to the map
          </p>
        </div>
      </div>
    </div>
  )
}
