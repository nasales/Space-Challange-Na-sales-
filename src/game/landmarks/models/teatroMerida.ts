// Teatro Romano de Mérida, cartoon style. Signature features, exaggerated:
// - the scaenae frons at the back (-Z): a terracotta wall with two storeys of slim blue-grey
//   marble columns (white and gold Corinthian capitals), a broken entablature that juts out over
//   every column, white statues between them and three dark doors, the central valva regia, bigger,
//   at the back of a curved exedra and the two side doors in rectangular recesses;
// - the low stage (pulpitum) in front of it, its front wall with alternating square and arched
//   niches, and stairs down to the white marble half moon of the orchestra;
// - the stepped half bowl of the seats (cavea), rising toward +Z in three tiers (ima, media and
//   summa cavea) split by pale walkways, with radial staircases, vomitoria and a thick outer wall
//   with arched gateways;
// - behind the stage, the garden peristyle (porticus post scaenam) with lawn, a colonnade and a
//   small shrine.
// Every surface is a stepped, flat top, so the detective can walk up the seats and onto the stage.
// Units are roughly metres.
import * as THREE from 'three'
import type { Kit, Opening } from '../kit'
import { archRing, cypress, statue } from '../ornaments'

const STONE = 0xe7cfa6 // warm granite of the seats
const STONE_B = 0xd9bc8e // every other row of seats, pilasters
const STONE_D = 0xc29a6c // parapets, outer wall, stage
const WALK = 0xf5e8cb // pale limestone: walkways and staircases
const MARBLE = 0xfff6e8 // orchestra, entablatures, statues
const COLUMN = 0x7d93b8 // blue-grey marble shafts (also the orchestra paving pattern)
const GOLD = 0xf2c14e // capital trims
const WALL = 0xb06f4c // brick and rubble of the scaenae frons
const NICHE = 0x7a5238 // shadow inside the stage niches
const DARK = 0x2b2540
const WOOD = 0x9a6b48 // stage boards
const GARDEN = 0x5cbf4a // lawn of the peristyle

const R0 = 10.5 // radius of the orchestra
const STAGE_H = 1.6 // height of the stage floor
const FZ = -9 // front face of the scaenae frons wall
const FRONS_W = 60
const WALL_H = 21.3
const RECESS_HALF = 3.5 // half width of the side recesses
const RECESS_DEPTH = 1.6
const EXEDRA_R = 7 // radius of the central exedra...
const EXEDRA_K = 0.5 // ...squashed in depth to a shallow curve
const DOORS = [
  { x: -16, w: 2.6, h: 4.6 },
  { x: 0, w: 3.6, h: 6 },
  { x: 16, w: 2.6, h: 4.6 },
]
/** Straight parts of the frons wall (x from, x to), front face at FZ. */
const SEGMENTS: [number, number][] = [[-FRONS_W / 2, -16 - RECESS_HALF], [-16 + RECESS_HALF, -EXEDRA_R], [EXEDRA_R, 16 - RECESS_HALF], [16 + RECESS_HALF, FRONS_W / 2]]
/** Straight runs of wall face: the segments plus the backs of the side recesses. */
const RUNS = [
  ...SEGMENTS.map(([x0, x1]) => ({ x0, x1, z: FZ, recess: false })),
  ...[-16, 16].map((x) => ({ x0: x - RECESS_HALF, x1: x + RECESS_HALF, z: FZ - RECESS_DEPTH, recess: true })),
]

/** z of the frons wall face at x (straight wall, recess back or exedra curve). */
function faceZ(x: number) {
  if (Math.abs(x) < EXEDRA_R) return FZ - EXEDRA_K * Math.sqrt(EXEDRA_R * EXEDRA_R - x * x)
  if (Math.abs(Math.abs(x) - 16) < RECESS_HALF) return FZ - RECESS_DEPTH
  return FZ
}

/** Half ring (in z >= 0) from radius r1 to r2, from y to y + h, opening toward -Z. */
function halfRing(kit: Kit, r1: number, r2: number, h: number, color: number, y = 0) {
  const s = new THREE.Shape()
  s.absarc(0, 0, r2, 0, Math.PI, false)
  s.lineTo(-r1, 0)
  s.absarc(0, 0, r1, Math.PI, 0, true)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 20 })
  geo.rotateX(Math.PI / 2) // shape y -> +Z, extrusion -> down
  geo.translate(0, h, 0)
  return kit.mesh(geo, color, 0, y, 0)
}

