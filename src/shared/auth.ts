// Optional player accounts (email + password) with Supabase Auth. Signed-in players also get their
// solved cases saved in the minigame_progress table (src/shared/progress.ts).
// The game never depends on this: without the env vars auth is simply disabled.
// Uses the same PUBLISHABLE key as src/shared/supabase.ts (public by design), never a secret key.
// The supabase-js client is created lazily (and loaded as a separate chunk) on first use, so
// players who never open the Account screen do not download it.
// The session persists in the browser (supabase-js default: localStorage).
import { useEffect, useState } from 'react'
import type { AuthChangeEvent, Session, SupabaseClient, User } from '@supabase/supabase-js'
import { L } from './i18n'

const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '')
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** False when the Supabase env vars are missing: the Account screen says so and Play still works. */
export const authConfigured = Boolean(URL_ && KEY)

const DISABLED_MESSAGE = L('Accounts are not available in this build.', 'Las cuentas no están disponibles en esta versión.')

let clientPromise: Promise<SupabaseClient> | null = null

function getClient(): Promise<SupabaseClient> {
  if (!authConfigured) return Promise.reject(new Error(DISABLED_MESSAGE))
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(URL_!, KEY!, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }),
    )
  }
  return clientPromise
}

/** The shared supabase-js client (with the player's session), for per-user tables such as minigame_progress. */
export function getAuthClient(): Promise<SupabaseClient> {
  return getClient()
}

/** Result of an auth action: `error` is a short message ready to show to the player. */
export interface AuthResult {
  error: string | null
}

/** Result of sign up: `needsConfirmation` is true when the project asks to confirm the email first. */
export interface SignUpResult extends AuthResult {
  needsConfirmation: boolean
}

function message(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return L('Something went wrong. Please try again.', 'Algo ha fallado. Inténtalo de nuevo.')
}

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  try {
    const client = await getClient()
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) return { error: error.message, needsConfirmation: false }
    return { error: null, needsConfirmation: !data.session }
  } catch (err) {
    return { error: message(err), needsConfirmation: false }
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const client = await getClient()
    const { error } = await client.auth.signInWithPassword({ email, password })
    return { error: error ? error.message : null }
  } catch (err) {
    return { error: message(err) }
  }
}

export async function signOut(): Promise<AuthResult> {
  try {
    const client = await getClient()
    const { error } = await client.auth.signOut()
    return { error: error ? error.message : null }
  } catch (err) {
    return { error: message(err) }
  }
}

export async function resetPassword(email: string): Promise<AuthResult> {
  try {
    const client = await getClient()
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    return { error: error ? error.message : null }
  } catch (err) {
    return { error: message(err) }
  }
}

/** Sets a new password for the signed-in player (used after a password reset link). */
export async function updatePassword(password: string): Promise<AuthResult> {
  try {
    const client = await getClient()
    const { error } = await client.auth.updateUser({ password })
    return { error: error ? error.message : null }
  } catch (err) {
    return { error: message(err) }
  }
}

/** True when the page was opened from a password reset email (Supabase adds type=recovery). */
export function isRecoveryLink(): boolean {
  return /type=recovery/.test(window.location.hash)
}

/** Current session, or null (also null when auth is disabled or the client fails to load). */
export async function getSession(): Promise<Session | null> {
  if (!authConfigured) return null
  try {
    const client = await getClient()
    const { data } = await client.auth.getSession()
    return data.session
  } catch {
    return null
  }
}

/** Calls `cb` on every sign in / sign out / token refresh. Returns the unsubscribe function. */
export function onAuthChange(cb: (session: Session | null, event: AuthChangeEvent) => void): () => void {
  if (!authConfigured) return () => {}
  let unsubscribe: (() => void) | null = null
  let cancelled = false
  getClient()
    .then((client) => {
      if (cancelled) return
      const { data } = client.auth.onAuthStateChange((event, session) => cb(session, event))
      unsubscribe = () => data.subscription.unsubscribe()
    })
    .catch(() => {})
  return () => {
    cancelled = true
    unsubscribe?.()
  }
}

// A session saved by supabase-js in localStorage (key sb-<project ref>-auth-token). Checked before
// loading the client, so players who never signed in do not download supabase-js on the menu.
function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) return true
    }
  } catch {
    // storage blocked: treat as signed out
  }
  return false
}

// Auth redirect links (email confirmation, password reset) land on the site with tokens in the URL.
function hasAuthParams(): boolean {
  const h = window.location.hash
  const q = window.location.search
  return /access_token=|error_description=/.test(h) || /[?&]code=/.test(q)
}

export interface SessionState {
  session: Session | null
  user: User | null
  loading: boolean
}

/**
 * Live auth state for React. `load` forces loading the client (the Account screen passes true);
 * otherwise it is only loaded when a saved session or an auth redirect exists.
 */
export function useSession(load = false): SessionState {
  const active = authConfigured && (load || hasStoredSession() || hasAuthParams())
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(active)

  useEffect(() => {
    if (!active) return
    let alive = true
    getSession().then((s) => {
      if (!alive) return
      setSession(s)
      setLoading(false)
    })
    const off = onAuthChange((s) => {
      if (!alive) return
      setSession(s)
      setLoading(false)
    })
    return () => {
      alive = false
      off()
    }
  }, [active])

  return { session, user: session?.user ?? null, loading: active ? loading : false }
}
