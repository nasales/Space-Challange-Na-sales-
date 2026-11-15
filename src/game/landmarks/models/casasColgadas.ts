// Casas Colgadas (Cuenca), cartoon style. Signature features, exaggerated: a tall, banded cliff
// of ochre limestone (the edge of the Huécar gorge) and, right on its brink, the three famous
// Hanging Houses: tall whitewashed and ochre houses with stacked wooden balconies on brackets
// that stick out over the drop (+Z), under terracotta roofs. Behind them, more old-town houses
// and the Mangana clock tower. At the foot of the cliff, the green gorge with the little river.
// Units are roughly metres.
import * as THREE from 'three'
import { seeded, wonk, type Kit } from '../kit'
import { beam, bush, cypress } from '../ornaments'

const ROCK = 0xc9a87a // ochre limestone
const ROCK_D = 0xa8875e // darker strata
const ROCK_L = 0xdcc29a // pale strata
const WALLS = [0xfaf3e3, 0xf0c27e, 0xf3e2c0]
const WOOD = 0x8a5a36
const WOOD_D = 0x6b4426
const ROOF = 0xdb6a3a
const DARK = 0x2b2540
const TOWER = 0xe9cf9e
const GOLD = 0xf2c14e

const CL = 66 // cliff length along X
const CD = 24 // cliff depth
const CH = 15 // cliff height
const FRONT = CD / 2 // z of the cliff edge

/** Wooden balcony on brackets, sticking out toward +Z from a wall at z = 0; floor at y. */
function balcony(kit: Kit, w: number, y: number) {
  const g = new THREE.Group()
  const out = 1.9
  g.add(kit.box(w, 0.35, out, WOOD, 0, y, out / 2))
  g.add(kit.box(w, 0.25, 0.25, WOOD_D, 0, y + 1.1, out - 0.1)) // hand rail
  for (let x = -w / 2 + 0.15; x <= w / 2 - 0.15 + 1e-6; x += 0.7) g.add(kit.box(0.14, 1.1, 0.14, WOOD_D, x, y + 0.1, out - 0.1)) // balusters
  for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) {
    g.add(kit.box(0.14, 1.1, out, WOOD_D, x, y + 0.1, out / 2)) // side rails
    g.add(beam(kit, new THREE.Vector3(x, y - 1.6, 0.1), new THREE.Vector3(x, y - 0.1, out - 0.3), 0.3, WOOD_D)) // bracket
  }
  g.add(kit.box(w + 0.6, 0.3, out + 0.4, WOOD, 0, y + 2.6, out / 2)) // little roof over it
  return g
}

/** Tall house on the cliff edge, front wall at z = 0 facing +Z, base at y = 0. */
function hangingHouse(kit: Kit, w: number, d: number, h: number, wall: number, seed: number) {
  const g = new THREE.Group()
  g.add(kit.box(w, h, d, wall, 0, 0, -d / 2))
  for (const x of [-w / 4, w / 4]) {
    g.add(kit.slab(1.1, 1.4, 0.2, DARK, x, h * 0.25, 0.05)) // windows
    g.add(kit.lightPanel(1.1, 1.4, x, h * 0.25, 0.25, 0, 0.9)) // lit at night
  }
  for (const y of [h * 0.5, h * 0.78]) {
    g.add(kit.slab(w * 0.45, 2, 0.2, DARK, 0, y, 0.05)) // balcony doors
    g.add(kit.lightPanel(w * 0.45, 2, 0, y, 0.25, 0, 0.8))
    g.add(balcony(kit, w - 0.6, y - 0.1))
  }
  const roof = kit.pediment(w + 1, w * 0.38, d + 1.4, ROOF, h)
  roof.position.z = -d / 2 + 0.3
  g.add(roof)
  return wonk(g, seed, 0.02)
}

/** Ordinary old-town house: block, gable roof, a door and windows facing +Z. */
function townHouse(kit: Kit, w: number, d: number, h: number, wall: number) {
  const g = new THREE.Group()
  g.add(kit.box(w, h, d, wall))
  g.add(kit.pediment(w + 0.6, w * 0.38, d + 0.6, ROOF, h))
  g.add(kit.slab(1, 1.8, 0.2, DARK, -w * 0.2, 0, d / 2 + 0.05))
  for (const y of [h * 0.45, h * 0.72]) if (y < h - 1.6) g.add(kit.slab(0.9, 1.1, 0.2, DARK, w * 0.22, y, d / 2 + 0.05))
  return g
}

