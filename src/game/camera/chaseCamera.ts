// Cámara que persigue al coche desde detrás y arriba.
// - Va algo rezagada en las curvas: así ves el coche girar (sensación de movimiento).
// - Mira un poco por delante del coche, hacia donde vas.
// - Al ir rápido: el campo de visión se abre y la cámara se queda algo atrás.
// - Se suaviza la DISTANCIA al coche, no su posición absoluta: así el retraso no depende
//   de la velocidad ni de lo que dure cada fotograma, y no da tirones a toda velocidad.
// - Con la rueda del ratón te alejas hasta una vista aérea para "inspeccionar la zona".
import * as THREE from 'three'
import { damp, TUNING, type CarState } from '../car/carPhysics'

const BASE_DISTANCE = 22
const BASE_HEIGHT = 9
const MIN_ZOOM = 0.7
const MAX_ZOOM = 30
/** Altura a la que mira la cámara sobre el suelo: el cuerpo del detective. */
const LOOK_HEIGHT = 4.5

export function createChaseCamera(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
  let zoom = 1.9 // distancia inicial: se ve bien al detective y lo que tiene delante
  let targetZoom = zoom
  let camHeading: number | null = null
  let first = true
  const lookAt = new THREE.Vector3()
  // Desplazamientos suavizados respecto al coche (x, z) y alturas absolutas (y)
  const offset = { x: 0, y: 0, z: 0 } // cámara
  const aheadOff = { x: 0, y: 0, z: 0 } // punto al que mira

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom * Math.exp(e.deltaY * 0.0012)))
  }
  dom.addEventListener('wheel', onWheel, { passive: false })

  /** Distancia actual de la cámara al coche (para ajustar niebla y sombras). */
  let distance = 0

  /**
   * @param inspect 0..1: cuánto está investigando el detective (la cámara sube a mirar por encima de su hombro)
   * @param obstacleAt altura de los obstáculos (tejados): la cámara no se mete dentro, pero no los usa para "ver" al detective
   */
  const update = (
    car: CarState,
    heightAt: (x: number, z: number) => number,
    dt: number,
    inspect = 0,
    obstacleAt: (x: number, z: number) => number = () => -Infinity,
  ) => {
    zoom = damp(zoom, targetZoom, 6, dt)
    const speed01 = Math.min(1, Math.abs(car.speed) / TUNING.turboSpeed) // 0 parado, 1 turbo a tope
    // El ángulo de la cámara sigue al del coche con retraso
    if (camHeading === null) camHeading = car.heading
    let diff = car.heading - camHeading
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)) // por el camino más corto
    camHeading += diff * (1 - Math.exp(-3.2 * dt))

    // Al alejarse, la cámara sube más que retrocede (vista más cenital)
    // Con velocidad, la cámara se retrasa y baja: el coche "se escapa" hacia delante
    const back = BASE_DISTANCE * zoom * (1 + speed01 * 0.22)
    const up = BASE_HEIGHT * zoom * (1 + Math.max(0, zoom - 1) * 0.08) * (1 - speed01 * 0.2) * (1 + inspect * 0.9)
    const bx = Math.sin(camHeading), bz = Math.cos(camHeading) // "detrás" del coche
    const want = new THREE.Vector3(car.x + bx * back, car.y + up, car.z + bz * back)
    // Nunca por debajo del terreno ni dentro de una casa
    want.y = Math.max(want.y, heightAt(want.x, want.z) + 2, obstacleAt(want.x, want.z) + 3)
    // Que ninguna loma tape al coche: miramos varios puntos entre cámara y coche y,
    // si el terreno corta la línea de visión, subimos la cámara lo justo para verlo
    const carY = car.y + 2
    for (const t of [0.2, 0.4, 0.6, 0.8]) {
      const gx = want.x + (car.x - want.x) * t, gz = want.z + (car.z - want.z) * t
      const ground = heightAt(gx, gz) + 1.5
      // altura mínima de cámara para que la recta cámara→coche pase por encima de ese punto
      want.y = Math.max(want.y, carY + (ground - carY) / (1 - t))
    }

    // Suavizamos el desplazamiento coche→cámara, no la posición: a velocidad constante
    // la cámara va "pegada" al coche y no tiembla aunque cada fotograma dure distinto
    if (first) Object.assign(offset, { x: want.x - car.x, y: want.y, z: want.z - car.z })
    offset.x = damp(offset.x, want.x - car.x, 8, dt)
    offset.y = damp(offset.y, want.y, 8, dt)
    offset.z = damp(offset.z, want.z - car.z, 8, dt)
    camera.position.set(car.x + offset.x, offset.y, car.z + offset.z)

    // Mira un poco por delante del coche (también como desplazamiento suavizado)
    const ahead = 6 + Math.abs(car.speed) * 0.15 + inspect * 5 // investigando: mira a la zona de la lupa
    const aheadX = -Math.sin(car.heading) * ahead, aheadZ = -Math.cos(car.heading) * ahead
    if (first) Object.assign(aheadOff, { x: aheadX, y: car.y + LOOK_HEIGHT, z: aheadZ })
    first = false
    aheadOff.x = damp(aheadOff.x, aheadX, 10, dt)
    aheadOff.y = damp(aheadOff.y, car.y + LOOK_HEIGHT, 10, dt)
    aheadOff.z = damp(aheadOff.z, aheadZ, 10, dt)
    lookAt.set(car.x + aheadOff.x, aheadOff.y, car.z + aheadOff.z)
    camera.lookAt(lookAt)

    // Más velocidad → visión más abierta
    camera.fov = damp(camera.fov, 52 + speed01 * 26, 4, dt)
    distance = camera.position.distanceTo(lookAt)
  }

  return {
    update,
    get distance() {
      return distance
    },
    dispose: () => dom.removeEventListener('wheel', onWheel),
  }
}
