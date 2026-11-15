// Fast travel by plane (the M travel map): the detective turns into a small toy plane, takes off,
// flies a smooth arc to a landmark's plaza, lands and turns back into the detective.
// Original low-poly model built here from three.js primitives (no external assets). Faces -Z like him.
//
// Use (see GameView.tsx):
//   const plane = createPlane()                    // scene.add(plane.root)
//   plane.start(carState, target, heightAt)        // target = landmarks.approachOf(id, ...)
//   plane.update(carState, detective.root, dt)     // every frame while plane.active, instead of stepCar
//
// While active, update() moves carState itself (x, y, z, heading, a show speed for the camera's
// field of view); on the landing frame it leaves carState standing still on the plaza.
import * as THREE from 'three'
import type { CarState } from '../car/carPhysics'
import { toonMaterial } from '../scene/toonGradient'
import { DETECTIVE_SCALE } from '../detective/detectiveSize'
import { UNITS_PER_KM } from '../map/projection'

// ---- Look ----
const BODY = 0xe5322d // red fuselage (the team's accent red)
const BODY_DARK = 0xb8231f
const WING = 0xfff1d6 // cream wings
const TRIM = 0xf2c14e // gold stripes, wing tips and spinner
const DARK = 0x2b2540 // propeller, wheels, cockpit rim
const GLASS = 0xbdf3ff
const SKIN = 0xffcfa0
const HAT = 0x7a5235 // the detective's brown fedora pokes out of the cockpit
const HAT_BAND = 0x2b2540
/** Strength of the violet cartoon shadow on the plane (1 = like the rest of the world). */
const PLANE_SHADOW = 0.6
/** Size of the plane in the world (times the model units below; the detective uses the same scale). */
const PLANE_SCALE = DETECTIVE_SCALE * 1.05

// ---- Flight ----
/** Detective -> plane (and plane -> detective) swap on the ground (s). */
const MORPH_TIME = 0.35
/** Flight time for a short hop and the longest it may take (s); in between it grows with distance. */
const FLIGHT_MIN_TIME = 3
const FLIGHT_MAX_TIME = 4.6
/** Extra flight seconds per km of distance (until FLIGHT_MAX_TIME). */
const FLIGHT_TIME_PER_KM = 0.004
/**
 * Softer take-off and landing: the ground track follows an ease-in-out of this power (2 = quad,
 * 3 = cubic; the old sine ease is about 2.2). A little extra time keeps the cruise speed the same.
 */
const TRACK_EASE_POWER = 2.8
const EASE_EXTRA_TIME = 0.4
/**
 * Cruise height above the trip's start and end (world units): grows with distance, within these
 * limits. The minimum keeps the plane above the floating case markers (about 260 units tall).
 */
const CRUISE_MIN = 330
const CRUISE_MAX = 520
const CRUISE_PER_KM = 0.8
/** Never closer than this to the ground mid-flight (world units). */
const GROUND_CLEARANCE = 25
/** Show speed sent to the camera while cruising (world units/s): opens its field of view like the turbo. */
const CAMERA_SPEED = 260
/** Most the plane banks into a turn and pitches on climb / descent (rad). */
const MAX_BANK = 0.5
const MAX_PITCH = 0.45
/** Fraction of the flight in which the nose turns from the trip direction to face the monument. */
const FINAL_TURN = 0.3
/** Propeller turns per second at full power. */
const PROP_SPEED = 28
/** Little hop of the swap "poof" (world units). */
const MORPH_HOP = 3

export interface TravelTarget {
  x: number
  z: number
  /** Heading on arrival (faces the monument). */
  heading: number
}

type Phase = 'idle' | 'toPlane' | 'flying' | 'toDetective'

const smooth = (t: number) => t * t * (3 - 2 * t)
/** Ease-in-out of power p: slow start, slow end (p = 3 is the usual easeInOutCubic). */
const easeInOutPow = (t: number, p: number) => (t < 0.5 ? 2 ** (p - 1) * t ** p : 1 - (2 - 2 * t) ** p / 2)
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/**
 * The plane model, in model units (about 4 long, 4.6 wide). Nose towards -Z, wheels at y = 0.
 * @returns the group plus the propeller pivot (spun by the flight) and what to dispose.
 */
