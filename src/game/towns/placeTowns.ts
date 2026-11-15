// Dónde va cada casa: a partir de las poblaciones reales (places.json) calcula una lista de casas.
// - Cuanta más población, más casas (con logaritmo: Madrid no tiene mil veces más que un pueblo).
// - Houses stand in a street grid of small blocks (2 x 2 terraced houses facing the street, or
//   one big building), filled from the centre out, with FIXED randomness (one seed per place):
//   the map always comes out the same.
// - Se descartan las que caen en el mar, en pendientes fuertes o junto a un monumento.
import type { Place } from '../map/mapData'
import { lonLatToWorld } from '../map/projection'

/**
 * Regional house look: south = whitewashed walls and terracotta roofs (Andalucía, Extremadura,
 * Canarias); north = stone and dark slate (Cantabrian coast); castile = ochre adobe and brick
 * (the Meseta, Aragón, La Rioja); levante = warm cream walls, orange tile, green shutters
 * (Mediterranean coast and Baleares).
 */
export type TownStyle = 'south' | 'north' | 'castile' | 'levante'
/** 0 casa baja, 1 casa de dos alturas, 2 casa alargada, 3 iglesia, 4 bloque de pisos, 5 torre, 6 hórreo (granary on stilts) */
export type HouseVariant = 0 | 1 | 2 | 3 | 4 | 5 | 6

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
  /** true if (x, z) is on a road or within `margin` units of its edge (optional: no roads) */
  nearRoad?: (x: number, z: number, margin: number) => boolean
}

/** Gap (world units) between a house footprint and river water. */
const RIVER_CLEARANCE = 6
/** Gap (world units) between a house footprint and a road edge (a pavement, so towns line the road). */
const ROAD_CLEARANCE = 2.5

/** Regiones con casas de piedra y tejado de pizarra. */
const NORTH = new Set(['Galicia', 'Asturias', 'Cantabria', 'País Vasco', 'Navarra'])
/** Inland regions with ochre adobe and brick villages. */
const CASTILE = new Set(['Castilla y León', 'Castilla-La Mancha', 'Comunidad de Madrid', 'Aragón', 'La Rioja'])
/** Mediterranean regions with cream walls, orange tile and green shutters. */
const LEVANTE = new Set(['Cataluña', 'Comunidad Valenciana', 'Región de Murcia', 'Islas Baleares'])
/** Regions whose villages have hórreos (raised granaries) among the houses. */
const HORREO_REGIONS = new Set(['Galicia', 'Asturias'])
/** Share of the small houses that become a hórreo in those regions (villages only). */
const HORREO_SHARE = 0.18
/** Towns above this population get no hórreos (they are a village thing). */
const HORREO_MAX_POP = 40000

/** House style of a region (south is the default: whitewash and terracotta). */
export const styleOf = (region: string): TownStyle =>
  NORTH.has(region) ? 'north' : CASTILE.has(region) ? 'castile' : LEVANTE.has(region) ? 'levante' : 'south'
/**
 * Street grid of a town (world units): houses stand HOUSE_PITCH apart in 2 x 2 blocks (terraced,
 * as in Spanish towns) and the blocks are BLOCK apart, which leaves a street of about
 * BLOCK - 2 * HOUSE_PITCH between them. From above: rows of roofs with clear streets.
 */
