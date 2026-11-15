// Words shown on the evidence board for each kind of item and each link to the claim.
import type { EvidenceRelation } from '../../../shared/tutorial'

export const KIND_LABEL = { chart: 'Chart photo', clipping: 'Newspaper clipping', datacard: 'Data card' } as const

export const RELATION_LABEL: Record<EvidenceRelation, string> = {
  supports: 'Supports the claim',
  contradicts: 'Contradicts the claim',
  neutral: 'Says nothing about it',
}

/** Short tag on a linked card */
export const RELATION_TAG: Record<EvidenceRelation, string> = {
  supports: 'Supports',
  contradicts: 'Contradicts',
  neutral: 'Says nothing',
}

export const RELATIONS: EvidenceRelation[] = ['supports', 'contradicts', 'neutral']
