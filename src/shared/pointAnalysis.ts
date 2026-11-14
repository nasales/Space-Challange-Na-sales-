// Analysis of ANY map point (not only the featured cases), for the magnifying glass / variable picker.
// One Supabase request (`get_cell`) returns the six variables of the nearest land cell, with the
// generic trend computed by the statistics pipeline (pipeline/fill_trends.py -> table `trends`).
// Each variable is converted to the data contract (CaseData), so the Sherlock screen can use the
// same code for featured cases and for any point.
import type { CaseData } from './contract'
import { fetchCell, type CellVariable } from './supabase'

/** Test used by pipeline/trend.py (TEST_NAME) to fill the `trends` table. */
export const GENERIC_TEST = 'mann-kendall-prewhitening-yue-wang-2002'

/** One variable at the chosen point. */
export interface PointVariable {
  /** Variable id, e.g. "tair", "precip" (same as CaseData.variable) */
  id: string
  /** Name to show in the picker, e.g. "Air temperature" */
  name: string
  /** Simple definition for students */
  definition: string
  units: string
  /** 12 monthly means, January to December (useful for a seasonal chart) */
  climatology: (number | null)[]
  /**
   * Contract-shaped data for the charts and the checker. null when the database has no trend
   * for this variable (series too short): then the picker should disable this variable.
   */
  data: CaseData | null
  /** Extra statistics (reveal only AFTER the player submits a conclusion). */
  extra: {
    /** 95 % confidence interval of the slope, units/year */
    slopeCiLow: number | null
    slopeCiHigh: number | null
    direction: 'increasing' | 'decreasing' | 'no trend' | null
    /** Months used by the trend test (may be shorter than the full series) */
    periodStart: string | null
    periodEnd: string | null
  }
}

export interface PointAnalysis {
  /** Requested point */
  lat: number
  lon: number
  /** Centre of the database cell actually used (nearest land cell) */
  cell: { id: number; lat: number; lon: number; distanceKm: number }
  variables: PointVariable[]
}

/** "1998-01-01" + n months -> ["1998-01", "1998-02", ...] */
export function monthDates(startMonth: string, count: number): string[] {
  const year = Number(startMonth.slice(0, 4))
  const month = Number(startMonth.slice(5, 7)) - 1
  return Array.from({ length: count }, (_, i) => {
    const m = month + i
    return `${year + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`
  })
}

const perYear = (perDecade: number | null) => (perDecade == null ? null : perDecade / 10)

/** Converts one `get_cell` row to the contract. Returns null when there is no trend. */
export function cellToCaseData(row: CellVariable, place: string): CaseData | null {
  if (row.slope_per_decade == null || row.p_value == null) return null
  return {
    place,
    lat: row.lat,
    lon: row.lon,
    variable: row.var_id,
    units: row.unit,
    dataset: row.source,
    dates: monthDates(row.start_month, row.values.length),
    values: row.values,
    slope: row.slope_per_decade / 10,
    p_value: row.p_value,
    significant: row.significant ?? row.p_value < 0.05,
    test: GENERIC_TEST,
  }
}

// Same cell -> same answer: keep recent results so going back and forth does not refetch.
const cache = new Map<number, Promise<CellVariable[]>>()
const CACHE_SIZE = 30

function cachedCell(lat: number, lon: number, signal?: AbortSignal): Promise<CellVariable[]> {
  // Key on the 0.25° grid used by the database (cell_id formula in supabase_schema.sql)
  const key = Math.floor((lat + 90) / 0.25) * 1440 + Math.floor((lon + 180) / 0.25)
  const hit = cache.get(key)
  if (hit) return hit
  const request = fetchCell(lat, lon, signal)
  cache.set(key, request)
  request.catch(() => cache.delete(key)) // never keep a failed or aborted request
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!)
  return request
}

/**
 * Everything the magnifying glass needs for one point, in one request.
 * Returns null when the point is sea or outside the map (no land cell within ~0.5°).
 * @param place name shown to the player (e.g. LocationInfo.place from the HUD)
 */
export async function fetchPointAnalysis(
  lat: number,
  lon: number,
  place: string,
  signal?: AbortSignal,
): Promise<PointAnalysis | null> {
  const rows = await cachedCell(lat, lon, signal)
  if (rows.length === 0) return null
  const first = rows[0]
  return {
    lat,
    lon,
    cell: { id: first.cell_id, lat: first.lat, lon: first.lon, distanceKm: first.distance_km },
    variables: rows.map((row) => ({
      id: row.var_id,
      name: row.name_en,
      definition: row.definition_en,
      units: row.unit,
      climatology: row.climatology,
      data: cellToCaseData(row, place),
      extra: {
        slopeCiLow: perYear(row.slope_ci_low),
        slopeCiHigh: perYear(row.slope_ci_high),
        direction: (row.direction as PointVariable['extra']['direction']) ?? null,
        periodStart: row.period_start,
        periodEnd: row.period_end,
      },
    })),
  }
}
