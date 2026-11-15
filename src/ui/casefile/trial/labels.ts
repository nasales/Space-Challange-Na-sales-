// Words of the courtroom trial (Trial.tsx): sides, rulings and the final verdicts.
import type { TrialMove, TrialRuling, TrialSentence, TrialSide } from '../../../shared/tutorial'

export const SIDE_LABEL: Record<TrialSide, string> = { prosecution: 'Prosecution', defence: 'Defence' }

/** What each side argues, shown on its table */
export const SIDE_ROLE: Record<TrialSide, string> = {
  prosecution: 'Says the claim is true',
  defence: 'Says the claim is not',
}

export const RULINGS: TrialRuling[] = ['admit', 'reject', 'insufficient']

export const RULING_BUTTON: Record<TrialRuling, { label: string; help: string }> = {
  admit: { label: 'Admit', help: 'Solid evidence for what its side says' },
  reject: { label: 'Reject', help: 'It does not show what the lawyer says' },
  insufficient: { label: 'Insufficient', help: 'The court needs more data to decide' },
}

/** Stamp on a ruled exhibit */
export const RULING_STAMP: Record<TrialRuling, string> = {
  admit: 'Admitted',
  reject: 'Rejected',
  insufficient: 'Insufficient',
}

type Verdict = TrialSentence['options'][number]['verdict']

export const VERDICT_LABEL: Record<Verdict, { label: string; sub: string }> = {
  guilty: { label: 'Guilty', sub: 'The claim is right' },
  not_guilty: { label: 'Not guilty', sub: 'The claim is wrong' },
  not_proven: { label: 'Not proven', sub: 'Only partly supported' },
}

export const MOVE_LABEL: Record<TrialMove, string> = {
  both_dry: 'Both drier',
  both_wet: 'Both wetter',
  apart: 'Apart',
}
export const MOVES: TrialMove[] = ['both_dry', 'both_wet', 'apart']

/** Exhibit letter: 0 -> "A" */
export const letterOf = (i: number) => String.fromCharCode(65 + i)
