// Words of the courtroom trial (Trial.tsx): sides, rulings and the final verdicts.
import type { TrialMove, TrialRuling, TrialSentence, TrialSide } from '../../../shared/tutorial'
import { L } from '../../../shared/i18n'

export const SIDE_LABEL: Record<TrialSide, string> = { prosecution: L('Prosecution', 'Acusación'), defence: L('Defence', 'Defensa') }

/** What each side argues, shown on its table */
export const SIDE_ROLE: Record<TrialSide, string> = {
  prosecution: L('Says the claim is true', 'Dice que la afirmación es cierta'),
  defence: L('Says the claim is not', 'Dice que no lo es'),
}

export const RULINGS: TrialRuling[] = ['admit', 'reject', 'insufficient']

export const RULING_BUTTON: Record<TrialRuling, { label: string; help: string }> = {
  admit: { label: L('Admit', 'Admitir'), help: L('Solid evidence for what its side says', 'Prueba sólida de lo que dice su parte') },
  reject: { label: L('Reject', 'Rechazar'), help: L('It does not show what the lawyer says', 'No demuestra lo que dice el abogado') },
  insufficient: { label: L('Insufficient', 'Insuficiente'), help: L('The court needs more data to decide', 'El tribunal necesita más datos para decidir') },
}

/** Stamp on a ruled exhibit */
export const RULING_STAMP: Record<TrialRuling, string> = {
  admit: L('Admitted', 'Admitida'),
  reject: L('Rejected', 'Rechazada'),
  insufficient: L('Insufficient', 'Insuficiente'),
}

type Verdict = TrialSentence['options'][number]['verdict']

export const VERDICT_LABEL: Record<Verdict, { label: string; sub: string }> = {
  guilty: { label: L('Guilty', 'Culpable'), sub: L('The claim is right', 'La afirmación es correcta') },
  not_guilty: { label: L('Not guilty', 'Inocente'), sub: L('The claim is wrong', 'La afirmación es falsa') },
  not_proven: { label: L('Not proven', 'No probado'), sub: L('Only partly supported', 'Solo en parte respaldada') },
}

export const MOVE_LABEL: Record<TrialMove, string> = {
  both_dry: L('Both drier', 'Ambos más secos'),
  both_wet: L('Both wetter', 'Ambos más húmedos'),
  apart: L('Apart', 'Por separado'),
}
export const MOVES: TrialMove[] = ['both_dry', 'both_wet', 'apart']

/** Exhibit letter: 0 -> "A" */
export const letterOf = (i: number) => String.fromCharCode(65 + i)
