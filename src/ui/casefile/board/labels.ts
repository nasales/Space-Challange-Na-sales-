// Words shown on the evidence board for each kind of item and each link to the claim.
import type { EvidenceRelation } from '../../../shared/tutorial'
import { L } from '../../../shared/i18n'

export const KIND_LABEL = { chart: L('Chart photo', 'Foto de gráfica'), clipping: L('Newspaper clipping', 'Recorte de periódico'), datacard: L('Data card', 'Ficha de datos') } as const

export const RELATION_LABEL: Record<EvidenceRelation, string> = {
  supports: L('Supports the claim', 'Apoya la afirmación'),
  contradicts: L('Contradicts the claim', 'Contradice la afirmación'),
  neutral: L('Says nothing about it', 'No dice nada al respecto'),
}

/** Short tag on a linked card */
export const RELATION_TAG: Record<EvidenceRelation, string> = {
  supports: L('Supports', 'Apoya'),
  contradicts: L('Contradicts', 'Contradice'),
  neutral: L('Says nothing', 'No dice nada'),
}

export const RELATIONS: EvidenceRelation[] = ['supports', 'contradicts', 'neutral']
