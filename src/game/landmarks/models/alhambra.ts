// La Alhambra (Granada), cartoon style: fat red towers with big merlons on wide feet, an
// exaggerated Comares tower, oversized fountain and plump cypresses. The Nasrid palace city on top of the Sabika hill, brought closer
// together: an almond-shaped ring of red walls with square towers; the Alcazaba fortress at the
// west end with the Torre de la Vela; the Nasrid palaces in the middle (Court of the Myrtles
// with its long pool and the Comares tower, Court of the Lions with its arcade and fountain);
// the square Palace of Charles V with its round courtyard; and gardens with cypresses and a
// long pool, like the Generalife, at the east end. Units are roughly metres; the long axis is X.
import * as THREE from 'three'
import type { Kit } from '../kit'
import { wonk } from '../kit'
import { cypress, horseshoeArch, merlonRing, merlons, wallBetween } from '../ornaments'

const RED = 0xe0703f // "red castle": rammed earth walls, warm and bright
const RED_D = 0xc85a34 // towers
const WHITE = 0xfff4de // palace walls
const ROOF = 0xdb6a3a
const STONE = 0xeac48f // Palace of Charles V
const WATER = 0x35b6f0
const HEDGE = 0x2f9a46
const DARK = 0x2b2540
const EARTH = 0xb38455
const GRASS = 0x86d957

/** Ring of the outer walls (x, z), going around the hilltop. */
const OUTLINE: [number, number][] = [
  [-60, 0], [-50, -12], [-30, -18], [0, -20], [30, -17], [50, -10],
  [60, 0], [48, 12], [25, 17], [0, 19], [-30, 17], [-50, 11],
]
const WALL_H = 8

/** Square tower with stepped merlons and two small dark windows on each face. */
let towerSeed = 1
function tower(kit: Kit, w: number, h: number, color = RED_D) {
  const g = new THREE.Group()
  g.add(kit.taper(w * 1.18, w * 1.18, w, w, h, color)) // wide feet
  g.add(kit.box(w + 0.8, 0.8, w + 0.8, color, 0, h - 0.4, 0)) // fat top band
  const crown = merlonRing(kit, w + 0.6, w + 0.6, Math.max(1.2, w * 0.22), color)
  crown.position.y = h + 0.4
  g.add(crown)
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Group()
    for (const x of [-w * 0.18, w * 0.18]) {
      const win = horseshoeArch(kit, w * 0.18, w * 0.22, 0.3, DARK)
      win.position.set(x, h * 0.62, w / 2 + 0.1)
      face.add(win)
    }
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  return wonk(g, towerSeed++, 0.03)
}

/** Simple palace wing: white walls and a tiled gable roof, length along Z. */
function wing(kit: Kit, w: number, h: number, d: number) {
  const g = new THREE.Group()
  g.add(kit.box(w, h, d, WHITE))
  g.add(kit.pediment(w + 0.6, w * 0.45, d + 0.6, ROOF, h))
  return g
}

function courtOfMyrtles(kit: Kit) {
  const g = new THREE.Group()
  g.add(kit.box(4, 0.4, 16, WATER)) // the long pool
  for (const x of [-2.8, 2.8]) g.add(kit.box(1.2, 0.9, 16, HEDGE, x, 0, 0)) // myrtle hedges
  for (const x of [-6, 6]) {
    const w = wing(kit, 3.5, 6, 20)
    w.position.x = x
    g.add(w)
  }
  const south = wing(kit, 3, 7, 12)
  south.rotation.y = Math.PI / 2
  south.position.z = 10
  g.add(south)
  // Comares tower at the north end, the tallest of the palace
  const comares = tower(kit, 12, 26, RED)
  comares.position.z = -13
  g.add(comares)
  return g
}

