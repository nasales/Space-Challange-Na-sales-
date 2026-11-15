// Small badge in the top-left corner: is the database (Supabase) reachable, and which build is running.
// Checks once at start and then every 60 s. Does not block the game.
import { useEffect, useState } from 'react'
import { pingSupabase, supabaseConfigured } from '../../shared/supabase'
import { VERSION_LABEL } from '../../shared/version'
import './DbStatus.css'
import { L } from '../../shared/i18n'

type State = 'checking' | 'connected' | 'offline' | 'not_configured'

const LABEL: Record<State, string> = {
  checking: L('Database: checking…', 'Base de datos: comprobando…'),
  connected: L('Database: connected', 'Base de datos: conectada'),
  offline: L('Database: offline', 'Base de datos: sin conexión'),
  not_configured: L('Database: not configured', 'Base de datos: sin configurar'),
}

/** hidden: fade the badge out (while a featured case is open) */
export default function DbStatus({ hidden = false }: { hidden?: boolean }) {
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
    <div
      className={`db-status db-status--${state}${hidden ? ' db-status--hidden' : ''}`}
      role="status"
      data-testid="db-status"
      aria-hidden={hidden || undefined}
    >
      <span className="db-status__dot" aria-hidden="true" />
      <span>{LABEL[state]}</span>
      <span className="db-status__version">{VERSION_LABEL}</span>
    </div>
  )
}
