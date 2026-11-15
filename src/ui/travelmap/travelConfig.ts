// Fast travel map (M key): tuning, map frame and the landmarks you can fly to.
// Self-contained on purpose: the Interface can later replace this overlay with an expanded minimap.

// ---- Timing and feel ----
/** Fade + zoom when the map opens and closes (ms). */
export const OPEN_MS = 260
export const CLOSE_MS = 200
/** The map starts (and leaves) at this scale for the slight zoom. */
export const ZOOM_FROM = 0.94
/** Landmark icon scale on hover / keyboard focus. */
export const HOVER_SCALE = 1.2
/** Toggle key (KeyboardEvent.code). Esc also closes. */
export const TOGGLE_KEY = 'KeyM'

// ---- Map frame (degrees): the mainland and the Balearic Islands ----
export const MAP_BOUNDS = { west: -9.9, east: 4.75, south: 35.55, north: 44.05 }
/** Same equirectangular projection as the game (src/game/map/projection.ts): longitude measured at 40 N. */
const LON_SCALE = Math.cos((40 * Math.PI) / 180)
/** Countries drawn around Spain, grey like the unexplored world in the game. */
export const NEIGHBOURS = ['PRT', 'FRA', 'AND', 'MAR', 'DZA', 'GIB']
/** Only the big rivers (rank 1 in rivers.json). */
export const RIVER_RANK = 1

/** Map coordinates (viewBox units) of a lon/lat point. North up. */
export function project(lon: number, lat: number) {
  return { x: (lon - MAP_BOUNDS.west) * LON_SCALE, y: MAP_BOUNDS.north - lat }
}
export const MAP_WIDTH = (MAP_BOUNDS.east - MAP_BOUNDS.west) * LON_SCALE
export const MAP_HEIGHT = MAP_BOUNDS.north - MAP_BOUNDS.south

// ---- Landmarks you can fly to (ids from public/maps/countries/ESP/landmarks.json) ----
/** Icon drawn inside each landmark badge. */
export type Glyph = 'arch' | 'spires' | 'tower' | 'castle' | 'modern' | 'dome' | 'theatre' | 'houses' | 'plaza'

/**
 * Landmarks left off the travel map (they stay in the 3D world): Peñafiel Castle sits too close to
 * the Segovia and Burgos badges and is not a main destination.
 */
export const HIDDEN_FROM_MAP = new Set(['castillo-penafiel'])

export const TRAVEL_LANDMARKS: { id: string; glyph: Glyph }[] = ([
  { id: 'sagrada-familia', glyph: 'spires' },
  { id: 'alhambra', glyph: 'castle' },
  { id: 'acueducto-segovia', glyph: 'arch' },
  { id: 'guggenheim', glyph: 'modern' },
  { id: 'giralda', glyph: 'tower' },
  { id: 'mezquita-cordoba', glyph: 'dome' },
  { id: 'ciudad-artes', glyph: 'modern' },
  { id: 'puerta-de-alcala', glyph: 'arch' },
  { id: 'catedral-santiago', glyph: 'spires' },
  { id: 'torre-hercules', glyph: 'tower' },
  { id: 'castillo-penafiel', glyph: 'castle' }, // hidden: see HIDDEN_FROM_MAP
  { id: 'catedral-burgos', glyph: 'spires' },
  { id: 'teatro-merida', glyph: 'theatre' },
  { id: 'basilica-pilar', glyph: 'dome' },
  { id: 'casas-colgadas', glyph: 'houses' },
  { id: 'plaza-mayor-salamanca', glyph: 'plaza' },
] as { id: string; glyph: Glyph }[]).filter((l) => !HIDDEN_FROM_MAP.has(l.id))

/** SVG path data (24 x 24 box) of each glyph, filled with ink. Original simple shapes. */
export const GLYPHS: Record<Glyph, string> = {
  // Triumphal gate / aqueduct: a wall with three round arches
  arch: 'M2 7h20v3H2zM3 10h18v11h-4v-5a2 2 0 0 0-4 0v5h-2v-5a2 2 0 0 0-4 0v5H3z',
  // Cathedral: three pointed towers
  spires: 'M4 21V11l2-6 2 6v10zM10 21V8l2-6 2 6v13zM16 21V11l2-6 2 6v10zM3 21h18v1H3z',
  // Bell tower / lighthouse: one tall tower with a lantern
  tower: 'M9 22V9h6v13zM8 9l4-6 4 6zM10.5 12h3v3h-3z',
  // Castle: crenellated wall between two towers
  castle: 'M2 22V8h2v2h1V8h2v2h1V8h2v14zM14 22V8h2v2h1V8h2v2h1V8h2v14zM9 22v-7h6v7zM10 12h4v3h-4z',
  // Modern museum: swooping curved shells
  modern: 'M2 21c2-7 6-12 11-13-3 3-4 8-4 13zM10 21c1-6 4-10 9-11-2 3-2 7-2 11zM16 21c1-3 3-5 6-6v6z',
  // Dome on arcades
  dome: 'M5 12a7 7 0 0 1 14 0zM11 3h2v3h-2zM4 13h16v2H4zM5 15h3v6H5zM10.5 15h3v6h-3zM16 15h3v6h-3z',
  // Roman theatre: half ring of seats with columns behind
  theatre: 'M2 20a10 10 0 0 1 20 0h-4a6 6 0 0 0-12 0zM5 7h2v7H5zM11 5h2v7h-2zM17 7h2v7h-2zM4 6h16v1H4z',
  // Hanging houses on a cliff edge
  houses: 'M2 22V9l5-4 5 4v13zM12 14V9l4-3 4 3v5zM5 12h3v3H5zM14 10h3v2h-3zM12 14h10v8H12z',
  // Plaza mayor: arcaded square with a central clock tower
  plaza: 'M2 11h20v11H2zM10 6h4v5h-4zM11 3h2v3h-2zM4 15h3v7H4zM10.5 15h3v7h-3zM17 15h3v7h-3z',
}
