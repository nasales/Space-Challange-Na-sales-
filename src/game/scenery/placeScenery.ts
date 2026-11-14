// Dónde va cada elemento del paisaje (olivos, viñas, pinos, molinos...), según scenery.json.
// - Cada región dice qué plantar, en qué cajas lat/lon, cada cuánto y entre qué alturas.
// - Se recorre una rejilla dentro de cada caja (girada, para que las filas no vayan siempre
//   norte-sur) y un ruido suave decide qué trozos tienen plantación: salen manchas, no un tapiz.
// - El azar es FIJO (semilla por región): el paisaje sale siempre igual.
// - Se descartan los puntos en el mar, en las paredes de los pisos, junto a casas o monumentos.
import { fractalNoise } from '../map/valueNoise'
import { lonLatToWorld } from '../map/projection'

export type SceneryKind = 'olive' | 'vine' | 'pine' | 'broadleaf' | 'holmoak' | 'palm' | 'windmill'

export interface SceneryBox {
  south: number
  north: number
  west: number
  east: number
}

export interface SceneryRegion {
  id: string
  kinds: SceneryKind[]
  boxes: SceneryBox[]
  /** separación entre elementos (unidades del mundo) */
  spacing: number
  /** rows = en filas (olivar, viñedo); scatter = disperso (bosque, dehesa) */
  layout?: 'rows' | 'scatter'
  /** largo de cada fila de viña (unidades); si no, igual que spacing */
  rowLength?: number
  /** parte del terreno con plantación (0-1) */
  cover?: number
  minMeters?: number
  maxMeters?: number
  /** highest = solo los `count` puntos más altos, separados `minGap` (molinos en los cerros) */
  pick?: 'highest'
  count?: number
  minGap?: number
}

export interface SceneryItem {
  kind: SceneryKind
  x: number
  z: number
  /** altura del suelo donde se apoya */
  y: number
  rot: number
  scale: number
}

export interface SceneryGround {
  heightAt: (x: number, z: number) => number
  /** altura real en metros */
  metersAt: (x: number, z: number) => number
  isLand: (x: number, z: number) => boolean
  /** ¿hay una casa a menos de `margin` de (x, z)? */
  nearHouse: (x: number, z: number, margin: number) => boolean
  landmarkDistance: (x: number, z: number) => number
  /** true if (x, z) is in a river or within `margin` units of its water */
  nearRiver: (x: number, z: number, margin: number) => boolean
  /** true if (x, z) is on a road or within `margin` units of its edge (optional: no roads) */
  nearRoad?: (x: number, z: number, margin: number) => boolean
}

/** Radio de cada elemento (para pendientes y distancias a las casas). */
export const KIND_RADIUS: Record<SceneryKind, number> = {
  olive: 3, vine: 6, pine: 3, broadleaf: 4, holmoak: 5, palm: 2.5, windmill: 5,
}
/** Tamaño de las manchas de plantación (unidades del mundo). */
const PATCH = 220 // was 110: patches keep their real size on the twice-as-big map
/**
 * Multiplies the spacing in scenery.json. The boxes are lat/lon, so on the twice-as-big map the
 * same spacing gave 4x the trees (and 4x the start-up loop); this keeps the count reasonable.
 */
const SPACING_FACTOR = 1.6
/** Diferencia de altura máxima bajo un elemento: más, y está en una pared de piso. */
const MAX_SLOPE = 2
/** Distancia mínima a un monumento. */
const LANDMARK_CLEARANCE = 70

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

/** Semilla a partir del nombre de la región. */
const seedOf = (id: string) => [...id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261)

export function placeScenery(regions: SceneryRegion[], ground: SceneryGround): SceneryItem[] {
  const items: SceneryItem[] = []
  for (const region of regions) {
    const rand = seeded(seedOf(region.id))
    const rows = region.layout === 'rows'
    const spacing = region.spacing * SPACING_FACTOR
    const along = rows ? (region.rowLength ?? region.spacing) * SPACING_FACTOR : spacing // separación a lo largo de la fila
    const across = spacing // separación entre filas
    const angle = rand() * Math.PI // dirección de las filas de esta región
    const cos = Math.cos(angle), sin = Math.sin(angle)
    const cover = region.cover ?? 1
    const noiseOffset = rand() * 1000
    const candidates: (SceneryItem & { meters: number })[] = []

    for (const b of region.boxes) {
      const nw = lonLatToWorld(b.west, b.north), se = lonLatToWorld(b.east, b.south)
      const cx = (nw.x + se.x) / 2, cz = (nw.z + se.z) / 2
      const half = Math.hypot(se.x - nw.x, se.z - nw.z) / 2 // la rejilla girada tiene que cubrir toda la caja
      for (let u = -half; u <= half; u += along) {
        for (let v = -half; v <= half; v += across) {
          const jitter = rows ? 1 : spacing * 0.8
          const lu = u + (rand() - 0.5) * jitter
          const lv = v + (rand() - 0.5) * jitter
          const x = cx + lu * cos - lv * sin
          const z = cz + lu * sin + lv * cos
          if (x < nw.x || x > se.x || z < nw.z || z > se.z) continue // fuera de la caja
          // Manchas: el ruido suave decide si este trozo tiene plantación
          if (fractalNoise(x / PATCH + noiseOffset, z / PATCH) < 1 - cover) continue
          const kind = region.kinds[Math.floor(rand() * region.kinds.length)]
          const r = KIND_RADIUS[kind]
          if (!ground.isLand(x, z)) continue
          const meters = ground.metersAt(x, z)
          if (region.minMeters !== undefined && meters < region.minMeters) continue
          if (region.maxMeters !== undefined && meters > region.maxMeters) continue
          if (ground.landmarkDistance(x, z) < LANDMARK_CLEARANCE) continue
          if (ground.nearRiver(x, z, r + 2)) continue // no trees in the water or on the bank
          if (ground.nearRoad?.(x, z, r + (kind === 'windmill' ? 4 : 1.5))) continue // nor on a road
          if (ground.nearHouse(x, z, r + (kind === 'windmill' ? 8 : 3))) continue // los molinos, con un poco más de sitio
          const hs = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].map(([dx, dz]) => ground.heightAt(x + dx, z + dz))
          if (Math.max(...hs) - Math.min(...hs) > MAX_SLOPE) continue
          candidates.push({
            kind, x, z, meters,
            y: Math.min(...hs),
            // En filas, todos mirando igual; sueltos, cada uno a su aire
            rot: rows ? -angle : rand() * Math.PI * 2,
            scale: 0.85 + rand() * 0.35,
          })
        }
      }
    }

    if (region.pick === 'highest') {
      // Los más altos primero, sin que dos queden más cerca que minGap
      const gap = region.minGap ?? 40
      const chosen: SceneryItem[] = []
      candidates.sort((a, b) => b.meters - a.meters)
      for (const c of candidates) {
        if (chosen.length >= (region.count ?? 10)) break
        if (chosen.every((o) => (o.x - c.x) ** 2 + (o.z - c.z) ** 2 > gap * gap)) chosen.push(c)
      }
      items.push(...chosen)
    } else {
      items.push(...candidates)
    }
  }
  return items
}

/** Carga scenery.json del país (si no existe, no hay paisaje). */
export async function loadScenery(countryId: string): Promise<SceneryRegion[]> {
  const res = await fetch(`/maps/countries/${countryId}/scenery.json`)
  if (!res.ok) return []
  return (await res.json()).regions
}
