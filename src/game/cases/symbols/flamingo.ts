// Flamingo (donana): pink bird standing on one leg, with a curved S neck and a bent beak.
// Faces +X.
import * as THREE from 'three'
import type { SymbolKit } from './kit'

const PINK = 0xff7fae
const PINK_DARK = 0xe0507f // legs, wings and tail
const BEAK = 0xfff1e0
const BEAK_TIP = 0x222228
const EYE = 0x222228

/** Standing leg: length and thickness; the body sits on top of it (world units). */
const LEG_LENGTH = 70
const LEG_RADIUS = 3.6
/** Foot: flat box (length, height, width). */
const FOOT = { l: 14, h: 2.5, w: 8 }
/** Folded leg: knee position, thigh and shin lengths. */
const KNEE = { x: 10, y: 50 }
const HIP = { x: -2, y: 74 }
const FOOT_TUCK = { x: -8, y: 60 }
/** Body: ellipsoid half sizes (length along x, height, width). */
const BODY = { x: 30, y: 18, z: 17 }
/** Wing: flattened ellipsoid on each side of the body. */
const WING = { x: 22, y: 11, z: 6 }
/** Tail: cone pointing back. */
const TAIL = { r: 10, l: 18 }
/** Neck: S-curve points (x, y above the body centre) up to the head, and thickness. */
const NECK_POINTS: [number, number][] = [[20, 6], [34, 22], [24, 40], [12, 54], [20, 66]]
const NECK_RADIUS = 5.4
/** Head radius; beak length, base radius and droop (rad). */
const HEAD_RADIUS = 9.5
const BEAK_LENGTH = 17
const BEAK_RADIUS = 4.6
const BEAK_DROOP = 2.1
const EYE_RADIUS = 2

/** A unit-length cylinder from a to b (2D points in the XY plane). */
function limb(kit: SymbolKit, geo: THREE.BufferGeometry, mat: THREE.Material, a: { x: number; y: number }, b: { x: number; y: number }) {
  const m = kit.part(geo, mat, (a.x + b.x) / 2, (a.y + b.y) / 2, 0)
  m.scale.y = Math.hypot(b.x - a.x, b.y - a.y)
  m.rotation.z = Math.atan2(-(b.x - a.x), b.y - a.y)
  return m
}

export function buildFlamingo(kit: SymbolKit) {
  const root = new THREE.Group()
  const pink = kit.mat(PINK)
  const dark = kit.mat(PINK_DARK)

  const legGeo = kit.geo('flamingo.leg', () => new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS, 1, 5))
  root.add(limb(kit, legGeo, dark, { x: 0, y: 0 }, { x: 0, y: LEG_LENGTH + 4 }))
  const footGeo = kit.geo('flamingo.foot', () => new THREE.BoxGeometry(FOOT.l, FOOT.h, FOOT.w))
  root.add(kit.part(footGeo, dark, 4, FOOT.h / 2, 0))
  // Folded leg: hip -> knee forward and down -> foot tucked back up (a "4")
  const fold = new THREE.Group()
  fold.position.z = 5
  fold.add(limb(kit, legGeo, dark, HIP, KNEE), limb(kit, legGeo, dark, KNEE, FOOT_TUCK))
  root.add(fold)

  const bodyY = LEG_LENGTH + BODY.y * 0.6
  const sphere = kit.geo('flamingo.sphere', () => new THREE.IcosahedronGeometry(1, 1))
  const body = kit.part(sphere, pink, 0, bodyY, 0)
  body.scale.set(BODY.x, BODY.y, BODY.z)
  root.add(body)
  for (const side of [-1, 1]) {
    const wing = kit.part(sphere, dark, -5, bodyY + 3, side * (BODY.z - 3))
    wing.scale.set(WING.x, WING.y, WING.z)
    wing.rotation.z = 0.15
    root.add(wing)
  }
  const tailGeo = kit.geo('flamingo.tail', () => new THREE.ConeGeometry(TAIL.r, TAIL.l, 5))
  const tail = kit.part(tailGeo, dark, -BODY.x - TAIL.l * 0.2, bodyY + 4, 0)
  tail.rotation.z = Math.PI / 2 + 0.3
  root.add(tail)

  const neckGeo = kit.geo('flamingo.neck', () => {
    const curve = new THREE.CatmullRomCurve3(NECK_POINTS.map(([x, y]) => new THREE.Vector3(x, y, 0)))
    return new THREE.TubeGeometry(curve, 16, NECK_RADIUS, 6, false)
  })
  root.add(kit.part(neckGeo, pink, 0, bodyY, 0))

  const [hx, hy] = NECK_POINTS[NECK_POINTS.length - 1]
  const headX = hx + 2, headY = bodyY + hy + 3
  const head = kit.part(sphere, pink, headX, headY, 0)
  head.scale.setScalar(HEAD_RADIUS)
  root.add(head)
  // Beak: cone from the front of the head, pointing forward and bent down
  const beakGeo = kit.geo('flamingo.beak', () => new THREE.ConeGeometry(BEAK_RADIUS, BEAK_LENGTH, 5).translate(0, BEAK_LENGTH / 2, 0))
  const beak = kit.part(beakGeo, kit.mat(BEAK), headX + HEAD_RADIUS * 0.6, headY, 0)
  beak.rotation.z = -BEAK_DROOP
  root.add(beak)
  const tipGeo = kit.geo('flamingo.tip', () => new THREE.ConeGeometry(BEAK_RADIUS * 0.6, BEAK_LENGTH * 0.4, 5).translate(0, BEAK_LENGTH * 0.2, 0))
  beak.add(kit.part(tipGeo, kit.mat(BEAK_TIP), 0, BEAK_LENGTH * 0.62, 0))
  for (const side of [-1, 1]) {
    const eye = kit.part(sphere, kit.mat(EYE), headX + 3, headY + 3, side * (HEAD_RADIUS - 2))
    eye.scale.setScalar(EYE_RADIUS)
    root.add(eye)
  }
  return root
}
