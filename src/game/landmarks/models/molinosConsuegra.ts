// Molinos de Consuegra (La Mancha), cartoon style. Signature features, exaggerated: a row of
// fat whitewashed windmills with dark conical caps and big wooden lattice sails (Don Quixote's
// "giants") along the crest of a dry golden ridge, and the little castle of La Muela at the
// east end. The sails face +Z. The ridge itself is the base. Units are roughly metres.
import * as THREE from 'three'
import { seeded, wonk, type Kit } from '../kit'

const WHITE = 0xfaf6ec // whitewash
const BAND = 0x5a8fd0 // blue band at the foot, as in La Mancha
const CAP = 0x4a3f3a // dark cap
const WOOD = 0x8a6a48
const DARK = 0x2b2540
const CASTLE = 0xd8b98a
const CASTLE_D = 0xb8946a
const RIDGE = 0xd9b25a // dry golden grass
const RIDGE_TOP = 0xc9a24e
const ROCK = 0x9b8f80

const MILL_H = 8.5
const MILL_R = 2.6

/** One sail: a spar from the hub and a lattice frame on one side of it, pointing up (+Y). */
function sail(kit: Kit) {
  const g = new THREE.Group()
  const len = 7.2, fw = 1.5
  g.add(kit.box(0.28, len, 0.28, WOOD))
  for (const x of [0.25, 0.25 + fw]) g.add(kit.box(0.14, len * 0.72, 0.14, WOOD, x, len * 0.28, 0)) // rails
  for (let i = 0; i <= 6; i++) g.add(kit.box(fw + 0.25, 0.12, 0.12, WOOD, 0.25 + fw / 2, len * 0.28 + (i * len * 0.72) / 6 - 0.06, 0))
  return g
}

function windmill(kit: Kit, seed: number) {
  const rand = seeded(seed)
  const g = new THREE.Group()
  g.add(kit.mesh(new THREE.CylinderGeometry(MILL_R * 0.86, MILL_R, MILL_H, 14), WHITE, 0, MILL_H / 2, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(MILL_R * 1.02, MILL_R * 1.04, 0.7, 14), BAND, 0, 0.35, 0))
  g.add(kit.slab(1.2, 2.2, 0.3, DARK, 0, 0.4, MILL_R * 0.98)) // door
  g.add(kit.slab(0.7, 0.8, 0.3, DARK, 0.4, MILL_H * 0.62, MILL_R * 0.88)) // little window
  // Cap: a fat dark cone on a ring
  g.add(kit.mesh(new THREE.CylinderGeometry(MILL_R * 0.98, MILL_R * 0.9, 0.5, 14), CAP, 0, MILL_H + 0.25, 0))
  g.add(kit.mesh(new THREE.ConeGeometry(MILL_R * 1.02, 2.8, 12), CAP, 0, MILL_H + 0.5 + 1.4, 0))
  // Hub and four sails, turned a little differently on every mill
  const hubY = MILL_H + 0.9, hubZ = MILL_R + 0.6
  g.add(kit.mesh(new THREE.CylinderGeometry(0.35, 0.35, 2, 8).rotateX(Math.PI / 2), WOOD, 0, hubY, MILL_R - 0.2))
  g.add(kit.mesh(new THREE.IcosahedronGeometry(0.5, 1), WOOD, 0, hubY, hubZ))
  const sails = new THREE.Group()
  for (let k = 0; k < 4; k++) {
    const s = sail(kit)
    s.rotation.z = (k * Math.PI) / 2
    sails.add(s)
  }
  sails.rotation.z = rand() * Math.PI
  sails.position.set(0, hubY, hubZ + 0.2)
  g.add(sails)
  return wonk(g, seed, 0.04)
}

/** Plain square merlons along X (Castilian style), sitting on y = 0. */
function merlonRow(kit: Kit, length: number, size: number, color: number) {
  const g = new THREE.Group()
  const n = Math.max(1, Math.floor(length / (size * 1.8)))
  const step = length / n
  for (let i = 0; i < n; i++) g.add(kit.box(size, size, size * 0.7, color, -length / 2 + step * (i + 0.5), 0, 0))
  return g
}

/** Castle of La Muela: curtain walls with round corner towers and a tall square keep. */
function castle(kit: Kit) {
  const g = new THREE.Group()
  const W = 16, Dp = 12, WH = 5
  for (const z of [-Dp / 2, Dp / 2]) {
    g.add(kit.box(W, WH, 1.4, CASTLE, 0, 0, z))
    const m = merlonRow(kit, W, 0.8, CASTLE)
    m.position.set(0, WH, z)
    g.add(m)
  }
  for (const x of [-W / 2, W / 2]) {
    g.add(kit.box(1.4, WH, Dp, CASTLE, x, 0, 0))
    const m = merlonRow(kit, Dp, 0.8, CASTLE)
    m.rotation.y = Math.PI / 2
    m.position.set(x, WH, 0)
    g.add(m)
  }
  for (const x of [-W / 2, W / 2]) {
    for (const z of [-Dp / 2, Dp / 2]) {
      g.add(kit.mesh(new THREE.CylinderGeometry(1.9, 2.1, 7, 12), CASTLE, x, 3.5, z))
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3
        g.add(kit.box(0.7, 0.7, 0.7, CASTLE, x + Math.cos(a) * 1.6, 7, z + Math.sin(a) * 1.6))
      }
    }
  }
  g.add(kit.slab(1.6, 2.6, 0.3, DARK, 0, 0, Dp / 2 + 0.7)) // gate
  // Keep
  g.add(kit.taper(7, 7, 6.2, 6.2, 11, CASTLE_D, 1.5, 0, -0.5))
  for (const z of [-3.6, 2.6]) {
    const m = merlonRow(kit, 6.6, 0.8, CASTLE_D)
    m.position.set(1.5, 11, z)
    g.add(m)
  }
  for (const x of [-1.6, 4.6]) {
    const m = merlonRow(kit, 5, 0.8, CASTLE_D)
    m.rotation.y = Math.PI / 2
    m.position.set(x, 11, -0.5)
    g.add(m)
  }
  g.add(kit.slab(0.8, 1.6, 0.3, DARK, 1.5, 7, 2.75))
  return g
}

export function buildMolinosConsuegra(kit: Kit): THREE.Group {
  const g = new THREE.Group()
  const xs = [-38, -29, -20, -11, -2, 7, 16]
  xs.forEach((x, i) => {
    const m = windmill(kit, 21 + i * 7)
    m.position.set(x, 0, i % 2 === 0 ? 1 : -1)
    g.add(m)
  })
  const c = castle(kit)
  c.position.set(31, 0, 0)
  g.add(c)
  return g
}

/**
 * The ridge: a long golden mound with a flat crest where the mills stand, rocks on its flanks.
 * w and d: size of the base (model units), including the margin. Returns the group and the
 * height of the crest.
 */
export function buildMolinosConsuegraBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 4
  const m = 8 * 0.85 // matches the margin in models/index.ts: the crest still holds the model
  g.add(kit.taper(w, d, w - m * 2, d - m * 2, top - 0.3, RIDGE))
  g.add(kit.box(w - m * 2, 0.3, d - m * 2, RIDGE_TOP, 0, top - 0.3, 0))
  const rand = seeded(5)
  for (let i = 0; i < 14; i++) {
    const side = i % 2 === 0 ? 1 : -1
    const x = (rand() - 0.5) * (w - 6)
    g.add(kit.mesh(new THREE.IcosahedronGeometry(0.8 + rand() * 0.8, 0), ROCK, x, top * 0.45, side * (d / 2 - m * 0.55)))
  }
  return { group: g, top }
}
