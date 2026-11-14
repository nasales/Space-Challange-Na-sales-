// How the player opens a featured case: Enter while the car is near its marker, or a click on
// the marker. Nothing happens while the game is paused (a UI overlay is open).
//
// The Space menu prototype (src/ui/probe) swallows every key in the capture phase while it is
// open, so Enter never reaches this listener then. Enter inside a text field is ignored too.

/** After the UI unpauses the game, Enter is ignored for this long (ms): the same key press that
 *  closed an overlay must not reopen the case straight away. */
const RESUME_GRACE_MS = 400
/** A pointer that moved more than this (px) between down and up is a drag, not a click. */
const CLICK_SLOP = 6

export interface CaseInputOptions {
  dom: HTMLElement
  /** Id of the case the car is near right now, or null */
  nearCase: () => string | null
  /** Case marker under the pointer (normalised device coordinates), or null */
  pick: (ndcX: number, ndcY: number) => string | null
  /** true while a UI overlay is open */
  isPaused: () => boolean
  /** Time (performance.now) when the game was last unpaused */
  resumedAt: () => number
  open: (caseId: string) => void
}

const isTextField = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName))

export function createCaseInput(o: CaseInputOptions) {
  const onKey = (e: KeyboardEvent) => {
    if (e.code !== 'Enter' && e.code !== 'NumpadEnter') return
    if (e.repeat || e.defaultPrevented || isTextField(e.target)) return
    if (o.isPaused() || performance.now() - o.resumedAt() < RESUME_GRACE_MS) return
    const id = o.nearCase()
    if (!id) return
    e.preventDefault()
    o.open(id)
  }

  let down: { x: number; y: number } | null = null
  const onPointerDown = (e: PointerEvent) => {
    down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null
  }
  const onPointerUp = (e: PointerEvent) => {
    const start = down
    down = null
    if (!start || e.button !== 0 || o.isPaused()) return
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_SLOP) return
    const rect = o.dom.getBoundingClientRect()
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1
    const id = o.pick(ndcX, ndcY)
    if (id) o.open(id)
  }

  window.addEventListener('keydown', onKey)
  o.dom.addEventListener('pointerdown', onPointerDown)
  o.dom.addEventListener('pointerup', onPointerUp)

  return {
    dispose() {
      window.removeEventListener('keydown', onKey)
      o.dom.removeEventListener('pointerdown', onPointerDown)
      o.dom.removeEventListener('pointerup', onPointerUp)
    },
  }
}
