// The featured cases shown on the menu: only title, place and question are kept.
// Facts, slopes and p-values stay out of the menu so no conclusion is given away.
import casesIndex from '../../../data/cases_index.json'

export interface FeaturedCase {
  id: string
  title: string
  place: string
  question: string
}

export const FEATURED: FeaturedCase[] = (casesIndex as FeaturedCase[]).map(({ id, title, place, question }) => ({
  id,
  title,
  place,
  question,
}))
