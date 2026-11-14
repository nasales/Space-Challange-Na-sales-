// Small SVG building blocks shared by the case-file charts.
import type { ReactNode } from 'react'
import type { PlacedLabel } from './chartKit'
import { sig } from './format'

/** Circled points with their labels (the existing comic "evidence" mark) */
export function Marks({ placed, r = 6 }: { placed: PlacedLabel[]; r?: number }) {
  return (
    <>
      {placed.map((m, i) => (
        <g key={`m${i}`} className="casefile-chart__mark">
          <circle cx={m.cx} cy={m.cy} r={r} />
          <text x={m.tx} y={m.ty} textAnchor={m.anchor}>
            {m.label}
          </text>
        </g>
      ))}
    </>
  )
}

/** Horizontal grid lines with their value labels on the left */
export function YGrid({ ticks, sy, left, right, fmt = sig }: { ticks: number[]; sy: (v: number) => number; left: number; right: number; fmt?: (v: number) => string }) {
  return (
    <>
      {ticks.map((v) => (
        <g key={`y${v}`}>
          <line x1={left} x2={right} y1={sy(v)} y2={sy(v)} className="casefile-chart__grid" />
          <text x={left - 6} y={sy(v) + 4} textAnchor="end" className="casefile-chart__tick">
            {fmt(v)}
          </text>
        </g>
      ))}
    </>
  )
}

/** Bottom axis line with tick marks and labels */
export function XAxis({ ticks, sx, left, right, y }: { ticks: { x: number; label: string }[]; sx: (x: number) => number; left: number; right: number; y: number }) {
  return (
    <>
      <line x1={left} x2={right} y1={y} y2={y} className="casefile-chart__axis" />
      {ticks.map((t) => (
        <g key={`x${t.x}`}>
          <line x1={sx(t.x)} x2={sx(t.x)} y1={y} y2={y + 5} className="casefile-chart__axis" />
          <text x={sx(t.x)} y={y + 18} textAnchor="middle" className="casefile-chart__tick">
            {t.label}
          </text>
        </g>
      ))}
    </>
  )
}

/** Legend entry in the caption; `kind` picks the swatch style (CSS) */
export function Key({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`casefile-chart__key casefile-chart__key--${kind}`}>{children}</span>
}
