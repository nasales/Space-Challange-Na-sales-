// A featured case's witness: a stylised low-poly toon character built from a WitnessLook
// (src/shared/witness.ts). Same toon materials, ink outline and proportions as the detective
// (big head, short body), scaled by DETECTIVE_SCALE times look.height. No external assets.
// It looks towards -Z, like the detective.
//
// Hierarchy:  root (position and yaw) -> body (breathing, weight shift)
//               -> legs, torso, arms (shoulder -> elbow -> hand), head -> hair, hat, glasses
//
//   const w = createWitness(look)
//   scene.add(w.root)
//   w.update(dt, { lookAt, wave, talking, listening })   // every frame
//   w.headTop(out)                                       // world point just above the head
import * as THREE from 'three'
import { toonMaterial } from '../scene/toonGradient'
import { DETECTIVE_SCALE } from '../detective/detectiveSize'
import type { WitnessLook } from '../../shared/witness'

/** Same soft violet shadow as the detective (dark clothes do not turn purple). */
const SHADOW = 0.55
const SHOES = 0x4a3020
const BELT = 0x3b2a1e
const EYES = 0xffffff
const DARK = 0x2b2540
const DEFAULT_HAT: Record<string, string> = { cap: '#2f3a4a', straw: '#e3c27a', beret: '#7a2f3a' }

// Model units (before scaling), close to the detective's
const HIP = 0.85
const SHOULDER = 1.65
const HEAD_Y = SHOULDER + 0.08
const HEAD_R = 0.5
/** Top of the head or hat in head-pivot units, per hat style (for the speech bubble anchor). */
const TOP: Record<string, number> = { none: 1.02, cap: 1.1, straw: 1.18, beret: 1.12 }

/** Speed at which the witness turns towards what he looks at (1/s). */
const TURN_RATE = 4

export interface WitnessPose {
  /** World point to turn towards (the detective), or null to keep the rest heading */
  lookAt?: { x: number; z: number } | null
  /** Yaw to keep when lookAt is null (rad, same convention as the detective's heading) */
  restHeading?: number
  /** World point the head turns towards (within its reach), e.g. the detective in a dialogue */
  gazeAt?: { x: number; z: number } | null
  /** Wave a hand (detective nearby) */
  wave?: boolean
  /** Talking: head bob, mouth and hand gestures */
  talking?: boolean
  /** Listening (in a dialogue, the detective talks): small nods */
  listening?: boolean
}