/** Piece of the central exedra: a half ring turned toward -Z and squashed, cut at the wall face. */
function exedra(kit: Kit, r1: number, r2: number, h: number, color: number, y: number) {
  const m = halfRing(kit, r1, r2, h, color, y)
  m.rotation.y = Math.PI
  m.scale.z = EXEDRA_K
  m.position.z = FZ
  return m
}

/** Flat round-arched plate facing +Z, base at y = 0: straight part h, then a half circle. */
function archPanel(kit: Kit, w: number, h: number, depth: number, color: number) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(w / 2, h)
  s.absarc(0, h, w / 2, 0, Math.PI, false)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 8 })
  geo.translate(0, 0, -depth / 2)
  return kit.mesh(geo, color)
}

/** Cartoon Corinthian column, base at y = 0: white base, slim blue-grey shaft, white bell capital with gold trims. */
function corinthianColumn(kit: Kit, h: number, r: number) {
  const g = new THREE.Group()
  const baseH = h * 0.05, capH = h * 0.12, abacusH = h * 0.035
  const shaftH = h - baseH - capH - abacusH
  g.add(kit.mesh(new THREE.CylinderGeometry(r * 1.3, r * 1.45, baseH, 8), MARBLE, 0, baseH / 2, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(r * 0.85, r, shaftH, 8), COLUMN, 0, baseH + shaftH / 2, 0))
  const capY = baseH + shaftH
  g.add(kit.mesh(new THREE.CylinderGeometry(r * 1.0, r * 1.0, h * 0.025, 8), GOLD, 0, capY - h * 0.0125, 0)) // astragal
  g.add(kit.mesh(new THREE.CylinderGeometry(r * 1.6, r * 0.9, capH, 8), MARBLE, 0, capY + capH / 2, 0)) // bell of leaves
  g.add(kit.box(r * 3.4, abacusH, r * 3.4, GOLD, 0, capY + capH, 0)) // abacus
  return g
}

/** One seat row: from radius r1 (where its staircase starts) to r2, its tread at `top`, rising from `from`. */
interface Row {
  r1: number
  r2: number
  from: number
  top: number
  /** depth of the tread in front of it, where the half steps of the staircase sit */
  before: number
}

