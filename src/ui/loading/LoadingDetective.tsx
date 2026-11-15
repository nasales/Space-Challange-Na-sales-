// 2D side view of the game's detective (same look as the 3D model in src/game/detective:
// big chibi head, fedora with a dark band, trench coat with belt, red scarf, gloves, hand lens).
// Facing right. Every moving part is a <g> that MapLoader.css animates around a joint.
import type { CSSProperties } from 'react'
import type { Outfit } from '../../shared/outfit'

const INK = '#1a1423'

export default function LoadingDetective({ outfit }: { outfit: Outfit }) {
  const colors = {
    '--ld-coat': outfit.coat,
    '--ld-hat': outfit.hat,
    '--ld-scarf': outfit.scarf,
    '--ld-trousers': outfit.trousers,
  } as CSSProperties

  return (
    <svg className="ld" viewBox="0 0 120 140" style={colors} aria-hidden="true" focusable="false">
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
        {/* Back leg and back arm (behind the coat) */}
        <g className="ld__leg ld__leg--back">
          <path className="ld__trousers-dark" d="M53 96 h10 v28 h-10 z" />
          <path className="ld__shoe" d="M51 122 h14 q8 0 8 5 q0 4 -5 4 h-17 z" />
        </g>
        <g className="ld__arm ld__arm--back">
          <path className="ld__coat-dark" d="M54 64 q-6 12 -4 26 l9 -1 q-1 -12 4 -23 z" />
          <circle className="ld__glove" cx="54" cy="92" r="5" />
        </g>

        {/* Scarf tails streaming behind */}
        <g className="ld__scarf-tail">
          <path className="ld__scarf" d="M46 61 q-12 -2 -26 4 q-4 2 -2 6 q14 -4 28 -2 z" />
          <path className="ld__scarf-dark" d="M20 65 l-6 0 M18 70 l-6 2" />
        </g>

        {/* Coat tails flapping behind */}
        <g className="ld__tails">
          <path className="ld__coat-dark" d="M46 86 L28 110 L52 106 z" />
        </g>

        {/* Front leg */}
        <g className="ld__leg ld__leg--front">
          <path className="ld__trousers" d="M56 96 h10 v28 h-10 z" />
          <path className="ld__shoe" d="M54 122 h14 q8 0 8 5 q0 4 -5 4 h-17 z" />
        </g>

        {/* Trench coat: body, belt and buckle, lapel, buttons */}
        <path className="ld__coat" d="M46 60 h26 q4 0 5 6 l4 38 q0 3 -3 3 h-38 q-3 0 -3 -3 l4 -38 q1 -6 5 -6 z" />
        <path className="ld__belt" d="M42 82 h38 v6 h-38 z" />
        <rect className="ld__buckle" x="66" y="81" width="7" height="8" rx="1.5" />
        <path fill="none" d="M64 62 l6 16" />
        <circle className="ld__ink" cx="74" cy="72" r="1.6" stroke="none" />
        <circle className="ld__ink" cx="74" cy="96" r="1.6" stroke="none" />

        {/* Scarf knot at the neck */}
        <path className="ld__scarf" d="M44 56 q16 -4 30 0 l-1 8 q-14 -3 -28 0 z" />

        {/* Head: hair at the back, face, ear, nose, eye, brow, smirk */}
        <g className="ld__head">
          <path className="ld__hair" d="M40 34 q-4 14 6 20 l6 -10 z" />
          <circle className="ld__skin" cx="60" cy="38" r="21" />
          <path className="ld__skin" d="M50 40 q-6 -1 -6 5 q1 5 7 4" />
          <circle className="ld__nose" cx="81" cy="42" r="5" />
          <ellipse fill="#fff" cx="70" cy="35" rx="4.6" ry="6" />
          <circle className="ld__pupil ld__ink" cx="72" cy="36" r="2.4" stroke="none" />
          <path className="ld__brow" fill="none" strokeWidth="3.5" d="M64 26 q6 -3 12 1" />
          <path fill="none" d="M67 50 q6 3 11 -2" />
          {/* Fedora: crown, dark band, brim tilted down at the front */}
          <g className="ld__hat">
            <path className="ld__hat-fill" d="M40 24 q0 -18 21 -18 q19 0 20 18 z" />
            <path className="ld__band" d="M40.5 18 h40 v6 h-40 z" />
            <path fill="none" d="M58 8 q2 5 0 9" />
            <path className="ld__hat-fill" d="M30 26 q30 -6 62 2 q2 3 -2 4 q-30 -5 -58 -1 q-4 -2 -2 -5 z" />
          </g>
        </g>

        {/* Front arm holding the hand lens out in front */}
        <g className="ld__arm ld__arm--front">
          <path className="ld__coat" d="M60 64 q10 8 18 18 l-6 6 q-9 -9 -16 -16 z" />
          <g className="ld__lens">
            <path className="ld__wood" d="M78 86 l8 8" strokeWidth="5" />
            <circle className="ld__gold" cx="93" cy="101" r="10" />
            <circle className="ld__glass" cx="93" cy="101" r="6.5" strokeWidth="2" />
            <path fill="none" stroke="#fff" strokeWidth="2" d="M89 98 q2 -3 5 -3" />
          </g>
          <circle className="ld__glove" cx="77" cy="86" r="5.5" />
        </g>
      </g>
    </svg>
  )
}
