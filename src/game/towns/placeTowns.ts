// Dónde va cada casa: a partir de las poblaciones reales (places.json) calcula una lista de casas.
// - Cuanta más población, más casas (con logaritmo: Madrid no tiene mil veces más que un pueblo).
// - Las casas se reparten en una rejilla alrededor del centro, de dentro hacia fuera, con algo de
//   azar FIJO (semilla por población): el mapa sale siempre igual.
// - Se descartan las que caen en el mar, en pendientes fuertes o junto a un monumento.
import type { Place } from '../map/mapData'
import { lonLatToWorld } from '../map/projection'

export type TownStyle = 'south' | 'north'
/** 0 casa baja, 1 casa de dos alturas, 2 casa alargada, 3 iglesia, 4 bloque de pisos, 5 torre */
export type HouseVariant = 0 | 1 | 2 | 3 | 4 | 5

export interface HouseSpot {
  x: number
  z: number
  /** altura del suelo donde se apoya */
  y: number
  /** giro (rad) */
  rot: number
  scale: number
  style: TownStyle
  variant: HouseVariant
  /** radio de la planta, para los choques */
  radius: number
}

export interface TownGround {
  heightAt: (x: number, z: number) => number
  isLand: (x: number, z: number) => boolean
  /** distancia al monumento más cercano (0 si está dentro) */
  landmarkDistance: (x: number, z: number) => number
  /** true if (x, z) is in a river or within `margin` units of its water */
  nearRiver: (x: number, z: number, margin: number) => boolean
}

/** Gap (world units) between a house footprint and river water. */
const RIVER_CLEARANCE = 6

/** Regiones con casas de piedra y tejado de pizarra. */
const NORTH = new Set(['Galicia', 'Asturias', 'Cantabria', 'País Vasco', 'Navarra'])
/** Separación entre casas en la rejilla del pueblo (unidades del mundo). */
const SPACING = 28
/** Radio de una casa normal (para pendientes y choques). */
const HOUSE_RADIUS = 6
/** Hueco mínimo entre dos casas (la "calle"). */
const STREET = 9
/** Diferencia de altura máxima bajo una casa: más, y es una ladera. */
const MAX_SLOPE = 3
/** Distancia mínima a un monumento (su plaza queda libre). */
const LANDMARK_CLEARANCE = 80
/** A partir de esta población hay iglesia con campanario en el centro. */
const CHURCH_POP = 12000
/** A partir de esta población el centro tiene bloques de pisos en vez de casas. */
const BLOCKS_POP = 50000
/** A partir de esta población, además, alguna torre alta. */
const TOWER_POP = 300000
/** Poblaciones más pequeñas que esto no tienen casa (salvo que la curva ya les dé alguna). */
const MIN_POP = 1500
/** Un edificio ocupa más que una casa: radio ×1,5. */
const BUILDING_RADIUS = 1.5

/** Generador de números aleatorios con semilla (siempre da la misma secuencia). */
function seeded(seed: number) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Número de casas de una población. */
export const housesFor = (pop: number) => {
  const n = Math.round(3 * (Math.log10(pop) - 3) ** 2)
  return n > 0 ? n : pop >= MIN_POP ? 1 : 0
}

/** Celdas de la rejilla ordenadas de la más cercana al centro a la más lejana. */
function spiralCells(count: number) {
  const r = Math.ceil(Math.sqrt(count) * 1.2) + 1
  const cells: [number, number][] = []
  for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) cells.push([i, j])
  return cells.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2))
}

export function placeTowns(places: Place[], ground: TownGround): HouseSpot[] {
  const houses: HouseSpot[] = []
  // Rejilla de ocupación común a todas las poblaciones: los pueblos pegados a una ciudad
  // (p. ej. los de alrededor de Madrid) no ponen casas encima de las suyas
  const CELL = 40
  const taken = new Map<string, HouseSpot[]>()
  const occupied = (x: number, z: number, r: number) => {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL)
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const h of taken.get(`${cx + i},${cz + j}`) ?? [])
          if ((h.x - x) ** 2 + (h.z - z) ** 2 < (h.radius + r + STREET) ** 2) return true
    return false
  }
  const take = (h: HouseSpot) => {
    const key = `${Math.floor(h.x / CELL)},${Math.floor(h.z / CELL)}`
    if (!taken.has(key)) taken.set(key, [])
    taken.get(key)!.push(h)
  }
  for (const [index, place] of places.entries()) {
    const rand = seeded(index * 7919 + 17)
    const center = lonLatToWorld(place.lon, place.lat)
    const style: TownStyle = NORTH.has(place.region) ? 'north' : 'south'
    const wanted = housesFor(place.pop)
    const gridRot = rand() * Math.PI // cada pueblo con su propia orientación de calles
    const cos = Math.cos(gridRot), sin = Math.sin(gridRot)
    let placed = 0
    let tries = 0
    for (const [i, j] of spiralCells(wanted)) {
      if (placed >= wanted || tries > wanted * 3) break
      tries++
      // Posición en la rejilla girada, con un poco de desorden (calles de pueblo, no de ciudad)
      const gx = i * SPACING + (rand() - 0.5) * 6
      const gz = j * SPACING + (rand() - 0.5) * 6
      const x = center.x + gx * cos - gz * sin
      const z = center.z + gx * sin + gz * cos
      const church = placed === 0 && place.pop >= CHURCH_POP
      // Centro de las ciudades: bloques de pisos (y alguna torre en las grandes)
      const centerDist = Math.sqrt(i * i + j * j) / Math.sqrt(wanted)
      let building: HouseVariant | null = null
      if (!church && place.pop >= BLOCKS_POP && centerDist < 0.75) {
        building = place.pop >= TOWER_POP && centerDist < 0.35 && rand() < 0.5 ? 5 : 4
      }
      const radius = church ? HOUSE_RADIUS * 1.8 : building !== null ? HOUSE_RADIUS * BUILDING_RADIUS : HOUSE_RADIUS
      if (!ground.isLand(x, z) || ground.landmarkDistance(x, z) < LANDMARK_CLEARANCE) continue
      if (occupied(x, z, radius)) continue // ya hay una casa (p. ej. de un pueblo vecino) en ese sitio
      // Toda la planta en tierra y sin pendiente fuerte (centro + cuatro puntos alrededor)
      const pts = [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]].map(([dx, dz]) => [x + dx, z + dz])
      if (!pts.every(([px, pz]) => ground.isLand(px, pz))) continue
      if (ground.nearRiver(x, z, radius * Math.SQRT2 + RIVER_CLEARANCE)) continue // whole square footprint dry
      const hs = pts.map(([px, pz]) => ground.heightAt(px, pz))
      if (Math.max(...hs) - Math.min(...hs) > MAX_SLOPE) continue

      // Variante: iglesia, edificio o una casa (en las ciudades, más casas de dos alturas)
      let variant: HouseVariant = church ? 3 : building ?? 0
      if (!church && building === null) {
        const tall = place.pop > 30000 && centerDist < 0.6 ? 0.7 : 0.25
        const r = rand()
        variant = r < tall ? 1 : r < tall + 0.25 ? 2 : 0
      }
      const house: HouseSpot = {
        x, z,
        y: Math.min(...hs),
        rot: gridRot + Math.floor(rand() * 4) * (Math.PI / 2) + (building !== null ? 0 : (rand() - 0.5) * 0.15),
        scale: 0.9 + rand() * 0.25,
        style, variant, radius,
      }
      houses.push(house)
      take(house)
      placed++
    }
  }
  return houses
}
