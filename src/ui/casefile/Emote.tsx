// Hand-drawn comic emotes for the speech bubbles (inline SVG, no emoji fonts).
// One per dialogue mood (src/shared/tutorial.ts LineMood). viewBox 0 0 48 48, ink outlines.
import type { LineMood } from '../../shared/tutorial'

const INK = '#161b2e'
const GOLD = '#f2c14e'
const RED = '#e5322d'
const SEA = '#5ea8c2'

/** Small four-point sparkle centred on (x, y) */
function Sparkle({ x, y, r, fill = GOLD }: { x: number; y: number; r: number; fill?: string }) {
  const k = r * 0.28
  return (
    <path
      d={`M${x} ${y - r}Q${x + k} ${y - k} ${x + r} ${y}Q${x + k} ${y + k} ${x} ${y + r}Q${x - k} ${y + k} ${x - r} ${y}Q${x - k} ${y - k} ${x} ${y - r}Z`}
      fill={fill}
      stroke={INK}
      strokeWidth={2}
      strokeLinejoin="round"
    />
  )
}

function Bang({ x, color }: { x: number; color: string }) {
  return (
    <g>
      <path d={`M${x - 4} 6h8l-2 25h-4z`} fill={color} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <circle cx={x} cy={39} r={4} fill={color} stroke={INK} strokeWidth={2.5} />
    </g>
  )
}

function Drawing({ mood }: { mood: LineMood }) {
  switch (mood) {
    case 'happy':
      // closed happy eyes, wide smile, two sparkles
      return (
        <g fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round">
          <path d="M9 22q4-6 8 0M25 22q4-6 8 0" />
          <path d="M10 29q11 12 22 0z" fill={RED} strokeLinejoin="round" />
          <Sparkle x={40} y={10} r={6} />
          <Sparkle x={42} y={30} r={3.5} />
        </g>
      )
    case 'curious':
      return (
        <g>
          <path
            d="M14 16q0-11 11-11t11 10q0 7-8 10q-3 1-3 5v3"
            fill="none"
            stroke={INK}
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 16q0-11 11-11t11 10q0 7-8 10q-3 1-3 5v3"
            fill="none"
            stroke={SEA}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={25} cy={41} r={4.5} fill={SEA} stroke={INK} strokeWidth={2.5} />
        </g>
      )
    case 'explaining':
      // light bulb with rays
      return (
        <g stroke={INK} strokeLinecap="round" strokeLinejoin="round">
          <path d="M24 10a11 11 0 0 1 6.5 19.8V34h-13v-4.2A11 11 0 0 1 24 10z" fill={GOLD} strokeWidth={3} />
          <path d="M18 38h12M20 43h8" fill="none" strokeWidth={3} />
          <path d="M20 22q4 3 8 0" fill="none" strokeWidth={2} />
          <path d="M24 2v3M8 9l2.5 2.5M40 9l-2.5 2.5M3 23h3M42 23h3" fill="none" strokeWidth={2.5} />
        </g>
      )
    case 'sad':
      // one tear drop and soft blue gloom lines: quiet, never comic
      return (
        <g stroke={INK} strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 6v12M14 4v16M20 6v10" fill="none" stroke={SEA} strokeWidth={2.5} opacity={0.8} />
          <path d="M31 10q-9 13-9 20a9 9 0 0 0 18 0q0-7-9-20z" fill={SEA} strokeWidth={2.5} />
          <path d="M27 31a4 4 0 0 0 3 4" fill="none" stroke="#fff" strokeWidth={2} />
        </g>
      )
    case 'proud':
      // a star with a little shine
      return (
        <g>
          <path
            d="M24 5l5.6 11.6 12.7 1.7-9.3 8.8 2.3 12.6L24 33.6l-11.3 6.1 2.3-12.6-9.3-8.8 12.7-1.7z"
            fill={GOLD}
            stroke={INK}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <path d="M19 19l3-1" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
          <Sparkle x={42} y={40} r={4} />
        </g>
      )
    case 'doubtful':
      // "hmm" squiggle and a sweat drop
      return (
        <g stroke={INK} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 32q4-8 8 0t8 0 8 0 8 0" fill="none" strokeWidth={3.5} />
          <path d="M39 6q-5 7-5 10a5 5 0 0 0 10 0q0-3-5-10z" fill={SEA} strokeWidth={2.5} />
          <path d="M8 16h10" fill="none" strokeWidth={3} />
        </g>
      )
    case 'insistent':
      return (
        <g>
          <Bang x={16} color={RED} />
          <Bang x={32} color={RED} />
        </g>
      )
    case 'determined':
      // one sharp "!" with focus lines
      return (
        <g>
          <path d="M5 12l6 3M3 26h6M5 40l6-3M43 12l-6 3M45 26h-6M43 40l-6-3" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
          <Bang x={24} color={GOLD} />
        </g>
      )
    case 'confident':
      // smirk and a small musical note
      return (
        <g stroke={INK} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 20h8M20 19q3-3 6 0" fill="none" strokeWidth={3} />
          <path d="M6 32q10 5 20-5" fill="none" strokeWidth={3.5} />
          <path d="M38 34V8l8 4" fill="none" strokeWidth={3} />
          <ellipse cx={34.5} cy={35} rx={5} ry={4} fill={GOLD} strokeWidth={2.5} transform="rotate(-20 34.5 35)" />
        </g>
      )
    default:
      // neutral: three talking dots
      return (
        <g fill={INK} className="wemote__dots">
          <circle cx={11} cy={26} r={4.5} />
          <circle cx={24} cy={26} r={4.5} />
          <circle cx={37} cy={26} r={4.5} />
        </g>
      )
  }
}

export default function Emote({ mood, className }: { mood: LineMood; className?: string }) {
  return (
    <svg className={`wemote wemote--${mood}${className ? ` ${className}` : ''}`} viewBox="0 0 48 48" aria-hidden="true">
      <Drawing mood={mood} />
    </svg>
  )
}
