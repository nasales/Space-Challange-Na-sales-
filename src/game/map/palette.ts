// Paleta de la maqueta de juguete: colores vivos y planos, un color por "piso" de altura.
export type RGB = [number, number, number]

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]

export const SEA = {
  deep: hex('#1E8FFF'), // azul eléctrico de cómic
  shallow: hex('#2EB8FF'),
  coast: hex('#7FE9FF'),
  foam: hex('#FFFFFF'),
}

export const SAND = hex('#FFEC6B')

// Un color por piso (mismo orden que TERRACE_LEVELS en terrace.ts).
// Tres versiones según la zona sea húmeda, intermedia o seca.
export const LEVEL_COLORS: Record<'wet' | 'mid' | 'dry', RGB[]> = {
  // Paleta de cómic para el suelo. La Meseta (pisos 2-4) en dorado de trigal; terracota solo en las
  // sierras, lavanda en la roca alta y nieve en las cumbres. Variado, pero sin ser chillón.
  wet: ['#4FE86A', '#3CDE63', '#2CD25F', '#22C25C', '#1CAE5A', '#C9806E', '#9C7FC4', '#F3EEFF', '#FFFFFF'].map(hex),
  mid: ['#B4F046', '#A0EA40', '#8DE03E', '#7AD440', '#6CC446', '#C9806E', '#9C7FC4', '#F3EEFF', '#FFFFFF'].map(hex),
  dry: ['#FAD978', '#F8D171', '#F6C96B', '#F3BE64', '#EBA95F', '#D98A68', '#9C7FC4', '#F3EEFF', '#FFFFFF'].map(hex),
}

/** Color de las manchas de "campos" en las llanuras, según la zona. */
export const FIELD_TINT: Record<'wet' | 'mid' | 'dry', RGB> = {
  wet: hex('#8CF77A'), // prados más claros
  mid: hex('#F2D86A'), // trigales
  dry: hex('#8FEA4E'), // regadíos verde chillón en mitad del secano
}

// Mundo sin explorar: grises suaves, como una maqueta todavía sin pintar.
export const UNEXPLORED = {
  land: hex('#C3C7CE'),
  sea: hex('#8E9BA8'),
  coast: hex('#5F6873'),
  border: hex('#EEF0F3'),
  wall: hex('#9AA0A8'),
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
