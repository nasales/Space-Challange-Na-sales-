// Measures the panel a chart lives in and hands the chart a frame of that exact size, so the chart
// fills the evidence file without scrolling and keeps its text at real pixel size.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { frameFor, type Frame } from './chartKit'

export default function ChartBox({ children }: { children: (frame: Frame) => ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => {
      const w = Math.round(el.clientWidth)
      const h = Math.round(el.clientHeight)
      setSize((old) => (old && old.w === w && old.h === h ? old : { w, h }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={box} className="clue-result__svgbox">
      {size && size.w > 40 && size.h > 40 && children(frameFor(size.w, size.h))}
    </div>
  )
}
