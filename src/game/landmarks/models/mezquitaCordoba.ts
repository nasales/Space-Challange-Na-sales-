// Mezquita-Catedral (Córdoba), cartoon style. Signature feature, exaggerated: the forest of
// red-and-cream striped arches. The courtyard side of the prayer hall is an open arcade, so you
// look into rows of double arches on slim columns. Outside: chunky buttressed walls with fat
// stepped merlons and big voussoir doors, many parallel tiled roofs, the Renaissance cathedral
// rising out of the middle, the Courtyard of the Orange Trees in front (+Z) and the bell tower
// over the Door of Forgiveness, topped by a big golden St. Raphael. Units are roughly metres.
import * as THREE from 'three'
import { wonk, type Kit } from '../kit'
import { horseshoeArch, merlonRing, merlons, onionDome, openStorey, orangeTree, pinnacle, statue, voussoirArch } from '../ornaments'

const WALL = 0xf0c27e // warm ochre stone
const WALL_D = 0xd09a5a // buttresses, plinths, cornices
const ROOF = 0xdb6a3a // terracotta tiles
const CATHEDRAL = 0xf6e2b8
const CATHEDRAL_ROOF = 0x7f8fa6
const RED = 0xc8352a
const CREAM = 0xfff0cf
const COLUMN = 0x6b5b78 // dark marble columns
const DARK = 0x2b2540
const GOLD = 0xf2c14e

const HALL_W = 80, HALL_D = 70, HALL_H = 12
const HALL_Z = -10 // centre of the prayer hall
const HALL_FRONT = HALL_Z + HALL_D / 2 // z of the courtyard side
const PATIO_D = 40
const PATIO_Z = HALL_FRONT + PATIO_D / 2 // centre of the courtyard

/** Door: dark horseshoe opening framed by a big red-and-cream voussoir arch, facing +Z. */
function door(kit: Kit, w: number, h: number) {
  const g = new THREE.Group()
  g.add(horseshoeArch(kit, w, h, 0.3, DARK))
  const ring = voussoirArch(kit, w * 0.575, w * 0.42, 0.5, [RED, CREAM], 11)
  ring.position.y = h + w * 0.29 // centre of the horseshoe arc
  g.add(ring)
  g.add(kit.box(w * 2.4, 0.6, 0.7, WALL_D, 0, h + w * 1.35, 0)) // little cornice above
  return g
}

/**
 * One row of the arch forest, running along X: slim columns carrying two tiers of striped
 * arches (horseshoe arches below, round arches above), as in the real prayer hall.
 */
function archRow(kit: Kit, length: number, span: number) {
  const g = new THREE.Group()
  const n = Math.floor(length / span)
  const start = -((n - 1) * span) / 2
  for (let i = 0; i < n; i++) {
    const x = start + i * span
    // Column under each springing point
    for (const cx of [x - span / 2, x + span / 2]) {
      g.add(kit.mesh(new THREE.CylinderGeometry(0.35, 0.4, 4.2, 8), COLUMN, cx, 2.1, 0))
      g.add(kit.box(1.1, 0.5, 1.1, CREAM, cx, 4.2, 0)) // capital
    }
    const lower = voussoirArch(kit, span * 0.36, span * 0.16, 0.8, [RED, CREAM], 9)
    lower.position.set(x, 4.9, 0)
    g.add(lower)
    g.add(kit.box(0.7, 3.4, 0.8, CREAM, x + span / 2, 4.7, 0)) // pier up to the upper tier
    const upper = voussoirArch(kit, span * 0.4, span * 0.13, 0.8, [CREAM, RED], 9)
    upper.position.set(x, 8.2, 0)
    g.add(upper)
  }
  return g
}

