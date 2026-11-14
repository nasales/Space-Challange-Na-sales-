// Cómo se pasa de longitud/latitud (y metros de altura) a coordenadas del mundo 3D.
// Todo el juego usa estas funciones, así el mundo gris y los países explorados encajan.
//
// Proyección equirectangular: el mundo es un plano. Para que España no salga estirada,
// los grados de longitud se miden como en la latitud 40º (la de España).
// Norte = -Z, Este = +X, arriba = +Y.

/** Escala del mundo: unidades 3D por kilómetro real. Más grande = más que explorar. */
export const UNITS_PER_KM = 8 // was 4: the map is twice as big to explore

const REF_LAT = 40
const KM_PER_DEG_LON = 111.32 * Math.cos((REF_LAT * Math.PI) / 180)
const KM_PER_DEG_LAT = 110.57

export const UNITS_PER_DEG_LON = KM_PER_DEG_LON * UNITS_PER_KM
export const UNITS_PER_DEG_LAT = KM_PER_DEG_LAT * UNITS_PER_KM

export function lonLatToWorld(lon: number, lat: number) {
  return { x: lon * UNITS_PER_DEG_LON, z: -lat * UNITS_PER_DEG_LAT }
}

export function worldToLonLat(x: number, z: number) {
  return { lon: x / UNITS_PER_DEG_LON, lat: -z / UNITS_PER_DEG_LAT }
}

/** Metros reales → altura en el mundo, con una exageración del relieve. */
export function metersToY(meters: number, exaggeration: number) {
  return (meters / 1000) * exaggeration * UNITS_PER_KM
}

/**
 * Relief exaggeration of the explored countries. Lower than before (12 at 4 units/km) so that, on
 * the twice-as-big map, slopes are much gentler while keeping the toy-terrace look.
 */
export const HEIGHT_EXAGGERATION = 5

/** Nivel del mar de los países explorados (un poco hundido: la costa forma escalón). */
export const SEA_Y = metersToY(-25, HEIGHT_EXAGGERATION)
/** Nivel del mar del mundo sin explorar: algo más bajo, para que no "parpadee" con el otro. */
export const WORLD_SEA_Y = SEA_Y - 0.4 * UNITS_PER_KM
/** Donde se esconden las partes de una malla que no se deben ver (bajo el suelo del mundo). */
export const HIDDEN_Y = WORLD_SEA_Y - 5 * UNITS_PER_KM
