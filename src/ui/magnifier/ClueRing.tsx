// The clues written on the glass of the hand lens: six round "evidence medallions" on a ring that
// follows the lens circle, the case question in the centre, and the hints lettered along the rim.
// Comic look of the game (ink outlines, Ben-Day halftone, print misregistration, motion on twos).
//
// A medallion is live when the database has a trend for that variable at the detective's point
// (data from VariablePicker); picking it calls onPick and the picker shows the evidence sheet.
// Clues without data use aria-disabled instead of the `disabled` attribute on purpose: a disabled
// button gets no hover, no focus and no Tab stop, so players could not even look at the clue.
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import type { PointAnalysis } from '../../shared/pointAnalysis'
import { CLIMATE_VARIABLES, type ClimateVariable, type VariableIcon } from '../../shared/variables'
import './ClueRing.css'

/** Picker phases in which the clues are on screen; the entrance and exit animations follow them */
export type ClueRingPhase = 'zooming' | 'open' | 'closing' | 'releasing'

/**
 * Distance from the lens centre to each medallion centre, as a fraction of the lens diameter.
 * With a medallion of 0.13 (ClueRing.css, --cr-m) the outer edge sits at 0.365, leaving a clear
 * band of glass inside the rim (0.5) for the bottom label and the lettered hints.
 */
const RING_RADIUS = 0.3

/** Hand-inked underline under the hovered clue's name (viewBox 100 x 10) */
const UNDERLINE = 'M3 6.5C18 3.5 34 8 52 5.2S86 3.6 97 6'

/** Polar layout: evenly spaced around the lens centre, the first one at the top, clockwise */
function slotPosition(index: number, count: number) {
  const angle = (index / count) * Math.PI * 2
  return {
    x: +(Math.sin(angle) * RING_RADIUS).toFixed(4),
    y: +(-Math.cos(angle) * RING_RADIUS).toFixed(4),
  }
}

/** Data of the point under the lens, loaded by VariablePicker when the lens opens */
export type ClueData =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'empty' }
  | { state: 'ready'; analysis: PointAnalysis }

interface Props {
  phase: ClueRingPhase
  data: ClueData
  /** A live clue was picked (variable id) */
  onPick: (id: string) => void
}

/** Short status lettered on the rim and stamped on clues that cannot be opened */
function dataStatus(data: ClueData): { rim: string; stamp: string } {
  if (data.state === 'loading') return { rim: 'Reading the evidence…', stamp: 'Wait' }
  if (data.state === 'empty') return { rim: 'No data here: try on land', stamp: 'No data' }
  if (data.state === 'error') return { rim: 'Evidence archive offline', stamp: 'Offline' }
  return { rim: 'Pick a clue to read it', stamp: 'No data' }
}