export function buildCasasColgadas(kit: Kit): THREE.Group {
  const g = new THREE.Group()
  const rand = seeded(31)

  // ---- The cliff: chunky rock columns with coloured strata and boulders at the foot ----
  const COLS = 8
  const cw = CL / COLS
  for (let i = 0; i < COLS; i++) {
    const x = -CL / 2 + cw * (i + 0.5)
    const jut = (rand() - 0.5) * 2.4 // each column sticks out a bit differently
    g.add(kit.taper(cw + 1.2, CD + 2 + jut, cw, CD, CH, ROCK, x, 0, jut / 2))
    for (const [y, c] of [[3, ROCK_D], [7, ROCK_L], [10.5, ROCK_D]] as const) {
      const zf = FRONT + 1 + jut - ((1 + jut / 2) * y) / CH // front face of the taper at height y
      g.add(kit.box(cw + 0.4, 1 + rand() * 0.6, 0.8, c, x, y, zf - 0.1))
    }
  }
  g.add(kit.box(CL, 0.4, CD, ROCK_L, 0, CH, 0)) // flat top where the houses stand
  for (let i = 0; i < 9; i++) {
    const size = 1.2 + rand() * 1.4
    g.add(kit.mesh(new THREE.IcosahedronGeometry(size, 0), ROCK_D, -CL / 2 + 4 + i * 7.3, size * 0.5, FRONT + 2.2))
  }

  // ---- The three Hanging Houses, right on the brink ----
  const top = CH + 0.4
  const trio = [
    { x: -5, w: 7.5, h: 11, wall: WALLS[0] },
    { x: 3, w: 7, h: 12.5, wall: WALLS[1] },
    { x: 10.5, w: 7, h: 10.5, wall: WALLS[0] },
  ]
  trio.forEach((t, i) => {
    const hh = hangingHouse(kit, t.w, 9, t.h, t.wall, 40 + i)
    hh.position.set(t.x, top, FRONT + 0.4)
    g.add(hh)
  })

  // ---- Other houses along the edge and behind ----
  const row = [
    { x: -28, z: FRONT - 3.5 }, { x: -21, z: FRONT - 3 }, { x: -14, z: FRONT - 3.5 },
    { x: 19, z: FRONT - 3 }, { x: 26, z: FRONT - 3.5 },
    { x: -24, z: -4 }, { x: -9, z: -6 }, { x: 0, z: -7 }, { x: 9, z: -6.5 }, { x: 22, z: -5 },
  ]
  for (const p of row) {
    const w = 5.5 + rand() * 1.5, d = 5.5 + rand(), h = 5 + rand() * 4
    const house = townHouse(kit, w, d, h, WALLS[Math.floor(rand() * WALLS.length)])
    house.position.set(p.x, top, p.z)
    g.add(house)
  }

  // ---- Mangana clock tower at the back ----
  const tower = new THREE.Group()
  tower.add(kit.taper(5.6, 5.6, 5, 5, 16, TOWER))
  tower.add(kit.mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.3, 14).rotateX(Math.PI / 2), 0xfff0cf, 0, 12.5, 2.65))
  tower.add(kit.box(0.2, 1.1, 0.15, DARK, 0, 12.4, 2.85), kit.box(0.8, 0.2, 0.15, DARK, 0.35, 12.4, 2.85))
  tower.add(kit.box(6.2, 0.8, 6.2, ROCK_D, 0, 16, 0))
  tower.add(kit.mesh(new THREE.ConeGeometry(4.2, 4, 4).rotateY(Math.PI / 4), ROOF, 0, 16.8 + 2, 0))
  tower.add(kit.mesh(new THREE.IcosahedronGeometry(0.4, 1), GOLD, 0, 21, 0))
  tower.position.set(-16.5, top, -6)
  g.add(wonk(tower, 8, 0.03))
  // Night lights: the clock face, and floodlights on the cliff under the houses
  g.add(kit.lightHalo(2, -16.5, top + 12.5, -6 + 3, 0.6))
  for (const x of [-20, 3, 22]) g.add(kit.lightHalo(6, x, 4, FRONT + 4, 0.35))
  return g
}

/**
 * The floor of the gorge: grass, the little Huécar river along the foot of the cliff and some
 * trees, all inside the w x d footprint. Returns the group and the height of its surface.
 */
export function buildCasasColgadasBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 0.4
  g.add(kit.box(w + 4, 0.03, d + 4, 0xe6d6b4))
  g.add(kit.box(w, top, d, 0x7ed957))
  g.add(kit.slab(w - 1, 0.08, 2.4, 0x3fb8f0, 0, top, d / 2 - 3)) // river
  const rand = seeded(9)
  for (let x = -w / 2 + 3; x < w / 2 - 2; x += 6.5) {
    const tree = rand() < 0.5 ? cypress(kit, 6) : bush(kit, 3, 0x2f9a45, 0x6b4426)
    tree.position.set(x + (rand() - 0.5) * 2, top, d / 2 - 1.2)
    g.add(tree)
  }
  return { group: g, top }
}
