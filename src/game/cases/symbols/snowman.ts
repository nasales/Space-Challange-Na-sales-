// Snowman (filomena_madrid): three snowballs, a red scarf, a black top hat, a carrot nose,
// coal eyes and buttons, stick arms. Faces +Z.
import * as THREE from 'three'
import type { SymbolKit } from './kit'

const SNOW = 0xf4f7ff
const COAL = 0x26262c
const CARROT = 0xff8a1f
const SCARF = 0xe0382e
const STICK = 0x7a4e2c
const HAT_BAND = 0xe0382e

/** Snowballs from the bottom: radius and centre height (world units). */
const BALLS = [
  { r: 38, y: 36 },
  { r: 28, y: 90 },
  { r: 20, y: 128 },
]
/** Hat: brim and crown radius and height. Top at about 160. */
const BRIM = { r: 19, h: 3.5 }
const CROWN = { r: 13, h: 14 }
const HAT_BAND_HEIGHT = 4
/** Scarf ring around the neck: radius and thickness. */
const SCARF_RADIUS = 21
const SCARF_TUBE = 5
/** Nose: carrot cone length and base radius. */
const NOSE = { l: 20, r: 4.5 }
/** Coal: eye and button radius; button heights on the middle ball. */
const COAL_RADIUS = 3
const BUTTON_ANGLES = [-0.35, 0, 0.35] // tilt from the ball's front, up and down (rad)
/** Stick arms: length, radius, angle up from horizontal. */
const ARM = { l: 40, r: 2.4, up: 0.5 }

export function buildSnowman(kit: SymbolKit) {
  const root = new THREE.Group()
  const ball = kit.geo('snowman.ball', () => new THREE.IcosahedronGeometry(1, 2))
  const snow = kit.mat(SNOW)
  for (const b of BALLS) {
    const m = kit.part(ball, snow, 0, b.y, 0)
    m.scale.setScalar(b.r)
    root.add(m)
  }
  const [, mid, head] = BALLS
  const headTop = head.y + head.r

  const brimGeo = kit.geo('snowman.brim', () => new THREE.CylinderGeometry(BRIM.r, BRIM.r, BRIM.h, 10))
  const coal = kit.mat(COAL)
  root.add(kit.part(brimGeo, coal, 0, headTop - 4 + BRIM.h / 2, 0))
  const crownGeo = kit.geo('snowman.crown', () => new THREE.CylinderGeometry(CROWN.r, CROWN.r, CROWN.h, 10))
  root.add(kit.part(crownGeo, coal, 0, headTop - 4 + BRIM.h + CROWN.h / 2, 0))
  const bandGeo = kit.geo('snowman.band', () => new THREE.CylinderGeometry(CROWN.r + 0.6, CROWN.r + 0.6, HAT_BAND_HEIGHT, 10))
  root.add(kit.part(bandGeo, kit.mat(HAT_BAND), 0, headTop - 4 + BRIM.h + HAT_BAND_HEIGHT / 2, 0))

  const scarfGeo = kit.geo('snowman.scarf', () => new THREE.TorusGeometry(SCARF_RADIUS, SCARF_TUBE, 5, 12))
  const scarf = kit.part(scarfGeo, kit.mat(SCARF), 0, head.y - head.r + 2, 0)
  scarf.rotation.x = Math.PI / 2
  root.add(scarf)
  const tailGeo = kit.geo('snowman.scarfTail', () => new THREE.BoxGeometry(9, 24, 4))
  const tail = kit.part(tailGeo, kit.mat(SCARF), 10, head.y - head.r - 10, SCARF_RADIUS - 1)
  tail.rotation.z = 0.25
  root.add(tail)

  const noseGeo = kit.geo('snowman.nose', () => new THREE.ConeGeometry(NOSE.r, NOSE.l, 6).translate(0, NOSE.l / 2, 0))
  const nose = kit.part(noseGeo, kit.mat(CARROT), 0, head.y, head.r - 2)
  nose.rotation.x = Math.PI / 2
  root.add(nose)

  const coalGeo = kit.geo('snowman.coal', () => new THREE.IcosahedronGeometry(COAL_RADIUS, 0))
  for (const side of [-1, 1]) {
    const a = side * 0.38
    root.add(kit.part(coalGeo, coal, Math.sin(a) * head.r, head.y + 6, Math.cos(a) * head.r * 0.92))
  }
  for (const t of BUTTON_ANGLES) {
    root.add(kit.part(coalGeo, coal, 0, mid.y + Math.sin(t) * mid.r, Math.cos(t) * mid.r))
  }

  const armGeo = kit.geo('snowman.arm', () => new THREE.CylinderGeometry(ARM.r * 0.7, ARM.r, ARM.l, 5).translate(0, ARM.l / 2, 0))
  for (const side of [-1, 1]) {
    const arm = kit.part(armGeo, kit.mat(STICK), side * mid.r * 0.8, mid.y + 6, 0)
    arm.rotation.z = -side * (Math.PI / 2 - ARM.up)
    root.add(arm)
  }
  return root
}
