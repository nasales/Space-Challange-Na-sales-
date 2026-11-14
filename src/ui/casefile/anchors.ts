// Tiny store for the dialogue anchors the game sends every frame (GameCallbacks.onDialogueAnchors).
// The speech bubbles read it directly and move themselves, so the app does not re-render per frame.
import type { DialogueAnchors } from '../../shared/events'

export interface AnchorStore {
  /** Pass this as the game's onDialogueAnchors */
  set: (a: DialogueAnchors | null) => void
  get: () => DialogueAnchors | null
  subscribe: (fn: (a: DialogueAnchors | null) => void) => () => void
}

export function createAnchorStore(): AnchorStore {
  let current: DialogueAnchors | null = null
  const subs = new Set<(a: DialogueAnchors | null) => void>()
  return {
    set: (a) => {
      current = a
      subs.forEach((fn) => fn(a))
    },
    get: () => current,
    subscribe: (fn) => {
      subs.add(fn)
      return () => {
        subs.delete(fn)
      }
    },
  }
}
