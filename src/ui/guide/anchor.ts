// Tiny store for the guide robot's screen position (GameCallbacks.onGuideAnchor). The speech bubble
// reads it directly and moves itself, so the app does not re-render every time the robot moves.
// Same idea as src/ui/casefile/anchors.ts.

export type GuideAnchor = { x: number; y: number } | null

export interface GuideAnchorStore {
  /** Pass this as the game's onGuideAnchor */
  set: (a: GuideAnchor) => void
  get: () => GuideAnchor
  subscribe: (fn: (a: GuideAnchor) => void) => () => void
}

export function createGuideAnchorStore(): GuideAnchorStore {
  let current: GuideAnchor = null
  const subs = new Set<(a: GuideAnchor) => void>()
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
