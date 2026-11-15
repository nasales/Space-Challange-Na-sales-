// The two suspects of the interrogation room, drawn as flat noir cartoon characters (original
// inline SVG art, not real people): Summer Heat, a sun-headed tough in an orange trench coat and
// dark glasses, and Missing Snow, a snowflake-headed figure in a pale coat that fades away at the
// hem. Full body viewBox 0 0 160 300 (feet at the bottom); 'head' crops to the face for the
// small portraits.
import { useId } from 'react'
import type { SuspectLook } from '../../../shared/tutorial'

const INK = '#161b2e'
const BODY_BOX = '0 0 160 300'
const HEAD_BOX = '22 6 116 116'

interface Props {
  look: SuspectLook
  /** Number on the line-up placard */
  n: number
  crop?: 'body' | 'head'
  className?: string
}

export default function SuspectArt({ look, n, crop = 'body', className }: Props) {
  return (
    <svg className={`ixsuspect-art ixsuspect-art--${look}${className ? ` ${className}` : ''}`} viewBox={crop === 'head' ? HEAD_BOX : BODY_BOX} aria-hidden="true">
      {look === 'heat' ? <Heat n={n} body={crop === 'body'} /> : <Snow n={n} body={crop === 'body'} />}
    </svg>
  )
}

function Placard({ n, fill }: { n: number; fill: string }) {
  return (
    <g>
      <path d="M58 150l-4 -10M102 150l4 -10" stroke={INK} strokeWidth={2} />
      <rect x={46} y={150} width={68} height={34} fill={fill} stroke={INK} strokeWidth={3} />
      <text x={80} y={162} textAnchor="middle" className="ixsuspect-art__plate-small">
        ANETO PD
      </text>
      <text x={80} y={179} textAnchor="middle" className="ixsuspect-art__plate">
        No. {n}
      </text>
    </g>
  )
}

function Heat({ n, body }: { n: number; body: boolean }) {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2
    const a1 = a - 0.16
    const a2 = a + 0.16
    const r0 = 30
    const r1 = i % 2 ? 44 : 50
    return `M${80 + r0 * Math.cos(a1)},${62 + r0 * Math.sin(a1)}L${80 + r1 * Math.cos(a)},${62 + r1 * Math.sin(a)}L${80 + r0 * Math.cos(a2)},${62 + r0 * Math.sin(a2)}Z`
  })
  return (
    <g>
      {body && (
        <>
          {/* heat shimmer */}
          <g className="ixsuspect-art__waves" fill="none" stroke="#f2a03a" strokeWidth={2.5} strokeLinecap="round">
            <path d="M28 40q4 -6 0 -12t0 -12" />
            <path d="M132 40q4 -6 0 -12t0 -12" />
            <path d="M140 92q4 -6 0 -12t0 -12" />
          </g>
          {/* legs */}
          <rect x={62} y={238} width={14} height={50} fill="#2b2f45" stroke={INK} strokeWidth={3} />
          <rect x={84} y={238} width={14} height={50} fill="#2b2f45" stroke={INK} strokeWidth={3} />
          <path d="M56 286h22v9H52zM82 286h22l4 9H82z" fill={INK} />
          {/* trench coat, collar up */}
          <path d="M44 104h72l14 148H30z" fill="#c4532a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <path d="M80 104v148M62 104l18 34 18 -34M36 196h88" fill="none" stroke={INK} strokeWidth={2.5} />
          <path d="M50 98l12 22 -18 -4zM110 98l-12 22 18 -4z" fill="#a8401c" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
          <rect x={34} y={190} width={92} height={10} fill="#7a2c12" stroke={INK} strokeWidth={2.5} />
          <rect x={74} y={188} width={12} height={14} fill="#f2c14e" stroke={INK} strokeWidth={2} />
          {/* arms: hands on the placard */}
          <path d="M44 110l-14 70 22 4 6 -50" fill="#c4532a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <path d="M116 110l14 70 -22 4 -6 -50" fill="#c4532a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <circle cx={44} cy={176} r={7} fill="#ffcf3f" stroke={INK} strokeWidth={2.5} />
          <circle cx={116} cy={176} r={7} fill="#ffcf3f" stroke={INK} strokeWidth={2.5} />
          <Placard n={n} fill="#fff8e7" />
        </>
      )}
      {/* sun head */}
      <g className="ixsuspect-art__rays">
        {rays.map((d, i) => (
          <path key={i} d={d} fill={i % 2 ? '#f29b26' : '#f2c14e'} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        ))}
      </g>
      <circle cx={80} cy={62} r={31} fill="#ffcf3f" stroke={INK} strokeWidth={3} />
      <path d="M58 72q6 6 12 4" fill="none" stroke="#f29b26" strokeWidth={3} strokeLinecap="round" />
      {/* dark glasses and a smirk */}
      <path d="M57 52h20l-2 11q-8 4 -16 0zM83 52h20l-2 11q-8 4 -16 0z" fill={INK} />
      <path d="M77 54h6" stroke={INK} strokeWidth={3} />
      <path d="M61 55l6 0M87 55l6 0" stroke="#5ea8c2" strokeWidth={2} strokeLinecap="round" />
      <path d="M70 77q10 6 20 -3" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path d="M89 73l4 -1" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      {/* bead of sweat (shown when the alibi breaks) */}
      <path className="ixsuspect-art__sweat" d="M107 46q4 7 0 10q-4 -3 0 -10z" fill="#9fd3ea" stroke={INK} strokeWidth={1.8} />
    </g>
  )
}