/** Orchestra, proedria and the three tiers of seats with walkways, staircases, vomitoria and the outer wall. */
function buildCavea(kit: Kit, g: THREE.Group) {
  // ---- Orchestra: white marble half moon with a blue-grey paving pattern ----
  g.add(kit.mesh(new THREE.CylinderGeometry(R0, R0, 0.25, 24, 1, false, -Math.PI / 2, Math.PI), MARBLE, 0, 0.125, 0))
  g.add(kit.box(R0 * 2 + 2.6, 0.25, 0.5, MARBLE, 0, 0, -0.15)) // strip up to the stage
  g.add(halfRing(kit, 6, 7, 0.3, COLUMN))
  g.add(kit.mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 12, 1, false, -Math.PI / 2, Math.PI), COLUMN, 0, 0.15, 0))
  g.add(kit.slab(R0 * 2 - 0.4, 0.3, 0.9, COLUMN, 0, 0, 0.5))

  // ---- Proedria (two wide marble steps for the notables) and the low balteus wall ----
  g.add(halfRing(kit, R0, 11.4, 0.35, MARBLE))
  g.add(halfRing(kit, 11.4, 12.3, 0.7, MARBLE))
  g.add(halfRing(kit, 12.3, 12.8, STAGE_H, STONE_D))

  // ---- Three tiers of seats; each ring is solid from the ground, so the treads are walkable ----
  const tiers: Row[][] = []
  let r = 12.8, top = 0.7
  const tier = (rows: number, depth: number, firstRise: number, rise: number, start: number, before: number) => {
    const list: Row[] = []
    for (let i = 0; i < rows; i++) {
      const from = top
      top += i === 0 ? firstRise : rise
      list.push({ r1: i === 0 ? start : r, r2: r + depth, from, top, before: i === 0 ? before : depth })
      g.add(halfRing(kit, r, r + depth, top, i % 2 === 0 ? STONE : STONE_B))
      r += depth
    }
    tiers.push(list)
  }
  const walkway = (w: number) => {
    g.add(halfRing(kit, r, r + w, top, WALK))
    r += w
  }
  const parapet = (rise: number) => {
    g.add(halfRing(kit, r, r + 0.5, top + rise, STONE_D))
    r += 0.5
  }
  tier(7, 1.43, STAGE_H - 0.7, 0.7, 12.3, 0.9) // ima cavea
  walkway(1.8) // first praecinctio
  const vomR = r
  parapet(1.2)
  tier(5, 1.3, 1.2, 0.75, vomR, 1.8) // media cavea
  walkway(1.4) // second praecinctio
  const start3 = r
  parapet(1.2)
  tier(3, 1.0, 1.2, 0.8, start3, 1.4) // summa cavea

  // ---- Thick outer wall with a cornice, pilasters and arched gateways ----
  const outR = r + 1.5
  const wallTop = top + 1.4
  g.add(halfRing(kit, r, outR, wallTop, STONE_D))
  g.add(halfRing(kit, r - 0.2, outR + 0.3, 0.6, STONE_B, wallTop))
  const gateAngle = (k: number) => Math.PI * (0.1 + (0.8 * k) / 6)
  for (let k = 0; k < 7; k++) {
    const a = gateAngle(k)
    const gate = new THREE.Group()
    gate.add(archPanel(kit, 2.8, 2.6, 0.3, DARK))
    const ring = archRing(kit, 0, 2.6, 1.4, 0.5, 0.5, MARBLE, STONE_B)
    ring.position.z = 0.2
    gate.add(ring)
    if (k % 2 === 0) gate.add(kit.lightPanel(2.2, 3.2, 0, 0, 0.3, 0, 0.5)) // night: lit gateway
    gate.position.set(Math.cos(a) * outR, 0, Math.sin(a) * outR)
    gate.rotation.y = Math.PI / 2 - a // faces outward
    g.add(gate)
  }
  for (let k = -1; k < 7; k++) {
    const a = gateAngle(k + 0.5)
    const p = kit.box(1.3, wallTop, 0.8, STONE_B, Math.cos(a) * (outR + 0.2), 0, Math.sin(a) * (outR + 0.2))
    p.rotation.y = Math.PI / 2 - a
    g.add(p)
  }

  // ---- Radial staircases: half steps on the tread in front of each row, pale stone ----
  const imaAngle = (k: number) => Math.PI * (0.04 + (0.92 * k) / 6)
  const stairs = (rows: Row[], angles: number[]) => {
    for (const a of angles) {
      const c = Math.cos(a), s = Math.sin(a)
      const piece = (rad: number, len: number, y0: number, y1: number) => {
        const m = kit.slab(len, y1 - y0, 1.1, WALK, c * rad, y0, s * rad)
        m.rotation.y = -a // its length runs along the radius
        g.add(m)
      }
      for (const row of rows) {
        piece((row.r1 + row.r2) / 2, row.r2 - row.r1, row.top - 0.3, row.top + 0.04) // pale strip on the tread
        const n = Math.max(2, Math.round((row.top - row.from) / 0.4))
        const d = Math.min(row.before / n, 0.5)
        for (let k = 1; k < n; k++) {
          const outer = row.r1 - d * (n - 1 - k) // step k ends here
          piece(outer - d / 2, d, row.from - 0.3, row.from + ((row.top - row.from) * k) / n)
        }
      }
    }
  }
  const imaAngles = [0, 1, 2, 3, 4, 5, 6].map(imaAngle)
  const midAngles = [0, 1, 2, 3, 4, 5].map((k) => imaAngle(k + 0.5)) // upper stairs offset, Roman style
  stairs(tiers[0], imaAngles)
  stairs(tiers[1], midAngles)
  stairs(tiers[2], midAngles)

  // ---- Vomitoria: dark entrances in the parapet of the first walkway, framed in marble ----
  const walkTop = tiers[0][tiers[0].length - 1].top
  for (let k = 1; k < 6; k++) {
    const a = imaAngle(k)
    const v = new THREE.Group()
    v.add(kit.slab(1.8, 1.05, 0.15, DARK, 0, walkTop, -0.08))
    for (const side of [-1, 1]) v.add(kit.box(0.4, 1.05, 0.7, MARBLE, side * 1.1, walkTop, 0.1))
    v.add(kit.box(2.7, 0.4, 0.8, MARBLE, 0, walkTop + 1.05, 0.1))
    v.position.set(Math.cos(a) * vomR, 0, Math.sin(a) * vomR)
    v.rotation.y = Math.PI / 2 - a
    g.add(v)
  }
}

