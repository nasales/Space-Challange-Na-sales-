// Direct read-only access from the browser to Supabase (REST API, no extra library).
// Uses the PUBLISHABLE key (public by design): Row Level Security only allows reads.
// Never put the secret / service_role key here or in any VITE_ variable.
// Set at build time: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example).
import type { CaseData } from './contract'

const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '')
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabaseConfigured = Boolean(URL_ && KEY)

/** Light item for the case list: no series and no statistical result. */
export interface CaseSummary {
  id: string
  place: string
  lat: number
  lon: number
  variable: string
}

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

async function rest<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  if (!supabaseConfigured) throw new Error('Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY)')
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    signal,
    headers: { apikey: KEY!, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`Supabase ${path.split('?')[0]} failed with HTTP ${res.status}`)
  return (await res.json()) as T
}

/** Cheap connection check: reads one row of the public `variables` table. */
export async function pingSupabase(signal?: AbortSignal): Promise<true> {
  await rest<unknown[]>('variables?select=id&limit=1', {}, signal)
  return true
}

/** Any point of the map. An empty list means sea or outside the map. */
export const fetchCell = (lat: number, lon: number, signal?: AbortSignal) =>
  rest<CellVariable[]>('rpc/get_cell', { method: 'POST', body: JSON.stringify({ p_lat: lat, p_lon: lon }) }, signal)

/** The featured cases (Supabase `cases` table, contract format). */
export const fetchCases = (signal?: AbortSignal) =>
  rest<CaseSummary[]>('cases?select=id,place,lat,lon,variable&order=id', {}, signal)

export async function fetchCase(id: string, signal?: AbortSignal): Promise<CaseData | undefined> {
  const rows = await rest<(CaseData & { id: string })[]>(
    `cases?select=place,lat,lon,variable,units,dataset,dates,values,slope,p_value,significant,test&id=eq.${encodeURIComponent(id)}`,
    {},
    signal,
  )
  return rows[0]
}
