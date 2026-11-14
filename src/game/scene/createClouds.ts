// Nubes de dibujo: cada nube es un grupito de bolas low-poly blancas que se mueven con el viento.
// Se usa un InstancedMesh: todas las bolas se dibujan de una vez (mucho más rápido que una a una).
import * as THREE from 'three'
import { UNITS_PER_KM, metersToY, HEIGHT_EXAGGERATION } from '../map/projection'

interface Cloud {
  x: number
  z: number
  y: number
  puffs: { dx: number; dy: number; dz: number; r: number }[]
}

const CLOUD_COUNT = 160
const WIND = new THREE.Vector2(5 * UNITS_PER_KM, -1.2 * UNITS_PER_KM).multiplyScalar(0.25) // unidades/s

/**
 * @param area zona del mundo (x, z) donde flotan las nubes; al salir por un lado vuelven por el otro
 */
export function createClouds(area: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  const rand = (a: number, b: number) => a + Math.random() * (b - a)
  const clouds: Cloud[] = []
  for (let k = 0; k < CLOUD_COUNT; k++) {
    const size = rand(10, 30) * 4 // cloud width in world units (not km: it would bloat them on the bigger map)
    const n = Math.round(rand(4, 8))
    const puffs = Array.from({ length: n }, (_, j) => {
      const along = (j / (n - 1) - 0.5) * size // en fila, la del centro más grande
      const r = size * rand(0.18, 0.3) * (1 - Math.abs(along / size) * 0.8)
      return { dx: along, dy: rand(0, r * 0.4), dz: rand(-0.2, 0.2) * size, r }
    })
    clouds.push({
      x: rand(area.minX, area.maxX),
      z: rand(area.minZ, area.maxZ),
      y: metersToY(rand(3300, 4600), HEIGHT_EXAGGERATION), // just above the highest peaks, at the same relief scale
      puffs,
    })
  }

  const total = clouds.reduce((s, c) => s + c.puffs.length, 0)
  const geometry = new THREE.IcosahedronGeometry(1, 1)
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    emissive: 0x9fb4c8, // las caras en sombra no se ven grises oscuras, sino azuladas suaves
    flatShading: true,
  })
  const mesh = new THREE.InstancedMesh(geometry, material, total)
  mesh.castShadow = true
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

  const matrix = new THREE.Matrix4()
  const w = area.maxX - area.minX, d = area.maxZ - area.minZ
  const wrap = (v: number, min: number, size: number) => ((((v - min) % size) + size) % size) + min

  /** Mueve las nubes (llamar en cada fotograma con los segundos transcurridos). */
  const update = (dt: number) => {
    let k = 0
    for (const c of clouds) {
      c.x = wrap(c.x + WIND.x * dt, area.minX, w)
      c.z = wrap(c.z + WIND.y * dt, area.minZ, d)
      for (const p of c.puffs) {
        matrix.makeScale(p.r, p.r * 0.7, p.r) // algo aplastadas
        matrix.setPosition(c.x + p.dx, c.y + p.dy, c.z + p.dz)
        mesh.setMatrixAt(k++, matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
  }
  update(0)
  mesh.computeBoundingSphere()
  mesh.frustumCulled = false // las nubes se mueven: no recalculamos su caja cada fotograma

  const dispose = () => {
    geometry.dispose()
    material.dispose()
  }
  return { mesh, update, dispose }
}
