// Player progress: which featured cases are solved. Saved in this browser only (localStorage);
// if storage is blocked (private window, cleared data) the game still works, just without memory.

const KEY = 'esd.completedCases'

/** Solved case ids saved in this browser (empty if none or if storage is unavailable). */
export function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

/** Marks a case as solved and returns the new set. */
export function markCompleted(caseId: string): Set<string> {
  const set = loadCompleted()
  set.add(caseId)
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]))
  } catch {
    // storage unavailable: keep the progress for this session only
  }
  return set
}

const GUIDE_KEY = 'esd.guideSeen'

/** True once the player has been offered the map tutorial in this browser (taken or skipped). */
export function loadGuideSeen(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1'
  } catch {
    return false // storage unavailable: the offer shows again next time
  }
}

/** Remembers that the tutorial was offered, so it is not offered again (it stays in the pause menu). */
export function markGuideSeen(): void {
  try {
    localStorage.setItem(GUIDE_KEY, '1')
  } catch {
    // storage unavailable: nothing to remember
  }
}
