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
//   w.update(dt, { lookAt, wave, talking, listening, mood })   // every frame
//   w.headTop(out)                                             // world point just above the head
//   w.setGlow(0..1)                                            // warm glow (detective in the zone)
//
// Talking and listening follow the mood of the line (src/shared/tutorial.ts LineMood): each mood
// is a pose of the arms, head and body plus a face (brows, mouth), blended smoothly.
import * as THREE from 'three'
import { toonMaterial } from '../scene/toonGradient'
import { DETECTIVE_SCALE } from '../detective/detectiveSize'
import type { WitnessLook } from '../../shared/witness'
import type { LineMood } from '../../shared/tutorial'

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
  /** Mood of the line being spoken (by him when talking, by the detective when listening) */
  mood?: LineMood | null
}

const MOODS: LineMood[] = ['neutral', 'happy', 'curious', 'explaining', 'sad', 'proud', 'doubtful', 'insistent', 'determined', 'confident']

/**
 * One arm: [forward swing, outward swing, elbow bend, forearm inward] (rad). Forward/bend > 0 bring
 * the arm and forearm up in front; inward turns the forearm towards the belly (hands on hips, chest).
 */
type Arm = [number, number, number, number]
interface MoodPose {
  /** Head pitch (> 0 up), yaw, roll (rad) */
  hx: number
  hy: number
  hz: number
  /** Body lean back (> 0: chest out) and small hop (model units) */
  lean: number
  hop: number
  left: Arm
  right: Arm
  /** Pointing finger / thumb up on the right hand (0..1) */
  finger: number
  thumb: number
  /** Brows: tilt (> 0: inner ends down, stern; < 0: worried), lift, and extra lift of one brow */
  browTilt: number
  browLift: number
  browOne: number
  /** Mouth: smile (> 0) or frown (< 0), and width factor */
  smile: number
  mouthWidth: number
  /** Animation speed (sad lines are slower) */
  speed: number
}

