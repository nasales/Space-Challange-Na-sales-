// Murallas de Ávila, cartoon style. Signature features, exaggerated: a complete ring of chunky
// granite walls with plain square merlons and a fat round tower (cubo) every few metres, the
// twin-towered Puerta del Alcázar on the front (+Z) and the Puerta de San Vicente on the east,
// the cathedral apse built into the east wall as a giant cubo, and the little old town inside:
// whitewashed houses with terracotta roofs and the cathedral tower. Units are roughly metres.
import * as THREE from 'three'
import { seeded, type Kit } from '../kit'

const GRANITE = 0xd2b98f // golden-grey granite
const GRANITE_D = 0xb39a72 // gates, plinths
const DARK = 0x2b2540
const HOUSE = [0xfaf3e3, 0xf3e2c0, 0xf6d9b0]
const ROOF = 0xdb6a3a
const CATHEDRAL = 0xe2d2b0
const SLATE = 0x7f8fa6
const PAVING = 0xe2cb9f

const W = 108 // walls along X
const D = 54 // walls along Z
const WH = 9 // wall height
const WT = 2.6 // wall thickness
const TOWER_R = 3
const TOWER_H = 11
const SPACING = 12 // between cubos

/** Plain square merlons along X (centred), sitting on y = 0. */
function merlonRow(kit: Kit, length: number, size: number, color: number) {
  const g = new THREE.Group()
  const n = Math.max(1, Math.floor(length / (size * 1.8)))
  const step = length / n
  for (let i = 0; i < n; i++) g.add(kit.box(size, size, size * 0.8, color, -length / 2 + step * (i + 0.5), 0, 0))
  return g
}

/** Round tower (cubo) with a ring of merlons on top. Base at y = 0. */
function cubo(kit: Kit, r: number, h: number, color = GRANITE) {
  const g = new THREE.Group()
  g.add(kit.mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 12), color, 0, h / 2, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.12, 0.6, 12), GRANITE_D, 0, h - 0.3, 0))
  const n = Math.max(6, Math.round(r * 2.4))
  for (let k = 0; k < n; k++) {
    const a = (k * Math.PI * 2) / n
    const m = kit.box(0.9, 1, 0.8, color, Math.cos(a) * r * 0.95, h, Math.sin(a) * r * 0.95)
    m.rotation.y = -a
    g.add(m)
  }
  return g
}

/** Gate: an arched passage between two tall cubos, joined by a battlemented bridge. Faces +Z. */
function gate(kit: Kit) {
  const g = new THREE.Group()
  const wall = kit.facade(10, 13, WT + 1.4, [{ x: 0, width: 4, height: 5, arch: true }], GRANITE_D)
  g.add(wall)
  const m = merlonRow(kit, 10, 1, GRANITE_D)
  m.position.y = 13
  g.add(m)
  for (const x of [-6, 6]) {
    const t = cubo(kit, 4, 16)
    t.position.set(x, 0, 1.6)
    g.add(t)
  }
  return g
}

/** Small house: whitewashed block with a terracotta gable roof, door and window. */
function house(kit: Kit, w: number, d: number, h: number, color: number) {
  const g = new THREE.Group()
  g.add(kit.box(w, h, d, color))
  const r = kit.pediment(w + 0.4, w * 0.4, d + 0.4, ROOF, h)
  g.add(r)
  g.add(kit.slab(0.9, 1.6, 0.2, DARK, -w * 0.2, 0, d / 2 + 0.05))
  g.add(kit.slab(0.8, 0.8, 0.2, DARK, w * 0.22, h * 0.55, d / 2 + 0.05))
  return g
}

