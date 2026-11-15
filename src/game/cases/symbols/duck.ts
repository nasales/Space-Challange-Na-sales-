// Duck (daimiel): a chunky mallard drake, green head, white collar, brown chest, grey body,
// orange beak and feet. Faces +X.
import * as THREE from 'three'
import type { SymbolKit } from './kit'

const HEAD = 0x2e8b57
const COLLAR = 0xf4f7ff
const CHEST = 0x8a5a3c
const BODY = 0xc9c3b6
const WING = 0x8f8a80
const TAIL = 0x2a2d3a
const BEAK = 0xffa21f
const EYE = 0x1d1d22

/** Body: ellipsoid half sizes (length, height, width) and centre height (world units). */
const BODY_SIZE = { x: 52, y: 32, z: 36 }
const BODY_Y = 46
/** Chest: sphere at the front of the body. */
const CHEST_RADIUS = 30
/** Wings: flattened ellipsoids on each side. */
const WING_SIZE = { x: 34, y: 18, z: 8 }
/** Tail: cone pointing back and up. */
const TAIL_SIZE = { r: 14, l: 26 }
/** Neck and head: neck radius, head radius and centre. */
const NECK_RADIUS = 15
const HEAD_RADIUS = 27
const HEAD_AT = { x: 36, y: 122 }
/** Collar ring: radius and thickness. */
const COLLAR_RING = { r: 15, tube: 3.5 }
/** Beak: flat wedge length, width, thickness. */
const BEAK_SIZE = { l: 26, w: 20, t: 8 }
const EYE_RADIUS = 3.6
/** Feet: flat boxes under the body. */
const FOOT = { l: 18, h: 4, w: 12 }
/** Feet position (x, side offset); legs up into the body (radius, top height). */
const FOOT_X = 0
const FOOT_Z = 14
const LEG_RADIUS = 3.5
const LEG_TOP = 26

export function buildDuck(kit: SymbolKit) {
  const root = new THREE.Group()
  const sphere = kit.geo('duck.sphere', () => new THREE.IcosahedronGeometry(1, 1))

  const body = kit.part(sphere, kit.mat(BODY), -6, BODY_Y, 0)
  body.scale.set(BODY_SIZE.x, BODY_SIZE.y, BODY_SIZE.z)
  root.add(body)
  const chest = kit.part(sphere, kit.mat(CHEST), 26, BODY_Y + 8, 0)
  chest.scale.setScalar(CHEST_RADIUS)
  root.add(chest)
  for (const side of [-1, 1]) {
    const wing = kit.part(sphere, kit.mat(WING), -12, BODY_Y + 8, side * (BODY_SIZE.z - 4))
    wing.scale.set(WING_SIZE.x, WING_SIZE.y, WING_SIZE.z)
    wing.rotation.z = 0.18
    root.add(wing)
  }
  const tailGeo = kit.geo('duck.tail', () => new THREE.ConeGeometry(TAIL_SIZE.r, TAIL_SIZE.l, 5))
  const tail = kit.part(tailGeo, kit.mat(TAIL), -BODY_SIZE.x - 4, BODY_Y + 16, 0)
  tail.rotation.z = Math.PI / 2 + 0.6 // back and up
  root.add(tail)

  const neckH = HEAD_AT.y - (BODY_Y + 20)
  const neckGeo = kit.geo('duck.neck', () => new THREE.CylinderGeometry(NECK_RADIUS, NECK_RADIUS * 1.15, neckH, 7))
  root.add(kit.part(neckGeo, kit.mat(HEAD), HEAD_AT.x - 4, BODY_Y + 20 + neckH / 2, 0))
  const collarGeo = kit.geo('duck.collar', () => new THREE.TorusGeometry(COLLAR_RING.r, COLLAR_RING.tube, 4, 10))
  const collar = kit.part(collarGeo, kit.mat(COLLAR), HEAD_AT.x - 4, BODY_Y + 34, 0)
  collar.rotation.x = Math.PI / 2
  root.add(collar)
  const head = kit.part(sphere, kit.mat(HEAD), HEAD_AT.x, HEAD_AT.y, 0)
  head.scale.setScalar(HEAD_RADIUS)
  root.add(head)

  const beakGeo = kit.geo('duck.beak', () => new THREE.BoxGeometry(BEAK_SIZE.l, BEAK_SIZE.t, BEAK_SIZE.w))
  const beak = kit.part(beakGeo, kit.mat(BEAK), HEAD_AT.x + HEAD_RADIUS + BEAK_SIZE.l * 0.3, HEAD_AT.y - 6, 0)
  beak.rotation.z = -0.12
  root.add(beak)
  for (const side of [-1, 1]) {
    const eye = kit.part(sphere, kit.mat(EYE), HEAD_AT.x + 10, HEAD_AT.y + 6, side * (HEAD_RADIUS - 4))
    eye.scale.setScalar(EYE_RADIUS)
    root.add(eye)
  }
  const footGeo = kit.geo('duck.foot', () => new THREE.BoxGeometry(FOOT.l, FOOT.h, FOOT.w))
  const legGeo = kit.geo('duck.leg', () => new THREE.CylinderGeometry(LEG_RADIUS, LEG_RADIUS, LEG_TOP, 5))
  for (const side of [-1, 1]) {
    root.add(kit.part(footGeo, kit.mat(BEAK), FOOT_X + FOOT.l * 0.25, FOOT.h / 2, side * FOOT_Z))
    root.add(kit.part(legGeo, kit.mat(BEAK), FOOT_X, LEG_TOP / 2, side * FOOT_Z))
  }
  return root
}
