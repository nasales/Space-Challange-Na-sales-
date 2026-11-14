// PROTOTYPE (temporary, Perry 2026-11-14): stand-in for Yeipi's magnifying glass.
// Space opens a menu with the six variables of the point where the detective is; picking one shows
// a simple chart and, on request, the statistical result. Esc or Space closes it.
// To replace it: delete this folder and the <PointProbe /> line in src/App.tsx. The data comes from
// fetchPointAnalysis() in src/shared/pointAnalysis.ts, which the final UI can keep using.
import { useEffect, useRef, useState } from 'react'
import type { LocationInfo } from '../../shared/events'
import { fetchPointAnalysis, type PointAnalysis, type PointVariable } from '../../shared/pointAnalysis'
import { supabaseConfigured } from '../../shared/supabase'
import './PointProbe.css'

// Order of the buttons in the menu (unknown ids go last)
const ORDER = ['tair', 't2m_long', 'precip', 'soilmoist', 'evap', 'wind']
const rank = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length)

type Load =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'empty' }
  | { state: 'ready'; analysis: PointAnalysis }

const sig = (x: number) => (Math.abs(x) >= 100 ? x.toFixed(0) : x.toPrecision(3))

export default function PointProbe({ location }: { location: LocationInfo | null }) {
  const [open, setOpen] = useState(false)
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [picked, setPicked] = useState<PointVariable | null>(null)
  const [revealed, setRevealed] = useState(false)
  const locationRef = useRef(location)
  const openRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    locationRef.current = location
  }, [location])

  function close() {
    abortRef.current?.abort()
    openRef.current = false
    setOpen(false)
  }

  // Opens the menu and loads the point where the detective is at that moment
  function openHere() {
    const here = locationRef.current
    if (!here) return
    openRef.current = true
    setOpen(true)
    setPicked(null)
    setRevealed(false)
    if (!supabaseConfigured) {
      setLoad({ state: 'error', message: 'The database is not configured in this build.' })
      return
    }
    setLoad({ state: 'loading' })
    const ctrl = new AbortController()
    abortRef.current = ctrl
    fetchPointAnalysis(here.lat, here.lon, here.place, ctrl.signal)
      .then((analysis) => {
        if (!ctrl.signal.aborted) setLoad(analysis ? { state: 'ready', analysis } : { state: 'empty' })
      })
      .catch((err: unknown) => {
        if (!ctrl.signal.aborted) setLoad({ state: 'error', message: err instanceof Error ? err.message : String(err) })
      })
  }

  // Space toggles the menu, Esc closes it. While open, the game does not receive keys
  // (capture phase on window runs before the game's listener).
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    keyHandler.current = (e: KeyboardEvent) => {
      if (e.code === 'Space' && locationRef.current) {
        e.preventDefault()
        e.stopImmediatePropagation()
        if (!e.repeat) {
          if (openRef.current) close()
          else openHere()
        }
        return
      }
      if (!openRef.current) return
      if (e.code === 'Escape') close()
      e.stopImmediatePropagation()
    }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      abortRef.current?.abort()
    }
  }, [])

  if (!open || !location) return null

  return (
    <div className="point-probe" role="dialog" aria-label="Investigate this place">
      <div className="point-probe__card">
        <header className="point-probe__head">
          <div>
            <span className="point-probe__tag">Prototype</span>
            <h2>{location.place}</h2>
            <p className="point-probe__coords">
              {location.lat.toFixed(2)}, {location.lon.toFixed(2)}
              {load.state === 'ready' && load.analysis.cell.distanceKm > 20 && // a 0.25° cell centre can be ~17 km away
                ` · nearest land cell ${load.analysis.cell.distanceKm.toFixed(0)} km away`}
            </p>
          </div>
          <button type="button" className="point-probe__close" onClick={close} aria-label="Close">
            ×
          </button>
        </header>

        {load.state === 'loading' && <p className="point-probe__msg">Gathering the evidence…</p>}
        {load.state === 'error' && <p className="point-probe__msg">Could not load the data: {load.message}</p>}
        {load.state === 'empty' && <p className="point-probe__msg">No data here (sea or outside the map).</p>}

        {load.state === 'ready' && !picked && (
          <>
            <p className="point-probe__ask">What do you want to investigate?</p>
            <div className="point-probe__vars">
              {[...load.analysis.variables]
                .sort((a, b) => rank(a.id) - rank(b.id))
                .map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className="point-probe__var"
                    disabled={!v.data}
                    onClick={() => setPicked(v)}
                  >
                    <b>{v.name}</b>
                    <span>{v.data ? v.units : 'not enough data'}</span>
                  </button>
                ))}
            </div>
          </>
        )}

        {picked?.data && (
          <div className="point-probe__detail">
            <button type="button" className="point-probe__back" onClick={() => { setPicked(null); setRevealed(false) }}>
              ← Variables
            </button>
            <h3>{picked.name}</h3>
            <p className="point-probe__def">{picked.definition}</p>
            <SeriesChart dates={picked.data.dates} values={picked.data.values} units={picked.data.units} />
            <p className="point-probe__credit">Data: NASA {picked.data.dataset.replace(/^NASA /, '')}</p>
            {!revealed ? (
              <button type="button" className="point-probe__reveal" onClick={() => setRevealed(true)}>
                Show the statistical result
              </button>
            ) : (
              <p className="point-probe__result">
                Trend: <b>{sig(picked.data.slope * 10)} {picked.data.units} per decade</b>
                {picked.extra.slopeCiLow != null && picked.extra.slopeCiHigh != null &&
                  ` (95 % range ${sig(picked.extra.slopeCiLow * 10)} to ${sig(picked.extra.slopeCiHigh * 10)})`}
                {' · '}{picked.data.p_value < 0.001 ? 'p < 0.001' : `p = ${picked.data.p_value.toFixed(3)}`}
                {' · '}
                <b>{picked.data.significant ? `significant, ${picked.extra.direction}` : 'not significant'}</b>
              </p>
            )}
          </div>
        )}
        <p className="point-probe__hint">Space or Esc to close</p>
      </div>
    </div>
  )
}

/** Minimal monthly line chart (no library). Gaps (null) break the line. */
function SeriesChart({ dates, values, units }: { dates: string[]; values: (number | null)[]; units: string }) {
  const W = 560
  const H = 200
  const P = { l: 46, r: 10, t: 10, b: 24 }
  const nums = values.filter((v): v is number => v != null)
  if (nums.length === 0) return <p className="point-probe__msg">No values.</p>
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1
  const x = (i: number) => P.l + (i / Math.max(values.length - 1, 1)) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - (v - min) / span) * (H - P.t - P.b)
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v == null) {
      pen = false
      return
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    pen = true
  })
  return (
    <svg className="point-probe__chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Monthly values in ${units}`}>
      <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} className="point-probe__axis" />
      <line x1={P.l} x2={P.l} y1={P.t} y2={H - P.b} className="point-probe__axis" />
      <text x={P.l - 6} y={P.t + 8} textAnchor="end">{sig(max)}</text>
      <text x={P.l - 6} y={H - P.b} textAnchor="end">{sig(min)}</text>
      <text x={P.l - 6} y={(H - P.b + P.t) / 2} textAnchor="end">{units}</text>
      <text x={P.l} y={H - 6}>{dates[0]?.slice(0, 4)}</text>
      <text x={W - P.r} y={H - 6} textAnchor="end">{dates[dates.length - 1]?.slice(0, 4)}</text>
      <path d={d} className="point-probe__line" />
    </svg>
  )
}
