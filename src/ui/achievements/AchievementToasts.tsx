// Achievement toasts: a trophy-style caption at the top centre that slides in, stays a few seconds
// and slides out; several in a row wait in a queue. Mounted with one line in src/App.tsx.
// Development only: open the game with ?achtest to fire two demo toasts (one with a ring, one single).
import { useEffect, useState, type CSSProperties } from 'react'
import { demoToasts, onAchievementToast, type AchievementToast } from '../../shared/achievements'
import './AchievementToasts.css'

/** How long each toast is on screen, slide in and out included (ms). */
const TOAST_MS = 4600
/** Delay before the ?achtest demo toasts (ms), so they show once the page has settled. */
const DEMO_DELAY_MS = 600
const DEMO = import.meta.env.DEV && new URLSearchParams(window.location.search).has('achtest')

/** Progress ring geometry (SVG units). */
const RING_R = 25
const RING_C = 2 * Math.PI * RING_R

export default function AchievementToasts() {
  const [queue, setQueue] = useState<AchievementToast[]>([])
  useEffect(() => onAchievementToast((t) => setQueue((q) => [...q, t])), [])
  useEffect(() => {
    if (!DEMO) return
    const id = window.setTimeout(demoToasts, DEMO_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [])
  const current = queue[0]
  useEffect(() => {
    if (!current) return
    const id = window.setTimeout(() => setQueue((q) => q.slice(1)), TOAST_MS)
    return () => window.clearTimeout(id)
  }, [current])
  if (!current) return null
  const { ring } = current
  return (
    <div
      key={current.key}
      className={`ach-toast${current.complete ? ' is-complete' : ''}`}
      role="status"
      aria-live="polite"
      style={{ animationDuration: `${TOAST_MS}ms` }}
    >
      <div className="ach-toast__badge">
        {ring && (
          <svg className="ach-toast__ring" viewBox="0 0 60 60" aria-hidden="true">
            <circle className="ach-toast__track" cx="30" cy="30" r={RING_R} />
            <circle
              className="ach-toast__fill"
              cx="30"
              cy="30"
              r={RING_R}
              style={
                {
                  strokeDasharray: RING_C,
                  '--ring-from': RING_C * (1 - ring.from),
                  '--ring-to': RING_C * (1 - ring.to),
                } as CSSProperties
              }
            />
          </svg>
        )}
        <span className={`ach-toast__icon${ring ? '' : ' is-single'}`} aria-hidden="true">
          {current.icon}
        </span>
      </div>
      <p className="ach-toast__text">
        <span className="ach-toast__title">{current.title}</span>
        <span className="ach-toast__message">{current.message}</span>
      </p>
    </div>
  )
}
