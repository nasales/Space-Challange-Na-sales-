// Keyboard helpers shared by the case-file screens.
import { useEffect, useRef } from 'react'

/**
 * Window capture listener: runs before the game's keydown listener and stops it.
 * onEscape(null) still blocks keys but ignores Escape.
 */
export function useKeyCapture(onEscape: (() => void) | null) {
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

/**
 * Like useKeyCapture, but lets keys reach the screen's own React handlers first (custom keyboard
 * controls such as the evidence-board chart cursor and ruler): Escape is handled in the capture
 * phase, and every key is stopped at `document`, after React (root container) and before the
 * game's window listeners.
 */
export function useKeyShield(onEscape: () => void) {
  const handler = useRef(onEscape)
  useEffect(() => {
    handler.current = onEscape
  })
  useEffect(() => {
    const onCapture = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        handler.current()
      } else if (e.key === 'Enter' && e.repeat) {
        e.preventDefault()
      }
    }
    const stop = (e: KeyboardEvent) => e.stopImmediatePropagation()
    window.addEventListener('keydown', onCapture, true)
    document.addEventListener('keydown', stop)
    document.addEventListener('keyup', stop)
    return () => {
      window.removeEventListener('keydown', onCapture, true)
      document.removeEventListener('keydown', stop)
      document.removeEventListener('keyup', stop)
    }
  }, [])
}
