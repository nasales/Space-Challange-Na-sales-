// Main roads of the explored country (Natural Earth, public domain), produced once by
// scripts/fetch-roads.mjs and stored in public/maps/countries/<ID>/roads.json.
import type { Bounds } from '../map/mapData'

/** A road as stored in roads.json. */
export interface Road {
  /** Route label, e.g. "A6" or "N432" (may be empty). */
  name: string
  /** 1 motorway / autovía, 2 primary national road. */
  rank: 1 | 2
  /** One or more polylines of [lon, lat] points. */
  lines: [number, number][][]
}

/** Loads roads.json of a country; a country without it simply has no roads. */
export async function loadRoads(countryId: string): Promise<Road[]> {
  try {
    const res = await fetch(`/maps/countries/${countryId}/roads.json`)
    if (!res.ok) return []
    return ((await res.json()).roads ?? []) as Road[]
  } catch {
    return []
  }
}

/** Keeps the road lines that touch the given bounds (same rule as the rivers in mapData.ts). */
export function roadsInBounds(roads: Road[], b: Bounds): Road[] {
  const inside = ([lon, lat]: [number, number]) => lon >= b.west && lon <= b.east && lat >= b.south && lat <= b.north
  return roads
    .map((r) => ({ ...r, lines: r.lines.filter((line) => line.some(inside)) }))
    .filter((r) => r.lines.length > 0)
}