export function buildMurallasAvila(kit: Kit): THREE.Group {
  const g = new THREE.Group()
  g.add(kit.box(W - WT, 0.12, D - WT, PAVING)) // streets inside

  // ---- Wall ring with merlons ----
  for (const z of [-D / 2, D / 2]) {
    g.add(kit.box(W + WT, WH, WT, GRANITE, 0, 0, z))
    const m = merlonRow(kit, W + WT, 1, GRANITE)
    m.position.set(0, WH, z + (z > 0 ? 0.8 : -0.8))
    g.add(m)
  }
  for (const x of [-W / 2, W / 2]) {
    g.add(kit.box(WT, WH, D - WT, GRANITE, x, 0, 0))
    const m = merlonRow(kit, D - WT, 1, GRANITE)
    m.rotation.y = Math.PI / 2
    m.position.set(x + (x > 0 ? 0.8 : -0.8), WH, 0)
    g.add(m)
  }

  // ---- Cubos all around, leaving room for the gates and the cathedral apse ----
  const out = WT / 2 + 0.6
  const keepFree = (x: number, z: number) =>
    (Math.abs(x) < 9 && z > 0) || // Puerta del Alcázar (front)
    (x > 0 && Math.abs(z - 8) < 9) || // Puerta de San Vicente (east)
    (x > 0 && Math.abs(z + 10) < 10) // cathedral apse (east)
  for (let x = -W / 2; x <= W / 2 + 1e-6; x += SPACING) {
    for (const z of [-D / 2, D / 2]) {
      if (keepFree(x, z)) continue
      const t = cubo(kit, TOWER_R, TOWER_H)
      t.position.set(x, 0, z + Math.sign(z) * out)
      g.add(t)
    }
  }
  for (let z = -D / 2 + SPACING; z < D / 2 - SPACING / 2; z += SPACING) {
    for (const x of [-W / 2, W / 2]) {
      if (keepFree(x, z)) continue
      const t = cubo(kit, TOWER_R, TOWER_H)
      t.position.set(x + Math.sign(x) * out, 0, z)
      g.add(t)
    }
  }

  // ---- Gates ----
  const front = gate(kit)
  front.position.z = D / 2
  g.add(front)
  const east = gate(kit)
  east.rotation.y = Math.PI / 2
  east.position.set(W / 2, 0, 8)
  g.add(east)

  // ---- Cathedral: apse as a giant cubo in the east wall, church and tower inside ----
  const apse = cubo(kit, 8, 13, GRANITE)
  apse.position.set(W / 2 - 1, 0, -10)
  g.add(apse)
  g.add(kit.box(30, 14, 14, CATHEDRAL, W / 2 - 22, 0, -10))
  const nave = kit.pediment(14.6, 5, 30.6, SLATE, 14)
  nave.rotation.y = Math.PI / 2
  nave.position.set(W / 2 - 22, 0, -10)
  g.add(nave)
  g.add(kit.taper(8, 8, 7, 7, 26, CATHEDRAL, W / 2 - 38, 0, -14))
  for (const [dx, dz] of [[0, 3.75], [3.75, 0]] as const) g.add(kit.slab(dz ? 1.4 : 0.3, 4, dz ? 0.3 : 1.4, DARK, W / 2 - 38 + dx, 19, -14 + dz))
  const spire = new THREE.ConeGeometry(5.2, 7, 4)
  spire.rotateY(Math.PI / 4)
  g.add(kit.box(8.4, 1, 8.4, GRANITE_D, W / 2 - 38, 26, -14))
  g.add(kit.mesh(spire, SLATE, W / 2 - 38, 27 + 3.5, -14))

  // ---- Old town: rows of little houses, leaving the cathedral and the gates clear ----
  const rand = seeded(17)
  for (let x = -W / 2 + 8; x < W / 2 - 8; x += 8) {
    for (let z = -D / 2 + 7; z < D / 2 - 6; z += 8) {
      if (x > W / 2 - 48 && z < 2) continue // cathedral
      if (Math.abs(x) < 7 && z > D / 2 - 14) continue // street from the front gate
      if (x > W / 2 - 16 && Math.abs(z - 8) < 6) continue // street from the east gate
      const hw = 4.5 + rand() * 1.5, hd = 4.5 + rand() * 1.2, hh = 4 + rand() * 2.5
      const h = house(kit, hw, hd, hh, HOUSE[Math.floor(rand() * HOUSE.length)])
      h.position.set(x + (rand() - 0.5) * 1.5, 0, z + (rand() - 0.5) * 1.5)
      h.rotation.y = rand() < 0.3 ? Math.PI / 2 : 0
      g.add(h)
    }
  }
  return g
}

/**
 * Meadow around the walls with a pale road up to the front gate.
 * w and d: size of the base (model units). Returns the group and the height of its surface.
 */
export function buildMurallasAvilaBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 0.4
  g.add(kit.box(w + 4, 0.03, d + 4, 0xe6d6b4))
  g.add(kit.box(w, top, d, 0x7ed957))
  g.add(kit.slab(6, 0.06, d / 2, 0xe2d4b8, 0, top, d / 4)) // road to the Puerta del Alcázar
  return { group: g, top }
}
