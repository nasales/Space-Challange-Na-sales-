// Water of the sea lane to the Canary Islands (map/canarySeaLane.ts) in the open gap between the
// mainland zone and the Canary Islands box, where no zone mesh exists. A flat strip at sea level,
// coloured like the zone seas (shallow water in the middle), sunk under the world outside the lane.
// Inside the zones the lane is drawn by the zone meshes themselves, so the strip stops at their edges.
import * as THREE from 'three'
import type { Bounds } from '../map/mapData'
import { laneKm, LANE_BOUNDS, LANE_SEA_KM } from '../map/canarySeaLane'
import { HIDDEN_Y, SEA_Y, UNITS_PER_DEG_LAT, UNITS_PER_DEG_LON, UNITS_PER_KM } from '../map/projection'
import { SEA, UNEXPLORED, mix, smooth } from '../map/palette'

/** Grid step of the strip (km). */
const STEP_KM = 1
/**
 * The strip is unlit, so it would look brighter than the lit, toon-shaded zone seas: its colours are
 * darkened by this factor to match them (measured on screen).
 */
const MATCH_ZONE_LIGHT = 0.89
/** The strip goes this far (degrees) into each zone, under its edge, so no crack shows. */
const OVERLAP_DEG = 0.03

/** @param zones display bounds of the zone meshes (the strip is left out inside them) */
export function createSeaLane(zones: Bounds[]): { mesh: THREE.Mesh; dispose: () => void } {
  const kmLon = UNITS_PER_DEG_LON / UNITS_PER_KM, kmLat = UNITS_PER_DEG_LAT / UNITS_PER_KM
  const nx = Math.ceil(((LANE_BOUNDS.east - LANE_BOUNDS.west) * kmLon) / STEP_KM) + 1
  const nz = Math.ceil(((LANE_BOUNDS.north - LANE_BOUNDS.south) * kmLat) / STEP_KM) + 1
  const inZone = (lon: number, lat: number) =>
    zones.some((b) => lon > b.west + OVERLAP_DEG && lon < b.east - OVERLAP_DEG && lat > b.south + OVERLAP_DEG && lat < b.north - OVERLAP_DEG)

  const positions = new Float32Array(nx * nz * 3)
  const colors = new Float32Array(nx * nz * 3)
  const keep = new Uint8Array(nx * nz) // vertex outside every zone
  const wet = new Uint8Array(nx * nz) // vertex on the coloured sea of the lane
  const col = new THREE.Color()
  for (let r = 0, k = 0; r < nz; r++) {
    const lat = LANE_BOUNDS.north - (r * STEP_KM) / kmLat
    for (let c = 0; c < nx; c++, k++) {
      const lon = LANE_BOUNDS.west + (c * STEP_KM) / kmLon
      const km = laneKm(lon, lat)
      keep[k] = inZone(lon, lat) ? 0 : 1
      wet[k] = km < LANE_SEA_KM ? 1 : 0
      positions[k * 3] = lon * UNITS_PER_DEG_LON
      positions[k * 3 + 1] = wet[k] ? SEA_Y - 0.05 : HIDDEN_Y // a hair under the zone seas where they overlap
      positions[k * 3 + 2] = -lat * UNITS_PER_DEG_LAT
      const rgb = wet[k] ? mix(SEA.ford, SEA.deep, smooth(-1, 0.4, km)) : UNEXPLORED.wall
      const k2 = MATCH_ZONE_LIGHT / 255
      col.setRGB(rgb[0] * k2, rgb[1] * k2, rgb[2] * k2, THREE.SRGBColorSpace)
      colors.set([col.r, col.g, col.b], k * 3)
    }
  }
  const index: number[] = []
  for (let r = 0; r < nz - 1; r++) {
    for (let c = 0; c < nx - 1; c++) {
      const a = r * nx + c, b = a + nx, cc = b + 1, d = a + 1
      if (!(keep[a] && keep[b] && keep[cc] && keep[d])) continue
      if (!(wet[a] || wet[b] || wet[cc] || wet[d])) continue
      index.push(a, b, d, b, cc, d)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  const material = new THREE.MeshBasicMaterial({ vertexColors: true }) // unlit: flat colour like the toon-shaded zone seas
  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = false
  return {
    mesh,
    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  }
}
