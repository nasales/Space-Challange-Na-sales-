// Typed client for the Python backend (backend/app.py), served at /api/*.
// In dev, Vite proxies /api to http://127.0.0.1:8000 (npm run dev:api).
import type { CaseData } from './contract'

export interface Health {
  ok: boolean
  supabase: 'connected' | 'not_configured' | 'error'
}

/** Light item for the case list: no series and no statistical result. */
export interface CaseSummary {
  id: string
  place: string
  lat: number
  lon: number
  variable: string
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal })
  if (!res.ok) throw new Error(`${path} failed with HTTP ${res.status}`)
  return (await res.json()) as T
}

export const fetchHealth = (signal?: AbortSignal) => getJson<Health>('/api/health', signal)

export const fetchCases = (signal?: AbortSignal) => getJson<CaseSummary[]>('/api/cases', signal)

export const fetchCase = (id: string, signal?: AbortSignal) =>
  getJson<CaseData>(`/api/cases/${encodeURIComponent(id)}`, signal)