export function buildPlaneMesh() {
  const geometries: THREE.BufferGeometry[] = []
  const materials = new Map<number, THREE.Material>()
  const mat = (color: number) => {
    if (!materials.has(color)) materials.set(color, toonMaterial(color, {}, PLANE_SHADOW))
    return materials.get(color)!
  }
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0) => {
    geometries.push(geo)
    const m = new THREE.Mesh(geo, mat(color))
    m.position.set(x, y, z)
    m.castShadow = true
    parent.add(m)
    return m
  }
  const group = new THREE.Group()

  // Fuselage: a fat rounded tube that tapers to the tail (cylinders along Z)
  const BODY_Y = 0.85
  add(group, new THREE.CylinderGeometry(0.5, 0.55, 1.6, 10).rotateX(Math.PI / 2), BODY, 0, BODY_Y, -0.45)
  add(group, new THREE.CylinderGeometry(0.22, 0.5, 1.7, 10).rotateX(Math.PI / 2), BODY, 0, BODY_Y + 0.08, 1.2)
  add(group, new THREE.CylinderGeometry(0.56, 0.56, 0.12, 10).rotateX(Math.PI / 2), TRIM, 0, BODY_Y, 0.1) // gold band
  // Nose: dark cowling ring, gold spinner and the propeller
  add(group, new THREE.CylinderGeometry(0.5, 0.42, 0.3, 10).rotateX(Math.PI / 2), BODY_DARK, 0, BODY_Y, -1.38)
  add(group, new THREE.ConeGeometry(0.2, 0.42, 8).rotateX(-Math.PI / 2), TRIM, 0, BODY_Y, -1.72)
  const propeller = new THREE.Group()
  propeller.position.set(0, BODY_Y, -1.62)
  group.add(propeller)
  add(propeller, new THREE.BoxGeometry(0.16, 1.5, 0.06), DARK)
  add(propeller, new THREE.BoxGeometry(0.16, 0.22, 0.07), TRIM, 0, 0.7, 0) // tips
  add(propeller, new THREE.BoxGeometry(0.16, 0.22, 0.07), TRIM, 0, -0.7, 0)

  // Wings: low wing with gold tips and a slight upward dihedral on each side
  for (const side of [-1, 1]) {
    const wing = new THREE.Group()
    wing.position.set(side * 0.35, BODY_Y - 0.25, -0.35)
    wing.rotation.z = side * 0.08
    group.add(wing)
    add(wing, new THREE.BoxGeometry(1.95, 0.12, 0.85), WING, side * 0.97, 0, 0)
    add(wing, new THREE.BoxGeometry(0.3, 0.14, 0.87), TRIM, side * 1.95, 0, 0)
    add(wing, new THREE.BoxGeometry(0.5, 0.13, 0.12), BODY, side * 0.97, 0, -0.42) // red leading-edge stripe
  }
  // Tail: horizontal stabiliser and the fin
  add(group, new THREE.BoxGeometry(1.6, 0.08, 0.5), WING, 0, BODY_Y + 0.12, 1.85)
  add(group, new THREE.BoxGeometry(0.09, 0.75, 0.55), BODY, 0, BODY_Y + 0.5, 1.88)
  add(group, new THREE.BoxGeometry(0.1, 0.18, 0.56), TRIM, 0, BODY_Y + 0.82, 1.88)

  // Open cockpit with a small windscreen and the detective's head and hat sticking out
  add(group, new THREE.CylinderGeometry(0.34, 0.34, 0.08, 10), DARK, 0, BODY_Y + 0.48, 0.15)
  add(group, new THREE.BoxGeometry(0.55, 0.28, 0.05).rotateX(-0.5), GLASS, 0, BODY_Y + 0.6, -0.25)
  add(group, new THREE.SphereGeometry(0.27, 10, 8), SKIN, 0, BODY_Y + 0.72, 0.18)
  add(group, new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12), HAT, 0, BODY_Y + 0.92, 0.18) // brim
  add(group, new THREE.CylinderGeometry(0.24, 0.27, 0.26, 10), HAT, 0, BODY_Y + 1.07, 0.18) // crown
  add(group, new THREE.CylinderGeometry(0.275, 0.275, 0.07, 10), HAT_BAND, 0, BODY_Y + 0.97, 0.18)

  // Landing gear: two struts with fat wheels under the wings, a small tail wheel
  for (const side of [-1, 1]) {
    add(group, new THREE.BoxGeometry(0.08, 0.45, 0.08), DARK, side * 0.5, 0.38, -0.55)
    add(group, new THREE.CylinderGeometry(0.2, 0.2, 0.14, 10).rotateZ(Math.PI / 2), DARK, side * 0.5, 0.2, -0.55)
  }
  add(group, new THREE.CylinderGeometry(0.09, 0.09, 0.08, 8).rotateZ(Math.PI / 2), DARK, 0, 0.42, 1.9)

  return {
    group,
    propeller,
    dispose: () => {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
    },
  }
}

