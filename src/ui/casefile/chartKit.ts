// Shared pieces of the hand-made SVG charts of the case file: width measurement, round ticks,
// year ticks, a y scale, and label placement without overlaps.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { SeasonId } from '../../shared/tutorial'
import { MONTH_LONG } from './format'

/** What one chart view draws: the SVG body, its height, the accessible summary and the legend */
export interface ViewOut {
  H: number
  body: ReactNode
  summary: string
  keys: ReactNode
  note?: string
  /** Pixel geometry for interactive overlays (evidence-board tasks); line views and window_trends */
  geom?: ChartGeom
}

/** One drawn point, in pixels, with the date key it came from ("YYYY-MM", "YYYY" or "MM") */
export interface GeomPoint {
  px: number
  py: number
  key: string
  value: number
}

/**
 * Where a chart drew its data, so a caller can draw on top of it (TimeSeriesChart `overlay`).
 * sx/sy map data -> pixels and ix/iy pixels -> data (x = decimal year, y = value on the y axis).
 */
export interface ChartGeom {
  W: number
  H: number
  plot: { left: number; right: number; top: number; bottom: number }
  pts: GeomPoint[]
  sx: (x: number) => number
  sy: (y: number) => number
  ix: (px: number) => number
  iy: (py: number) => number
}

export type ViewResult = ViewOut | { empty: string }

/** Chart height and padding for a box of width W (extra space on top/bottom/left if asked) */
export function frame(W: number, extra: { t?: number; b?: number; l?: number } = {}) {
  const narrow = W < 460
  const H = Math.round(Math.min(300, Math.max(210, W * 0.48))) + (extra.t ?? 0) + (extra.b ?? 0)
  const P = { l: (narrow ? 40 : 50) + (extra.l ?? 0), r: 14, t: 28 + (extra.t ?? 0), b: 28 + (extra.b ?? 0) }
  return { narrow, H, P, plotW: W - P.l - P.r, plotH: H - P.t - P.b }
}

/** Round axis ticks (1, 2, 2.5, 5 x 10^n) */
export function niceTicks(min: number, max: number, count: number, integer = false): number[] {
  const span = max - min || Math.abs(max) || 1
  const raw = span / Math.max(count, 1)
  const mag = 10 ** Math.floor(Math.log10(raw))
  let step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  if (integer) step = Math.max(1, Math.round(step))
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(Number(v.toFixed(10)))
  return out
}

export function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setWidth(Math.max(260, Math.round(el.clientWidth)))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Linear y scale with round ticks; `values` must not be empty */
export function yScale(values: number[], top: number, bottom: number, opts: { ticks: number; zero?: boolean; integer?: boolean; pad?: number }) {
  const vs = opts.zero ? [...values, 0] : values
  let yMin = Math.min(...vs)
  let yMax = Math.max(...vs)
  const pad = (yMax - yMin || Math.abs(yMax) || 1) * (opts.pad ?? 0.08)
  // counts and other zero-based scales do not go below zero
  yMin = opts.integer && yMin >= 0 ? 0 : yMin - pad
  yMax += pad
  const ticks = niceTicks(yMin, yMax, opts.ticks, opts.integer)
  yMin = Math.min(yMin, ticks[0])
  yMax = Math.max(yMax, ticks[ticks.length - 1])
  const sy = (y: number) => top + (1 - (y - yMin) / (yMax - yMin || 1)) * (bottom - top)
  return { yMin, yMax, ticks, sy }
}

/** Year labels that fit the width: every 1, 2, 5, 10... years */
export function yearTicks(firstYear: number, lastYear: number, plotW: number, narrow: boolean): number[] {
  const maxLabels = Math.max(2, Math.floor(plotW / (narrow ? 44 : 56)))
  const yStep = [1, 2, 5, 10, 20, 50].find((s) => (lastYear - firstYear) / s + 1 <= maxLabels) ?? 50
  const out: number[] = []
  for (let yr = Math.ceil(firstYear / yStep) * yStep; yr <= lastYear; yr += yStep) out.push(yr)
  return out
}

