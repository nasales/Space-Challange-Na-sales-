// The featured cases shown on the menu: only title, place and question are kept.
// Facts, slopes and p-values stay out of the menu so no conclusion is given away.
// Only the cases active in the game (TUTORIAL_CASE_IDS) are listed, in that order.
import casesIndex from '../../../data/cases_index.json'
import { TUTORIAL_CASE_IDS } from '../../shared/tutorial'
import { localCase } from '../../shared/casesEs'

export interface FeaturedCase {
  id: string
  title: string
  place: string
  question: string
}

const byId = new Map((casesIndex as FeaturedCase[]).map((item) => [item.id, item]))

export const FEATURED: FeaturedCase[] = TUTORIAL_CASE_IDS.flatMap((id) => {
  const item = byId.get(id)
  return item ? [localCase({ id: item.id, title: item.title, place: item.place, question: item.question })] : []
})
