// Loads a featured-case tutorial: the story script (data/tutorials/<case_id>.json) and its chart
// data (data/tutorial_data/<case_id>.json). Both are bundled by Vite (import.meta.glob), so the
// case file works offline and never calls a live API. Each file is a separate lazy chunk.
import type { TutorialData, TutorialScript } from '../../shared/tutorial'

type Lazy<T> = Record<string, () => Promise<T>>

const scripts: Lazy<TutorialScript> = import.meta.glob<TutorialScript>('/data/tutorials/*.json', { import: 'default' })
const datas: Lazy<TutorialData> = import.meta.glob<TutorialData>('/data/tutorial_data/*.json', { import: 'default' })

// Case titles for the "near case" hint (small file, bundled with the hint).
interface CaseIndexEntry {
  id: string
  title: string
}
const caseIndex =
  Object.values(import.meta.glob<CaseIndexEntry[]>('/data/cases_index.json', { eager: true, import: 'default' }))[0] ?? []

export function caseTitle(caseId: string): string {
  return caseIndex.find((c) => c.id === caseId)?.title ?? caseId
}

export interface LoadedTutorial {
  script: TutorialScript
  data: TutorialData
}

export async function loadTutorial(caseId: string): Promise<LoadedTutorial> {
  const script = scripts[`/data/tutorials/${caseId}.json`]
  const data = datas[`/data/tutorial_data/${caseId}.json`]
  if (!script || !data) {
    throw new Error(`The case file "${caseId}" is not ready yet.`)
  }
  const [s, d] = await Promise.all([script(), data()])
  return { script: s, data: d }
}
