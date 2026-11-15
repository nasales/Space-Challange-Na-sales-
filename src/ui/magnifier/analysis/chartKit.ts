// Small shared pieces of the evidence-sheet charts (plain SVG, no chart library).
import { useSyncExternalStore } from 'react'

export interface Frame {
  /** viewBox size */
  W: number
  H: number
  /** Padding around the plot area */
  l: number
  r: number
  t: number
  b: number
}

/** Wide sheet: long time axis. */
export const WIDE: Frame = { W: 560, H: 210, l: 54, r: 12, t: 22, b: 24 }
/** Phone, and the two half-width charts: fewer viewBox units so the text stays readable. */
export const COMPACT: Frame = { W: 340, H: 200, l: 46, r: 10, t: 22, b: 24 }

const PHONE = '(max-width: 520px)'

function subscribe(onChange: () => void) {
  const query = window.matchMedia(PHONE)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** true on a phone-sized viewport (same breakpoint as ClueResult.css) */
export function useNarrow(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE).matches,
    () => false,
  )
}

/** Linear scale from a data range to a pixel range. */
export function scale(d0: number, d1: number, p0: number, p1: number) {
  const span = d1 - d0 || 1
  return (v: number) => p0 + ((v - d0) / span) * (p1 - p0)
}

/** SVG path of a series; null values break the line. A lone point is drawn as a short dash. */
export function linePath(values: (number | null)[], sx: (i: number) => number, sy: (v: number) => number): string {
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      pen = false
      return
    }
    const x = sx(i).toFixed(1)
    const y = sy(v).toFixed(1)
    const alone = !pen && (values[i + 1] == null || !Number.isFinite(values[i + 1] as number))
    d += alone ? `M${x},${y}h0.01` : `${pen ? 'L' : 'M'}${x},${y}`
    pen = true
  })
  return d
}
