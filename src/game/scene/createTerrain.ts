// Malla 3D de una zona del país explorado en estilo maqueta: pisos planos de altura y colores vivos.
// Lo que queda fuera del país (y de su franja de mar) se hunde bajo el mundo gris.
//
// La malla se divide en TROZOS de 256x256 celdas: three.js solo dibuja los trozos que entran
// en cámara, y los trozos sin nada del país ni se crean. Así el detalle alto no pesa tanto.
import * as THREE from 'three'
import type { ZoneData } from '../map/mapData'
import type { Country } from '../map/worldData'
import { terraceHeight } from '../map/terrace'
import { computeExploredRegion, type ExploredRegion } from '../map/exploredRegion'
import { riverCarveDepth, FIELD_REACH_KM, type RiverClearing } from '../map/rivers'
import {
  lonLatToWorld,
  metersToY,
  UNITS_PER_DEG_LAT,
  UNITS_PER_DEG_LON,
  UNITS_PER_KM,
  HEIGHT_EXAGGERATION,
  SEA_Y,
  HIDDEN_Y,
  WORLD_SEA_Y,
} from '../map/projection'
import { WORLD_EXAGGERATION } from './createWorldTerrain'
import { createToonTerrainMaterial } from './createToonTerrainMaterial'

/** Cuánto exageramos las alturas (relieve muy marcado, estilo videojuego). */
export { HEIGHT_EXAGGERATION }
const CHUNK = 256

export interface Terrain {
  /** Grupo con todos los trozos de la malla. */
  group: THREE.Group
  /** Altura del suelo (unidades del mundo) en una posición x,z del mundo. */
  heightAt: (x: number, z: number) => number
  /** Altura real (suavizada) en metros, negativa en el mar. */
  metersAt: (x: number, z: number) => number
  /** true si x,z está dentro del país explorado (tierra). */
  isExploredLand: (x: number, z: number) => boolean
  /** true if (x, z) is on the shallow sea (coastal band or an enclosed sea up to the islands): crossed by boat (map/shallowSea.ts). */
  isFord: (x: number, z: number) => boolean
  /** true on land with real relief where rivers run: the country and the neighbouring land near it. */
  isRiverLand: (x: number, z: number) => boolean
  /** true if (x, z) is in a river or within `margin` world units of its water. */
  nearRiver: (x: number, z: number, margin: number) => boolean
  dispose: () => void
}

/**
 * @param heights alturas suavizadas (m), las mismas que usó la textura, para que encajen
 */
