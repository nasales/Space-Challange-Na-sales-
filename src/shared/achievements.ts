// Achievements: small goals the player completes while exploring, shown as trophy toasts
// (src/ui/achievements/AchievementToasts.tsx). Saved in this browser only (localStorage), like
// progress.ts; if storage is blocked the achievements still work for this session.
//
// The game and the app only call the report*() functions below (one line each); everything else,
// the definitions, the rules for when a toast shows and the saved state, lives in this file.
// The toasts listen through onAchievementToast() (a tiny module-level event bus).
import { BULL_SPOTS } from '../game/bulls/bullSpots'
import { lonLatToWorld } from '../game/map/projection'
import { loadCompleted } from './progress'
import { TUTORIAL_CASE_IDS } from './tutorial'

/** localStorage key: { [achievementId]: string[] of the steps already found }. */
const STORAGE_KEY = 'esd.achievements'

/** The 17 autonomous communities, as written in places.json (the HUD region). Ceuta and Melilla are autonomous cities, not counted. */
const COMMUNITIES = [
  'Andalucía', 'Aragón', 'Asturias', 'Islas Baleares', 'Canarias', 'Cantabria', 'Castilla y León',
  'Castilla-La Mancha', 'Cataluña', 'Comunidad Valenciana', 'Extremadura', 'Galicia', 'Comunidad de Madrid',
  'Región de Murcia', 'Navarra', 'País Vasco', 'La Rioja',
] as const

/** A bull counts as found when the detective passes this close to it (world units; 8 units = 1 km). */
export const BULL_FOUND_RADIUS = 60

const CASE_COUNT = TUTORIAL_CASE_IDS.length
const COMMUNITY_COUNT = COMMUNITIES.length
const COMMUNITY_HALF = Math.ceil(COMMUNITY_COUNT / 2)
const BULL_COUNT = BULL_SPOTS.length

export type AchievementId = 'cases' | 'communities' | 'sea-legs' | 'bulls'

export interface AchievementDef {
  id: AchievementId
  /** Emoji shown in the toast */
  icon: string
  title: string
  /** Steps to complete it (1 = a single achievement, shown without a progress ring) */
  total: number
  /** Step counts that show a toast (the others are counted silently) */
  toastAt: readonly number[]
  /** One-line toast message for `done` steps */
  message: (done: number, total: number) => string
}

/** Every achievement, in display order. */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'cases',
    icon: '🔎',
    title: 'Case closer',
    total: CASE_COUNT,
    toastAt: Array.from({ length: CASE_COUNT }, (_, i) => i + 1),
    message: (done, total) => (done < total ? `${done}/${total} case levels solved` : `All ${total} case levels solved`),
  },
  {
    id: 'communities',
    icon: '🧭',
    title: 'Community explorer',
    total: COMMUNITY_COUNT,
    toastAt: [COMMUNITY_HALF, COMMUNITY_COUNT],
    message: (done, total) =>
      done < total ? `Milestone 1/2: ${done} of ${total} communities visited` : `Milestone 2/2: all ${total} communities visited`,
  },
  {
    id: 'sea-legs',
    icon: '🚣',
    title: 'Sea legs',
    total: 1,
    toastAt: [1],
    message: () => 'First time rowing out to sea',
  },
  {
    id: 'bulls',
    icon: '🐂',
    title: 'Bull hunter',
    total: BULL_COUNT,
    toastAt: [BULL_COUNT],
    message: (_done, total) => `You found all ${total} roadside bulls`,
  },
]

/** What a toast shows. `ring` is null for single achievements. */
export interface AchievementToast {
  key: number
  icon: string
  title: string
  message: string
  ring: { from: number; to: number } | null
  complete: boolean
}

// ---- Saved state ----

type State = Partial<Record<AchievementId, string[]>>

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    const state: State = {}
    if (parsed && typeof parsed === 'object') {
      for (const def of ACHIEVEMENTS) {
        const list = (parsed as Record<string, unknown>)[def.id]
        if (Array.isArray(list)) state[def.id] = list.filter((x): x is string => typeof x === 'string')
      }
    }
    return state
  } catch {
    return {}
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage unavailable: keep the achievements for this session only
  }
}

const state: State = load()
// Cases solved before achievements existed count silently
for (const id of loadCompleted()) {
  if ((TUTORIAL_CASE_IDS as readonly string[]).includes(id) && !state.cases?.includes(id)) (state.cases ??= []).push(id)
}

// ---- Toast bus ----

type Listener = (toast: AchievementToast) => void
const listeners = new Set<Listener>()
let toastKey = 0

/** Subscribes to new toasts; returns the unsubscribe function. */
export function onAchievementToast(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit(def: AchievementDef, done: number) {
  const toast: AchievementToast = {
    key: ++toastKey,
    icon: def.icon,
    title: def.title,
    message: def.message(done, def.total),
    ring: def.total > 1 ? { from: (done - 1) / def.total, to: done / def.total } : null,
    complete: done >= def.total,
  }
  for (const l of listeners) l(toast)
}

/** Records one step of an achievement (ignored if already found); toasts on the step counts it lists. */
function step(id: AchievementId, key: string) {
  const def = ACHIEVEMENTS.find((a) => a.id === id)
  const found = (state[id] ??= [])
  if (!def || found.includes(key) || found.length >= def.total) return
  found.push(key)
  save()
  if (def.toastAt.includes(found.length)) emit(def, found.length)
}

// ---- Reports (one line each in the app / game) ----

/** A featured case was solved (App.tsx, on the case flow's onSolved). */
export function reportCaseSolved(caseId: string) {
  if ((TUTORIAL_CASE_IDS as readonly string[]).includes(caseId)) step('cases', caseId)
}

let bullWorld: { id: string; x: number; z: number }[] | null = null

/** Where the detective is (GameView, with each HUD update): the region and the world position. */
export function reportExploration(region: string, x: number, z: number) {
  if ((COMMUNITIES as readonly string[]).includes(region)) step('communities', region)
  bullWorld ??= BULL_SPOTS.map((b) => ({ id: b.id, ...lonLatToWorld(b.lon, b.lat) }))
  for (const b of bullWorld) {
    if (Math.hypot(b.x - x, b.z - z) <= BULL_FOUND_RADIUS) step('bulls', b.id)
  }
}

/** The detective is rowing the boat (GameView, every frame while afloat). */
export function reportBoat() {
  if (!state['sea-legs']?.length) step('sea-legs', 'boat')
}

/** Current progress of every achievement (for a list or tests). */
export function achievementProgress() {
  return ACHIEVEMENTS.map((def) => ({ def, done: Math.min(def.total, state[def.id]?.length ?? 0) }))
}

/** Development only (?achtest): shows one multi-step toast and one single toast (or only one kind); saves nothing. */
export function demoToasts(only?: 'ring' | 'single') {
  if (only !== 'single') emit(ACHIEVEMENTS[0], Math.max(1, Math.min(2, ACHIEVEMENTS[0].total)))
  if (only !== 'ring') emit(ACHIEVEMENTS[2], 1)
}

// Development only: window.__achievements.reset() clears the saved achievements (console / Playwright)
if (import.meta.env.DEV && typeof window !== 'undefined') {
  Object.assign(window, {
    __achievements: {
      state,
      progress: achievementProgress,
      reset: () => {
        for (const k of Object.keys(state)) delete state[k as AchievementId]
        save()
      },
    },
  })
}
