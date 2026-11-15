// The tutorial's guide: a small hovering robot built from simple shapes, with the same toon
// materials as the detective and the witnesses (the ink outline pass draws its black lines).
// No external assets. It looks towards -Z, like the detective.
//
// Hierarchy:  root (position, yaw, pop-in scale) -> body (bob, lean)
//               -> shell, belt, chest light, thruster, arms (shoulder -> hand), head -> visor, eyes, ears, antenna
//
//   const bot = createGuideBot()
//   scene.add(bot.root)
//   bot.update(dt, { target, lookAt, talking })   // every frame; target null = fly away and hide
//   bot.headTop(out)                              // world point just above the antenna (speech bubble)
import * as THREE from 'three'
import { toonMaterial } from '../scene/toonGradient'
import { DETECTIVE_SCALE } from '../detective/detectiveSize'

const SHELL = 0xf6f1e4 // warm white, like the menu paper
const ACCENT = 0x2bb3c0 // teal joints
const BELT = 0xf2c14e // gold band (the menus' gold)
const VISOR = 0x1b2140
const EYES = 0x7df9ff
const BULB = 0xff5a4f
const FLAME = 0xffb347

/** How fast it flies to its spot and turns (1/s, exponential easing). */
const FLY_RATE = 2.6
const TURN_RATE = 6
/** Pop-in / pop-out time (s). */
const POP_TIME = 0.35
/** It drops in from this far above its first spot (world units). */
const DROP_IN = 26
/** Hover bob (world units, rad/s). */
const BOB = 0.45
const BOB_SPEED = 2.4
/** Top of the antenna bulb above the root, in model units. */
const TOP = 1.62

export interface GuideBotPose {
  /** World point to hover at, or null to leave (it shrinks away) */
  target: { x: number; y: number; z: number } | null
  /** World point to face (the detective, usually) */
  lookAt?: { x: number; z: number } | null
  talking?: boolean
}

