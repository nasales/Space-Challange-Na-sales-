// Luces: luz ambiente de cielo/suelo + sol cálido que proyecta sombras.
// La "cámara de sombras" sigue al punto que miras, así las sombras se ven nítidas donde importa.
import * as THREE from 'three'
import { SUN_DIRECTION } from './createSky'

const SHADOW_MAP_SIZE = 4096

export function createLighting() {
  const hemi = new THREE.HemisphereLight(0xb8d4ff, 0xffd9a8, 1.9) // cielo azulado: sombras frías, de dibujo animado
  const sun = new THREE.DirectionalLight(0xffefcc, 2.1) // sol cálido
  sun.castShadow = true
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
  sun.shadow.bias = -0.0004

  const group = new THREE.Group()
  group.add(hemi, sun, sun.target)

  /**
   * @param focus punto al que mira la cámara
   * @param radius tamaño de la zona con sombras (unidades del mundo)
   */
  const update = (focus: THREE.Vector3, radius: number) => {
    sun.target.position.copy(focus)
    sun.position.copy(focus).addScaledVector(SUN_DIRECTION, radius * 3)
    const cam = sun.shadow.camera
    cam.left = cam.bottom = -radius
    cam.right = cam.top = radius
    cam.near = radius * 0.5
    cam.far = radius * 6
    cam.updateProjectionMatrix()
    sun.shadow.normalBias = radius / 1500 // evita "rayas" de sombra en las caras planas
  }

  return { group, update, dispose: () => sun.shadow.dispose() }
}
