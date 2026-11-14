// Cámara que persigue al coche desde detrás y arriba.
// - Va algo rezagada en las curvas: así ves el coche girar (sensación de movimiento).
// - Mira un poco por delante del coche, hacia donde vas.
// - Al ir rápido: el campo de visión se abre y la cámara se queda algo atrás.
// - Se suaviza la DISTANCIA al coche, no su posición absoluta: así el retraso no depende
//   de la velocidad ni de lo que dure cada fotograma, y no da tirones a toda velocidad.
// - Con la rueda del ratón te alejas hasta una vista aérea para "inspeccionar la zona".
// - Lens focus: the camera flies into the detective's hand lens (stepFocus + the lens param of update).
import * as THREE from 'three'
import { damp, TUNING, type CarState } from '../car/carPhysics'
import { LENS_SCREEN_FRACTION } from '../../shared/events'

const BASE_DISTANCE = 22
const BASE_HEIGHT = 9
const MIN_ZOOM = 0.7
const MAX_ZOOM = 60 // was 30: the map is twice as big, the overview must still frame Spain
/** Furthest the camera looks ahead of the detective (turbo is faster on the bigger map). */
const MAX_AHEAD = 30
/** Altura a la que mira la cámara sobre el suelo: el cuerpo del detective. */
const LOOK_HEIGHT = 4.5
/** How far a monument may rise above the sight line before the camera moves in front of it. */
const WALL_MARGIN = 1.5
/** Duration of the flight into the lens and back out (s). */
const FOCUS_IN_TIME = 0.9
const FOCUS_OUT_TIME = 0.6
/** Narrower field of view once in the lens (telephoto feel). The final distance uses this value. */
const FOCUS_FOV = 36
/** Extra push-in near the end of the flight (fraction of the final distance); zero on the last frame. */
const FOCUS_PUSH = 0.07

/** The hand lens as the camera needs it: glass centre, glass normal (towards the camera) and glass radius, in world units. */
export interface LensTarget {
  center: THREE.Vector3
  normal: THREE.Vector3
  radius: number
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Distance from the glass at which its diameter covers LENS_SCREEN_FRACTION of
 * min(viewport width, viewport height). fov is vertical: the visible half-height at distance D is
 * D * tan(fov / 2) and the half-width is that times aspect, so the smaller half-extent is
 * D * tan(fov / 2) * min(1, aspect). Solving radius / halfExtent = LENS_SCREEN_FRACTION gives D.
 */
export function lensFocusDistance(radius: number, fovDeg: number, aspect: number) {
  const halfTan = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2) * Math.min(1, aspect)
  return radius / (LENS_SCREEN_FRACTION * halfTan)
}