function courtOfLions(kit: Kit) {
  const g = new THREE.Group()
  const w = 14, d = 9
  // Arcade of slim white columns around the court, under a tiled roof
  for (let x = -w / 2; x <= w / 2 + 1e-6; x += 1.4) {
    for (const z of [-d / 2, d / 2]) g.add(kit.mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.2, 6), WHITE, x, 1.6, z))
  }
  for (let z = -d / 2 + 1.4; z < d / 2 - 0.5; z += 1.4) {
    for (const x of [-w / 2, w / 2]) g.add(kit.mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.2, 6), WHITE, x, 1.6, z))
  }
  for (const z of [-d / 2 - 1, d / 2 + 1]) {
    g.add(kit.box(w + 4, 3.6, 2, WHITE, 0, 3.2, z))
    const r = kit.pediment(w + 4.4, 1.4, 2.6, ROOF, 6.8)
    r.position.z = z
    g.add(r)
  }
  for (const x of [-w / 2 - 1, w / 2 + 1]) {
    g.add(kit.box(2, 3.6, d + 4, WHITE, x, 3.2, 0))
    const r = kit.pediment(2.6, 1.4, d + 4.4, ROOF, 6.8)
    r.position.x = x
    g.add(r)
  }
  // Pavilions jutting into the court at both ends
  for (const x of [-w / 2 + 1, w / 2 - 1]) {
    g.add(kit.box(2.4, 4.4, 2.4, WHITE, x, 0, 0))
    g.add(kit.mesh(new THREE.ConeGeometry(2, 1.8, 4).rotateY(Math.PI / 4), ROOF, x, 5.3, 0))
  }
  // Fountain: basin on twelve little lions
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6
    const lion = kit.mesh(new THREE.IcosahedronGeometry(0.6, 1), 0xf2d38a, Math.cos(a) * 1.7, 0.6, Math.sin(a) * 1.7)
    lion.scale.set(1, 1.1, 1.4)
    lion.rotation.y = -a
    g.add(lion)
  }
  g.add(kit.mesh(new THREE.CylinderGeometry(2.2, 0.9, 0.9, 14), WHITE, 0, 1.6, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.15, 14), WATER, 0, 2.05, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.2, 8), WHITE, 0, 2.6, 0))
  return g
}

/** Palace of Charles V: a square block with a round courtyard in the middle. */
function palaceCharlesV(kit: Kit) {
  const g = new THREE.Group()
  const w = 16, h = 9
  const s = new THREE.Shape()
  s.moveTo(-w / 2, -w / 2)
  s.lineTo(w / 2, -w / 2)
  s.lineTo(w / 2, w / 2)
  s.lineTo(-w / 2, w / 2)
  s.closePath()
  const hole = new THREE.Path()
  hole.absarc(0, 0, 5, 0, Math.PI * 2, true)
  s.holes.push(hole)
  const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 16 })
  geo.rotateX(-Math.PI / 2) // extrude upwards
  g.add(kit.mesh(geo, STONE))
  // Cornice as a frame around the top, leaving the round courtyard open
  for (const z of [-w / 2 + 1.5, w / 2 - 1.5]) g.add(kit.box(w + 0.8, 0.6, 3.8, 0xc39f74, 0, h, z))
  for (const x of [-w / 2 + 1.5, w / 2 - 1.5]) g.add(kit.box(3.8, 0.6, w - 6, 0xc39f74, x, h, 0))
  // Two rows of windows on each face
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Group()
    for (const y of [2.5, 6]) for (let x = -6; x <= 6; x += 3) face.add(kit.box(1, 1.6, 0.2, DARK, x, y, w / 2 + 0.05))
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  return g
}

/** Generalife-style garden: long pool between hedges and cypresses, fountain jets and a pavilion. */
function garden(kit: Kit) {
  const g = new THREE.Group()
  g.add(kit.box(26, 0.4, 2.4, WATER))
  for (const z of [-2, 2]) g.add(kit.box(26, 0.9, 1, HEDGE, 0, 0, z))
  for (let x = -12; x <= 12; x += 2) {
    for (const z of [-0.6, 0.6]) {
      const jet = kit.mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.4, 4), 0xdff4ff, x, 0.9, z)
      jet.rotation.x = z > 0 ? -0.5 : 0.5 // arching toward the middle of the pool
      g.add(jet)
    }
  }
  for (let x = -12; x <= 12; x += 4) {
    for (const z of [-3.6, 3.6]) {
      const c = cypress(kit, 7)
      c.position.set(x, 0, z)
      g.add(c)
    }
  }
  // Pavilion with three arches at the end of the pool
  const pav = new THREE.Group()
  pav.add(kit.facade(9, 6, 2, [-3, 0, 3].map((x) => ({ x, width: 2, height: 2.6, arch: true })), WHITE))
  pav.add(kit.pediment(9.6, 2.4, 2.6, ROOF, 6))
  pav.rotation.y = Math.PI / 2
  pav.position.x = 15
  g.add(pav)
  return g
}