/** Talking pose of each mood at time t (talk clock, seconds). */
function moodPose(m: LineMood, t: number): MoodPose {
  const g0 = Math.sin(t * 2.4), g1 = Math.sin(t * 3.1 + 1.7), bob = Math.sin(t * 9)
  const p: MoodPose = {
    hx: bob * 0.06 - 0.04, hy: 0, hz: Math.sin(t * 2.3) * 0.06, lean: 0, hop: 0,
    left: [0.35 + g0 * 0.25, 0.3 + Math.max(0, g0) * 0.25, 1.0 + g0 * 0.35, 0],
    right: [0.35 + g1 * 0.25, 0.3 + Math.max(0, g1) * 0.25, 1.0 + g1 * 0.35, 0],
    finger: 0, thumb: 0, browTilt: 0, browLift: 0, browOne: 0, smile: 0, mouthWidth: 1, speed: 1,
  }
  switch (m) {
    case 'happy': // big smile, open arms, a little bounce
      p.hx = 0.1 + bob * 0.05
      p.hz = Math.sin(t * 2) * 0.08
      p.lean = 0.04
      p.hop = Math.abs(Math.sin(t * 4)) * 0.05
      p.left = [0.5 + g0 * 0.12, 1.0 + g0 * 0.15, 0.5, 0]
      p.right = [0.5 + g1 * 0.12, 1.0 + g1 * 0.15, 0.5, 0]
      p.browLift = 0.05
      p.browTilt = -0.05
      p.smile = 1
      break
    case 'curious': // head tilted, one hand palm up, one brow up
      p.hx = 0.06 + bob * 0.03
      p.hy = 0.12
      p.hz = 0.3 + Math.sin(t * 1.3) * 0.04
      p.left = [0.05, 0.12, 0.15, 0]
      p.right = [0.75 + g1 * 0.1, 0.4, 1.3, 0.3]
      p.browOne = 0.08
      p.mouthWidth = 0.6
      break
    case 'explaining': // one hand beats the rhythm up and out, the other rests in front
      p.hx = bob * 0.05 - 0.02
      p.right = [1.0 + Math.sin(t * 3.5) * 0.35, 0.55 + Math.sin(t * 1.7) * 0.2, 0.7 + Math.sin(t * 3.5 + 0.8) * 0.4, 0]
      p.left = [0.4, 0.2, 1.1, 0.5]
      p.browLift = 0.02
      break
    case 'sad': // head down, hand on the chest, slow
      p.hx = -0.26 + bob * 0.015
      p.hz = 0.08
      p.lean = -0.05
      p.left = [0.05, 0.08, 0.1, 0]
      p.right = [0.85, -0.05, 1.75, 1.0]
      p.browTilt = -0.35
      p.browLift = 0.02
      p.smile = -0.8
      p.mouthWidth = 0.8
      p.speed = 0.55
      break
    case 'proud': // chest out, chin up, arms a little back
      p.hx = 0.15
      p.hz = Math.sin(t * 1.5) * 0.05
      p.lean = 0.1
      p.left = [-0.2 + g0 * 0.05, 0.35, 0.35, 0]
      p.right = [-0.2 + g1 * 0.05, 0.35, 0.35, 0]
      p.browLift = 0.03
      p.smile = 0.6
      break
    case 'doubtful': // hand on the chin, the other arm across, slow head shake, one brow up
      p.hx = 0.02
      p.hy = Math.sin(t * 5) * 0.2 * (Math.sin(t * 0.9) > 0 ? 1 : 0.25)
      p.hz = -0.12
      p.right = [1.25, 0, 1.95, 0.7]
      p.left = [0.45, 0.05, 1.55, 1.35]
      p.browOne = 0.08
      p.browTilt = 0.1
      p.mouthWidth = 0.55
      break
    case 'insistent': // pointing finger wags, strong nods, stern brows
      p.hx = 0.02 + Math.sin(t * 6) * 0.12
      p.lean = -0.04
      p.right = [1.35, 0.15, 0.35, 0.15 + Math.sin(t * 10) * 0.25]
      p.left = [0.2, 0.15, 0.6, 0]
      p.finger = 1
      p.browTilt = 0.3
      break
    case 'determined': { // fist up in front, firm nods
      const beat = Math.max(0, Math.sin(t * 2.5)) ** 3
      p.hx = -0.05 - beat * 0.2
      p.hz = 0
      p.right = [0.9, 0.3, 1.8 + beat * 0.25, 0.4]
      p.left = [0.15, 0.12, 0.3, 0]
      p.browTilt = 0.22
      p.mouthWidth = 0.8
      break
    }
    case 'confident': // hand on the hip, thumb up
      p.hx = 0.06 + bob * 0.04
      p.lean = 0.05
      p.left = [-0.1, 0.75, 0.3, 1.5]
      p.right = [0.5, 0.25, 1.25, 0.2]
      p.thumb = 1
      p.browLift = 0.02
      p.smile = 0.7
      break
  }
  return p
}

/** Game-side extras of a witness's look that src/shared/witness.ts does not describe. */
export interface WitnessStyle {
  /**
   * How `look.apron` is worn: an open work vest with two pockets (default, Vicent) or a shop
   * apron with a bib, neck strap and a skirt down to the knees (Pilar's kiosk).
   */
  apron?: 'vest' | 'bib'
}

