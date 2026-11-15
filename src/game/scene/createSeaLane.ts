// Water of the sea to the Canary Islands (map/canarySeaLane.ts) in the open gap between the
// mainland zone and the Canary Islands box, where no zone mesh exists. A flat sheet at sea level,
// coloured like the zone seas (shallow water inside, a band of deeper blue around it) and drawn with
// the zones' own toon material, so the two meet without a seam in any light (day/night cycle).
// It sinks under the African coast of the grey world, which draws a smooth shore. Inside the zones the sea is drawn by the zone
// meshes themselves, so the sheet stops at their edges.
import * as THREE from 'three'
import type { Bounds } from '../map/mapData'
import { laneKm, laneLandHeight, LANE_BOUNDS, LANE_SEA_KM } from '../map/canarySeaLane'
import { SEA_Y, WORLD_SEA_Y, UNITS_PER_DEG_LAT, UNITS_PER_DEG_LON, UNITS_PER_KM } from '../map/projection'
import { SEA, mix, smooth } from '../map/palette'
import { createToonTerrainMaterial } from './createToonTerrainMaterial'

/** Grid step of the sheet (km). */
const STEP_KM = 1
/** The sheet goes this far (degrees) into each zone, under its edge, so no crack shows. */
const OVERLAP_DEG = 0.03
/**
 * Smooth shores: instead of cutting the sheet on its 1 km grid (a staircase), it sinks gently under
 * the African land (per metre of land height) and under the open ocean past its coloured band (per
 * km), and the depth test draws the shore where it goes under: a smooth line, like a contour.
 */
const DIP_PER_LAND_M = (SEA_Y - WORLD_SEA_Y) / 15 // under the grey world's sea level by 15 m of land
const DIP_PER_SEA_KM = (SEA_Y - WORLD_SEA_Y) / 0.8 // under it 0.8 km past the coloured band
/** Margin (km) past the coloured band, and land height (m), beyond which no cell is built. */
const EDGE_KM = 1.5
const MAX_LAND_M = 40

/** @param zones display bounds of the zone meshes (the sheet is left out inside them) */
export function createSeaLane(zones: Bounds[]): { mesh: THREE.Mesh; dispose: () => void } {
  const kmLon = UNITS_PER_DEG_LON / UNITS_PER_KM, kmLat = UNITS_PER_DEG_LAT / UNITS_PER_KM
  const nx = Math.ceil(((LANE_BOUNDS.east - LANE_BOUNDS.west) * kmLon) / STEP_KM) + 1
  const nz = Math.ceil(((LANE_BOUNDS.north - LANE_BOUNDS.south) * kmLat) / STEP_KM) + 1
  const inZone = (lon: number, lat: number) =>
    zones.some((b) => lon > b.west + OVERLAP_DEG && lon < b.east - OVERLAP_DEG && lat > b.south + OVERLAP_DEG && lat < b.north - OVERLAP_DEG)

  const positions = new Float32Array(nx * nz * 3)
  const colors = new Float32Array(nx * nz * 3)
  const wet = new Uint8Array(nx * nz) // vertex near enough to the lane's sea, outside every zone
  const normals = new Float32Array(nx * nz * 3) // all straight up: the sheet shades flat, like the zone seas
  const col = new THREE.Color()
  for (let r = 0, k = 0; r < nz; r++) {
    const lat = LANE_BOUNDS.north - (r * STEP_KM) / kmLat
    for (let c = 0; c < nx; c++, k++) {
      const lon = LANE_BOUNDS.west + (c * STEP_KM) / kmLon
      const km = laneKm(lon, lat)
      const land = laneLandHeight(lon, lat)
      wet[k] = km < LANE_SEA_KM + EDGE_KM && land < MAX_LAND_M && !inZone(lon, lat) ? 1 : 0
      const dip = Math.max(0, land) * DIP_PER_LAND_M + Math.max(0, km - LANE_SEA_KM) * DIP_PER_SEA_KM
      positions[k * 3] = lon * UNITS_PER_DEG_LON
      positions[k * 3 + 1] = SEA_Y - 0.05 - dip // a hair under the zone seas where they overlap
      positions[k * 3 + 2] = -lat * UNITS_PER_DEG_LAT
      const rgb = mix(SEA.ford, SEA.deep, smooth(-1, 0.4, km)) // same gradient as the zone seas
      col.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace)
      colors.set([col.r, col.g, col.b], k * 3)
      normals[k * 3 + 1] = 1
    }
  }
  // Cells with at least one corner near the sea (the sunk ones end under the world, out of sight)
  const index: number[] = []
  for (let r = 0; r < nz - 1; r++) {
    for (let c = 0; c < nx - 1; c++) {
      const a = r * nx + c, b = a + nx, cc = b + 1, d = a + 1
      if (!(wet[a] || wet[b] || wet[cc] || wet[d])) continue
      index.push(a, b, d, b, cc, d)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setIndex(index)
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  const { material, dispose: disposeMaterial } = createToonTerrainMaterial(null)
  material.vertexColors = true
  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  return {
    mesh,
    dispose: () => {
      geometry.dispose()
      disposeMaterial()
    },
  }
}