export function createTerrain(
  data: ZoneData,
  heights: Float32Array,
  country: Country,
  texture: THREE.Texture,
  /** Objects (monuments) whose ground the river channels must never carve. */
  keepDry: RiverClearing[] = [],
  /** The other countries of the world (see computeExploredRegion). */
  neighbours: Country[] = [],
  /** The explored region on this grid, if it was already computed (same heights). */
  explored?: ExploredRegion,
): Terrain {
  const { bounds, heightWidth: gw, heightHeight: gh } = data
  const width = (bounds.east - bounds.west) * UNITS_PER_DEG_LON
  const depth = (bounds.north - bounds.south) * UNITS_PER_DEG_LAT
  const cellsPerKm = gw / (width / UNITS_PER_KM)
  const { countryLand, region, ford, neighbourLand } =
    explored ?? computeExploredRegion(country, bounds, heights, gw, gh, cellsPerKm, neighbours)

  // Ground without the river beds
  const baseY = (i: number) => {
    if (!region[i]) return HIDDEN_Y
    const nb = neighbourLand[i]
    if (nb > 0) {
      // Neighbouring country: real terraced relief, blending into the low grey world far away
      // (same height formula as createWorldTerrain.ts, so the two meshes meet without a step)
      const toy = metersToY(terraceHeight(Math.max(heights[i], 1)), HEIGHT_EXAGGERATION)
      const grey = WORLD_SEA_Y + metersToY(heights[i] + 100, WORLD_EXAGGERATION) + 0.05
      return grey + (toy - grey) * nb
    }
    if (!countryLand[i]) return SEA_Y
    return metersToY(terraceHeight(Math.max(heights[i], 1)), HEIGHT_EXAGGERATION)
  }
  // River beds: a dip under the terraced surface, cut deeper where needed so the water only runs
  // downhill. Rivers also run a little way into the neighbouring land (its full-relief part)
  const riverLand = new Uint8Array(gw * gh)
  for (let i = 0; i < riverLand.length; i++) riverLand[i] = countryLand[i] || neighbourLand[i] > 0.99 ? 1 : 0
  const river = riverCarveDepth(data.rivers, bounds, gw, gh, cellsPerKm, riverLand, keepDry, (i) => (riverLand[i] ? baseY(i) : NaN))
  const carve = river?.carve
  const unitsPerCell = UNITS_PER_KM / cellsPerKm

  const cellY = (i: number) => {
    const y = baseY(i)
    return carve && carve[i] > 0 ? Math.max(y - carve[i], SEA_Y + 0.3) : y
  }

  // Esquina noroeste de la zona en el mundo
  const center = lonLatToWorld((bounds.west + bounds.east) / 2, (bounds.north + bounds.south) / 2)
  const west = center.x - width / 2, north = center.z - depth / 2

  // Sombreado de dibujos animados (cel) y acantilados pintados: ver createToonTerrainMaterial
  const { material, dispose: disposeMaterial } = createToonTerrainMaterial(texture)
  const group = new THREE.Group()

  for (let r0 = 0; r0 < gh - 1; r0 += CHUNK) {
    for (let c0 = 0; c0 < gw - 1; c0 += CHUNK) {
      const r1 = Math.min(r0 + CHUNK, gh - 1), c1 = Math.min(c0 + CHUNK, gw - 1)
      const nx = c1 - c0 + 1, nz = r1 - r0 + 1

      // ¿Hay algo visible en este trozo? Si no, ni lo creamos
      let visible = false
      for (let r = r0; r <= r1 && !visible; r++)
        for (let c = c0; c <= c1; c++) if (region[r * gw + c]) { visible = true; break }
      if (!visible) continue

      const positions = new Float32Array(nx * nz * 3)
      const uvs = new Float32Array(nx * nz * 2)
      for (let r = r0, k = 0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++, k++) {
          positions[k * 3] = west + (c / (gw - 1)) * width
          positions[k * 3 + 1] = cellY(r * gw + c)
          positions[k * 3 + 2] = north + (r / (gh - 1)) * depth
          uvs[k * 2] = c / (gw - 1)
          uvs[k * 2 + 1] = 1 - r / (gh - 1)
        }
      }
      // Dos triángulos por celda, orientados hacia arriba
      const index = new Uint32Array((nx - 1) * (nz - 1) * 6)
      for (let z = 0, k = 0; z < nz - 1; z++) {
        for (let x = 0; x < nx - 1; x++) {
          const a = z * nx + x, b = a + nx, c = b + 1, d = a + 1
          index.set([a, b, d, b, c, d], k)
          k += 6
        }
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
      geometry.setIndex(new THREE.BufferAttribute(index, 1))
      geometry.computeVertexNormals() // necesarias para que las sombras no hagan "rayas"

      const chunk = new THREE.Mesh(geometry, material)
      chunk.castShadow = chunk.receiveShadow = true // las montañas dan sombra
      group.add(chunk)
    }
  }

  // Posición del mundo → celda de la rejilla
  const cell = (x: number, z: number) => {
    const gx = Math.min(gw - 1.001, Math.max(0, ((x - west) / width) * (gw - 1)))
    const gz = Math.min(gh - 1.001, Math.max(0, ((z - north) / depth) * (gh - 1)))
    const x0 = Math.floor(gx), z0 = Math.floor(gz)
    return { i: z0 * gw + x0, tx: gx - x0, tz: gz - z0 }
  }
  const bilinear = (f: (i: number) => number, x: number, z: number) => {
    const { i, tx, tz } = cell(x, z)
    return (
      f(i) * (1 - tx) * (1 - tz) +
      f(i + 1) * tx * (1 - tz) +
      f(i + gw) * (1 - tx) * tz +
      f(i + gw + 1) * tx * tz
    )
  }

  return {
    group,
    heightAt: (x, z) => bilinear(cellY, x, z), // igual que la malla
    metersAt: (x, z) => bilinear((i) => heights[i], x, z),
    isExploredLand: (x, z) => {
      const { i, tx, tz } = cell(x, z)
      return countryLand[i + (tx > 0.5 ? 1 : 0) + (tz > 0.5 ? gw : 0)] === 1
    },
    isRiverLand: (x, z) => {
      const { i, tx, tz } = cell(x, z)
      return riverLand[i + (tx > 0.5 ? 1 : 0) + (tz > 0.5 ? gw : 0)] === 1
    },
    isFord: (x, z) => {
      const { i, tx, tz } = cell(x, z)
      return ford[i + (tx > 0.5 ? 1 : 0) + (tz > 0.5 ? gw : 0)] === 1
    },
    nearRiver: (x, z, margin) => {
      if (!river) return false
      const { edge } = river
      // edge is +Infinity beyond the field reach: clamp there so the bilinear blend stays a distance
      // (margins must be smaller than the reach, ~32 units)
      const reach = FIELD_REACH_KM * cellsPerKm
      return bilinear((i) => Math.min(edge[i], reach), x, z) * unitsPerCell <= margin
    },
    dispose: () => {
      for (const chunk of group.children) (chunk as THREE.Mesh).geometry.dispose()
      disposeMaterial()
    },
  }
}