/** The stage (pulpitum) with its niched front wall and stairs down to the orchestra. */
function buildStage(kit: Kit, g: THREE.Group) {
  g.add(kit.box(FRONS_W + 2, STAGE_H, -1 - FZ, STONE_D, 0, 0, (FZ - 1) / 2))
  g.add(kit.slab(FRONS_W, 0.12, 5.4, WOOD, 0, STAGE_H, -3.9)) // wooden boards in front of the columns
  // Front wall: alternating square and arched niches, shadowed inside
  const openings: Opening[] = []
  let i = 0
  for (let x = -29; x <= 29; x += 2.9) {
    if (Math.abs(Math.abs(x) - 8) < 2) continue // room for the stairs
    const arch = i++ % 2 === 1
    openings.push({ x, width: 1.3, height: arch ? 0.55 : 1.0, arch, bottom: 0.25 })
  }
  const front = kit.facade(FRONS_W + 2, STAGE_H, 0.6, openings, STONE)
  front.position.z = -0.6
  g.add(front)
  g.add(kit.slab(FRONS_W + 1.8, STAGE_H - 0.1, 0.04, NICHE, 0, 0, -0.95))
  g.add(kit.box(FRONS_W + 2.4, 0.25, 0.9, MARBLE, 0, STAGE_H, -0.6)) // marble edge of the stage
  // Two small flights of stairs from the orchestra up to the stage
  for (const sx of [-8, 8]) {
    for (let k = 1; k <= 4; k++) g.add(kit.box(2.4, (STAGE_H * k) / 4, 0.5, MARBLE, sx, 0, -0.05 + (4 - k) * 0.5))
  }
}

/** The scaenae frons: wall with recesses and exedra, doors, two storeys of columns, statues, side wings. */
function buildFrons(kit: Kit, g: THREE.Group) {
  // ---- Wall: straight segments, side recesses and the curved central exedra ----
  for (const [x0, x1] of SEGMENTS) g.add(kit.box(x1 - x0, WALL_H, 3, WALL, (x0 + x1) / 2, 0, FZ - 1.5))
  const backT = 3 - RECESS_DEPTH
  for (const x of [-16, 16]) g.add(kit.box(RECESS_HALF * 2, WALL_H, backT, WALL, x, 0, FZ - RECESS_DEPTH - backT / 2))
  g.add(exedra(kit, EXEDRA_R, EXEDRA_R + 1.4, WALL_H, WALL, 0))

  /** A band along the wall face (dado, entablature, cornice), following runs and exedra. */
  const band = (y: number, h: number, depth: number, color: number, recesses = true, curve = true) => {
    for (const run of RUNS) {
      if (run.recess && !recesses) continue
      g.add(kit.box(run.x1 - run.x0, h, depth, color, (run.x0 + run.x1) / 2, y, run.z + depth / 2))
    }
    if (curve) g.add(exedra(kit, EXEDRA_R - depth, EXEDRA_R + 0.1, h, color, y))
  }
  band(STAGE_H, 1.4, 0.5, STONE_D, false, false) // dado under the lower storey
  band(11, 1.1, 0.8, MARBLE) // lower entablature
  band(12.1, 0.35, 2, MARBLE) // ledge for the upper storey and its statues
  band(19.25, 1.0, 0.7, MARBLE) // upper entablature
  band(WALL_H - 0.7, 0.7, 1.2, MARBLE) // top cornice
  g.add(exedra(kit, EXEDRA_R - 0.6, EXEDRA_R + 1.7, 0.7, MARBLE, WALL_H - 0.7))

  // ---- Three doors with marble frames, the valva regia bigger, all lit for a night play ----
  for (const d of DOORS) {
    const z = (d.x === 0 ? FZ - EXEDRA_R * EXEDRA_K : FZ - RECESS_DEPTH) + 0.1
    g.add(kit.slab(d.w, d.h, 0.2, DARK, d.x, STAGE_H, z))
    for (const side of [-1, 1]) g.add(kit.box(0.5, d.h, 0.5, MARBLE, d.x + side * (d.w / 2 + 0.25), STAGE_H, z + 0.15))
    g.add(kit.box(d.w + 1.6, 0.6, 0.7, MARBLE, d.x, STAGE_H + d.h, z + 0.15))
    g.add(kit.lightPanel(d.w * 0.9, d.h * 0.9, d.x, STAGE_H, z + 0.3, 0, 0.9))
  }

  // ---- Two storeys of columns, each on a pedestal, with an entablature jutting out over it ----
  const storey = (half: number, baseY: number, pedH: number, colH: number, r: number, entH: number) => {
    for (let x = -half; x <= half; x += 2) {
      if (DOORS.some((d) => d.x === x)) continue // leave the doors free
      const z = faceZ(x) + 1.3
      g.add(kit.box(1.5, pedH, 1.5, MARBLE, x, baseY, z))
      const c = corinthianColumn(kit, colH, r)
      c.position.set(x, baseY + pedH, z)
      g.add(c)
      const ey = baseY + pedH + colH
      g.add(kit.box(1.9, entH, 2.6, MARBLE, x, ey, z))
      g.add(kit.box(2.3, 0.35, 2.9, MARBLE, x, ey + entH, z + 0.1))
    }
  }
  storey(28, STAGE_H, 1.4, 8, 0.42, 1.1) // 26 columns, top at 12.45
  const upY = STAGE_H + 1.4 + 8 + 1.1 + 0.35
  storey(26, upY, 0.8, 6, 0.34, 1.0) // 24 columns

  // ---- White statues between the columns (a bigger one over each door) ----
  for (const x of [-25, -21, -16, -11, -7, -3, 0, 3, 7, 11, 16, 21, 25]) {
    const big = DOORS.some((d) => d.x === x)
    const s = statue(kit, big ? 3.2 : 2.6, MARBLE)
    s.position.set(x, upY, faceZ(x) + (big ? 1.3 : 0.9))
    g.add(s)
  }
  for (const x of [-23, -5, 5, 23]) {
    const z = faceZ(x) + 0.6
    g.add(kit.box(0.9, 1.4, 0.9, MARBLE, x, STAGE_H, z))
    const s = statue(kit, 2.8, MARBLE)
    s.position.set(x, STAGE_H + 1.4, z)
    g.add(s)
  }

  // ---- Side wings closing the stage (parascaenia), each with a door ----
  for (const side of [-1, 1]) {
    const x = side * (FRONS_W / 2 + 3)
    g.add(kit.box(6, 13, 11, WALL, x, 0, -6.5))
    g.add(kit.box(6.6, 0.6, 11.6, MARBLE, x, 13, -6.5))
    g.add(kit.slab(2.4, 4.2, 0.2, DARK, x, 0, -0.95))
    g.add(kit.box(3.4, 0.5, 0.6, MARBLE, x, 4.2, -0.8))
  }

  // ---- Night: footlights along the stage and soft floodlights on the upper storey ----
  for (const x of [-24, -12, 0, 12, 24]) g.add(kit.lightHalo(3, x, STAGE_H + 0.8, -1.6, 0.6))
  for (const x of [-18, 0, 18]) g.add(kit.lightHalo(4, x, 16, FZ + 3, 0.45))
  g.add(kit.lightHalo(5, 0, 1.5, 4, 0.3)) // orchestra
}

