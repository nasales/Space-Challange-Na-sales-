// Shared helpers for the case symbols (one low-poly toon model per featured case).
// Every symbol stands on y = 0 (its bottom), centred on x = z = 0, about SYMBOL_HEIGHT tall,
// built only from three.js primitives (original shapes, no external assets).
//
// Each mesh made with kit.part() is tagged userData.part = 'symbol' and keeps its own colour in
// userData.openMat; createCaseMarkers swaps every tagged mesh to the green material when the case
// is solved and back to userData.openMat when it is open again.
import * as THREE from 'three'
import { toonMaterial } from '../../scene/toonGradient'

/** Overall height of a symbol in world units (same as the "!" marker, MARKER_HEIGHT). */
export const SYMBOL_HEIGHT = 160
/** Toon shadow strength of the symbol materials (1 = full violet shadow, like the "!"). */
const SHADOW_STRENGTH = 1

export interface SymbolKit {
  /** Shared toon material of one colour. */
  mat(color: number): THREE.Material
  /** Shared geometry under a key (built once per kit). */
  geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry
  /** A tagged, shadow-casting mesh at (x, y, z). */
  part(geometry: THREE.BufferGeometry, material: THREE.Material, x?: number, y?: number, z?: number): THREE.Mesh
  dispose(): void
}

/** A builder returns the symbol group (bottom on y = 0, centred on x = z = 0). */
export type SymbolBuilder = (kit: SymbolKit) => THREE.Group

export function createSymbolKit(): SymbolKit {
  const materials = new Map<number, THREE.Material>()
  const geometries = new Map<string, THREE.BufferGeometry>()
  return {
    mat(color) {
      let m = materials.get(color)
      if (!m) materials.set(color, (m = toonMaterial(color, {}, SHADOW_STRENGTH)))
      return m
    },
    geo(key, make) {
      let g = geometries.get(key)
      if (!g) geometries.set(key, (g = make()))
      return g
    },
    part(geometry, material, x = 0, y = 0, z = 0) {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(x, y, z)
      mesh.castShadow = true
      mesh.userData.part = 'symbol'
      mesh.userData.openMat = material
      return mesh
    },
    dispose() {
      for (const g of geometries.values()) g.dispose()
      for (const m of materials.values()) m.dispose()
      geometries.clear()
      materials.clear()
    },
  }
}

/** Extrudes a 2D shape (in the XY plane) to `depth`, centred on z = 0, without bevel. */
export function extrudeCentred(shape: THREE.Shape, depth: number, curveSegments = 4) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments })
  g.translate(0, 0, -depth / 2)
  return g
}
