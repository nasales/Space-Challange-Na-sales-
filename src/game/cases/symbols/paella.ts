// Paella (dana_valencia): a wide flat pan with two handles, yellow rice, prawns and a lemon wedge.
// Tilted toward the viewer so the rice on top shows from the chase camera.
import * as THREE from 'three'
import type { SymbolKit } from './kit'

const PAN = 0x3b3d46 // dark steel
const RICE = 0xf2b31c // saffron yellow
const PRAWN = 0xff6a3d
const LEMON = 0xfff27a
const LEMON_RIND = 0xe8d21a
const BEAN = 0x4fa83a

/** Pan: radius at the rim and at the bottom, wall height (world units). */
const PAN_RADIUS = 66
const PAN_BOTTOM_RADIUS = 60
const PAN_DEPTH = 12
const PAN_SEGMENTS = 12
/** Rice layer: radius, thickness and how far its top stands above the pan (inside the rim). */
const RICE_RADIUS = 57
const RICE_THICKNESS = 4
const RICE_ABOVE_PAN = 1.5
/** Handles: loop radius and tube thickness, just outside the rim. */
const HANDLE_RADIUS = 11
const HANDLE_TUBE = 3.6
/** Prawns: curled arcs lying on the rice (radius, thickness, arc). */
const PRAWN_RADIUS = 10
const PRAWN_TUBE = 4.2
const PRAWN_ARC = Math.PI * 1.25
const PRAWNS = [
  { x: -28, z: -18, turn: 0.4 },
  { x: 24, z: -26, turn: 2.1 },
  { x: -20, z: 28, turn: 3.6 },
  { x: 32, z: 18, turn: 5.0 },
]
/** Lemon wedge: radius, thickness, opening angle, position on the rice. */
const LEMON_RADIUS = 18
const LEMON_THICKNESS = 9
const LEMON_ANGLE = Math.PI * 0.55
const LEMON_AT = { x: -4, z: -2 }
/** Rind: how much wider than the flesh. */
const RIND = 2
/** Green beans: small boxes (length, width) scattered on the rice. */
const BEAN_SIZE = { l: 12, w: 4 }
const BEANS = [
  { x: -44, z: 4, turn: 0.3 },
  { x: 6, z: -44, turn: 1.4 },
  { x: 44, z: -4, turn: 2.6 },
  { x: 8, z: 42, turn: 0.9 },
]
/** Height of the pan's centre above y = 0 and its tilt toward the viewer (rad). */
const CENTRE_Y = 80
const TILT = 0.75

export function buildPaella(kit: SymbolKit) {
  const root = new THREE.Group()
  const pan = new THREE.Group() // the dish, built flat and tilted as a whole
  const steel = kit.mat(PAN)
  const panGeo = kit.geo('paella.pan', () => new THREE.CylinderGeometry(PAN_RADIUS, PAN_BOTTOM_RADIUS, PAN_DEPTH, PAN_SEGMENTS))
  pan.add(kit.part(panGeo, steel))
  const riceY = PAN_DEPTH / 2 + RICE_ABOVE_PAN - RICE_THICKNESS / 2
  const riceGeo = kit.geo('paella.rice', () => new THREE.CylinderGeometry(RICE_RADIUS, RICE_RADIUS, RICE_THICKNESS, PAN_SEGMENTS))
  pan.add(kit.part(riceGeo, kit.mat(RICE), 0, riceY + 0.01, 0))
  const topY = riceY + RICE_THICKNESS / 2

  const handleGeo = kit.geo('paella.handle', () => new THREE.TorusGeometry(HANDLE_RADIUS, HANDLE_TUBE, 5, 8, Math.PI))
  for (const side of [-1, 1]) {
    const h = kit.part(handleGeo, steel, side * (PAN_RADIUS - HANDLE_TUBE), PAN_DEPTH / 2 - HANDLE_TUBE, 0)
    h.rotation.x = -Math.PI / 2 // lie flat
    h.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2 // arch pointing away from the pan
    pan.add(h)
  }

  const prawnGeo = kit.geo('paella.prawn', () => new THREE.TorusGeometry(PRAWN_RADIUS, PRAWN_TUBE, 5, 8, PRAWN_ARC))
  for (const p of PRAWNS) {
    const m = kit.part(prawnGeo, kit.mat(PRAWN), p.x, topY + PRAWN_TUBE * 0.6, p.z)
    m.rotation.x = -Math.PI / 2
    m.rotation.z = p.turn
    pan.add(m)
  }

  const lemonGeo = kit.geo('paella.lemon', () =>
    new THREE.CylinderGeometry(LEMON_RADIUS, LEMON_RADIUS, LEMON_THICKNESS, 6, 1, false, 0, LEMON_ANGLE),
  )
  pan.add(kit.part(lemonGeo, kit.mat(LEMON), LEMON_AT.x, topY + LEMON_THICKNESS / 2, LEMON_AT.z))
  const rindGeo = kit.geo('paella.rind', () =>
    new THREE.CylinderGeometry(LEMON_RADIUS + RIND, LEMON_RADIUS + RIND, LEMON_THICKNESS * 0.8, 6, 1, false, 0, LEMON_ANGLE),
  )
  pan.add(kit.part(rindGeo, kit.mat(LEMON_RIND), LEMON_AT.x, topY + LEMON_THICKNESS * 0.4, LEMON_AT.z))

  const beanGeo = kit.geo('paella.bean', () => new THREE.BoxGeometry(BEAN_SIZE.l, BEAN_SIZE.w, BEAN_SIZE.w))
  for (const b of BEANS) {
    const m = kit.part(beanGeo, kit.mat(BEAN), b.x, topY + BEAN_SIZE.w / 2, b.z)
    m.rotation.y = b.turn
    pan.add(m)
  }

  pan.position.y = CENTRE_Y
  pan.rotation.x = TILT
  root.add(pan)
  return root
}