/** The garden peristyle behind the stage (porticus post scaenam): lawn, colonnade and a small shrine. */
function buildPeristyle(kit: Kit, g: THREE.Group) {
  const back = -23.6
  g.add(kit.box(48, 0.3, 11, GARDEN, 0, 0, -17.6))
  g.add(kit.slab(1.6, 0.06, 10.6, WALK, 0, 0.3, -17.6)) // gravel cross paths
  g.add(kit.slab(46, 0.06, 1.6, WALK, 0, 0.3, -17.6))
  // Stylobate on the three free sides (the frons closes the fourth)
  g.add(kit.box(52, 0.5, 2, STONE_B, 0, 0, back))
  for (const sx of [-25, 25]) g.add(kit.box(2, 0.5, 12.6, STONE_B, sx, 0, -18.3))
  const column = (x: number, z: number) => {
    g.add(kit.mesh(new THREE.CylinderGeometry(0.32, 0.38, 4, 8), MARBLE, x, 2.5, z))
    g.add(kit.box(0.9, 0.3, 0.9, MARBLE, x, 4.5, z))
  }
  for (let x = -24; x <= 24; x += 3) column(x, back)
  for (const sx of [-25, 25]) for (const z of [-14.5, -17.5, -20.5]) column(sx, z)
  g.add(kit.box(51, 0.6, 0.9, MARBLE, 0, 4.8, back))
  for (const sx of [-25, 25]) g.add(kit.box(0.9, 0.6, 12, MARBLE, sx, 4.8, -18.3))
  // Small shrine (aula sacra) on the axis, facing the frons
  g.add(kit.box(5.4, 3.6, 4, MARBLE, 0, 0.3, -20.6))
  const roof = kit.pediment(6, 1.4, 4.4, WALL, 3.9)
  roof.position.z = -20.6
  g.add(roof)
  g.add(kit.slab(1.4, 2.2, 0.15, DARK, 0, 0.3, -18.55))
  g.add(kit.lightPanel(1.2, 2, 0, 0.3, -18.4, 0, 0.6))
}

export function buildTeatroMerida(kit: Kit): THREE.Group {
  const g = new THREE.Group()
  buildCavea(kit, g)
  buildStage(kit, g)
  buildFrons(kit, g)
  buildPeristyle(kit, g)
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
