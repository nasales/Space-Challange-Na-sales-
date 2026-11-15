// Malla del mundo entero "sin explorar": relieve gris y suave, sin escalones.
// Debajo del país explorado se aplana, para que no asome a través de la maqueta.
import * as THREE from 'three'
import type { WorldData } from '../map/worldData'
import type { Bounds } from '../map/mapData'
import type { Country } from '../map/worldData'
import { rasterizeCountry } from '../map/rasterizeCountry'
import { lonLatToWorld, metersToY, UNITS_PER_DEG_LAT, UNITS_PER_DEG_LON, WORLD_SEA_Y } from '../map/projection'

/** Relieve del mundo gris: bastante menos exagerado que el del país explorado. */
export const WORLD_EXAGGERATION = 2 // halved with the 2x map so the grey world keeps its relief

/**
 * @param explored país explorado y zonas que cubren sus maquetas: ahí se aplana el mundo
 */
export function createWorldTerrain(
  world: WorldData,
  texture: THREE.Texture,
  explored: { country: Country; zones: Bounds[] },
): THREE.Mesh {
  const { bounds, heights, gridWidth: gw, gridHeight: gh } = world
  const width = (bounds.east - bounds.west) * UNITS_PER_DEG_LON
  const depth = (bounds.north - bounds.south) * UNITS_PER_DEG_LAT

  // Celdas del mundo que caen dentro del país explorado (y dentro de alguna de sus maquetas)
  const inCountry = rasterizeCountry(explored.country, bounds, gw, gh)
  const flatten = (col: number, row: number) => {
    const lon = bounds.west + (col / (gw - 1)) * (bounds.east - bounds.west)
    const lat = bounds.north - (row / (gh - 1)) * (bounds.north - bounds.south)
    const inZone = explored.zones.some(
      (z) => lon >= z.west && lon <= z.east && lat >= z.south && lat <= z.north,
    )
    if (!inZone) return false
    // también las celdas vecinas, para que el mundo gris no asome por los bordes
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const r = row + dy, c = col + dx
        if (r >= 0 && r < gh && c >= 0 && c < gw && inCountry[r * gw + c]) return true
      }
    return false
  }

  const geometry = new THREE.PlaneGeometry(width, depth, gw - 1, gh - 1)
  geometry.rotateX(-Math.PI / 2)
  const pos = geometry.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const col = i % gw, row = Math.floor(i / gw)
    const h = heights[i]
    const y = h <= 0 || flatten(col, row) ? WORLD_SEA_Y : WORLD_SEA_Y + metersToY(h + 100, WORLD_EXAGGERATION)
    pos.setY(i, y)
  }
  geometry.computeVertexNormals()

  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map: texture }))
  const center = lonLatToWorld((bounds.west + bounds.east) / 2, (bounds.north + bounds.south) / 2)
  mesh.position.set(center.x, 0, center.z)
  return mesh
}