export function createWitness(look: WitnessLook) {
  const materials = new Map<string, THREE.Material>()
  const mat = (color: THREE.ColorRepresentation) => {
    const key = new THREE.Color(color).getHexString()
    if (!materials.has(key)) materials.set(key, toonMaterial(color, {}, SHADOW))
    return materials.get(key)!
  }
  const geometries: THREE.BufferGeometry[] = []
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, x = 0, y = 0, z = 0) => {
    geometries.push(geo)
    const m = new THREE.Mesh(geo, mat(color))
    m.position.set(x, y, z)
    m.castShadow = true
    parent.add(m)
    return m
  }
  const box = (p: THREE.Object3D, w: number, h: number, d: number, c: THREE.ColorRepresentation, x = 0, y = 0, z = 0) =>
    add(p, new THREE.BoxGeometry(w, h, d), c, x, y, z)
  const ball = (p: THREE.Object3D, r: number, c: THREE.ColorRepresentation, x = 0, y = 0, z = 0, detail = 2) =>
    add(p, new THREE.IcosahedronGeometry(r, detail), c, x, y, z)
  const cyl = (p: THREE.Object3D, rt: number, rb: number, h: number, c: THREE.ColorRepresentation, x = 0, y = 0, z = 0, seg = 12) =>
    add(p, new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y, z)
  const pivot = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    parent.add(g)
    return g
  }

  const { skin, hair, shirt, trousers } = look
  const root = new THREE.Group()
  root.name = 'witness'
  const scaler = pivot(root, 0, 0, 0)
  scaler.scale.setScalar(DETECTIVE_SCALE * (look.height ?? 1))
  const body = pivot(scaler, 0, 0, 0)

  // ---- Legs (pivot at the hip) ----
  const legs = [-1, 1].map((side) => {
    const leg = pivot(body, side * 0.19, HIP, 0)
    box(leg, 0.23, 0.68, 0.25, trousers, 0, -0.34, 0)
    box(leg, 0.27, 0.15, 0.42, SHOES, 0, -0.76, -0.07)
    return leg
  })

  // ---- Torso: shirt with a small belly, belt, optional vest/apron ----
  const torso = pivot(body, 0, 0, 0)
  cyl(torso, 0.36, 0.44, 0.85, shirt, 0, HIP + 0.42, 0)
  const belly = ball(torso, 0.36, look.apron ?? shirt, 0, HIP + 0.3, -0.1)
  belly.scale.set(1.05, 0.9, 0.85)
  cyl(torso, 0.455, 0.455, 0.1, BELT, 0, HIP + 0.06, 0)
  box(torso, 0.12, 0.09, 0.04, 0xc9a24a, 0, HIP + 0.06, -0.46) // buckle
  if (look.apron) {
    // Work vest over the shirt: open at the front (a strip of shirt shows) with two pockets
    cyl(torso, 0.385, 0.45, 0.62, look.apron, 0, HIP + 0.52, 0)
    box(torso, 0.12, 0.62, 0.04, shirt, 0, HIP + 0.52, -0.425).rotation.x = 0.05
    const pocketColor = new THREE.Color(look.apron).multiplyScalar(0.8)
    for (const side of [-1, 1]) box(torso, 0.16, 0.13, 0.04, pocketColor, side * 0.21, HIP + 0.38, -0.425)
  }
  for (const side of [-1, 1]) {
    const collar = box(torso, 0.2, 0.06, 0.16, shirt, side * 0.12, SHOULDER - 0.02, -0.22)
    collar.rotation.set(0.3, side * 0.4, 0)
  }
  cyl(torso, 0.15, 0.17, 0.18, skin, 0, SHOULDER + 0.03, 0, 10) // neck

  // ---- Arms: shoulder -> elbow -> hand; rolled-up sleeves ----
  const arms = [-1, 1].map((side) => {
    const shoulder = pivot(body, side * 0.47, SHOULDER - 0.06, 0)
    ball(shoulder, 0.12, look.apron ?? shirt, 0, 0, 0, 1)
    box(shoulder, 0.19, 0.38, 0.21, shirt, 0, -0.19, 0)
    const elbow = pivot(shoulder, 0, -0.37, 0)
    box(elbow, 0.215, 0.08, 0.235, shirt, 0, -0.01, 0) // rolled cuff
    box(elbow, 0.16, 0.28, 0.17, skin, 0, -0.17, 0)
    ball(elbow, 0.11, skin, 0, -0.35, 0)
    return { shoulder, elbow }
  })

  // ---- Big head: friendly face ----
  const head = pivot(body, 0, HEAD_Y, 0)
  ball(head, HEAD_R, skin, 0, 0.48, 0)
  ball(head, 0.12, new THREE.Color(skin).offsetHSL(0, 0.05, -0.06), 0, 0.4, -0.49) // nose
  for (const side of [-1, 1]) {
    const eye = ball(head, 0.085, EYES, side * 0.18, 0.55, -0.43)
    eye.scale.set(0.9, 1.1, 0.5)
    const pupil = ball(head, 0.05, DARK, side * 0.18, 0.54, -0.47)
    pupil.scale.set(1, 1.2, 0.5)
    const brow = box(head, 0.2, 0.055, 0.06, hair, side * 0.19, 0.7, -0.43)
    brow.rotation.z = side * -0.18 // outer ends down: kind, a little worried
    const ear = ball(head, 0.11, skin, side * 0.49, 0.45, -0.02)
    ear.scale.set(0.6, 1, 0.8)
  }
  const mouth = box(head, 0.18, 0.045, 0.05, DARK, 0, 0.24, look.beard ? -0.5 : -0.46)

  // ---- Hair ----
  const hairCap = () => {
    const h = ball(head, 0.51, hair, 0, 0.55, 0.07)
    h.scale.set(1.02, 0.75, 1)
  }
  switch (look.hairStyle) {
    case 'short':
      hairCap()
      break
    case 'bald': {
      // Only a fringe around the back and the sides
      const fringe = ball(head, 0.51, hair, 0, 0.4, 0.08)
      fringe.scale.set(1.04, 0.42, 0.98)
      break
    }
    case 'bun':
      hairCap()
      ball(head, 0.19, hair, 0, 0.98, 0.3)
      break
    case 'long':
      hairCap()
      box(head, 0.86, 0.72, 0.3, hair, 0, 0.22, 0.3)
      for (const side of [-1, 1]) box(head, 0.14, 0.6, 0.4, hair, side * 0.44, 0.3, 0.05)
      break
    case 'curly':
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2
        const ring = i % 2 ? 0.75 : 1.15 // two rings of curls, back-top half of the head
        ball(head, 0.17, hair, Math.sin(a) * 0.42, 0.55 + Math.cos(ring) * 0.32 + (i % 3) * 0.04, Math.cos(a) * 0.3 + 0.12, 1)
      }
      ball(head, 0.3, hair, 0, 0.88, 0.08, 1)
      break
  }
  if (look.beard) {
    const beard = ball(head, 0.36, hair, 0, 0.24, -0.2)
    beard.scale.set(1.05, 0.8, 0.85)
    box(head, 0.3, 0.07, 0.07, hair, 0, 0.31, -0.5) // moustache
  }

  // ---- Hat ----
  const hatColor = look.hatColor ?? DEFAULT_HAT[look.hat] ?? '#555555'
  if (look.hat === 'cap') {
    const dome = add(head, new THREE.SphereGeometry(0.535, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), hatColor, 0, 0.56, 0.01)
    dome.scale.set(1, 0.95, 1.03)
    const visor = box(head, 0.56, 0.04, 0.36, hatColor, 0, 0.6, -0.62)
    visor.rotation.x = -0.18
    ball(head, 0.05, hatColor, 0, 1.07, 0, 1)
  } else if (look.hat === 'straw') {
    cyl(head, 0.86, 0.86, 0.04, hatColor, 0, 0.8, 0, 18)
    cyl(head, 0.42, 0.5, 0.34, hatColor, 0, 0.98, 0, 14)
    cyl(head, 0.505, 0.505, 0.07, 0x7a4a2c, 0, 0.86, 0, 14)
  } else if (look.hat === 'beret') {
    const beret = ball(head, 0.55, hatColor, 0.05, 0.9, 0.02)
    beret.scale.set(1.05, 0.32, 1.05)
    beret.rotation.z = -0.18
    ball(head, 0.05, hatColor, 0.03, 1.08, 0, 1)
  }

  // ---- Glasses ----
  if (look.glasses) {
    for (const side of [-1, 1]) {
      add(head, new THREE.TorusGeometry(0.1, 0.022, 6, 14), DARK, side * 0.18, 0.55, -0.49)
      box(head, 0.03, 0.03, 0.42, DARK, side * 0.3, 0.57, -0.28) // temple arm
    }
    box(head, 0.12, 0.025, 0.03, DARK, 0, 0.57, -0.5) // bridge
  }

  // ---- Animation ----
  let time = Math.random() * 10 // own phase, so two witnesses never move in lockstep
  let wave = 0 // 0..1 blends
  let talk = 0
  let listen = 0
  let yaw: number | null = null
  let gaze = 0
  const topLocal = new THREE.Vector3(0, TOP[look.hat] ?? TOP.none, 0)
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k
  const ease = (v: number, target: number, rate: number, dt: number) => v + (target - v) * (1 - Math.exp(-rate * dt))

  const update = (dt: number, pose: WitnessPose = {}) => {
    time += dt
    wave = ease(wave, pose.wave && !pose.talking ? 1 : 0, 6, dt)
    talk = ease(talk, pose.talking ? 1 : 0, 8, dt)
    listen = ease(listen, pose.listening ? 1 : 0, 5, dt)

    // Facing: towards lookAt (plus the dialogue cheat), or the rest heading
    const target = pose.lookAt
      ? Math.atan2(-(pose.lookAt.x - root.position.x), -(pose.lookAt.z - root.position.z))
      : (pose.restHeading ?? root.rotation.y)
    if (yaw === null) yaw = target
    const diff = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw))
    yaw += diff * (1 - Math.exp(-TURN_RATE * dt))
    root.rotation.y = yaw

    // Idle: breathing, slow weight shift from one leg to the other, looks around now and then
    const shift = Math.sin(time * 0.55)
    body.scale.y = 1 + Math.sin(time * 2) * 0.015
    body.position.x = shift * 0.035
    body.rotation.z = -shift * 0.025
    legs[0].rotation.z = shift * 0.03
    legs[1].rotation.z = shift * 0.03
    const idleLook = (1 - talk) * (1 - listen) * (1 - wave)
    head.rotation.y = idleLook * Math.sin(time * 0.7) * Math.max(0, Math.sin(time * 0.23)) * 0.6
    // Gaze: the head turns to the point (the body may face a little away from it)
    const gazeTarget = pose.gazeAt
      ? Math.max(-0.9, Math.min(0.9, wrap(Math.atan2(-(pose.gazeAt.x - root.position.x), -(pose.gazeAt.z - root.position.z)) - yaw)))
      : 0
    gaze = ease(gaze, gazeTarget, 6, dt)
    head.rotation.y += gaze
    head.rotation.x = Math.sin(time * 1.5) * 0.03
    head.rotation.z = shift * 0.04

    // Arms hang relaxed, swaying a little
    for (const [i, a] of arms.entries()) {
      const side = i === 0 ? -1 : 1
      a.shoulder.rotation.set(Math.sin(time * 1.1 + i) * 0.04, 0, side * 0.12)
      a.elbow.rotation.set(0.15, 0, 0)
    }

    // Talking: head bob, mouth opens and closes, both hands gesture in front of the body
    if (talk > 0.001) {
      head.rotation.x += Math.sin(time * 9) * 0.06 * talk - 0.04 * talk
      head.rotation.z += Math.sin(time * 2.3) * 0.06 * talk
      for (const [i, a] of arms.entries()) {
        const side = i === 0 ? -1 : 1
        const g = Math.sin(time * (i ? 3.1 : 2.4) + i * 1.7)
        a.shoulder.rotation.x = lerp(a.shoulder.rotation.x, 0.35 + g * 0.25, talk)
        a.shoulder.rotation.z = lerp(a.shoulder.rotation.z, side * (0.3 + Math.max(0, g) * 0.25), talk)
        a.elbow.rotation.x = lerp(a.elbow.rotation.x, 1.0 + g * 0.35, talk)
      }
    }
    mouth.scale.y = 1 + talk * (1.5 + 1.5 * Math.sin(time * 15) * Math.sin(time * 6.7))

    // Listening: slow nods
    if (listen > 0.001) head.rotation.x += Math.max(0, Math.sin(time * 2.2)) * 0.12 * listen

    // Waving: right arm up to the side, forearm swings
    if (wave > 0.001) {
      const r = arms[1]
      r.shoulder.rotation.x = lerp(r.shoulder.rotation.x, 0.15, wave)
      r.shoulder.rotation.z = lerp(r.shoulder.rotation.z, 2.0, wave)
      r.elbow.rotation.x = lerp(r.elbow.rotation.x, 0, wave)
      r.elbow.rotation.z = lerp(0, 0.7 + Math.sin(time * 9) * 0.45, wave)
      head.rotation.z += 0.08 * wave
    } else {
      arms[1].elbow.rotation.z = 0
    }
  }

  return {
    root,
    update,
    /** World point just above the head (or hat), plus `margin` world units. */
    headTop(out: THREE.Vector3, margin = 0) {
      head.localToWorld(out.copy(topLocal))
      out.y += margin
      return out
    },
    dispose() {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
    },
  }
}