export function createWitness(look: WitnessLook, style: WitnessStyle = {}) {
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
  const bib = !!look.apron && style.apron === 'bib'
  const belly = ball(torso, 0.36, bib ? shirt : (look.apron ?? shirt), 0, HIP + 0.3, -0.1)
  belly.scale.set(1.05, 0.9, 0.85)
  cyl(torso, 0.455, 0.455, 0.1, BELT, 0, HIP + 0.06, 0)
  if (!bib) box(torso, 0.12, 0.09, 0.04, 0xc9a24a, 0, HIP + 0.06, -0.46) // buckle
  if (look.apron && bib) {
    // Shop apron: a long bib from the chest down over the belly to the waist, a strap round
    // the neck, ties round the waist and a wrap-around skirt to mid-thigh with a big front pocket.
    // Its light colour over the dark shirt and trousers reads from the chase camera
    const pocketColor = new THREE.Color(look.apron).multiplyScalar(0.82)
    box(torso, 0.52, 0.84, 0.05, look.apron, 0, HIP + 0.5, -0.44).rotation.x = 0.05
    const strap = add(torso, new THREE.TorusGeometry(0.2, 0.025, 5, 16), look.apron, 0, SHOULDER - 0.06, -0.13)
    strap.rotation.x = Math.PI / 2 - 0.75 // neck loop, dipping to the top of the bib
    strap.scale.set(1, 1.25, 1)
    cyl(torso, 0.462, 0.462, 0.07, look.apron, 0, HIP + 0.06, 0) // ties over the belt
    // Skirt: an open piece of cone round the front and sides (seen from inside too)
    const skirtGeo = new THREE.CylinderGeometry(0.47, 0.52, 0.55, 14, 1, true, Math.PI - 1.2, 2.4)
    geometries.push(skirtGeo)
    const skirtMat = toonMaterial(look.apron, { side: THREE.DoubleSide }, SHADOW)
    materials.set('apron-skirt', skirtMat)
    const skirt = new THREE.Mesh(skirtGeo, skirtMat)
    skirt.position.set(0, HIP - 0.22, -0.02)
    skirt.castShadow = true
    torso.add(skirt)
    box(torso, 0.36, 0.17, 0.03, pocketColor, 0, HIP - 0.24, -0.535).rotation.x = -0.09
  } else if (look.apron) {
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
    ball(shoulder, 0.12, bib ? shirt : (look.apron ?? shirt), 0, 0, 0, 1)
    box(shoulder, 0.19, 0.38, 0.21, shirt, 0, -0.19, 0)
    const elbow = pivot(shoulder, 0, -0.37, 0)
    box(elbow, 0.215, 0.08, 0.235, shirt, 0, -0.01, 0) // rolled cuff
    box(elbow, 0.16, 0.28, 0.17, skin, 0, -0.17, 0)
    const hand = ball(elbow, 0.11, skin, 0, -0.35, 0)
    return { shoulder, elbow, hand }
  })
  // Pointing finger and thumb on the right hand, only shown in some moods
  const finger = box(arms[1].elbow, 0.055, 0.2, 0.06, skin, 0, -0.49, -0.02)
  const thumb = box(arms[1].elbow, 0.065, 0.065, 0.19, skin, 0, -0.36, -0.15)
  finger.visible = thumb.visible = false

  // ---- Big head: friendly face ----
  const head = pivot(body, 0, HEAD_Y, 0)
  ball(head, HEAD_R, skin, 0, 0.48, 0)
  ball(head, 0.12, new THREE.Color(skin).offsetHSL(0, 0.05, -0.06), 0, 0.4, -0.49) // nose
  const brows: THREE.Mesh[] = []
  for (const side of [-1, 1]) {
    const eye = ball(head, 0.085, EYES, side * 0.18, 0.55, -0.43)
    eye.scale.set(0.9, 1.1, 0.5)
    const pupil = ball(head, 0.05, DARK, side * 0.18, 0.54, -0.47)
    pupil.scale.set(1, 1.2, 0.5)
    const brow = box(head, 0.2, 0.055, 0.06, hair, side * 0.19, 0.7, -0.43)
    brow.rotation.z = side * -0.18 // outer ends down: kind, a little worried
    brows.push(brow)
    const ear = ball(head, 0.11, skin, side * 0.49, 0.45, -0.02)
    ear.scale.set(0.6, 1, 0.8)
  }
  const mouthZ = look.beard ? -0.5 : -0.46
  const mouth = box(head, 0.18, 0.045, 0.05, DARK, 0, 0.24, mouthZ)
  // Smile and frown: half rings, shown instead of the straight mouth when the mood asks for it
  const arc = (y: number, roll: number) => {
    const m = add(head, new THREE.TorusGeometry(0.1, 0.026, 6, 14, Math.PI), DARK, 0, y, mouthZ - 0.005)
    m.rotation.set(-0.25, 0, roll)
    m.castShadow = false
    m.visible = false
    return m
  }
  const smileArc = arc(0.31, Math.PI) // U
  const frownArc = arc(0.2, 0) // upside-down U

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
    // Short full beard: a thin shell hugging the jaw and chin below the mouth (the mouth stays on
    // skin, readable), a bit lighter than the hair so it does not read as a hole, and a moustache
    const beardColor = new THREE.Color(hair).offsetHSL(0, 0, 0.07)
    const beard = add(head, new THREE.SphereGeometry(0.52, 18, 8, Math.PI - 0.5, Math.PI + 1.0, Math.PI * 0.68, Math.PI * 0.32), beardColor, 0, 0.48, 0)
    beard.scale.set(1.02, 1, 1.03)
    const chin = ball(head, 0.17, beardColor, 0, 0.1, -0.36, 1)
    chin.scale.set(1.3, 0.8, 0.9)
    const moustache = box(head, 0.32, 0.075, 0.08, beardColor, 0, 0.31, -0.5)
    moustache.rotation.x = -0.2
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
  /** Warm glow colour at full strength (emissive, linear RGB). */
  const GLOW_RGB = [0.32, 0.22, 0.04]
  const glowColor = new THREE.Color()
  let time = Math.random() * 10 // own phase, so two witnesses never move in lockstep
  let talkTime = 0 // talk clock: runs slower on sad lines
  let wave = 0 // 0..1 blends
  let talk = 0
  let listen = 0
  let yaw: number | null = null
  let gaze = 0
  /** Blend weight of each mood (sum ~1), eased so poses melt into each other. */
  const weights = Object.fromEntries(MOODS.map((m) => [m, m === 'neutral' ? 1 : 0])) as Record<LineMood, number>
  const topLocal = new THREE.Vector3(0, TOP[look.hat] ?? TOP.none, 0)
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
  const lerp = (a: number, b: number, k: number) => a + (b - a) * k
  const ease = (v: number, target: number, rate: number, dt: number) => v + (target - v) * (1 - Math.exp(-rate * dt))

  /** Talking pose: the mood poses mixed by their weights. */
  const blended = (t: number): MoodPose => {
    const out = moodPose('neutral', t)
    const keys = ['hx', 'hy', 'hz', 'lean', 'hop', 'finger', 'thumb', 'browTilt', 'browLift', 'browOne', 'smile', 'mouthWidth', 'speed'] as const
    for (const k of keys) out[k] = 0
    out.left = [0, 0, 0, 0]
    out.right = [0, 0, 0, 0]
    let total = 0
    for (const m of MOODS) {
      const w = weights[m]
      if (w < 0.002) continue
      const p = moodPose(m, t)
      total += w
      for (const k of keys) out[k] += p[k] * w
      for (let j = 0; j < 4; j++) {
        out.left[j] += p.left[j] * w
        out.right[j] += p.right[j] * w
      }
    }
    const n = 1 / (total || 1)
    for (const k of keys) out[k] *= n
    for (let j = 0; j < 4; j++) {
      out.left[j] *= n
      out.right[j] *= n
    }
    return out
  }

  /** Listening reaction to the detective's line: head down, nods, tilt, smile. Light on purpose. */
  const listening = () => {
    let down = 0, nod = 0, tilt = 0, smile = 0, slow = 0, total = 0
    for (const m of MOODS) {
      const w = weights[m]
      if (w < 0.002) continue
      total += w
      if (m === 'sad') { down += -0.22 * w; nod += 0.05 * w; slow += w }
      else if (m === 'insistent' || m === 'determined') nod += 0.18 * w
      else if (m === 'happy' || m === 'proud' || m === 'confident') { down += 0.04 * w; nod += 0.08 * w; smile += 0.6 * w }
      else if (m === 'curious') { tilt += 0.16 * w; nod += 0.06 * w }
      else if (m === 'doubtful') { tilt += -0.1 * w; nod += 0.04 * w }
      else nod += 0.11 * w
    }
    const n = 1 / (total || 1)
    return { down: down * n, nod: nod * n, tilt: tilt * n, smile: smile * n, slow: slow * n }
  }

  const update = (dt: number, pose: WitnessPose = {}) => {
    time += dt
    wave = ease(wave, pose.wave && !pose.talking ? 1 : 0, 6, dt)
    talk = ease(talk, pose.talking ? 1 : 0, 8, dt)
    listen = ease(listen, pose.listening ? 1 : 0, 5, dt)
    const mood: LineMood = (pose.talking || pose.listening) && pose.mood ? pose.mood : 'neutral'
    for (const m of MOODS) weights[m] = ease(weights[m], m === mood ? 1 : 0, 5, dt)
    talkTime += dt * (1 - 0.45 * weights.sad)

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
    body.position.y = 0
    body.rotation.x = 0
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

    // Talking: the pose of the line's mood (arms, head, lean), with its own rhythm
    const P = blended(talkTime)
    if (talk > 0.001) {
      head.rotation.x += P.hx * talk
      head.rotation.y += P.hy * talk
      head.rotation.z += P.hz * talk
      body.rotation.x = P.lean * talk
      body.position.y = P.hop * talk
      for (const [i, a] of arms.entries()) {
        const side = i === 0 ? -1 : 1
        const A = i === 0 ? P.left : P.right
        a.shoulder.rotation.x = lerp(a.shoulder.rotation.x, A[0], talk)
        a.shoulder.rotation.z = lerp(a.shoulder.rotation.z, side * A[1], talk)
        a.elbow.rotation.x = lerp(a.elbow.rotation.x, A[2], talk)
        a.elbow.rotation.z = -side * A[3] * talk
      }
    }
    finger.visible = P.finger * talk > 0.5
    thumb.visible = P.thumb * talk > 0.5
    arms[1].hand.scale.setScalar(1 - 0.12 * Math.max(P.finger, P.thumb) * talk) // closed hand

    // Listening: nods, and a light reaction to the mood (head lowered on sad lines)
    const L = listening()
    if (listen > 0.001) {
      const nod = -Math.max(0, Math.sin(time * (2.2 - L.slow))) * L.nod
      head.rotation.x += (L.down + nod) * listen
      head.rotation.z += L.tilt * listen
    }

    // Face: brows and mouth follow the mood (talking fully, listening lightly)
    const k = Math.max(talk, listen * 0.6)
    const browTilt = (talk >= listen ? P.browTilt : P.browTilt * 0.5) * k
    const browLift = (talk >= listen ? P.browLift : 0) * k
    const browOne = P.browOne * k
    brows.forEach((b, i) => {
      const side = i === 0 ? -1 : 1
      b.rotation.z = side * (-0.18 + browTilt)
      b.position.y = 0.7 + browLift + (side > 0 ? browOne : -browOne * 0.3)
    })
    const smile = talk >= listen ? P.smile * talk : L.smile * listen
    const open = talk * (1.5 + 1.5 * Math.sin(time * 15) * Math.sin(time * 6.7))
    smileArc.visible = smile > 0.3
    frownArc.visible = smile < -0.3
    mouth.visible = !smileArc.visible && !frownArc.visible
    mouth.scale.set(lerp(1, P.mouthWidth, talk), 1 + open, 1)
    smileArc.scale.set(0.8 + 0.4 * Math.min(1, smile), 1 + open * 0.3, 1)
    frownArc.scale.set(0.9, 1 + open * 0.2, 1)

    // Waving: right arm high up to the side, forearm swings wide, a little hop on the toes
    if (wave > 0.001) {
      const r = arms[1]
      r.shoulder.rotation.x = lerp(r.shoulder.rotation.x, 0.15, wave)
      r.shoulder.rotation.z = lerp(r.shoulder.rotation.z, 2.5, wave)
      r.elbow.rotation.x = lerp(r.elbow.rotation.x, 0, wave)
      r.elbow.rotation.z = lerp(0, 0.6 + Math.sin(time * 9) * 0.6, wave)
      head.rotation.z += 0.1 * wave
      body.position.y += Math.abs(Math.sin(time * 4.5)) * 0.06 * wave
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
    /** Warm glow on the whole figure (0..1), e.g. while the detective is in the case zone. */
    setGlow(v: number) {
      glowColor.setRGB(GLOW_RGB[0] * v, GLOW_RGB[1] * v, GLOW_RGB[2] * v)
      materials.forEach((m) => (m as THREE.MeshToonMaterial).emissive.copy(glowColor))
    },
    dispose() {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
    },
  }
}