function Snow({ n, body }: { n: number; body: boolean }) {
  const arms = Array.from({ length: 6 }, (_, i) => (i / 6) * 360 - 90)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  return (
    <g>
      {body && (
        <>
          <defs>
            <linearGradient id={`ix-snow-fade-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" />
              <stop offset="0.62" stopColor="#fff" />
              <stop offset="1" stopColor="#fff" stopOpacity={0.05} />
            </linearGradient>
            <mask id={`ix-snow-mask-${uid}`}>
              <rect x={0} y={0} width={160} height={300} fill={`url(#ix-snow-fade-${uid})`} />
            </mask>
          </defs>
          {/* falling flakes */}
          <g className="ixsuspect-art__flakes" stroke="#dbeaf3" strokeWidth={2} strokeLinecap="round">
            <path d="M24 70v10M19 75h10M20.5 71.5l7 7M27.5 71.5l-7 7" />
            <path d="M138 120v8M134 124h8" />
            <path d="M30 210v8M26 214h8" />
            <path d="M136 40v10M131 45h10M132.5 41.5l7 7M139.5 41.5l-7 7" />
          </g>
          <g mask={`url(#ix-snow-mask-${uid})`}>
            {/* legs, barely there */}
            <rect x={63} y={238} width={13} height={50} fill="#8aa2b8" stroke={INK} strokeWidth={3} strokeDasharray="7 5" />
            <rect x={84} y={238} width={13} height={50} fill="#8aa2b8" stroke={INK} strokeWidth={3} strokeDasharray="7 5" />
            {/* long pale coat */}
            <path d="M46 106h68l12 146H34z" fill="#a9c3d6" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
            <path d="M80 106v146M64 106l16 30 16 -30" fill="none" stroke={INK} strokeWidth={2.5} />
            <circle cx={73} cy={160} r={2.4} fill={INK} />
            <circle cx={73} cy={214} r={2.4} fill={INK} />
            {/* arms */}
            <path d="M46 112l-12 66 20 4 4 -48" fill="#a9c3d6" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
            <path d="M114 112l12 66 -20 4 -4 -48" fill="#a9c3d6" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          </g>
          <circle cx={44} cy={176} r={7} fill="#eef6fb" stroke={INK} strokeWidth={2.5} />
          <circle cx={116} cy={176} r={7} fill="#eef6fb" stroke={INK} strokeWidth={2.5} />
          {/* striped scarf */}
          <path d="M56 102h48v12H56z" fill="#e5322d" stroke={INK} strokeWidth={2.5} />
          <path d="M64 102v12M74 102v12M84 102v12M94 102v12" stroke="#fff8e7" strokeWidth={3} />
          <path d="M92 112l6 30 -10 2 -4 -30z" fill="#e5322d" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
          <Placard n={n} fill="#fff8e7" />
        </>
      )}
      {/* snowflake head: six arms with little branches around a hexagonal face */}
      <g className="ixsuspect-art__flake" stroke={INK} strokeLinecap="round">
        {arms.map((deg) => (
          <g key={deg} transform={`rotate(${deg} 80 62)`}>
            <path d="M80 62h46" strokeWidth={9} />
            <path d="M80 62h46" stroke="#eef6fb" strokeWidth={4} />
            <path d="M108 62l9 -9M108 62l9 9" strokeWidth={8} />
            <path d="M108 62l9 -9M108 62l9 9" stroke="#eef6fb" strokeWidth={3.5} />
          </g>
        ))}
      </g>
      <path d="M80 34l24 14v28l-24 14 -24 -14V48z" fill="#eef6fb" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      {/* worried, innocent face */}
      <path d="M66 52q4 -4 8 -1M86 51q4 -3 8 1" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <ellipse cx={71} cy={60} rx={3} ry={4} fill={INK} />
      <ellipse cx={89} cy={60} rx={3} ry={4} fill={INK} />
      <path d="M73 75q7 -4 14 0" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={64} cy={68} r={3.4} fill="#f4b8c0" />
      <circle cx={96} cy={68} r={3.4} fill="#f4b8c0" />
      <path className="ixsuspect-art__sweat" d="M102 40q4 7 0 10q-4 -3 0 -10z" fill="#9fd3ea" stroke={INK} strokeWidth={1.8} />
    </g>
  )
}
