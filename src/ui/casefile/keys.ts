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
