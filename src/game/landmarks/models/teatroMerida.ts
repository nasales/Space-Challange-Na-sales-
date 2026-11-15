// Teatro Romano de Mérida, cartoon style. Signature features, exaggerated: the two-storey
// scaenae frons at the back (-Z), a wall of slim blue-grey marble columns with white capitals,
// statues between them and three dark doors, standing behind the stage; in front of it the white
// half-moon of the orchestra and the big stepped half bowl of the seats (cavea), rising toward
// +Z, ringed by a thick outer wall with dark gateways. Lawn and cypresses around the ruins.
// Units are roughly metres.
import * as THREE from 'three'
import type { Kit } from '../kit'
import { beam, cypress, ionicColumn, statue } from '../ornaments'

const STONE = 0xe7cfa6 // warm granite of the seats
const STONE_D = 0xc9a77e // outer wall, every third row of seats
const WALL = 0xb5865a // brick and rubble behind the columns
const MARBLE = 0xfff6e8 // capitals, entablatures, statues, orchestra
const COLUMN = 0x8f9fb8 // blue-grey marble shafts
const DARK = 0x2b2540

const R = 36 // outer radius of the seats
const R0 = 11 // radius of the orchestra
const ROWS = 9
const RISE = 1.25 // height of each row of seats
const STAGE_D = 7
const FRONS_Z = -STAGE_D - 2 // front face of the back wall
const FRONS_W = 58

/** Half ring (upper half in the shape plane) from radius r1 to r2, height h, opening toward -Z. */
function halfRing(kit: Kit, r1: number, r2: number, h: number, color: number) {
  const s = new THREE.Shape()
  s.absarc(0, 0, r2, 0, Math.PI, false)
  s.lineTo(-r1, 0)
  s.absarc(0, 0, r1, Math.PI, 0, true)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 14 })
  geo.rotateX(Math.PI / 2) // shape y -> +Z, extrusion -> down
  geo.translate(0, h, 0)
  return kit.mesh(geo, color)
}

/** One storey of the columned front: columns on a podium, an entablature on top. */
function colonnade(kit: Kit, colH: number, podiumH: number, count: number, z: number) {
  const g = new THREE.Group()
  const step = (FRONS_W - 6) / (count - 1)
  g.add(kit.box(FRONS_W, podiumH, 4, STONE_D, 0, 0, z))
  for (let i = 0; i < count; i++) {
    const c = ionicColumn(kit, colH, 0.55, COLUMN, MARBLE)
    c.position.set(-(FRONS_W - 6) / 2 + i * step, podiumH, z + 0.6)
    g.add(c)
  }
  g.add(kit.box(FRONS_W + 0.6, 0.7, 4.4, MARBLE, 0, podiumH + colH, z))
  g.add(kit.box(FRONS_W + 1.4, 0.6, 5, MARBLE, 0, podiumH + colH + 0.7, z))
  return g
}

