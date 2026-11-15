// Cámara que persigue al coche desde detrás y arriba.
// - Va algo rezagada en las curvas: así ves el coche girar (sensación de movimiento).
// - Mira un poco por delante del coche, hacia donde vas.
// - Al ir rápido: el campo de visión se abre y la cámara se queda algo atrás.
// - Se suaviza la DISTANCIA al coche, no su posición absoluta: así el retraso no depende
//   de la velocidad ni de lo que dure cada fotograma, y no da tirones a toda velocidad.
// - Con la rueda del ratón te alejas hasta una vista aérea para "inspeccionar la zona".
// - Lens focus: the camera flies into the detective's hand lens (stepFocus + the lens param of update).
// - Intro: when the map has loaded, the camera starts high above Spain and swoops down to the
//   detective, landing exactly on the chase pose (startIntro / introActive).
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
/** Widest field of view the camera may open to when it has to come closer to the lens (near a wall). */
const FOCUS_FOV_MAX = 70
/** Points checked along the lens axis for roofs, monuments and ground in the way. */
const FREE_SAMPLES = 16
/** Intro: zoom at the start (far and high, a wide view of Spain) and length of the swoop (s). */
const INTRO_ZOOM = 75
const INTRO_TIME = 3.2
/** Intro: the camera holds on the whole map for this long (s) before the swoop starts. */
const INTRO_HOLD = 2
/** Intro skipped (key, click or wheel): the rest of the flight is squeezed into this time (s). */
const INTRO_SKIP_TIME = 0.35
/** Intro: the camera starts this far round the detective (rad) and spirals in behind him. */
const INTRO_SPIN = 0.75
/** Intro: how far past the final pose the swoop punches in before it settles (fraction of the zoom path). */
const INTRO_OVERSHOOT = 0.035
/** Fraction of the intro used by the main swoop; the rest is the small settle back. */
const INTRO_SWOOP = 0.84

/** The hand lens as the camera needs it: glass centre, glass normal (towards the camera) and glass radius, in world units. */
export interface LensTarget {
  center: THREE.Vector3
  normal: THREE.Vector3
  radius: number
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * Intro progress 0..1 -> eased path 0..1: an ease-in-out swoop that goes a little past the end
 * (1 + INTRO_OVERSHOOT) and then settles back to exactly 1. Both pieces have zero speed where they
 * meet and at the very end, so the landing is smooth.
 */
function introEase(t: number) {
  if (t >= 1) return 1
  if (t < INTRO_SWOOP) return easeInOutCubic(t / INTRO_SWOOP) * (1 + INTRO_OVERSHOOT)
  const q = (t - INTRO_SWOOP) / (1 - INTRO_SWOOP)
  return 1 + INTRO_OVERSHOOT * (1 - q * q * (3 - 2 * q))
}

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

  let zoomLocked = false // e.g. during a witness dialogue (its own camera)
  // Intro: progress 0..1 while it plays, -1 when there is none (or it has landed)
  let introT = -1
  let introSkip = false
  let introHold = 0
  const skipIntro = () => {
    introSkip = true
  }
  const stopIntroListeners = () => {
    window.removeEventListener('keydown', skipIntro)
    window.removeEventListener('pointerdown', skipIntro)
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    if (introT >= 0) {
      skipIntro() // the wheel skips the intro instead of zooming
      return
    }
    if (zoomLocked || focusWanted || focusProgress > 0) return // no zooming while flying into the lens
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
   * Start the intro swoop: from far above Spain down to the chase pose. Any key, click or wheel
   * skips it (fast blend to the end). With prefers-reduced-motion there is no flight at all.
   */
  const startIntro = () => {
    if (reducedMotion?.matches) return
    introT = 0
    introSkip = false
    introHold = INTRO_HOLD
    window.addEventListener('keydown', skipIntro)
    window.addEventListener('pointerdown', skipIntro)
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
    // Intro: the zoom (in log scale) and the angle round the detective follow the eased path.
    // k goes 1 -> 0 (slightly below 0 in the overshoot); at k = 0 this is the plain chase pose
    const intro = introT >= 0
    let viewZoom = zoom
    let spin = 0
    if (intro) {
      // First a still look at the whole map (a skip cuts it short), then the swoop
      if (introHold > 0 && !introSkip) introHold -= dt
      else introT = Math.min(1, introT + dt / (introSkip ? INTRO_SKIP_TIME : INTRO_TIME))
      const k = 1 - introEase(introT)
      viewZoom = zoom * Math.exp(Math.log(INTRO_ZOOM / zoom) * k)
      spin = INTRO_SPIN * k
    }
    const speed01 = Math.min(1, Math.abs(car.speed) / TUNING.turboSpeed) // 0 parado, 1 turbo a tope
    // El ángulo de la cámara sigue al del coche con retraso
    if (camHeading === null) camHeading = car.heading
    let diff = car.heading - camHeading
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)) // por el camino más corto
    camHeading += diff * (1 - Math.exp(-3.2 * dt))