/** "YYYY-MM" -> decimal year at the middle of the month */
export const monthX = (date: string) => Number(date.slice(0, 4)) + (Number(date.slice(5, 7)) - 0.5) / 12

export const SEASON_LABEL: Record<SeasonId, string> = {
  DJF: 'Every winter (Dec-Feb)',
  MAM: 'Every spring (Mar-May)',
  JJA: 'Every summer (Jun-Aug)',
  SON: 'Every autumn (Sep-Nov)',
  JJAS: 'Every fire season (Jun-Sep)',
}

export const SEASON_NAME: Record<SeasonId, string> = {
  DJF: 'winter (Dec-Feb)',
  MAM: 'spring (Mar-May)',
  JJA: 'summer (Jun-Aug)',
  SON: 'autumn (Sep-Nov)',
  JJAS: 'fire season (Jun-Sep)',
}

export const monthLabel = (month: number) => `Every ${MONTH_LONG[month - 1] ?? 'month'}`

// ---- label placement -------------------------------------------------------------------------

export type Box = { x0: number; x1: number; y0: number; y1: number }
export const LABEL_H = 14
const CHAR_W = 7.2

export type Anchor = 'start' | 'end' | 'middle'

export function textBox(x: number, baseline: number, anchor: Anchor, text: string, charW = CHAR_W): Box {
  const w = text.length * charW + 6
  const x0 = anchor === 'start' ? x - 3 : anchor === 'end' ? x - w + 3 : x - w / 2
  return { x0, x1: x0 + w, y0: baseline - LABEL_H + 2, y1: baseline + 3 }
}

export const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

export interface PlacedLabel {
  cx: number
  cy: number
  tx: number
  ty: number
  anchor: Anchor
  label: string
}

/**
 * Places a label next to each point: tries above, below, then further up/down (and, with
 * `sideways`, left and right) until its box overlaps no box in `taken`. Placed boxes are added
 * to `taken`, so several labels on one chart stay readable.
 */
export function placeLabels(
  marks: { cx: number; cy: number; label: string }[],
  taken: Box[],
  area: { left: number; right: number; top: number; bottom: number },
  sideways = false,
): PlacedLabel[] {
  const anchorAt = (px: number): Anchor => (px < area.left + 70 ? 'start' : px > area.right - 70 ? 'end' : 'middle')
  return marks.map((m) => {
    const base = anchorAt(m.cx)
    const cands: { tx: number; ty: number; anchor: Anchor }[] = [
      { tx: m.cx, ty: m.cy - 11, anchor: base },
      { tx: m.cx, ty: m.cy + 20, anchor: base },
    ]
    // scatter dots: right or left of the dot first, so a label never sits between two dots
    if (sideways) cands.unshift({ tx: m.cx + 9, ty: m.cy + 4, anchor: 'start' }, { tx: m.cx - 9, ty: m.cy + 4, anchor: 'end' })
    for (const dy of [27, 43, 59]) cands.push({ tx: m.cx, ty: m.cy - dy, anchor: base }, { tx: m.cx, ty: m.cy + dy + 9, anchor: base })
    const fits = (c: (typeof cands)[number]) => {
      const b = textBox(c.tx, c.ty, c.anchor, m.label)
      return b.y0 >= area.top - 2 && b.y1 <= area.bottom - 2 && b.x0 >= area.left - 40 && b.x1 <= area.right + 6
    }
    const inside = cands.filter(fits)
    const pick =
      inside.find((c) => !taken.some((b) => overlaps(b, textBox(c.tx, c.ty, c.anchor, m.label)))) ??
      inside[0] ?? { tx: m.cx, ty: Math.max(LABEL_H, Math.min(area.bottom - 4, m.cy - 11)), anchor: base }
    taken.push(textBox(pick.tx, pick.ty, pick.anchor, m.label))
    return { cx: m.cx, cy: m.cy, ...pick, label: m.label }
  })
}