const HOUSE_PITCH = 14
const BLOCK = 38
/** Villages under this population get a slightly irregular grid and some empty garden plots. */
const LOOSE_POP = 20000
const GARDEN_SHARE = 0.15
/** Radio de una casa normal (para pendientes y choques). */
const HOUSE_RADIUS = 6
/** Hueco mínimo entre casas de dos poblaciones distintas (la "calle"). */
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
  // (p. ej. los de alrededor de Madrid) no ponen casas encima de las suyas. Inside one town the
  // block grid already spaces the houses, so only houses of OTHER towns need the street gap.
  const CELL = 40
  const taken = new Map<string, { h: HouseSpot; town: number }[]>()
  const occupied = (x: number, z: number, r: number, town: number) => {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL)
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const { h, town: t } of taken.get(`${cx + i},${cz + j}`) ?? [])
          if ((h.x - x) ** 2 + (h.z - z) ** 2 < (h.radius + r + (t === town ? 0 : STREET)) ** 2) return true
    return false
  }
  const take = (h: HouseSpot, town: number) => {
    const key = `${Math.floor(h.x / CELL)},${Math.floor(h.z / CELL)}`
    if (!taken.has(key)) taken.set(key, [])
    taken.get(key)!.push({ h, town })
  }
  for (const [index, place] of places.entries()) {
    const rand = seeded(index * 7919 + 17)
    const center = lonLatToWorld(place.lon, place.lat)
    const style = styleOf(place.region)
    const horreos = HORREO_REGIONS.has(place.region) && place.pop < HORREO_MAX_POP
    const wanted = housesFor(place.pop)
    const gridRot = rand() * Math.PI // cada pueblo con su propia orientación de calles
    const cos = Math.cos(gridRot), sin = Math.sin(gridRot)
    // Villages are a little irregular; towns and cities keep a neat grid
    const loose = place.pop < LOOSE_POP ? 1 : 0
    const blocks = Math.ceil(wanted / 3) + 1
    let placed = 0
    let tries = 0

    /** Tries to place one house or building at grid position (gx, gz); true if it was placed. */
    const tryPlace = (gx: number, gz: number, variant: HouseVariant, radius: number, rot: number, scale: number) => {
      const x = center.x + gx * cos - gz * sin
      const z = center.z + gx * sin + gz * cos
      if (!ground.isLand(x, z) || ground.landmarkDistance(x, z) < LANDMARK_CLEARANCE) return false
      if (occupied(x, z, radius, index)) return false // ya hay una casa (p. ej. de un pueblo vecino) en ese sitio
      // Toda la planta en tierra y sin pendiente fuerte (centro + cuatro puntos alrededor)
      const pts = [[0, 0], [radius, 0], [-radius, 0], [0, radius], [0, -radius]].map(([dx, dz]) => [x + dx, z + dz])
      if (!pts.every(([px, pz]) => ground.isLand(px, pz))) return false
      if (ground.nearRiver(x, z, radius * Math.SQRT2 + RIVER_CLEARANCE)) return false // whole square footprint dry
      if (ground.nearRoad?.(x, z, radius * Math.SQRT2 + ROAD_CLEARANCE)) {
        tries-- // never on a road; a spot taken by the road does not use up the town's attempts
        return false
      }
      const hs = pts.map(([px, pz]) => ground.heightAt(px, pz))
      if (Math.max(...hs) - Math.min(...hs) > MAX_SLOPE) return false
      const house: HouseSpot = { x, z, y: Math.min(...hs), rot, scale, style, variant, radius }
      houses.push(house)
      take(house, index)
      placed++
      return true
    }

    // Blocks of the street grid, from the centre out. Each block holds one big building (church,
    // block of flats, tower) or up to four houses in a 2 x 2 square, each facing the street on its
    // side of the block, so from above the town reads as roofs in rows with streets between them.
    for (const [bi, bj] of spiralCells(blocks)) {
      if (placed >= wanted || tries > wanted * 3) break
      const bx = bi * BLOCK + (rand() - 0.5) * 3 * loose
      const bz = bj * BLOCK + (rand() - 0.5) * 3 * loose
      const centerDist = Math.sqrt(bi * bi + bj * bj) / Math.sqrt(blocks)
      const church = placed === 0 && place.pop >= CHURCH_POP
      if (church) {
        tries++
        tryPlace(bx, bz, 3, HOUSE_RADIUS * 1.8, gridRot + Math.floor(rand() * 4) * (Math.PI / 2), 1)
        continue // the church stands alone in its block: the plaza
      }
      // Centro de las ciudades: bloques de pisos (y alguna torre en las grandes)
      if (place.pop >= BLOCKS_POP && centerDist < 0.75) {
        tries++
        const building: HouseVariant = place.pop >= TOWER_POP && centerDist < 0.35 && rand() < 0.5 ? 5 : 4
        tryPlace(bx, bz, building, HOUSE_RADIUS * BUILDING_RADIUS, gridRot + Math.floor(rand() * 4) * (Math.PI / 2), 0.95 + rand() * 0.1)
        continue
      }
      for (const sz of [-1, 1]) {
        let rowTaken = false // a long house fills the whole row of the block
        for (const sx of [-1, 1]) {
          if (placed >= wanted || rowTaken) break
          tries++
          // Gardens: villages leave some plots empty at the edge of town
          if (loose && centerDist > 0.5 && rand() < GARDEN_SHARE) continue
          // Variante (en las ciudades, más casas de dos alturas)
          const tall = place.pop > 30000 && centerDist < 0.6 ? 0.7 : 0.25
          const r = rand()
          let variant: HouseVariant = r < tall ? 1 : r < tall + 0.25 ? 2 : 0
          if (variant === 2 && sx === 1) variant = 0 // the row partner is already there
          // Galician / Asturian villages: some low houses are hórreos (fixed seed, as always)
          if (horreos && variant !== 1 && placed > 0 && rand() < HORREO_SHARE) variant = 6
          const gx = bx + (variant === 2 ? 0 : sx * HOUSE_PITCH / 2) + (rand() - 0.5) * 1.5 * loose
          const gz = bz + sz * HOUSE_PITCH / 2 + (rand() - 0.5) * 1.5 * loose
          // Front (+Z of the model) towards the street on this side of the block
          const rot = gridRot + (sz > 0 ? 0 : Math.PI) + (rand() - 0.5) * 0.12 * loose
          const ok = tryPlace(gx, gz, variant, HOUSE_RADIUS, rot, 0.92 + rand() * 0.08)
          if (ok && variant === 2) rowTaken = true
        }
      }
    }
  }
  return houses
}
