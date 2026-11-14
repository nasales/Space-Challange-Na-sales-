// Peñafiel Castle (Peñafiel, Valladolid), cartoon style. A long, narrow "ship-shaped" castle on the
// crest of a hill: pointed at both ends like a bow and a stern, a crenellated curtain wall with
// small round towers ("cubos") along both long sides, and a tall square keep in the middle with
// round corner turrets, which splits it into two courtyards. Pale limestone, no roofs.
// The real castle is about 210 m x 30 m; here the length is squashed (toy proportions) so the keep
// still reads at a small size. Units are model units; the long axis runs along X (east-west).
import * as THREE from 'three'
import { wonk, type Kit } from '../kit'

const STONE = 0xe8d9b0 // pale limestone
const TRIM = 0xd0bc8c // cornices and tower caps
const DARK = 0x2b2540 // door and window openings
const ROCK = 0xa39a86
const GRASS = 0x7ed957

const HALF_LENGTH = 40
const HALF_WIDTH = 10.8
const WALL_H = 9
const WALL_T = 3
const TOWER_H = 12.5
const TOWER_R = 2.6
const KEEP_W = 13
const KEEP_H = 38

/** Half-width of the ship-shaped plan at x: full in the middle, closing to a point at both ends. */
const halfWidthAt = (x: number) => HALF_WIDTH * (1 - Math.pow(Math.abs(x) / HALF_LENGTH, 2.2))

/** Row of chunky merlons along X (centred), sitting on y. */
function merlonRow(kit: Kit, g: THREE.Group, length: number, y: number, z: number, size: number, depth: number) {
  const n = Math.max(2, Math.round(length / (size * 2)))
  const step = length / n
  for (let i = 0; i < n; i++) g.add(kit.box(size, size, depth, STONE, -length / 2 + step * (i + 0.5), y, z))
}

/** Stretch of curtain wall with merlons between two points (x, z) of the plan. */
function curtain(kit: Kit, ax: number, az: number, bx: number, bz: number, gate = false) {
  const len = Math.hypot(bx - ax, bz - az)
  const g = new THREE.Group()
  g.add(kit.box(len, WALL_H, WALL_T, STONE))
  merlonRow(kit, g, len - TOWER_R * 2, WALL_H, 0, 1.7, WALL_T)
  if (gate) g.add(kit.slab(3.4, 5.2, WALL_T + 0.4, DARK)) // main gate, visible on both faces
  g.position.set((ax + bx) / 2, 0, (az + bz) / 2)
  g.rotation.y = Math.atan2(-(bz - az), bx - ax) // the group's X axis runs along the wall
  return g
}

/** Round tower with a cap ring and merlons around its top; base at y = 0. */
function roundTower(kit: Kit, r: number, h: number, merlons: number) {
  const g = new THREE.Group()
  g.add(kit.mesh(new THREE.CylinderGeometry(r, r * 1.12, h, 10), STONE, 0, h / 2, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(r * 1.15, r * 1.15, 0.9, 10), TRIM, 0, h + 0.45, 0))
  for (let k = 0; k < merlons; k++) {
    const a = (k * Math.PI * 2) / merlons
    const m = kit.box(r * 0.62, r * 0.55, r * 0.5, STONE, Math.sin(a) * r * 0.85, h + 0.9, Math.cos(a) * r * 0.85)
    m.rotation.y = a
    g.add(m)
  }
  return g
}

