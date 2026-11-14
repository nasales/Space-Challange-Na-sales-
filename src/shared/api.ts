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

/** One variable of a map cell, as returned by the Supabase `get_cell` function. */
export interface CellVariable {
  cell_id: number
  lat: number
  lon: number
  distance_km: number
  var_id: string
  name_en: string
  unit: string
  source: string
  definition_en: string
  start_month: string
  values: (number | null)[]
  climatology: (number | null)[]
  period_start: string | null
  period_end: string | null
  slope_per_decade: number | null
  slope_ci_low: number | null
  slope_ci_high: number | null
  p_value: number | null
  significant: boolean | null
  direction: string | null
}

/** Any point of the map. An empty list means sea or outside the map. */
export const fetchCell = (lat: number, lon: number, signal?: AbortSignal) =>
  getJson<CellVariable[]>(`/api/cell?lat=${lat}&lon=${lon}`, signal)