export default function ClueRing({ phase, data, onPick }: Props) {
  const status = dataStatus(data)
  const live = (id: string) =>
    data.state === 'ready' && !!data.analysis.variables.find((v) => v.id === id)?.data
  const uid = useId()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const [hovered, setHovered] = useState<number | null>(null)
  const [focused, setFocused] = useState<number | null>(null)
  // The caption keeps the last clue while it fades out, so leaving does not blank it mid-fade
  const [lastShown, setLastShown] = useState(0)

  const active = hovered ?? focused
  if (active !== null && active !== lastShown) setLastShown(active)
  const shownIndex = active ?? lastShown
  const shown: ClimateVariable = CLIMATE_VARIABLES[shownIndex]

  const count = CLIMATE_VARIABLES.length

  // Arrows walk around the ring; Tab wraps so focus stays on the glass while it is open
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = buttons.current.findIndex((b) => b === document.activeElement)
    if (current < 0) return
    let next: number
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % count
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + count) % count
    else if (e.key === 'Tab' && !e.shiftKey && current === count - 1) next = 0
    else if (e.key === 'Tab' && e.shiftKey && current === 0) next = count - 1
    else return
    e.preventDefault()
    buttons.current[next]?.focus()
  }

  return (
    <div
      className={`clue-ring clue-ring--${phase}${active !== null ? ' clue-ring--peek' : ''}`}
      onKeyDown={onKeyDown}
    >
      {/* Centre: the case question, swapped for the clue's own question while one is looked at */}
      <div className="clue-ring__centre">
        <div className="clue-ring__heading">
          <h2 id="variable-picker-title" className="clue-ring__title">
            Something changed here
          </h2>
          <p id="variable-picker-lead" className="clue-ring__lead">
            Pick a clue and hold it under the lens.
          </p>
        </div>
        {/* Remounted per clue so the slide-in replays when moving from one clue to the next */}
        <p className="clue-ring__caption" aria-hidden="true" key={shownIndex}>
          <span className="clue-ring__caption-name">
            {shown.name} <span className="clue-ring__caption-unit">{shown.unit}</span>
          </span>
          <span className="clue-ring__caption-blurb">{shown.blurb}</span>
        </p>
      </div>

      <ul className="clue-ring__ring">
        {CLIMATE_VARIABLES.map((v, i) => {
          const { x, y } = slotPosition(i, count)
          const descId = `${uid}-clue-${v.id}`
          const isLive = live(v.id)
          return (
            <li
              key={v.id}
              className="clue-ring__slot"
              style={{ '--x': x, '--y': y, '--i': i + 1 } as CSSProperties}
            >
              <button
                ref={(el) => {
                  buttons.current[i] = el
                }}
                type="button"
                className={`clue${isLive ? ' clue--live' : ''}`}
                aria-disabled={!isLive}
                aria-label={`${v.name} (${v.unit})`}
                aria-describedby={descId}
                title={isLive ? undefined : status.stamp}
                onClick={(e) => {
                  e.preventDefault()
                  if (isLive) onPick(v.id)
                  // Without data a tap on a touch screen (no hover) shows the clue's question instead
                  else if ((e.nativeEvent as PointerEvent).pointerType === 'touch') setFocused(i)
                }}
                onPointerEnter={(e) => e.pointerType !== 'touch' && setHovered(i)}
                onPointerLeave={() => setHovered((h) => (h === i ? null : h))}
                // Only keyboard focus (the same rule as :focus-visible) opens the caption, so a
                // mouse click does not leave it stuck after the pointer has left
                onFocus={(e) => e.currentTarget.matches(':focus-visible') && setFocused(i)}
                onBlur={() => setFocused((f) => (f === i ? null : f))}
              >
                <span className="clue__burst" aria-hidden="true" />
                <span className="clue__disc" aria-hidden="true">
                  <span className="clue__face">
                    <span className="clue__icon">
                      <span className="clue__ghost clue__ghost--cyan">
                        <ClueIcon icon={v.icon} />
                      </span>
                      <span className="clue__ghost clue__ghost--magenta">
                        <ClueIcon icon={v.icon} />
                      </span>
                      <ClueIcon icon={v.icon} />
                    </span>
                  </span>
                  {!isLive && <span className="clue__stamp">{status.stamp}</span>}
                </span>
                <span className="clue__label" aria-hidden="true">
                  <span className="clue__name" data-text={v.shortName}>
                    {v.shortName}
                  </span>
                  <svg className="clue__underline" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path className="clue__underline-ink" d={UNDERLINE} pathLength={1} />
                    <path className="clue__underline-gold" d={UNDERLINE} pathLength={1} />
                  </svg>
                </span>
                <span id={descId} className="clue-ring__sr">
                  {v.blurb} {isLive ? '' : `${status.stamp}.`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* Hints lettered along the lower rim, in the two gaps beside the bottom medallion */}
      <svg className="clue-ring__rim" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          {/* radius 45.5, clockwise-from-top angles 228 -> 194 and 166 -> 132, read left to right */}
          <path id={`${uid}-rim-left`} d="M16.19 80.44A45.5 45.5 0 0 0 38.99 94.15" />
          <path id={`${uid}-rim-right`} d="M61.01 94.15A45.5 45.5 0 0 0 83.81 80.44" />
        </defs>
        <text className="clue-ring__rim-text" style={{ '--i': count + 1 } as CSSProperties}>
          <textPath href={`#${uid}-rim-left`} startOffset="50%" textAnchor="middle">
            {status.rim}
          </textPath>
        </text>
        <text className="clue-ring__rim-text" style={{ '--i': count + 1 } as CSSProperties}>
          <textPath href={`#${uid}-rim-right`} startOffset="50%" textAnchor="middle">
            <tspan className="clue-ring__rim-key">Esc</tspan> Back to the map
          </textPath>
        </text>
      </svg>

      {/* The same hints as plain text: read by screen readers, shown on narrow screens */}
      <div className="clue-ring__footer" style={{ '--i': count + 1 } as CSSProperties}>
        <p className="clue-ring__soon">{status.rim}</p>
        <p className="clue-ring__back">
          <kbd>Esc</kbd> Back to the map
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------------------------------
   Clue icons: ink outlines and flat comic fills, 24 x 24.
------------------------------------------------------------------------------------------------ */

function ClueIcon({ icon }: { icon: VariableIcon }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1a1423"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[icon]}
    </svg>
  )
}

const ICONS: Record<VariableIcon, ReactNode> = {
  thermometer: (
    <>
      <path d="M10 4.5a2 2 0 0 1 4 0v9.2a4 4 0 1 1-4 0Z" fill="#fff8e7" />
      <circle cx="12" cy="17" r="2" fill="#e5322d" stroke="none" />
      <path d="M12 15V8" stroke="#e5322d" strokeWidth="1.6" />
      <path d="M16.5 6h2M16.5 9h1.5M16.5 12h2" strokeWidth="1.4" />
    </>
  ),
  wind: (
    <>
      <path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5" />
      <path d="M3 13h15a2.5 2.5 0 1 1-2.5 2.5" />
      <path d="M3 17h7" stroke="#5ea8c2" />
    </>
  ),
  soil: (
    <>
      <path d="M3 17c3-1.5 6 1.5 9 0s6 1.5 9 0v4H3Z" fill="#a8743a" />
      <path d="M12 3.5c2.3 3 3.5 4.9 3.5 6.6a3.5 3.5 0 0 1-7 0c0-1.7 1.2-3.6 3.5-6.6Z" fill="#5ea8c2" />
    </>
  ),
  evaporation: (
    <>
      <circle cx="17" cy="7" r="3" fill="#f2c14e" />
      <path d="M3 20h18" />
      <path d="M6 17c-1-1.5 1-2.5 0-4s1-2.5 0-4" stroke="#5ea8c2" />
      <path d="M10.5 17c-1-1.5 1-2.5 0-4s1-2.5 0-4" stroke="#5ea8c2" />
    </>
  ),
  rain: (
    <>
      <path d="M7 14a4 4 0 0 1-.4-8A5 5 0 0 1 16 5.5 3.5 3.5 0 0 1 17 14Z" fill="#fff8e7" />
      <path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="#5ea8c2" strokeWidth="2" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6 3h12M6 21h12" />
      <path d="M7.5 3c0 5 4.5 6 4.5 9s-4.5 4-4.5 9h9c0-5-4.5-6-4.5-9s4.5-4 4.5-9Z" fill="#fff8e7" />
      <path d="M9 19.5h6l-3-3.5Z" fill="#f2c14e" stroke="none" />
    </>
  ),
}