export function buildCastilloPenafiel(kit: Kit): THREE.Group {
  const g = new THREE.Group()

  // ---- Ship-shaped curtain wall: one loop from the west tip along the north side and back ----
  const xs = [-30, -18, -6, 6, 18, 30]
  const north = xs.map((x) => [x, -halfWidthAt(x)])
  const south = xs.map((x) => [x, halfWidthAt(x)]).reverse()
  const loop = [[-HALF_LENGTH, 0], ...north, [HALF_LENGTH, 0], ...south]
  loop.forEach(([ax, az], i) => {
    const [bx, bz] = loop[(i + 1) % loop.length]
    g.add(curtain(kit, ax, az, bx, bz, ax === 18 && bx === 6 && az > 0)) // gate on the south side, east courtyard
  })
  // Cubos: one on every corner of the plan (6 per long side) and a stouter one on each tip
  loop.forEach(([x, z], i) => {
    const tip = z === 0
    const t = roundTower(kit, tip ? TOWER_R * 1.2 : TOWER_R, tip ? TOWER_H + 1.5 : TOWER_H, 5)
    t.position.set(x, 0, z)
    g.add(wonk(t, i + 3, 0.02))
  })
  // Cross walls from the keep to the curtain: the two courtyards
  for (const side of [-1, 1]) {
    const z0 = KEEP_W / 2 - 0.5, z1 = HALF_WIDTH
    g.add(kit.box(WALL_T, WALL_H + 1.5, z1 - z0, STONE, 0, 0, (side * (z0 + z1)) / 2))
  }

  // ---- Keep (torre del homenaje): tall tapered square tower, clearly the highest element ----
  const keep = new THREE.Group()
  const top = KEEP_W - 1.4 // width at the top of the body
  keep.add(kit.taper(KEEP_W, KEEP_W, top, top, KEEP_H, STONE))
  keep.add(kit.box(top + 2.2, 1.6, top + 2.2, TRIM, 0, KEEP_H, 0)) // cornice
  const rim = KEEP_H + 1.6
  const edge = (top + 2.2) / 2 - 0.7
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Group()
    merlonRow(kit, face, top - 2.4, rim, edge, 1.7, 1.4)
    // Dark windows up the face and, on the east and west faces, a door at courtyard level
    const zf = (y: number) => (KEEP_W + ((top - KEEP_W) * y) / KEEP_H) / 2 + 0.05
    face.add(kit.slab(1.6, 3, 0.3, DARK, 0, 15, zf(16)))
    face.add(kit.slab(1.6, 3, 0.3, DARK, k % 2 ? 2 : -2, 25, zf(26)))
    if (k % 2) face.add(kit.slab(2.6, 4.2, 0.3, DARK, 0, 0, zf(0)))
    face.rotation.y = (k * Math.PI) / 2
    keep.add(face)
  }
  // Round turrets hanging on the four corners, a little taller than the battlements
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const turret = new THREE.Group()
      turret.add(kit.mesh(new THREE.CylinderGeometry(2, 0.5, 3.2, 10), TRIM, 0, -1.6, 0)) // corbel
      turret.add(roundTower(kit, 1.9, 9, 4))
      turret.position.set((sx * (top + 0.6)) / 2, KEEP_H - 6, (sz * (top + 0.6)) / 2)
      keep.add(turret)
    }
  }
  g.add(wonk(keep, 11, 0.02))
  return g
}

/**
 * The hill: a low, long rocky mound with a grass top that follows the castle (an ellipse inside
 * the w x d footprint, so all of it is walkable), and a few boulders on its slope.
 */
export function buildCastilloPenafielBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 5
  const mound = (rTop: number, rBottom: number, h: number, color: number, y: number) => {
    const geo = new THREE.CylinderGeometry(rTop, rBottom, h, 18)
    geo.scale(w / 2, 1, d / 2)
    g.add(kit.mesh(geo, color, 0, y + h / 2, 0))
  }
  mound(0.95, 1, top - 0.6, ROCK, 0)
  mound(0.94, 0.95, 0.6, GRASS, top - 0.6)
  for (let i = 0; i < 8; i++) {
    const a = i * 0.83 + 0.3
    const size = 1.1 + (i % 3) * 0.45
    g.add(kit.mesh(new THREE.IcosahedronGeometry(size, 0), ROCK, Math.cos(a) * (w / 2 - size) * 0.97, top * 0.45, Math.sin(a) * (d / 2 - size) * 0.97))
  }
  return { group: g, top }
}