export function createChaseCamera(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
  let zoom = 1.9 // distancia inicial: se ve bien al detective y lo que tiene delante
  let targetZoom = zoom
  let camHeading: number | null = null
  let first = true
  const lookAt = new THREE.Vector3()
  // Desplazamientos suavizados respecto al coche (x, z) y alturas absolutas (y)
  const offset = { x: 0, y: 0, z: 0 } // cámara
  const aheadOff = { x: 0, y: 0, z: 0 } // punto al que mira

  // Lens focus: wanted on/off, linear progress 0..1 and its eased value
  let focusWanted = false
  let focusProgress = 0
  let focusEased = 0
  const reducedMotion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  let chaseFov = camera.fov // the chase field of view, kept apart from the focus blend
  const chasePos = new THREE.Vector3()
  const focusPos = new THREE.Vector3()
  const focusLook = new THREE.Vector3()

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    if (focusWanted || focusProgress > 0) return // no zooming while flying into the lens
    targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom * Math.exp(e.deltaY * 0.0012)))
  }
  dom.addEventListener('wheel', onWheel, { passive: false })

  /** Distancia actual de la cámara al coche (para ajustar niebla y sombras). */
  let distance = 0

  /**
   * Move the lens focus towards on/off and return the eased amount 0..1.
   * Call once per frame before posing the detective and before update.
   * With prefers-reduced-motion it jumps straight to the end state.
   */
  const stepFocus = (on: boolean, dt: number) => {
    focusWanted = on
    if (reducedMotion?.matches) focusProgress = on ? 1 : 0
    else if (on) focusProgress = Math.min(1, focusProgress + dt / FOCUS_IN_TIME)
    else focusProgress = Math.max(0, focusProgress - dt / FOCUS_OUT_TIME)
    focusEased = easeInOutCubic(focusProgress)
    return focusEased
  }

  /**
   * @param inspect 0..1: cuánto está investigando el detective (la cámara sube a mirar por encima de su hombro)
   * @param obstacleAt altura de los obstáculos (tejados): la cámara no se mete dentro, pero no los usa para "ver" al detective
   * @param wallAt surface of the monuments: the camera never goes inside them and, if one stands
   *   between it and the detective, it moves in front of it instead of climbing over the top
   * heightAt is the ground without monuments (terrain and house roofs).
   */
  const update = (
    car: CarState,
    heightAt: (x: number, z: number) => number,
    dt: number,
    inspect = 0,
    obstacleAt: (x: number, z: number) => number = () => -Infinity,
    wallAt: (x: number, z: number) => number = () => -Infinity,
    lens: LensTarget | null = null,
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
    // Walk the sight line from the detective back to the camera: at the first piece of monument
    // that rises above it, the camera stays just in front of it (on the detective's side) instead
    // of climbing over the top, where it would shoot up or end up inside the building.
    // House roofs keep the old behaviour: the camera rises over them.
    let reach = back
    for (let d = 1.5; d < back; d += 1.5) {
      const lineY = car.y + 2 + (up - 2) * (d / back)
      if (wallAt(car.x + bx * d, car.z + bz * d) > lineY + WALL_MARGIN) {
        reach = Math.max(0, d - 2.5)
        break
      }
    }
    const want = new THREE.Vector3(car.x + bx * reach, car.y + up, car.z + bz * reach)
    // Never below the ground nor inside a house or a monument
    want.y = Math.max(want.y, heightAt(want.x, want.z) + 2, wallAt(want.x, want.z) + 2, obstacleAt(want.x, want.z) + 3)
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
    // Hard floor: while the smoothing catches up (e.g. right after the detective climbs a monument
    // in one step), the camera never sinks into a monument or below the ground
    const floor = Math.max(heightAt(camera.position.x, camera.position.z) + 1, wallAt(camera.position.x, camera.position.z) + 1.5)
    if (camera.position.y < floor) {
      camera.position.y = floor
      offset.y = floor
    }

    // Mira un poco por delante del coche (también como desplazamiento suavizado)
    const ahead = Math.min(MAX_AHEAD, 6 + Math.abs(car.speed) * 0.15) + inspect * 5 // investigando: mira a la zona de la lupa
    const aheadX = -Math.sin(car.heading) * ahead, aheadZ = -Math.cos(car.heading) * ahead
    if (first) Object.assign(aheadOff, { x: aheadX, y: car.y + LOOK_HEIGHT, z: aheadZ })
    first = false
    aheadOff.x = damp(aheadOff.x, aheadX, 10, dt)
    aheadOff.y = damp(aheadOff.y, car.y + LOOK_HEIGHT, 10, dt)
    aheadOff.z = damp(aheadOff.z, aheadZ, 10, dt)
    lookAt.set(car.x + aheadOff.x, aheadOff.y, car.z + aheadOff.z)
    camera.lookAt(lookAt)

    // Más velocidad → visión más abierta
    chaseFov = damp(chaseFov, 52 + speed01 * 26, 4, dt)
    camera.fov = chaseFov

    // ---- Lens focus: blend the chase pose into a pose looking straight at the glass ----
    // The chase pose above keeps updating, so flying back out lands on the current chase view.
    if (lens && focusEased > 0) {
      const e = focusEased
      camera.fov = chaseFov + (FOCUS_FOV - chaseFov) * e
      // Final distance from the final FOV, so the last frame matches the contract size exactly.
      // On the way in, a small extra push-in peaks late and is gone when the progress reaches 1
      const push = focusWanted && focusProgress < 1 ? FOCUS_PUSH * Math.sin(Math.PI * focusProgress) ** 2 * focusProgress : 0
      const dist = lensFocusDistance(lens.radius, FOCUS_FOV, camera.aspect) * (1 - push)
      focusPos.copy(lens.normal).multiplyScalar(dist).add(lens.center)
      chasePos.copy(camera.position)
      camera.position.lerpVectors(chasePos, focusPos, e)
      // The camera turns to the lens a little ahead of the move, so the glass is centred early
      const lookE = 1 - (1 - e) * (1 - e)
      focusLook.lerpVectors(lookAt, lens.center, lookE)
      // Same safeguard as the chase view: never below the ground nor inside a roof or a monument
      const p = camera.position
      p.y = Math.max(p.y, heightAt(p.x, p.z) + 0.3, wallAt(p.x, p.z) + 0.5, obstacleAt(p.x, p.z) + 0.5)
      camera.lookAt(focusLook)
      distance = camera.position.distanceTo(focusLook)
      return
    }
    distance = camera.position.distanceTo(lookAt)
  }

  return {
    update,
    stepFocus,
    /** Eased lens focus 0..1 (1 = the glass fills LENS_SCREEN_FRACTION of the smaller screen side). */
    get focus() {
      return focusEased
    },
    get distance() {
      return distance
    },
    dispose: () => dom.removeEventListener('wheel', onWheel),
  }
}