/** Flight controller plus the plane in the scene. */
export function createPlane() {
  const model = buildPlaneMesh()
  const root = new THREE.Group() // position and heading
  const body = new THREE.Group() // pitch, bank and the swap scale
  root.add(body)
  body.add(model.group)
  root.visible = false

  let phase: Phase = 'idle'
  let t = 0 // seconds in the current phase
  let duration = FLIGHT_MIN_TIME
  let cruise = CRUISE_MIN
  let heightAt: (x: number, z: number) => number = () => 0
  const from = { x: 0, y: 0, z: 0, heading: 0 }
  const to = { x: 0, y: 0, z: 0, heading: 0 }
  let tripHeading = 0
  let bank = 0
  let propAngle = 0
  let onLanded: (() => void) | null = null

  /** Point of the flight path at progress u (0..1): smooth ground track plus a smooth arc up and down. */
  const pathAt = (u: number) => {
    const k = easeInOutPow(u, TRACK_EASE_POWER)
    const x = from.x + (to.x - from.x) * k
    const z = from.z + (to.z - from.z) * k
    const base = from.y + (to.y - from.y) * smooth(u)
    // sin^0.8 arc: climbs quickly, a long cruise, then a quick descent onto the plaza
    const arc = Math.pow(Math.sin(Math.PI * u), 0.8) * cruise
    const y = Math.max(base + arc, u > 0.02 && u < 0.98 ? heightAt(x, z) + GROUND_CLEARANCE * Math.sin(Math.PI * u) : -Infinity)
    return { x, y, z }
  }

  /**
   * Starts the trip from where the detective stands to the target (landing spot and arrival heading).
   * @param ground height of the surface (terrain, roofs, monuments) to land on and to fly over
   * @param landed called once, on the frame he is back on his feet
   */
  const start = (s: CarState, target: TravelTarget, ground: (x: number, z: number) => number, landed?: () => void) => {
    if (phase !== 'idle') return false
    heightAt = ground
    Object.assign(from, { x: s.x, y: s.y, z: s.z, heading: s.heading })
    Object.assign(to, { x: target.x, y: ground(target.x, target.z), z: target.z, heading: target.heading })
    const km = Math.hypot(to.x - from.x, to.z - from.z) / UNITS_PER_KM
    duration = Math.min(FLIGHT_MAX_TIME, Math.max(FLIGHT_MIN_TIME, FLIGHT_MIN_TIME + km * FLIGHT_TIME_PER_KM)) + EASE_EXTRA_TIME
    cruise = Math.min(CRUISE_MAX, Math.max(CRUISE_MIN, km * CRUISE_PER_KM)) + Math.max(0, Math.max(from.y, to.y) - Math.min(from.y, to.y)) * 0.3
    tripHeading = km > 0.01 ? Math.atan2(-(to.x - from.x), -(to.z - from.z)) : from.heading
    onLanded = landed ?? null
    phase = 'toPlane'
    t = 0
    bank = 0
    return true
  }

  /**
   * Moves carState along the flight and poses the plane; hides the detective while he is the plane.
   * Call every frame while `active` (instead of stepCar), before chase.update.
   */
  const update = (s: CarState, detective: THREE.Object3D, dt: number) => {
    if (phase === 'idle') return
    t += dt
    let planeScale = 1
    let detectiveScale = 0
    let power = 1
    let pitch = 0
    let wantBank = 0

    if (phase === 'toPlane') {
      const k = Math.min(1, t / MORPH_TIME)
      // He shrinks into a poof and the plane pops out of it, nose already towards the trip
      detectiveScale = 1 - smooth(Math.min(1, k * 2))
      planeScale = smooth(Math.max(0, k * 2 - 1))
      power = k
      s.heading = from.heading + wrapAngle(tripHeading - from.heading) * smooth(k)
      s.y = from.y + Math.sin(Math.PI * k) * MORPH_HOP
      s.speed = 0
      if (k >= 1) {
        phase = 'flying'
        t = 0
      }
    } else if (phase === 'flying') {
      const u = Math.min(1, t / duration)
      const p = pathAt(u)
      const ahead = pathAt(Math.min(1, u + 0.02))
      const behind = pathAt(Math.max(0, u - 0.02))
      s.x = p.x
      s.y = p.y
      s.z = p.z
      // Nose: along the trip, then turning to face the monument for the landing
      const turn = smooth(Math.max(0, (u - (1 - FINAL_TURN)) / FINAL_TURN))
      const heading = tripHeading + wrapAngle(to.heading - tripHeading) * turn
      const yawRate = dt > 0 ? wrapAngle(heading - s.heading) / dt : 0
      s.heading = heading
      wantBank = Math.max(-MAX_BANK, Math.min(MAX_BANK, -yawRate * 0.35))
      const run = Math.hypot(ahead.x - behind.x, ahead.z - behind.z)
      pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, Math.atan2(ahead.y - behind.y, Math.max(run, 1e-3))))
      s.speed = CAMERA_SPEED * Math.sin(Math.PI * u)
      if (u >= 1) {
        phase = 'toDetective'
        t = 0
      }
    } else {
      const k = Math.min(1, t / MORPH_TIME)
      planeScale = 1 - smooth(Math.min(1, k * 2))
      detectiveScale = smooth(Math.max(0, k * 2 - 1))
      power = 1 - k
      s.x = to.x
      s.z = to.z
      s.heading = to.heading
      s.y = to.y + Math.sin(Math.PI * k) * MORPH_HOP
      s.speed = 0
      if (k >= 1) {
        // Back on his feet: physics carries on from a clean standing state on the plaza
        phase = 'idle'
        Object.assign(s, { x: to.x, z: to.z, y: to.y, heading: to.heading, speed: 0, steer: 0, yawRate: 0, accel: 0, pitch: 0, roll: 0 })
        detectiveScale = 1
        planeScale = 0
        onLanded?.()
        onLanded = null
      }
    }

    bank += (wantBank - bank) * (1 - Math.exp(-6 * dt))
    propAngle += dt * PROP_SPEED * Math.PI * 2 * (0.25 + 0.75 * power)
    model.propeller.rotation.z = propAngle
    root.position.set(s.x, s.y, s.z)
    root.rotation.y = s.heading
    body.rotation.set(pitch, 0, bank, 'YXZ')
    body.scale.setScalar(PLANE_SCALE * Math.max(0.001, planeScale))
    root.visible = planeScale > 0.001
    detective.scale.setScalar(Math.max(0.001, detectiveScale))
    detective.visible = detectiveScale > 0.001
  }

  return {
    root,
    start,
    update,
    /** True from the swap into the plane until he is back on his feet. */
    get active() {
      return phase !== 'idle'
    },
    /** Progress of the whole trip, 0 at the start of the first swap to 1 when he is back on his feet. */
    get progress() {
      const total = 2 * MORPH_TIME + duration
      const done = phase === 'toPlane' ? t : phase === 'flying' ? MORPH_TIME + t : phase === 'toDetective' ? MORPH_TIME + duration + t : total // idle: trip over (or none)
      return Math.min(1, done / total)
    },
    /** True only while airborne (between the two swaps). */
    get flying() {
      return phase === 'flying'
    },
    /** Height of the plane above the ground below it (world units, 0 on the ground). */
    altitude(s: CarState) {
      return phase === 'flying' ? Math.max(0, s.y - heightAt(s.x, s.z)) : 0
    },
    dispose: model.dispose,
  }
}
