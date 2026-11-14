// Roads of the explored country, stored in public/maps/countries/<ID>/roads.json. Today it holds a
// single closed loop ("The Detective's Road") planned offline by scripts/plan-road.mjs from the
// map data already in the repo (relief, border, rivers, landmarks, places).
import type { Bounds } from '../map/mapData'

/** A road as stored in roads.json. */
export interface Road {
  /** Road name (may be empty). */
  name: string
  /** 1 motorway look (wide, median), 2 single carriageway with a centre dash. */
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