export function buildMezquitaCordoba(kit: Kit): THREE.Group {
  const g = new THREE.Group()

  // ---- Prayer hall: three solid walls, the courtyard side open ----
  const T = 2.2 // wall thickness
  g.add(kit.box(HALL_W, HALL_H, T, WALL, 0, 0, HALL_Z - HALL_D / 2 + T / 2)) // back (south)
  for (const x of [-HALL_W / 2 + T / 2, HALL_W / 2 - T / 2]) g.add(kit.box(T, HALL_H, HALL_D, WALL, x, 0, HALL_Z))
  g.add(kit.box(HALL_W - 2 * T, 0.4, HALL_D - T, 0xe9d3a6, 0, 0, HALL_Z - T / 2)) // floor
  // Open arcade on the courtyard side: a wall with big arches, each framed by voussoirs
  const ARCH_N = 11
  const archW = 4.4
  const step = (HALL_W - 4) / ARCH_N
  const openings = Array.from({ length: ARCH_N }, (_, i) => ({ x: -HALL_W / 2 + 2 + step * (i + 0.5), width: archW, height: 5.5, arch: true }))
  const arcade = kit.facade(HALL_W, HALL_H, T, openings, WALL)
  arcade.position.z = HALL_FRONT - T / 2
  g.add(arcade)
  for (const o of openings) {
    const ring = voussoirArch(kit, archW / 2, 1.2, T + 0.4, [RED, CREAM], 9)
    ring.position.set(o.x, 5.5, HALL_FRONT - T / 2)
    g.add(ring)
  }
  // Inside: rows of the arch forest, seen through the arcade
  for (const dz of [5, 11, 17, 23]) {
    const row = archRow(kit, HALL_W - 2 * T - 2, 5.2)
    row.position.z = HALL_FRONT - dz
    g.add(row)
  }
  // Fat stepped merlons all around the top
  const crown = merlonRing(kit, HALL_W, HALL_D, 1.9, WALL)
  crown.position.set(0, HALL_H, HALL_Z)
  g.add(crown)
  // Buttresses along the outside of the walls
  for (let x = -HALL_W / 2; x <= HALL_W / 2 + 1e-6; x += 8) g.add(kit.box(2.2, HALL_H + 0.8, 1.8, WALL_D, x, 0, HALL_Z - HALL_D / 2 - 0.7))
  for (let z = HALL_Z - HALL_D / 2; z <= HALL_FRONT + 1e-6; z += 8) {
    for (const x of [-HALL_W / 2 - 0.7, HALL_W / 2 + 0.7]) g.add(kit.box(1.8, HALL_H + 0.8, 2.2, WALL_D, x, 0, z))
  }
  // Big voussoir doors on the east and west walls, between the buttresses
  for (const side of [-1, 1]) {
    for (const dz of [-31, -15, 1, 17]) {
      const d = door(kit, 3.4, 3.6)
      d.position.set(side * (HALL_W / 2 + 0.05), 0, HALL_Z + dz)
      d.rotation.y = (side * Math.PI) / 2
      g.add(d)
    }
  }
  // Parallel tiled roofs, one per aisle, on a ceiling slab
  g.add(kit.box(HALL_W - 1, 0.8, HALL_D - 1, WALL_D, 0, HALL_H - 0.8, HALL_Z))
  const AISLES = 14
  const aisleW = HALL_W / AISLES
  for (let i = 0; i < AISLES; i++) {
    const r = kit.pediment(aisleW + 0.2, 3.2, HALL_D - 2, ROOF, HALL_H) // pediment() sets y = HALL_H
    r.position.x = -HALL_W / 2 + aisleW * (i + 0.5)
    r.position.z = HALL_Z
    g.add(r)
  }

  // ---- Cathedral rising out of the middle (a Latin cross) ----
  const C_Z = HALL_Z - 6
  g.add(kit.taper(15, 44, 13.5, 43, 26, CATHEDRAL, 0, 0, C_Z))
  const naveRoof = kit.pediment(15, 5.5, 44, CATHEDRAL_ROOF, 26)
  naveRoof.position.z = C_Z
  g.add(naveRoof)
  g.add(kit.box(38, 24, 12, CATHEDRAL, 0, 0, C_Z - 6))
  const trRoof = kit.pediment(13, 5, 38.6, CATHEDRAL_ROOF, 24)
  trRoof.rotation.y = Math.PI / 2
  trRoof.position.z = C_Z - 6
  g.add(trRoof)
  for (const side of [-1, 1]) {
    for (const z of [8, 14, 20]) g.add(kit.slab(0.3, 6, 2.4, DARK, side * 7.1, 15, C_Z + z)) // tall windows
  }
  g.add(kit.box(10, 6, 10, CATHEDRAL, 0, 27, C_Z - 6)) // lantern over the crossing
  const cupola = onionDome(kit, 5.4, CATHEDRAL_ROOF, GOLD)
  cupola.position.set(0, 33, C_Z - 6)
  g.add(cupola)
  for (const x of [-5, 5]) {
    for (const z of [-5, 5]) {
      const p = pinnacle(kit, 3, CATHEDRAL, GOLD)
      p.position.set(x, 33, C_Z - 6 + z)
      g.add(p)
    }
  }

  // ---- Courtyard of the Orange Trees ----
  const pw = HALL_W, wallT = 2, wallH = 9
  const patioFront = PATIO_Z + PATIO_D / 2
  g.add(kit.box(pw, wallH, wallT, WALL, 0, 0, patioFront - wallT / 2))
  for (const x of [-pw / 2 + wallT / 2, pw / 2 - wallT / 2]) g.add(kit.box(wallT, wallH, PATIO_D, WALL, x, 0, PATIO_Z))
  const frontMerlons = merlons(kit, pw, 1.6, WALL)
  frontMerlons.position.set(0, wallH, patioFront - wallT / 2)
  g.add(frontMerlons)
  for (const x of [-pw / 2 + wallT / 2, pw / 2 - wallT / 2]) {
    const m = merlons(kit, PATIO_D, 1.6, WALL)
    m.rotation.y = Math.PI / 2
    m.position.set(x, wallH, PATIO_Z)
    g.add(m)
  }
  for (let ix = -3; ix <= 3; ix++) {
    if (ix === 0) continue
    for (const dz of [-10, 0, 10]) {
      const t = orangeTree(kit, 4.4)
      t.position.set(ix * 10, 0, PATIO_Z + dz)
      g.add(t)
    }
  }
  // Fountain in the middle
  g.add(kit.mesh(new THREE.CylinderGeometry(3, 3.3, 1, 12), CREAM, 0, 0.5, PATIO_Z))
  g.add(kit.mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.2, 12), 0x3fb8f0, 0, 1, PATIO_Z))
  g.add(kit.mesh(new THREE.CylinderGeometry(0.4, 0.5, 2.2, 8), CREAM, 0, 1.1, PATIO_Z))
  g.add(kit.mesh(new THREE.IcosahedronGeometry(0.6, 1), 0xbdefff, 0, 2.6, PATIO_Z))

  // ---- Bell tower over the Door of Forgiveness ----
  const tower = new THREE.Group()
  const TW = 11, TH = 30
  tower.add(kit.taper(TW + 1.5, TW + 1.5, TW, TW, TH, WALL))
  const gate = door(kit, 4.6, 5.4)
  gate.position.z = TW / 2 + 0.45
  tower.add(gate)
  for (const y of [15, 22]) {
    for (const x of [-1.6, 1.6]) {
      const w = horseshoeArch(kit, 2, 2.6, 0.3, DARK)
      w.position.set(x, y, TW / 2 + 0.2)
      tower.add(w)
    }
  }
  let y = TH
  tower.add(kit.box(TW + 2, 1.2, TW + 2, WALL_D, 0, y, 0))
  y += 1.2
  const s1 = openStorey(kit, 8.6, 8.5, 3.8, 4.2, 1.4, WALL, CREAM, DARK)
  s1.position.y = y
  tower.add(s1)
  y += 8.5
  tower.add(kit.box(10, 1, 10, WALL_D, 0, y, 0))
  y += 1
  const s2 = openStorey(kit, 6.4, 6.5, 2.8, 3.2, 1.2, WALL, CREAM, DARK)
  s2.position.y = y
  tower.add(s2)
  y += 6.5
  tower.add(kit.box(7.6, 0.9, 7.6, WALL_D, 0, y, 0))
  y += 0.9
  const dome = onionDome(kit, 2.8, CATHEDRAL_ROOF, GOLD)
  dome.position.y = y
  tower.add(dome)
  const raphael = statue(kit, 4.6, GOLD) // St. Raphael, guardian of Córdoba
  raphael.position.y = y + 4.4
  tower.add(raphael)
  tower.position.set(-10, 0, patioFront - TW / 2 + 1)
  g.add(wonk(tower, 9, 0.03))
  return g
}

/**
 * Old-town streets around the building: warm paving.
 * w and d: size of the base (model units). Returns the group and the height of its surface.
 */
export function buildMezquitaCordobaBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 0.3
  g.add(kit.box(w + 4, 0.03, d + 4, 0xecd9b4))
  g.add(kit.box(w, top, d, 0xe2cb9f))
  return { group: g, top }
}
