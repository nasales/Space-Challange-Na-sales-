// Words shown in the interrogation room for each confrontation verdict, and the kind hints after
// a wrong pick (general reasoning hints; the evidence's own feedback is shown once it is right).
import type { AlibiVerdict, SeasonId } from '../../../shared/tutorial'

export const VERDICTS: AlibiVerdict[] = ['breaks', 'backs', 'doubt']

export const VERDICT_LABEL: Record<AlibiVerdict, string> = {
  breaks: 'Breaks the alibi',
  backs: 'Backs the alibi',
  doubt: 'Not enough: reasonable doubt',
}

/** Stamp on a folder and under a suspect */
export const VERDICT_STAMP: Record<AlibiVerdict, string> = {
  breaks: 'Alibi broken',
  backs: 'Alibi holds',
  doubt: 'Reasonable doubt',
}

/** Hint after picking `picked` when the right verdict is `right` */
export function verdictHint(picked: AlibiVerdict, right: AlibiVerdict): string {
  if (picked === 'breaks' && right === 'doubt')
    return 'To break an alibi, the evidence must be beyond reasonable doubt. Compare its p-value with 0.05.'
  if (picked === 'breaks' && right === 'backs')
    return 'Does this evidence show the suspect changed, or does it agree with what the suspect says?'
  if (picked === 'backs' && right === 'breaks')
    return 'Read the alibi again. Does the evidence agree with it, or show the opposite?'
  if (picked === 'backs' && right === 'doubt')
    return 'This evidence does not agree with the suspect: it points against the alibi, only not strongly enough.'
  if (picked === 'doubt' && right === 'breaks')
    return 'Doubt is for weak evidence. Is this trend above or below the p = 0.05 line?'
  return 'Doubt is for evidence that points against the alibi without proving it. Does this evidence point against it at all?'
}

export const SEASON_TAB: Record<SeasonId, string> = {
  DJF: 'Winter',
  MAM: 'Spring',
  JJA: 'Summer',
  SON: 'Autumn',
  JJAS: 'Fire season',
}

export const SEASON_MONTHS: Record<SeasonId, string> = {
  DJF: 'Dec-Feb',
  MAM: 'Mar-May',
  JJA: 'Jun-Aug',
  SON: 'Sep-Nov',
  JJAS: 'Jun-Sep',
}

/** The standard of proof used everywhere in the game (same as the pipeline) */
export const ALPHA = 0.05
