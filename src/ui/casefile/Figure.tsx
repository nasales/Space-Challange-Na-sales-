// Flat comic figures of the detective and a witness, drawn in SVG from the shared colours
// (src/shared/outfit.ts, src/shared/witness.ts). Used as portraits in the dialogue box and, when no
// 3D game is behind the scene (the ?casefile preview), as full-body stand-ins.
// Front view, viewBox 0 0 100 220; the head is centred at (50, 54).
import type { Outfit } from '../../shared/outfit'
import type { WitnessLook } from '../../shared/witness'

const INK = '#161b2e'
const SKIN_DETECTIVE = '#e8b98f'

/** Full body (0 0 100 220) or head and shoulders only */
const BODY_BOX = '0 0 100 220'
const HEAD_BOX = '14 6 72 72'

interface Common {
  /** 'head': portrait crop for the dialogue box */
  crop?: 'body' | 'head'
  talking?: boolean
  className?: string
}

function Face({ skin, talking, glasses }: { skin: string; talking?: boolean; glasses?: boolean }) {
  return (
    <>
      <circle cx={50} cy={54} r={20} fill={skin} stroke={INK} strokeWidth={3} />
      <circle cx={30} cy={56} r={4} fill={skin} stroke={INK} strokeWidth={2.5} />
      <circle cx={70} cy={56} r={4} fill={skin} stroke={INK} strokeWidth={2.5} />
      <circle cx={43} cy={53} r={2.2} fill={INK} />
      <circle cx={57} cy={53} r={2.2} fill={INK} />
      {glasses && (
        <g fill="none" stroke={INK} strokeWidth={2}>
          <circle cx={43} cy={53} r={5.5} />
          <circle cx={57} cy={53} r={5.5} />
          <path d="M48.5 53h3" />
        </g>
      )}
      {talking ? (
        <ellipse className="cf-figure__mouth" cx={50} cy={64} rx={4} ry={3} fill={INK} />
      ) : (
        <path d="M45 63q5 4 10 0" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      )}
    </>
  )
}

export function DetectiveFigure({ outfit, crop = 'body', talking, className }: Common & { outfit: Outfit }) {
  return (
    <svg
      className={`cf-figure${talking ? ' is-talking' : ''}${className ? ` ${className}` : ''}`}
      viewBox={crop === 'head' ? HEAD_BOX : BODY_BOX}
      aria-hidden="true"
    >
      {/* legs + shoes */}
      <rect x={36} y={160} width={11} height={46} fill={outfit.trousers} stroke={INK} strokeWidth={3} />
      <rect x={53} y={160} width={11} height={46} fill={outfit.trousers} stroke={INK} strokeWidth={3} />
      <path d="M32 206h17v8H30zM51 206h17l2 8H51z" fill={INK} />
      {/* trench coat */}
      <path d="M28 80h44l8 92H20z" fill={outfit.coat} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d="M50 80v92M38 80l12 26 12-26M24 128h52" fill="none" stroke={INK} strokeWidth={2.5} />
      <circle cx={44} cy={118} r={1.8} fill={INK} />
      <circle cx={44} cy={140} r={1.8} fill={INK} />
      {/* arms */}
      <path d="M28 82l-10 60M72 82l10 60" stroke={INK} strokeWidth={13} strokeLinecap="round" />
      <path d="M28 82l-10 60M72 82l10 60" stroke={outfit.coat} strokeWidth={8} strokeLinecap="round" />
      {/* scarf */}
      <path d="M34 76q16 10 32 0v8q-16 9-32 0z" fill={outfit.scarf} stroke={INK} strokeWidth={2.5} />
      <path d="M58 82l4 22h-8l-2-20z" fill={outfit.scarf} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <Face skin={SKIN_DETECTIVE} talking={talking} />
      {/* fedora */}
      <ellipse cx={50} cy={38} rx={31} ry={6} fill={outfit.hat} stroke={INK} strokeWidth={3} />
      <path d="M33 37q-1-20 17-21 18 1 17 21z" fill={outfit.hat} stroke={INK} strokeWidth={3} />
      <path d="M33 31h34v5H33z" fill={INK} opacity={0.75} />
    </svg>
  )
}

