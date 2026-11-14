// Small badge in the top-left corner: is the database (Supabase) reachable, and which build is running.
// Checks once at start and then every 60 s. Does not block the game.
import { useEffect, useState } from 'react'
import { pingSupabase, supabaseConfigured } from '../../shared/supabase'
import { VERSION_LABEL } from '../../shared/version'
import './DbStatus.css'

type State = 'checking' | 'connected' | 'offline' | 'not_configured'

const LABEL: Record<State, string> = {
  checking: 'Database: checking…',
  connected: 'Database: connected',
  offline: 'Database: offline',
  not_configured: 'Database: not configured',
}

export default function DbStatus() {
  const [state, setState] = useState<State>(supabaseConfigured ? 'checking' : 'not_configured')

  useEffect(() => {
    if (!supabaseConfigured) return
    let alive = true
    const check = () =>
      pingSupabase(AbortSignal.timeout(8000))
        .then(() => alive && setState('connected'))
        .catch(() => alive && setState('offline'))
    check()
    const id = window.setInterval(check, 60_000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  return (
    <div className={`db-status db-status--${state}`} role="status" data-testid="db-status">
      <span className="db-status__dot" aria-hidden="true" />
      <span>{LABEL[state]}</span>
      <span className="db-status__version">{VERSION_LABEL}</span>
    </div>
  )
}
