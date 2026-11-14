// Luces: luz ambiente de cielo/suelo + sol cálido que proyecta sombras.
// La "cámara de sombras" sigue al punto que miras, así las sombras se ven nítidas donde importa.
// Colours, intensities and direction come from the day/night palette (dayCycle.ts): the same
// shadow-casting light is the sun by day and the moon by night.
import * as THREE from 'three'
import type { DayPalette } from './dayCycle'

const SHADOW_MAP_SIZE = 4096

export function createLighting() {
  // Bluish sky / warm ground fill. Kept moderate: a strong fill bleaches colours toward pastel
  const hemi = new THREE.HemisphereLight(0x9cc4ff, 0xffc98a, 1.4)
  const sun = new THREE.DirectionalLight(0xffefcc, 2.1) // sol cálido
  sun.castShadow = true
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE)
  sun.shadow.bias = -0.0004

  const group = new THREE.Group()
  group.add(hemi, sun, sun.target)

  /**
   * @param focus punto al que mira la cámara
   * @param radius tamaño de la zona con sombras (unidades del mundo)
   * @param palette current time-of-day palette
   */
  const update = (focus: THREE.Vector3, radius: number, palette: DayPalette) => {
    hemi.color.copy(palette.hemiSky)
    hemi.groundColor.copy(palette.hemiGround)
    hemi.intensity = palette.hemiIntensity
    sun.color.copy(palette.lightColor)
    sun.intensity = palette.lightIntensity
    sun.target.position.copy(focus)
    sun.position.copy(focus).addScaledVector(palette.lightDirection, radius * 3)
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