function Hair({ look }: { look: WitnessLook }) {
  const c = look.hair
  switch (look.hairStyle) {
    case 'bald':
      return null
    case 'bun':
      return (
        <>
          <circle cx={50} cy={27} r={8} fill={c} stroke={INK} strokeWidth={3} />
          <path d="M30 52q0-20 20-20t20 20q-6-11-20-11t-20 11z" fill={c} stroke={INK} strokeWidth={3} />
        </>
      )
    case 'long':
      return <path d="M29 54q-2-22 21-22t21 22l3 28H64l-1-28q-13-8-26 0l-1 28H26z" fill={c} stroke={INK} strokeWidth={3} />
    case 'curly':
      return (
        <g fill={c} stroke={INK} strokeWidth={2.5}>
          {[30, 37, 44, 51, 58, 65, 70].map((x, i) => (
            <circle key={x} cx={x} cy={i === 0 || i === 6 ? 44 : 36} r={7} />
          ))}
        </g>
      )
    default:
      return <path d="M30 50q0-18 20-18t20 18q-8-8-20-8t-20 8z" fill={c} stroke={INK} strokeWidth={3} />
  }
}

function Hat({ look }: { look: WitnessLook }) {
  const c = look.hatColor ?? '#2f3a4a'
  switch (look.hat) {
    case 'cap':
      return (
        <>
          <path d="M30 45q0-19 20-19t20 19z" fill={c} stroke={INK} strokeWidth={3} />
          <path d="M30 45h40q4 0 6 5H34z" fill={c} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        </>
      )
    case 'straw':
      return (
        <>
          <ellipse cx={50} cy={40} rx={34} ry={6} fill={c} stroke={INK} strokeWidth={3} />
          <path d="M35 39q0-17 15-17t15 17z" fill={c} stroke={INK} strokeWidth={3} />
          <path d="M35 35h30" stroke={INK} strokeWidth={3} />
        </>
      )
    case 'beret':
      return <ellipse cx={46} cy={36} rx={23} ry={8} fill={c} stroke={INK} strokeWidth={3} transform="rotate(-8 46 36)" />
    default:
      return null
  }
}

export function WitnessFigure({ look, crop = 'body', talking, className }: Common & { look: WitnessLook }) {
  const h = Math.min(1.1, Math.max(0.9, look.height ?? 1))
  return (
    <svg
      className={`cf-figure${talking ? ' is-talking' : ''}${className ? ` ${className}` : ''}`}
      viewBox={crop === 'head' ? HEAD_BOX : BODY_BOX}
      style={crop === 'body' ? { height: `${h * 100}%` } : undefined}
      aria-hidden="true"
    >
      {/* legs + shoes */}
      <rect x={37} y={150} width={11} height={56} fill={look.trousers} stroke={INK} strokeWidth={3} />
      <rect x={52} y={150} width={11} height={56} fill={look.trousers} stroke={INK} strokeWidth={3} />
      <path d="M33 206h16v8H31zM51 206h16l2 8H51z" fill={INK} />
      {/* shirt */}
      <path d="M30 80h40l4 76H26z" fill={look.shirt} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d="M43 80l7 10 7-10" fill="none" stroke={INK} strokeWidth={2.5} />
      {look.apron && <path d="M37 98h26l3 58H34z" fill={look.apron} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />}
      {/* arms */}
      <path d="M30 84l-9 52M70 84l9 52" stroke={INK} strokeWidth={13} strokeLinecap="round" />
      <path d="M30 84l-9 52M70 84l9 52" stroke={look.shirt} strokeWidth={8} strokeLinecap="round" />
      <circle cx={20} cy={139} r={5} fill={look.skin} stroke={INK} strokeWidth={2.5} />
      <circle cx={80} cy={139} r={5} fill={look.skin} stroke={INK} strokeWidth={2.5} />
      <rect x={45} y={70} width={10} height={10} fill={look.skin} stroke={INK} strokeWidth={2.5} />
      {look.hairStyle === 'long' && <Hair look={look} />}
      <Face skin={look.skin} talking={talking} glasses={look.glasses} />
      {look.beard && <path d="M32 58q2 18 18 18t18-18q-4 6-18 6t-18-6z" fill={look.hair} stroke={INK} strokeWidth={2.5} />}
      {look.hairStyle !== 'long' && look.hat === 'none' && <Hair look={look} />}
      {look.hairStyle !== 'long' && look.hat !== 'none' && (
        // hair shows only at the sides under a hat
        <path d="M30 50q2-6 5-6v10zM70 50q-2-6-5-6v10z" fill={look.hair} stroke={INK} strokeWidth={2} />
      )}
      <Hat look={look} />
    </svg>
  )
}
