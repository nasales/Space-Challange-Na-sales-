// Loads a featured-case tutorial: the story script (data/tutorials/<case_id>.json) and its chart
// data (data/tutorial_data/<case_id>.json). Both are bundled by Vite (import.meta.glob), so the
// case file works offline and never calls a live API. Each file is a separate lazy chunk.
import type { TutorialData, TutorialScript } from '../../shared/tutorial'
import { fixText } from './format'
import { L, LANG } from '../../shared/i18n'
import { CASE_VARIABLE_NAMES_ES, CASES_ES } from '../../shared/casesEs'

type Lazy<T> = Record<string, () => Promise<T>>

const scripts: Lazy<TutorialScript> = import.meta.glob<TutorialScript>('/data/tutorials/*.json', { import: 'default' })
// Spanish story scripts (same structure as the English ones), used when the language is Spanish
const scriptsEs: Lazy<TutorialScript> = import.meta.glob<TutorialScript>('/data/tutorials/es/*.json', { import: 'default' })
const datas: Lazy<TutorialData> = import.meta.glob<TutorialData>('/data/tutorial_data/*.json', { import: 'default' })

// Case titles for the "near case" hint (small file, bundled with the hint).
interface CaseIndexEntry {
  id: string
  title: string
}
const caseIndex =
  Object.values(import.meta.glob<CaseIndexEntry[]>('/data/cases_index.json', { eager: true, import: 'default' }))[0] ?? []

export function caseTitle(caseId: string): string {
  if (LANG === 'es' && CASES_ES[caseId]) return CASES_ES[caseId].title
  return caseIndex.find((c) => c.id === caseId)?.title ?? caseId
}

const SCRIPT_DIR = '/data/tutorials/'
const DATA_DIR = '/data/tutorial_data/'
const idOf = (path: string, dir: string) => path.slice(dir.length, -'.json'.length)

export interface CaseListing {
  id: string
  title: string
  /** false while data/tutorial_data/<id>.json is missing */
  hasData: boolean
}

/** Every case with a story script, in the order of data/cases_index.json (then by id). */
export function listTutorials(): CaseListing[] {
  const order = (id: string) => {
    const i = caseIndex.findIndex((c) => c.id === id)
    return i < 0 ? caseIndex.length : i
  }
  return Object.keys(scripts)
    .map((p) => idOf(p, SCRIPT_DIR))
    .sort((a, b) => order(a) - order(b) || a.localeCompare(b))
    .map((id) => ({ id, title: caseTitle(id), hasData: `${DATA_DIR}${id}.json` in datas }))
}

export function hasTutorial(caseId: string): boolean {
  return `${SCRIPT_DIR}${caseId}.json` in scripts && `${DATA_DIR}${caseId}.json` in datas
}

/** Text fields that may arrive mis-encoded ("Â°C") are repaired once, here. */
function cleanData(data: TutorialData): TutorialData {
  const variables: TutorialData['variables'] = {}
  for (const [key, s] of Object.entries(data.variables ?? {})) {
    const nameEs = LANG === 'es' ? CASE_VARIABLE_NAMES_ES[s.variable ?? key] ?? CASE_VARIABLE_NAMES_ES[key] : undefined
    variables[key] = { ...s, name: nameEs ?? fixText(s.name ?? key), units: fixText(s.units ?? ''), dataset: fixText(s.dataset ?? '') }
  }
  const placeEs = LANG === 'es' ? CASES_ES[data.case_id]?.place : undefined
  return { ...data, place: placeEs ?? fixText(data.place ?? ''), variables }
}

export interface LoadedTutorial {
  script: TutorialScript
  data: TutorialData
}

export async function loadTutorial(caseId: string): Promise<LoadedTutorial> {
  // Spanish script when the language is Spanish and it exists; otherwise the English one
  const script = (LANG === 'es' ? scriptsEs[`${SCRIPT_DIR}es/${caseId}.json`] : undefined) ?? scripts[`${SCRIPT_DIR}${caseId}.json`]
  const data = datas[`${DATA_DIR}${caseId}.json`]
  if (!script || !data) {
    throw new Error(L(`The case file "${caseId}" is not ready yet.`, `El expediente "${caseId}" aún no está listo.`))
  }
  const [s, d] = await Promise.all([script(), data()])
  return { script: s, data: cleanData(d) }
}
