// Original flat comic art for the courtroom (inline SVG, same ink outline as Figure.tsx):
// the two lawyers behind their tables, the gavel, the scales on the back wall and the
// empty exhibit folder. Fictional adults only; no real people, no logos.
import type { TrialSide } from '../../../shared/tutorial'
import { L } from '../../../shared/i18n'

const INK = '#161b2e'

const LOOK: Record<TrialSide, { skin: string; hair: string; tie: string }> = {
  // prosecution: grey bob and glasses; defence: dark hair and a short beard
  prosecution: { skin: '#e3b08a', hair: '#9a9590', tie: '#8c2a2a' },
  defence: { skin: '#b9825e', hair: '#2a211c', tie: '#2a4f8c' },
}

/** A lawyer in a black court gown, seen from the bench (head, shoulders and hands on the table) */
export function Lawyer({ side, talking, crop }: { side: TrialSide; talking?: boolean; crop?: 'head' }) {
  const l = LOOK[side]
  const pros = side === 'prosecution'
  return (
    <svg className={`trlawyer${talking ? ' is-talking' : ''}`} viewBox={crop === 'head' ? '26 16 68 68' : '0 0 120 120'} aria-hidden="true">
      {/* gown with wide shoulders */}
      <path d="M18 120 Q20 76 44 70 L76 70 Q100 76 102 120 Z" fill="#1d2030" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      {/* white collar and bands */}
      <path d="M46 70 L60 86 L74 70 Z" fill="#fff8e7" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M56 84 h8 l-1 14 h-6 z" fill={pros ? '#fff8e7' : l.tie} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      {/* gown folds */}
      <path d="M36 92 Q38 106 34 120 M84 92 Q82 106 86 120" fill="none" stroke="#3a3f55" strokeWidth={2.5} />
      {/* neck + head */}
      <rect x={53} y={58} width={14} height={14} fill={l.skin} stroke={INK} strokeWidth={3} />
      <circle cx={60} cy={44} r={20} fill={l.skin} stroke={INK} strokeWidth={3} />
      {pros ? (
        // grey bob
        <path d="M38 50 Q34 22 60 20 Q86 22 82 50 L78 50 Q78 32 60 30 Q46 30 42 50 Z" fill={l.hair} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      ) : (
        <>
          <path d="M40 40 Q42 22 60 22 Q78 22 80 40 Q70 30 60 32 Q50 30 40 40 Z" fill={l.hair} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          {/* short beard */}
          <path d="M42 48 Q44 66 60 66 Q76 66 78 48 Q72 58 60 58 Q48 58 42 48 Z" fill={l.hair} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        </>
      )}
      <circle cx={53} cy={44} r={2.3} fill={INK} />
      <circle cx={67} cy={44} r={2.3} fill={INK} />
      {pros && (
        <g fill="none" stroke={INK} strokeWidth={2}>
          <circle cx={53} cy={44} r={5.5} />
          <circle cx={67} cy={44} r={5.5} />
          <path d="M58.5 44h3" />
        </g>
      )}
      {talking ? (
        <ellipse className="trlawyer__mouth" cx={60} cy={54} rx={4} ry={3} fill={INK} />
      ) : (
        <path d="M55 54 q5 3 10 0" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      )}
    </svg>
  )
}

/** The judge's gavel (head + handle); `className` drives the swing */
export function Gavel({ className }: { className?: string }) {
  return (
    <svg className={`trgavel${className ? ` ${className}` : ''}`} viewBox="0 0 120 80" aria-hidden="true">
      <g className="trgavel__arm">
        <rect x={52} y={30} width={62} height={9} rx={3} fill="#a8692f" stroke={INK} strokeWidth={3} />
        <rect x={14} y={14} width={44} height={40} rx={6} fill="#7a4520" stroke={INK} strokeWidth={3} />
        <path d="M24 14v40M48 14v40" stroke="#c9944f" strokeWidth={4} />
        <path d="M24 14v40M48 14v40" stroke={INK} strokeWidth={1.5} opacity={0.4} />
      </g>
    </svg>
  )
}

/** The round sound block the gavel strikes */
export function SoundBlock() {
  return (
    <svg className="trblock" viewBox="0 0 80 28" aria-hidden="true">
      <ellipse cx={40} cy={18} rx={36} ry={9} fill="#5a3418" stroke={INK} strokeWidth={3} />
      <ellipse cx={40} cy={13} rx={36} ry={9} fill="#8a5428" stroke={INK} strokeWidth={3} />
    </svg>
  )
}

/** Scales of justice for the back wall (simple original drawing) */
export function Scales() {
  return (
    <svg className="trscales" viewBox="0 0 120 100" aria-hidden="true">
      <g fill="none" stroke="#e9c46a" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M60 12v72M40 88h40M22 26h76" />
        <path d="M22 26l-14 30h28zM98 26l-14 30h28z" />
        <path d="M6 56q16 14 32 0M82 56q16 14 32 0" />
      </g>
      <circle cx={60} cy={12} r={6} fill="#e9c46a" />
    </svg>
  )
}

/** An empty manila folder with a "not submitted" stamp */
export function EmptyFolder({ title }: { title: string }) {
  return (
    <div className="trfolder" role="img" aria-label={L(`Folder "${title}": empty, not submitted`, `Carpeta «${title}»: vacía, no presentada`)}>
      <span className="trfolder__tab">{title}</span>
      <span className="trfolder__inside" aria-hidden="true">
        <span className="trfolder__nothing">{L('( empty )', '( vacía )')}</span>
      </span>
      <span className="trfolder__stamp" aria-hidden="true">
        {L('Not submitted', 'No presentada')}
      </span>
    </div>
  )
}