    // Al alejarse, la cámara sube más que retrocede (vista más cenital)
    // Con velocidad, la cámara se retrasa y baja: el coche "se escapa" hacia delante
    const back = BASE_DISTANCE * viewZoom * (1 + speed01 * 0.22)
    const up = BASE_HEIGHT * viewZoom * (1 + Math.max(0, viewZoom - 1) * 0.08) * (1 - speed01 * 0.2) * (1 + inspect * 0.9)
    const bx = Math.sin(camHeading + spin), bz = Math.cos(camHeading + spin) // "detrás" del coche
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
    // During the intro the camera sits exactly on the path (no smoothing lag), so the landing frame
    // is the exact chase pose and the smoothing afterwards starts from it: no jump
    if (first || intro) Object.assign(offset,{ x: want.x - car.x, y: want.y, z: want.z - car.z })
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
    if (first || intro) Object.assign(aheadOff, { x: aheadX, y: car.y + LOOK_HEIGHT, z: aheadZ })
    first = false
    if (intro && introT >= 1) {
      introT = -1 // landed: this frame was the chase pose
      stopIntroListeners()
    }
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
      // Final pose: on the glass axis at the distance where the glass fills the contract size.
      // If a roof, a monument or the ground is in the way, the camera stays ON the axis but comes
      // closer, and widens its field of view so the glass still covers exactly the same share of
      // the screen (never lifted: a lifted camera sees the glass tilted and off-centre)
      const blocked = (x: number, y: number, z: number) =>
        y < Math.max(heightAt(x, z) + 0.3, wallAt(x, z) + 0.5, obstacleAt(x, z) + 0.5)
      const ideal = lensFocusDistance(lens.radius, FOCUS_FOV, camera.aspect)
      let free = ideal
      for (let k = 1; k <= FREE_SAMPLES; k++) {
        const d = (ideal * k) / FREE_SAMPLES
        const { x, y, z } = lens.center
        if (blocked(x + lens.normal.x * d, y + lens.normal.y * d, z + lens.normal.z * d)) {
          free = (ideal * (k - 1)) / FREE_SAMPLES
          break
        }
      }
      const minDist = lensFocusDistance(lens.radius, FOCUS_FOV_MAX, camera.aspect)
      const finalDist = Math.max(minDist, Math.min(ideal, free * 0.9))
      // fov that makes the glass fill the contract size at finalDist (inverse of lensFocusDistance)
      const halfTan = lens.radius / (LENS_SCREEN_FRACTION * finalDist * Math.min(1, camera.aspect))
      const finalFov = finalDist < ideal ? THREE.MathUtils.radToDeg(2 * Math.atan(halfTan)) : FOCUS_FOV
      camera.fov = chaseFov + (finalFov - chaseFov) * e
      // On the way in, a small extra push-in peaks late and is gone when the progress reaches 1
      const push = focusWanted && focusProgress < 1 ? FOCUS_PUSH * Math.sin(Math.PI * focusProgress) ** 2 * focusProgress : 0
      const dist = finalDist * (1 - push)
      focusPos.copy(lens.normal).multiplyScalar(dist).add(lens.center)
      chasePos.copy(camera.position)
      if (e >= 1) {
        // Fully in: exactly on the glass axis, looking at the glass centre, so the camera's forward
        // is -lens.normal and the glass is square to it (a centred circle, not an ellipse) and
        // matches the UI glass drawn at the screen centre. No lerp rounding on this frame.
        camera.position.copy(focusPos)
        focusLook.copy(lens.center)
      } else {
        camera.position.lerpVectors(chasePos, focusPos, e)
        // The camera turns to the lens a little ahead of the move, so the glass is centred early
        const lookE = 1 - (1 - e) * (1 - e)
        focusLook.lerpVectors(lookAt, lens.center, lookE)
      }
      // Mid-flight the straight path may still graze a roof or a monument: lift it there only. The
      // final pose is free by construction, so this fades out and never tilts the last frame
      if (e < 1) {
        const p = camera.position
        const lift = Math.max(heightAt(p.x, p.z) + 0.3, wallAt(p.x, p.z) + 0.5, obstacleAt(p.x, p.z) + 0.5) - p.y
        if (lift > 0) p.y += lift * (1 - e)
      }
      camera.lookAt(focusLook)
      distance = camera.position.distanceTo(focusLook)
      return
    }
    distance = camera.position.distanceTo(lookAt)
  }

  return {
    update,
    stepFocus,
    /** Ignore the mouse wheel (true) or let it zoom again (false). */
    lockZoom(on: boolean) {
      zoomLocked = on
    },
    /** Eased lens focus 0..1 (1 = the glass fills LENS_SCREEN_FRACTION of the smaller screen side). */
    get focus() {
      return focusEased
    },
    get distance() {
      return distance
    },
    startIntro,
    /** True while the intro swoop plays (the player has no control yet). */
    get introActive() {
      return introT >= 0
    },
    dispose: () => {
      dom.removeEventListener('wheel', onWheel)
      stopIntroListeners()
    },
  }
}