export function buildTeatroMerida(kit: Kit): THREE.Group {
  const g = new THREE.Group()

  // ---- Seats: stepped half rings, each row a little higher and further out ----
  const rowW = (R - R0 - 2) / ROWS
  for (let i = 0; i < ROWS; i++) {
    const r1 = R0 + 2 + i * rowW
    const r2 = i === ROWS - 1 ? R : r1 + rowW
    g.add(halfRing(kit, r1, r2, (i + 1) * RISE, i % 3 === 2 ? STONE_D : STONE))
  }
  g.add(halfRing(kit, R0, R0 + 2, 0.6, STONE_D)) // low wall round the orchestra
  // Thick outer wall with dark gateways
  const topH = ROWS * RISE
  g.add(halfRing(kit, R, R + 2.2, topH + 1.4, STONE_D))
  for (let k = 0; k < 7; k++) {
    const a = Math.PI * (0.12 + (0.76 * k) / 6)
    const gate = kit.slab(2.6, 4, 0.3, DARK, Math.cos(a) * (R + 2.25), 0, Math.sin(a) * (R + 2.25))
    gate.rotation.y = Math.PI / 2 - a
    g.add(gate)
  }
  // Radial stairways: light ramps from the orchestra to the top
  for (let k = 0; k < 5; k++) {
    const a = Math.PI * (0.18 + (0.64 * k) / 4)
    const p = new THREE.Vector3(Math.cos(a) * (R0 + 2.4), RISE * 0.6, Math.sin(a) * (R0 + 2.4))
    const q = new THREE.Vector3(Math.cos(a) * (R - 0.6), topH + 0.1, Math.sin(a) * (R - 0.6))
    g.add(beam(kit, p, q, 1, MARBLE))
  }

  // ---- Orchestra: a white marble half moon ----
  const orch = new THREE.CylinderGeometry(R0, R0, 0.25, 20, 1, false, -Math.PI / 2, Math.PI)
  g.add(kit.mesh(orch, MARBLE, 0, 0.125, 0))

  // ---- Stage and the columned front (scaenae frons) ----
  g.add(kit.box(FRONS_W + 4, 1.6, STAGE_D, STONE_D, 0, 0, -STAGE_D / 2 - 0.5))
  g.add(kit.box(FRONS_W + 4, 0.3, 5, 0x9a6b48, 0, 1.6, -3)) // wooden boards in front of the columns
  const FRONS_H = 19
  g.add(kit.box(FRONS_W, FRONS_H, 4, WALL, 0, 0, FRONS_Z - 2))
  // Three dark doors, the royal door in the middle bigger
  for (const [x, w, h] of [[-15, 2.6, 4.4], [0, 3.6, 5.6], [15, 2.6, 4.4]]) {
    g.add(kit.slab(w, h, 0.3, DARK, x, 1.6, FRONS_Z + 0.1))
    g.add(kit.box(w + 1.2, 0.6, 0.8, MARBLE, x, 1.6 + h, FRONS_Z + 0.2))
  }
  const lowH = 8.4
  g.add(colonnade(kit, lowH, 1.6, 14, FRONS_Z + 1.5))
  const upY = 1.6 + lowH + 1.3
  const upper = colonnade(kit, 6, 0.6, 12, FRONS_Z + 1.3)
  upper.position.y = upY
  g.add(upper)
  // White statues between the upper columns
  for (const x of [-18.9, -9.5, 9.5, 18.9]) {
    const s = statue(kit, 3, MARBLE)
    s.position.set(x, upY + 0.6, FRONS_Z + 0.9)
    g.add(s)
  }
  // Side wings closing the stage (parascaenia)
  for (const side of [-1, 1]) g.add(kit.box(6, 12, STAGE_D + 4, WALL, side * (FRONS_W / 2 + 2), 0, -STAGE_D / 2 - 2))

  // ---- Night lights: the three doors glow, floodlights on the columns and the statues ----
  for (const [x, w, h] of [[-15, 2.6, 4.4], [0, 3.6, 5.6], [15, 2.6, 4.4]]) g.add(kit.lightPanel(w, h, x, 1.6, FRONS_Z + 0.5, 0, 0.8))
  for (const x of [-24, -12, 0, 12, 24]) g.add(kit.lightHalo(4.5, x, 6, FRONS_Z + 4, 0.45))
  for (const x of [-18.9, -9.5, 9.5, 18.9]) g.add(kit.lightHalo(2.5, x, upY + 2, FRONS_Z + 2.5, 0.5))
  return g
}

/**
 * Lawn around the ruins with a gravel path and cypresses in the corners, inside the w x d footprint.
 * Returns the group and the height of its surface.
 */
export function buildTeatroMeridaBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 0.4
  g.add(kit.box(w + 4, 0.03, d + 4, 0xe6d6b4))
  g.add(kit.box(w, top, d, 0x7ed957))
  g.add(kit.slab(w - 2, 0.06, 3, 0xe2d4b8, 0, top, d / 2 - 2.5)) // gravel path along the front
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const c = cypress(kit, 9)
      c.position.set(sx * (w / 2 - 3), top, sz * (d / 2 - 3))
      g.add(c)
    }
  }
  return { group: g, top }
}
