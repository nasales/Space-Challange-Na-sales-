// Words shown in the interrogation room for each confrontation verdict, and the kind hints after
// a wrong pick (general reasoning hints; the evidence's own feedback is shown once it is right).
import type { AlibiVerdict, SeasonId } from '../../../shared/tutorial'
import { L } from '../../../shared/i18n'

export const VERDICTS: AlibiVerdict[] = ['breaks', 'backs', 'doubt']

export const VERDICT_LABEL: Record<AlibiVerdict, string> = {
  breaks: L('Breaks the alibi', 'Rompe la coartada'),
  backs: L('Backs the alibi', 'Respalda la coartada'),
  doubt: L('Not enough: reasonable doubt', 'No basta: duda razonable'),
}

/** Stamp on a folder and under a suspect */
export const VERDICT_STAMP: Record<AlibiVerdict, string> = {
  breaks: L('Alibi broken', 'Coartada rota'),
  backs: L('Alibi holds', 'La coartada se sostiene'),
  doubt: L('Reasonable doubt', 'Duda razonable'),
}

/** Hint after picking `picked` when the right verdict is `right` */
export function verdictHint(picked: AlibiVerdict, right: AlibiVerdict): string {
  if (picked === 'breaks' && right === 'doubt')
    return L('To break an alibi, the evidence must be beyond reasonable doubt. Compare its p-value with 0.05.', 'Para romper una coartada, la prueba debe ir más allá de toda duda razonable. Compara su valor p con 0,05.')
  if (picked === 'breaks' && right === 'backs')
    return L('Does this evidence show the suspect changed, or does it agree with what the suspect says?', '¿Esta prueba muestra que el sospechoso cambió, o coincide con lo que dice?')
  if (picked === 'backs' && right === 'breaks')
    return L('Read the alibi again. Does the evidence agree with it, or show the opposite?', 'Vuelve a leer la coartada. ¿La prueba coincide con ella o muestra lo contrario?')
  if (picked === 'backs' && right === 'doubt')
    return L('This evidence does not agree with the suspect: it points against the alibi, only not strongly enough.', 'Esta prueba no coincide con el sospechoso: apunta contra la coartada, solo que no con bastante fuerza.')
  if (picked === 'doubt' && right === 'breaks')
    return L('Doubt is for weak evidence. Is this trend above or below the p = 0.05 line?', 'La duda es para pruebas débiles. ¿Esta tendencia está por encima o por debajo de la línea p = 0,05?')
  return L('Doubt is for evidence that points against the alibi without proving it. Does this evidence point against it at all?', 'La duda es para pruebas que apuntan contra la coartada sin demostrarlo. ¿Esta prueba apunta siquiera en su contra?')
}

export const SEASON_TAB: Record<SeasonId, string> = {
  DJF: L('Winter', 'Invierno'),
  MAM: L('Spring', 'Primavera'),
  JJA: L('Summer', 'Verano'),
  SON: L('Autumn', 'Otoño'),
  JJAS: L('Fire season', 'Temporada de incendios'),
}

export const SEASON_MONTHS: Record<SeasonId, string> = {
  DJF: L('Dec-Feb', 'dic-feb'),
  MAM: L('Mar-May', 'mar-may'),
  JJA: L('Jun-Aug', 'jun-ago'),
  SON: L('Sep-Nov', 'sep-nov'),
  JJAS: L('Jun-Sep', 'jun-sep'),
}

/** The standard of proof used everywhere in the game (same as the pipeline) */
export const ALPHA = 0.05