export function createGuideBot() {
  const root = new THREE.Group()
  root.visible = false
  const body = new THREE.Group()
  root.add(body)

  const geometries: THREE.BufferGeometry[] = []
  const materials: THREE.Material[] = []
  const mat = (color: number, extra: THREE.MeshToonMaterialParameters = {}) => {
    const m = toonMaterial(color, extra)
    materials.push(m)
    return m
  }
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D) => {
    geometries.push(geometry)
    const m = new THREE.Mesh(geometry, material)
    m.castShadow = true
    parent.add(m)
    return m
  }

  const shell = mat(SHELL)
  const accent = mat(ACCENT)
  const belt = mat(BELT)
  const eyeMat = mat(EYES, { emissive: EYES, emissiveIntensity: 1.4 })
  const bulbMat = mat(BULB, { emissive: BULB, emissiveIntensity: 1 })
  const chestMat = mat(BELT, { emissive: BELT, emissiveIntensity: 0.9 })
  const flameMat = new THREE.MeshBasicMaterial({ color: FLAME, transparent: true, opacity: 0.85 })
  materials.push(flameMat)

  // Body: an egg with a gold belt and a chest light
  const torso = mesh(new THREE.SphereGeometry(0.5, 20, 14), shell, body)
  torso.scale.set(1, 0.92, 0.95)
  const band = mesh(new THREE.TorusGeometry(0.47, 0.07, 8, 24), belt, body)
  band.rotation.x = Math.PI / 2
  band.position.y = -0.12
  const chest = mesh(new THREE.SphereGeometry(0.09, 10, 8), chestMat, body)
  chest.position.set(0, 0.12, -0.46)
  // Thruster under the body: a nozzle and a flickering flame
  const nozzle = mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.16, 14), accent, body)
  nozzle.position.y = -0.5
  const flame = mesh(new THREE.ConeGeometry(0.17, 0.5, 10), flameMat, body)
  flame.castShadow = false
  flame.rotation.x = Math.PI
  flame.position.y = -0.82

  // Arms: a teal shoulder ball and a white mitten
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group()
    shoulder.position.set(side * 0.52, 0.08, 0)
    body.add(shoulder)
    mesh(new THREE.SphereGeometry(0.1, 10, 8), accent, shoulder)
    const fore = mesh(new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), shell, shoulder)
    fore.position.set(side * 0.08, -0.18, 0)
    const hand = mesh(new THREE.SphereGeometry(0.1, 10, 8), accent, shoulder)
    hand.position.set(side * 0.1, -0.36, 0)
    return { shoulder, side }
  })

  // Head: a dome with a dark visor, two glowing eyes, ear caps and an antenna
  const head = new THREE.Group()
  head.position.y = 0.72
  body.add(head)
  const dome = mesh(new THREE.SphereGeometry(0.42, 20, 14), shell, head)
  dome.scale.set(1.08, 0.92, 1)
  const visor = mesh(new THREE.SphereGeometry(0.34, 18, 12), mat(VISOR), head)
  visor.scale.set(1.02, 0.6, 0.55)
  visor.position.set(0, 0.02, -0.24)
  const eyes = [-1, 1].map((side) => {
    const eye = mesh(new THREE.SphereGeometry(0.075, 10, 8), eyeMat, head)
    eye.position.set(side * 0.14, 0.03, -0.41)
    return eye
  })
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 12), accent, head)
    ear.rotation.z = Math.PI / 2
    ear.position.set(side * 0.46, 0, 0)
  }
  const antenna = new THREE.Group()
  antenna.position.y = 0.38
  head.add(antenna)
  const rod = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6), accent, antenna)
  rod.position.y = 0.15
  const bulb = mesh(new THREE.SphereGeometry(0.085, 10, 8), bulbMat, antenna)
  bulb.position.y = 0.34

  let clock = 0
  let pop = 0 // 0 hidden .. 1 full size
  let talk = 0 // eased 0..1
  let heading = 0
  let hasSpot = false
  const spot = new THREE.Vector3()
  const velocity = new THREE.Vector3()
  const previous = new THREE.Vector3()

  return {
    root,

    update(dt: number, pose: GuideBotPose) {
      clock += dt
      const wanted = !!pose.target
      pop = Math.min(1, Math.max(0, pop + (wanted ? dt : -dt) / POP_TIME))
      root.visible = pop > 0.001
      if (!root.visible) {
        hasSpot = false
        return
      }
      if (pose.target) {
        if (!hasSpot) {
          // First frame on stage: start above the spot and drop in
          spot.set(pose.target.x, pose.target.y + DROP_IN, pose.target.z)
          previous.copy(spot)
          hasSpot = true
        }
        const k = 1 - Math.exp(-FLY_RATE * dt)
        spot.x += (pose.target.x - spot.x) * k
        spot.y += (pose.target.y - spot.y) * k
        spot.z += (pose.target.z - spot.z) * k
      }
      if (dt > 0) velocity.copy(spot).sub(previous).divideScalar(dt)
      previous.copy(spot)
      root.position.set(spot.x, spot.y + Math.sin(clock * BOB_SPEED) * BOB, spot.z)

      // Face where it flies while moving fast, else whoever it talks to
      const speed = Math.hypot(velocity.x, velocity.z)
      let face: number | null = null
      if (speed > 12) face = Math.atan2(-velocity.x, -velocity.z)
      else if (pose.lookAt) face = Math.atan2(-(pose.lookAt.x - spot.x), -(pose.lookAt.z - spot.z))
      if (face !== null) {
        const turn = Math.atan2(Math.sin(face - heading), Math.cos(face - heading))
        heading += turn * (1 - Math.exp(-TURN_RATE * dt))
      }
      root.rotation.y = heading

      // Overshoot on the way in, plain shrink on the way out
      const e = wanted ? 1 + 2.2 * Math.pow(pop - 1, 3) + 1.2 * Math.pow(pop - 1, 2) : pop * pop
      root.scale.setScalar(DETECTIVE_SCALE * Math.max(0.001, e))

      talk += ((pose.talking ? 1 : 0) - talk) * (1 - Math.exp(-8 * dt))
      // Lean into the flight; nod and sway a little while talking
      body.rotation.x = -Math.min(0.5, speed * 0.012) + Math.sin(clock * 9) * 0.04 * talk
      body.rotation.z = Math.sin(clock * 1.7) * 0.05
      head.rotation.x = Math.sin(clock * 7.5) * 0.09 * talk
      head.rotation.z = Math.sin(clock * 2.3) * 0.06
      // Arms hang and sway; while talking the right one waves
      for (const { shoulder, side } of arms) {
        const wave = side > 0 ? talk : 0
        shoulder.rotation.z = side * (0.25 + Math.sin(clock * 2 + side) * 0.08) + side * wave * (1.7 + Math.sin(clock * 11) * 0.35)
        shoulder.rotation.x = Math.sin(clock * 2.6 + side * 2) * 0.12
      }
      // Lights: slow heartbeat on the antenna (fast while talking), blinking eyes, flickering flame
      const beat = 0.5 + 0.5 * Math.sin(clock * (3 + talk * 11))
      bulbMat.emissiveIntensity = 0.35 + beat * 1.5
      bulb.scale.setScalar(0.9 + beat * 0.25)
      const blink = clock % 3.4 > 3.25 ? 0.12 : 1
      for (const eye of eyes) eye.scale.set(1, blink * (1 + talk * 0.15 * Math.sin(clock * 12)), 1)
      chestMat.emissiveIntensity = 0.6 + 0.5 * Math.sin(clock * 4)
      flame.scale.set(1, 0.8 + Math.sin(clock * 31) * 0.18 + Math.min(0.8, speed * 0.02), 1)
      flameMat.opacity = 0.7 + Math.sin(clock * 23) * 0.15
    },

    /** World point `margin` above the antenna bulb. */
    headTop(out: THREE.Vector3, margin = 0) {
      return out.set(root.position.x, root.position.y + TOP * root.scale.y + margin, root.position.z)
    },

    /** True while it is on stage (or popping out). */
    get visible() {
      return root.visible
    },

    dispose() {
      for (const g of geometries) g.dispose()
      for (const m of materials) m.dispose()
    },
  }
}