export function buildAlhambra(kit: Kit): THREE.Group {
  const g = new THREE.Group()

  // ---- Outer walls and towers ----
  for (let i = 0; i < OUTLINE.length; i++) {
    const [ax, az] = OUTLINE[i]
    const [bx, bz] = OUTLINE[(i + 1) % OUTLINE.length]
    g.add(wallBetween(kit, ax, az, bx, bz, WALL_H, 2.4, RED))
    const len = Math.hypot(bx - ax, bz - az)
    const crown = merlons(kit, len, 1.5, RED)
    crown.position.set((ax + bx) / 2, WALL_H, (az + bz) / 2)
    crown.rotation.y = Math.atan2(-(bz - az), bx - ax)
    g.add(crown)
    const t = tower(kit, 6, 12)
    t.position.set(ax, 0, az)
    g.add(t)
  }

  // ---- Alcazaba (west end): inner fortress and the Torre de la Vela ----
  const ALC_X = -46
  for (const [ax, az, bx, bz] of [[-38, -10, -38, 9], [-54, -9, -38, -10], [-54, 8, -38, 9]]) {
    g.add(wallBetween(kit, ax, az, bx, bz, 9, 1.6, RED_D))
  }
  for (const [x, z] of [[-38, -10], [-38, 9]]) {
    const t = tower(kit, 5.5, 13)
    t.position.set(x, 0, z)
    g.add(t)
  }
  const vela = tower(kit, 8, 17)
  vela.position.set(ALC_X - 6, 0, 0)
  g.add(vela)
  // Bell gable on top of the Torre de la Vela
  const bell = kit.facade(3, 3.4, 0.8, [{ x: 0, width: 1.4, height: 1.6, arch: true, bottom: 0.4 }], WHITE)
  bell.position.set(ALC_X - 6, 17, 1.5)
  g.add(bell)
  g.add(kit.mesh(new THREE.CylinderGeometry(0.3, 0.55, 0.8, 8), 0x8a6a3a, ALC_X - 6, 18.3, 1.5))

  // ---- Nasrid palaces ----
  const myrtles = courtOfMyrtles(kit)
  myrtles.position.set(-18, 0, -3)
  g.add(myrtles)
  const lions = courtOfLions(kit)
  lions.position.set(-1, 0, -8)
  g.add(lions)
  // Partal: small portico with a tower by a pool, on the north wall
  g.add(kit.box(10, 0.4, 5, WATER, 14, 0, -11))
  const partal = tower(kit, 5, 9, WHITE)
  partal.position.set(14, 0, -15.5)
  g.add(partal)

  // ---- Palace of Charles V, and a small church ----
  const palace = palaceCharlesV(kit)
  palace.position.set(-24, 0, 9)
  g.add(palace)
  const church = wing(kit, 6, 7, 12)
  church.rotation.y = Math.PI / 2
  church.position.set(-6, 0, 10)
  g.add(church)
  const belfry = tower(kit, 3.4, 12, WHITE)
  belfry.position.set(-11, 0, 10)
  g.add(belfry)

  // ---- Gardens at the east end ----
  const gardens = garden(kit)
  gardens.position.set(34, 0, 2)
  g.add(gardens)
  for (const [x, z] of [[10, 10], [14, 6], [18, 12], [8, 2], [48, -4], [50, 6], [24, -8], [30, -10]]) {
    const c = cypress(kit, 6 + ((x + z) % 3))
    c.position.set(x, 0, z)
    g.add(c)
  }
  return g
}

/**
 * The Sabika hill: an earth mound with a green top, and cypresses around its foot.
 * w and d: size of the base (model units). Returns the group and the height of its surface.
 */
export function buildAlhambraBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const H = 6
  const hill = new THREE.CylinderGeometry(0.95, 1, H, 20) // fills the footprint, so it is all walkable
  hill.scale(w / 2, 1, d / 2)
  g.add(kit.mesh(hill, EARTH, 0, H / 2, 0))
  const cap = new THREE.CylinderGeometry(1, 1, 0.4, 20)
  cap.scale(w / 2 * 0.95, 1, d / 2 * 0.95)
  g.add(kit.mesh(cap, GRASS, 0, H + 0.2, 0))
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2
    const c = cypress(kit, 6 + (i % 3))
    c.position.set(Math.cos(a) * (w / 2) * 0.88, H + 0.4, Math.sin(a) * (d / 2) * 0.88) // on the rim, inside the walkable area
    g.add(c)
  }
  return { group: g, top: H + 0.4 }
}
