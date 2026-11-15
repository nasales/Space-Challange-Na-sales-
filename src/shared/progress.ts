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

// ---- Signed-in players: solved cases also saved per user in Supabase (table minigame_progress) ----
// One row per (user, minigame_id); minigame_id = the featured case id. RLS lets a player read and
// insert only their own rows; user_id defaults to auth.uid(). Guests never call these. Errors are
// logged and never break the game (the local progress above still works).

const TABLE = 'minigame_progress'

/** Minigame ids the signed-in player has completed (empty set on any error). */
export async function fetchRemoteCompleted(userId: string): Promise<Set<string>> {
  try {
    const { getAuthClient } = await import('./auth')
    const client = await getAuthClient()
    const { data, error } = await client.from(TABLE).select('minigame_id').eq('user_id', userId)
    if (error) throw error
    return new Set((data ?? []).map((r: { minigame_id: string }) => r.minigame_id))
  } catch (err) {
    console.warn('Could not load saved progress:', err)
    return new Set()
  }
}

/** Saves a completed minigame for the signed-in player (no-op if it is already saved). */
export async function saveRemoteCompleted(minigameId: string): Promise<void> {
  try {
    const { getAuthClient } = await import('./auth')
    const client = await getAuthClient()
    // ON CONFLICT DO NOTHING: the RLS policies allow insert but not update
    const { error } = await client
      .from(TABLE)
      .upsert(
        { minigame_id: minigameId, completed_at: new Date().toISOString() },
        { onConflict: 'user_id,minigame_id', ignoreDuplicates: true },
      )
    if (error) throw error
  } catch (err) {
    console.warn('Could not save progress:', err)
  }
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
