// Paleta de la maqueta de juguete: colores vivos y planos, un color por "piso" de altura.
export type RGB = [number, number, number]

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]

// Note: the final screen pass (createInkOutline) adds saturation, so these base colours are a bit
// calmer than the final look. Pick them as "clean toy paint", not neon.
export const SEA = {
  deep: hex('#2A7FE8'), // clear toy blue
  shallow: hex('#36A6F2'),
  coast: hex('#7FDDF7'),
  foam: hex('#FFFFFF'),
  ford: hex('#A9E9FA'), // shallow sea where the boat can go (shallowSea.ts): the lightest water, so it reads as open to the player
}

export const SAND = hex('#FFE48A')

// One colour per terrace level (same order as TERRACE_LEVELS in terrace.ts), in three versions
// for wet, intermediate and dry zones. Levels 0-4 are a clear 5-step ramp per zone (light lowlands
// -> deeper uplands) so the relief reads as clean bands; level 5 is terracotta sierra, 6 lavender
// rock, 7-8 snow.
export const LEVEL_COLORS: Record<'wet' | 'mid' | 'dry', RGB[]> = {
  wet: ['#7EDC5C', '#64D153', '#4CC34C', '#3AB249', '#2DA046', '#E58C66', '#A98AE6', '#F1ECFF', '#FFFFFF'].map(hex),
  mid: ['#C2E05C', '#AAD653', '#92C94C', '#7CBA47', '#68A843', '#E58C66', '#A98AE6', '#F1ECFF', '#FFFFFF'].map(hex),
  dry: ['#FFDF78', '#F8D268', '#EEC75E', '#E8C25A', '#DAB352', '#DB7F5C', '#A98AE6', '#F1ECFF', '#FFFFFF'].map(hex),
}

/** Colour of the "field" patches in the plains: a lighter shade of the same zone hue. */
export const FIELD_TINT: Record<'wet' | 'mid' | 'dry', RGB> = {
  wet: hex('#A8EE78'), // light meadows
  mid: hex('#DCEB72'), // young wheat
  dry: hex('#FFEA9A'), // pale stubble fields
}

// Unexplored world: soft blue "paper map" tones, clearly not playable but not dull grey.
export const UNEXPLORED = {
  land: hex('#E0E8F3'),
  sea: hex('#A8C2E2'),
  coast: hex('#7E92B0'),
  border: hex('#FFFFFF'),
  wall: hex('#B5C3D8'),
}


export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

export const scale = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k]

export const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
