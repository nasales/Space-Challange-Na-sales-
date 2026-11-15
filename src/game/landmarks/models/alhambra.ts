// La Alhambra (Granada), cartoon style. The Nasrid palace city on top of the Sabika hill,
// squeezed together like a toy: a real green hill with wooded slopes; an almond-shaped ring of
// red walls with fat-footed towers and stepped merlons; the Alcazaba fortress at the west end
// with the Torre de la Vela and its bell gable; the huge Torre de Comares over the Court of the
// Myrtles (long blue pool between hedges); the Court of the Lions (white arcade of slim columns
// and a big fountain on golden lions); the square Palace of Charles V with its round courtyard;
// the Partal pool, a little medina of white houses, and the Generalife gardens at the east end
// (long pool with arching jets, flower beds, terraces and cypress rows).
// Units are roughly metres; the long axis is X, north is -Z.
import * as THREE from 'three'
import type { Kit } from '../kit'
import { seeded, wonk } from '../kit'
import { bush, cypress, flowerBed, horseshoeArch, merlonRing, merlons, orangeTree, wallBetween } from '../ornaments'

const RED = 0xe0703f // "red castle": rammed earth walls, warm and bright
const RED_D = 0xc85a34 // towers and wall plinths
const RUIN = 0xd4875a // low ruined walls of the Alcazaba barracks
const WHITE = 0xfff4de // palace walls
const ROOF = 0xdb6a3a // terracotta tiles
const STONE = 0xeac48f // Palace of Charles V
const STONE_D = 0xc39f74
const PAVE = 0xf3dcae // sandy paving of the courtyards
const WATER = 0x35b6f0
const JET = 0xdff4ff
const HEDGE = 0x2f9a46
const DARK = 0x2b2540
const GOLD = 0xf2c14e
const EARTH = 0xb38455
const GRASS = 0x86d957
const SLOPE = 0x6fcc4c // hill slopes, a touch deeper than the top
const TERRACE = 0x74d452
const TREE = 0x3fae4a
const TREE_L = 0x5cc24f
const FLOWERS = [0xff5a7a, 0xffd23f, 0xff8a1e, 0xb46cff, 0xffffff]

// ---- The almond-shaped wall ring ----
const A0 = 50 // half-length of the ring (X)
const B0 = 20 // half-width of the ring (Z)
const ALMOND = 0.45 // shape exponent: 0.5 would be an ellipse, smaller is fuller at the ends
const WALL_H = 5
const HILL_H = 10 // height of the hilltop
/** Outer walls and towers sink this far below the hilltop: they stand on the slopes, like a real castle. */
const DROP = HILL_H

/** Half-width (Z) of the wall ring at a given x. */
function almondHalf(x: number) {
  const u = 1 - (x / A0) ** 2
  return u <= 0 ? 0 : B0 * Math.pow(u, ALMOND)
}

/** Vertices of the outer walls (x, z), with a small hand-drawn wobble (the tips stay put). */
function ringPoints(): [number, number][] {
  const rand = seeded(7)
  const pts: [number, number][] = []
  for (let i = 0; i < 18; i++) {
    const t = (i / 18) * Math.PI * 2
    const s = Math.sin(t)
    let x = A0 * Math.cos(t)
    let z = B0 * Math.sign(s) * Math.pow(Math.abs(s), ALMOND * 2)
    if (i % 9 !== 0) {
      const j = 1 + (rand() - 0.5) * 0.05
      x *= j
      z *= j
    }
    pts.push([x, z])
  }
  return pts
}

// ---- Small local helpers ----

/** Hipped tile roof (a frustum that closes to a ridge along the long side), base at y. */
function hipRoof(kit: Kit, w: number, d: number, h: number, y: number, color = ROOF) {
  const rw = Math.max(0.3, w - d), rd = Math.max(0.3, d - w)
  return kit.taper(w, d, rw, rd, h, color, 0, y, 0)
}

/**
 * Square tower: splayed feet, fat top band, stepped merlons, big dark horseshoe windows on each
 * face and an optional dark door. Base at y = 0.
 */
let towerSeed = 1
function tower(kit: Kit, w: number, h: number, color = RED_D, rows = 1, door = false, foot = 0) {
  const g = new THREE.Group()
  const wb = w * 1.28, wt = w * 0.96
  g.add(kit.taper(wb, wb, wt, wt, h, color)) // wide feet
  g.add(kit.box(w + 0.9, 0.9, w + 0.9, color, 0, h - 0.45, 0)) // fat top band
  const crown = merlonRing(kit, w + 0.7, w + 0.7, Math.max(1.3, w * 0.24), color)
  crown.position.y = h + 0.45
  g.add(crown)
  /** Half-size of the tapered body at height y (to stick windows on its faces). */
  const halfAt = (y: number) => (wb + ((wt - wb) * y) / h) / 2
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Group()
    for (let r = 0; r < rows; r++) {
      const y = foot + (h - foot) * (rows === 1 ? 0.62 : 0.42 + r * 0.26) // foot: buried part
      const n = w > 9 ? 3 : 2
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * w * 0.3
        const win = horseshoeArch(kit, w * 0.16, w * 0.14, 0.4, DARK)
        win.position.set(x, y, halfAt(y) + 0.05)
        face.add(win)
        if ((k + i + r) % 2 === 0) face.add(kit.lightPanel(w * 0.12, w * 0.19, x, y + w * 0.02, halfAt(y) + 0.5)) // lit at night
      }
    }
    if (door && k % 2 === 0) {
      const d = horseshoeArch(kit, w * 0.34, w * 0.32, 0.4, DARK)
      d.position.set(0, foot, halfAt(foot) - 0.1)
      d.rotation.x = -Math.atan((wb - wt) / 2 / h) // lean with the sloped face
      face.add(d)
      face.add(kit.lightHalo(w * 0.4, 0, foot + w * 0.25, halfAt(foot) + 0.6, 0.7)) // night: glow in the gateway
    }
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  return wonk(g, towerSeed++, 0.035)
}

/** Palace wing: white walls, little dark windows on the long sides, hipped tile roof. Long along Z. */
function wing(kit: Kit, w: number, h: number, d: number, windows = true) {
  const g = new THREE.Group()
  g.add(kit.box(w, h, d, WHITE))
  g.add(hipRoof(kit, w + 1, d + 1, Math.min(w, d) * 0.45, h))
  if (windows) {
    for (const sx of [-1, 1]) {
      for (let z = -d / 2 + 2, i = 0; z <= d / 2 - 1.9; z += 2.6, i++) {
        g.add(kit.slab(0.15, 1.3, 0.7, DARK, sx * (w / 2 + 0.05), h * 0.55, z))
        if ((i + (sx > 0 ? 1 : 0)) % 2 === 0) g.add(kit.lightPanel(0.6, 1.1, sx * (w / 2 + 0.25), h * 0.55 + 0.1, z, (sx * Math.PI) / 2)) // lit at night
      }
    }
  }
  return g
}

/** Portico: a white wall with n big arches facing +Z, a dark back so the arches read deep, tile roof. */
function portico(kit: Kit, width: number, h: number, n: number, depth = 1.2) {
  const g = new THREE.Group()
  const step = width / n
  const archW = step * 0.62
  const openings = Array.from({ length: n }, (_, i) => ({ x: -width / 2 + step * (i + 0.5), width: archW, height: h * 0.45, arch: true }))
  g.add(kit.facade(width, h, depth, openings, WHITE))
  g.add(kit.slab(width - 0.6, h - 0.6, 0.3, DARK, 0, 0, -depth / 2 - 0.9))
  g.add(kit.box(width - 0.6, h, 0.6, WHITE, 0, 0, -depth / 2 - 1.35)) // back wall
  g.add(hipRoof(kit, width + 0.8, depth + 2.6, 1.4, h, ROOF).translateZ(-1))
  return g
}

/** Little white house with a tile roof and a dark door, facing +Z. */
function house(kit: Kit, w: number, d: number, h: number) {
  const g = new THREE.Group()
  g.add(kit.box(w, h, d, WHITE))
  g.add(hipRoof(kit, w + 0.6, d + 0.6, Math.min(w, d) * 0.4, h))
  g.add(kit.slab(0.8, 1.4, 0.15, DARK, 0, 0, d / 2 + 0.05))
  g.add(kit.slab(0.6, 0.6, 0.15, DARK, w * 0.28, h * 0.55, d / 2 + 0.05))
  return g
}

/** Round garden tree (plump ball on a short trunk). */
function roundTree(kit: Kit, size: number, color = TREE) {
  return bush(kit, size, color, 0x7a4a2c)
}

// ---- Parts of the palace city ----

function courtOfMyrtles(kit: Kit) {
  const g = new THREE.Group()
  g.add(kit.box(14.5, 0.2, 19, PAVE, 0, 0, 1)) // paving
  g.add(kit.box(5.4, 0.35, 15.2, WHITE)) // marble rim
  g.add(kit.box(4.2, 0.45, 14.2, WATER)) // the long pool
  for (const x of [-3.5, 3.5]) g.add(kit.box(1.4, 1.3, 14, HEDGE, x, 0, 0)) // plump myrtle hedges
  for (const x of [-6.3, 6.3]) {
    const w = wing(kit, 3.4, 6, 18)
    w.position.set(x, 0, 1)
    g.add(w)
  }
  const north = portico(kit, 9.2, 5, 5)
  north.position.z = -7.4
  g.add(north)
  const south = portico(kit, 9.2, 5, 5)
  south.rotation.y = Math.PI
  south.position.z = 9.4
  g.add(south)
  return g
}

function courtOfLions(kit: Kit) {
  const g = new THREE.Group()
  const w = 14, d = 9, colH = 3.4
  g.add(kit.box(w + 6, 0.2, d + 6, PAVE))
  // Four water channels running from the fountain
  g.add(kit.box(w - 1, 0.3, 0.6, WATER))
  g.add(kit.box(0.6, 0.3, d - 1, WATER))
  // Arcade of slim white columns on the four sides
  const col = (x: number, z: number) => {
    g.add(kit.mesh(new THREE.CylinderGeometry(0.17, 0.2, colH, 6), WHITE, x, colH / 2 + 0.2, z))
    g.add(kit.box(0.5, 0.3, 0.5, WHITE, x, colH, z))
  }
  for (let x = -w / 2; x <= w / 2 + 1e-6; x += 1.4) for (const z of [-d / 2, d / 2]) col(x, z)
  for (let z = -d / 2 + 1.5; z < d / 2 - 0.5; z += 1.5) for (const x of [-w / 2, w / 2]) col(x, z)
  // Frieze over the columns, galleries behind them and their tile roofs
  for (const z of [-d / 2, d / 2]) {
    g.add(kit.box(w + 0.8, 1, 0.7, WHITE, 0, colH + 0.2, z))
    g.add(kit.box(w + 5, colH + 2, 2, WHITE, 0, 0, z + Math.sign(z) * 2))
    g.add(kit.slab(w, colH - 0.4, 0.2, DARK, 0, 0.2, z + Math.sign(z) * 0.95))
    const r = hipRoof(kit, w + 6, 4.2, 1.6, colH + 1.2)
    r.position.z = z + Math.sign(z) * 1.6
    g.add(r)
  }
  for (const x of [-w / 2, w / 2]) {
    g.add(kit.box(0.7, 1, d + 0.8, WHITE, x, colH + 0.2, 0))
    g.add(kit.box(2, colH + 2, d + 1, WHITE, x + Math.sign(x) * 2, 0, 0))
    g.add(kit.slab(0.2, colH - 0.4, d - 1, DARK, x + Math.sign(x) * 0.95, 0.2, 0))
    const r = hipRoof(kit, 4.2, d + 2, 1.6, colH + 1.2)
    r.position.x = x + Math.sign(x) * 1.6
    g.add(r)
  }
  // Pavilions jutting into the court at both ends, with pyramid roofs
  for (const x of [-w / 2 + 1.2, w / 2 - 1.2]) {
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) g.add(kit.mesh(new THREE.CylinderGeometry(0.18, 0.2, colH + 1, 6), WHITE, x + cx * 1.1, (colH + 1) / 2 + 0.2, cz * 1.1))
    g.add(kit.box(3, 1.1, 3, WHITE, x, colH + 1, 0))
    g.add(kit.mesh(new THREE.ConeGeometry(2.4, 2.4, 4).rotateY(Math.PI / 4), ROOF, x, colH + 3.3, 0))
  }
  // The fountain: a big basin on twelve golden lions
  g.add(kit.mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.4, 16), WHITE, 0, 0.4, 0))
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6
    const lion = new THREE.Group()
    const body = kit.mesh(new THREE.IcosahedronGeometry(0.55, 1), GOLD, 0, 0.55, 0)
    body.scale.set(0.9, 1, 1.4)
    lion.add(body)
    lion.add(kit.mesh(new THREE.IcosahedronGeometry(0.42, 1), GOLD, 0, 1.0, 0.55)) // head and mane
    lion.position.set(Math.cos(a) * 2, 0.6, Math.sin(a) * 2)
    lion.rotation.y = Math.PI / 2 - a // facing outwards
    g.add(lion)
  }
  g.add(kit.mesh(new THREE.CylinderGeometry(1.2, 1.4, 1.4, 12), WHITE, 0, 1.3, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(2.3, 1.0, 0.8, 16), WHITE, 0, 2.3, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.15, 16), WATER, 0, 2.7, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.2, 8), WHITE, 0, 3.3, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(0.8, 0.3, 0.4, 10), WHITE, 0, 4.0, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.4, 6), JET, 0, 4.8, 0)) // water jet
  return g
}

/** Palace of Charles V: a square block with a round courtyard ringed by columns. */
function palaceCharlesV(kit: Kit) {
  const g = new THREE.Group()
  const w = 14, h = 8.5, R = 5
  const square = (half: number) => {
    const s = new THREE.Shape()
    s.moveTo(-half, -half)
    s.lineTo(half, -half)
    s.lineTo(half, half)
    s.lineTo(-half, half)
    s.closePath()
    const hole = new THREE.Path()
    hole.absarc(0, 0, R, 0, Math.PI * 2, true)
    s.holes.push(hole)
    return s
  }
  const body = new THREE.ExtrudeGeometry(square(w / 2), { depth: h, bevelEnabled: false, curveSegments: 20 })
  body.rotateX(-Math.PI / 2) // extrude upwards
  g.add(kit.mesh(body, STONE))
  g.add(kit.box(w + 1, 1.2, w + 1, STONE_D)) // plinth
  // Tile roof frame around the open round courtyard
  const roof = new THREE.ExtrudeGeometry(square(w / 2 + 0.4), { depth: 1.1, bevelEnabled: false, curveSegments: 20 })
  roof.rotateX(-Math.PI / 2)
  g.add(kit.mesh(roof, ROOF, 0, h, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(R, R, 0.25, 24), PAVE, 0, 0, 0))
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2
    g.add(kit.mesh(new THREE.CylinderGeometry(0.28, 0.32, h - 0.6, 8), WHITE, Math.cos(a) * (R - 0.9), (h - 0.6) / 2, Math.sin(a) * (R - 0.9)))
  }
  g.add(kit.mesh(new THREE.TorusGeometry(R - 0.9, 0.4, 6, 24).rotateX(Math.PI / 2), WHITE, 0, h * 0.5, 0)) // gallery floor
  // Windows and a big door on each face
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Group()
    for (const y of [2.6, 5.8]) for (let x = -5.25; x <= 5.3; x += 2.1) if (!(y < 4 && Math.abs(x) < 1)) face.add(kit.slab(1, 1.6, 0.2, DARK, x, y, w / 2 + 0.05))
    face.add(kit.box(3.6, 0.6, 0.5, STONE_D, 0, 4.4, w / 2 + 0.1))
    face.add(kit.slab(2, 3.2, 0.2, DARK, 0, 1.2, w / 2 + 0.05))
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  return g
}

/** The Alcazaba: inner cross wall, keep towers and the grid of ruined barracks. */
function alcazaba(kit: Kit, g: THREE.Group) {
  const X = -36, half = almondHalf(X) - 0.5
  g.add(wallBetween(kit, X, -half, X, half, WALL_H + 1, 2, RED))
  for (const z of [-half / 2, half / 2]) {
    const m = merlons(kit, half, 1.4, RED)
    m.rotation.y = Math.PI / 2
    m.position.set(X, WALL_H + 1, z)
    g.add(m)
  }
  const gate = tower(kit, 5, 10.5, RED_D, 1, true)
  gate.position.set(X, 0, 0)
  g.add(gate)
  const homenaje = tower(kit, 6.5, 16, RED_D, 2)
  homenaje.position.set(-43, 0, -7)
  g.add(homenaje)
  const quebrada = tower(kit, 6, 13)
  quebrada.position.set(-43, 0, 7.5)
  g.add(quebrada)
  // Plaza de Armas: low ruined walls of the old barracks on bare earth
  g.add(kit.box(9, 0.2, 7, EARTH, -41.5, 0, 0.3))
  for (const x of [-45.5, -42.5, -39.5, -37.5]) g.add(kit.box(0.6, 1.2, 6.4, RUIN, x, 0, 0.3))
  for (const z of [-2.6, 0.4, 3.2]) g.add(kit.box(8.6, 1.2, 0.6, RUIN, -41.5, 0, z))
}

/** Torre de la Vela with its white bell gable, at the west tip. */
function torreVela(kit: Kit) {
  const g = new THREE.Group()
  const h = 19 + DROP
  g.add(tower(kit, 9, h, RED_D, 2, false, DROP))
  const gable = new THREE.Group()
  gable.add(kit.facade(4.4, 4.6, 1, [{ x: 0, width: 2, height: 1.9, arch: true, bottom: 0.7 }], WHITE))
  gable.add(kit.pediment(4.8, 1.4, 1.3, ROOF, 4.6))
  gable.add(kit.mesh(new THREE.CylinderGeometry(0.35, 0.75, 1.3, 10), GOLD, 0, 2.3, 0)) // the bell
  gable.add(kit.box(2.4, 0.25, 0.3, DARK, 0, 3.1, 0))
  gable.add(kit.lightHalo(2.4, 0, 2.3, 0.5, 0.8)) // night: the bell of the Vela
  gable.position.set(0, h + 0.45, 1.8)
  g.add(gable)
  return g
}

/** Partal: pool, an arched portico against the north wall and the little Torre de las Damas. */
function partal(kit: Kit) {
  const g = new THREE.Group()
  g.add(kit.box(10.5, 0.3, 5.2, WHITE))
  g.add(kit.box(9.4, 0.42, 4.2, WATER))
  const p = portico(kit, 9, 4.6, 5)
  p.position.z = -3.8
  g.add(p)
  const damas = tower(kit, 4.6, 9, RED_D)
  damas.position.set(0, 0, -6.2)
  g.add(damas)
  for (const x of [-3.5, 3.5]) {
    const f = flowerBed(kit, 4.5, 1.4, EARTH, FLOWERS)
    f.position.set(x, 0, 3.7)
    g.add(f)
  }
  for (const x of [-6.8, 6.8]) {
    const t = orangeTree(kit, 3)
    t.position.set(x, 0, 1)
    g.add(t)
  }
  return g
}

/** Generalife: long pool with arching jets, flower beds, terraces with cypresses, pavilion. */
function generalife(kit: Kit, g: THREE.Group) {
  const X = 34, half = almondHalf(X) - 0.5
  for (const [a, b] of [[-half, -2.6], [2.6, half]]) g.add(wallBetween(kit, X, a, X, b, WALL_H - 1, 1.8, RED))
  const gate = tower(kit, 5, 9.5, RED_D, 1, true)
  gate.position.set(X, 0, 0)
  g.add(gate)
  // Patio de la Acequia
  const cx = 41
  g.add(kit.box(12.4, 0.2, 7.6, PAVE, cx, 0, 0))
  g.add(kit.box(12, 0.32, 3.2, WHITE, cx, 0, 0))
  g.add(kit.box(11.2, 0.42, 2.3, WATER, cx, 0, 0))
  for (let x = cx - 5; x <= cx + 5.01; x += 1.25) {
    for (const z of [-1.3, 1.3]) {
      const jet = kit.mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.7, 5), JET, x, 1.0, z * 0.75)
      jet.rotation.x = z > 0 ? -0.6 : 0.6 // arching toward the middle of the pool
      g.add(jet)
    }
  }
  for (const z of [-2.6, 2.6]) {
    const f = flowerBed(kit, 11, 1.6, EARTH, FLOWERS)
    f.position.set(cx, 0, z)
    g.add(f)
    g.add(kit.box(11.5, 1.1, 0.9, HEDGE, cx, 0, z * 1.42))
  }
  // Stepped terraces on both sides, cypress rows on the lower step, orange trees on the upper one
  for (const s of [-1, 1]) {
    g.add(kit.box(10, 1.2, 3.6, TERRACE, 40, 0, s * 6.1))
    g.add(kit.box(7.5, 2.4, 2.6, TERRACE, 39, 0, s * 9.2))
    for (let x = 36; x <= 44.01; x += 2) {
      const c = cypress(kit, 6.5 + ((x / 2) % 2))
      c.position.set(x, 1.2, s * 5.8)
      g.add(c)
    }
    for (const x of [36.5, 39, 41.5]) {
      const t = orangeTree(kit, 2.6)
      t.position.set(x, 2.4, s * 9.2)
      g.add(t)
    }
  }
  // Pavilion at the east end, facing the pool
  const pav = new THREE.Group()
  const p = portico(kit, 7.6, 5, 3)
  pav.add(p)
  pav.add(kit.box(3.6, 3, 3.6, WHITE, 0, 5, -1.8)) // little mirador on top
  pav.add(kit.mesh(new THREE.ConeGeometry(2.9, 2, 4).rotateY(Math.PI / 4), ROOF, 0, 9, -1.8))
  pav.add(kit.slab(1, 1.3, 0.2, DARK, 0, 6, 0.0))
  pav.rotation.y = -Math.PI / 2
  pav.position.x = 47.6
  g.add(pav)
}

export function buildAlhambra(kit: Kit): THREE.Group {
  const g = new THREE.Group()
  towerSeed = 1
  const rand = seeded(31)

  // ---- Outer walls and towers ----
  const ring = ringPoints()
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i]
    const [bx, bz] = ring[(i + 1) % ring.length]
    g.add(wallBetween(kit, ax, az, bx, bz, WALL_H + DROP, 2.2, RED).translateY(-DROP))
    g.add(wallBetween(kit, ax, az, bx, bz, 1.6 + DROP, 3.4, RED_D).translateY(-DROP)) // wide foot
    const len = Math.hypot(bx - ax, bz - az)
    const crown = merlons(kit, len, 1.5, RED)
    crown.position.set((ax + bx) / 2, WALL_H, (az + bz) / 2)
    crown.rotation.y = Math.atan2(-(bz - az), bx - ax)
    g.add(crown)
    if (i === 9 || i === 13) continue // Torre de la Vela and Torre de Comares go here
    if (i === 3 || i === 6 || i === 12 || i === 15) continue // plain wall here, so towers breathe
    const big = i === 0
    const h = big ? 12 : 8.5 + rand() * 4
    const t = tower(kit, big ? 7 : 4.4 + rand() * 1.6, h + DROP, RED_D, big ? 2 : 1, false, DROP)
    t.position.set(ax, -DROP, az)
    g.add(t)
  }

  // Puerta de la Justicia: gate tower on the south wall, where the path climbs the hill
  const justicia = tower(kit, 5, 9 + DROP, RED_D, 1, true, DROP)
  justicia.position.set(0, -DROP, (ring[4][1] + ring[5][1]) / 2)
  g.add(justicia)

  // ---- Alcazaba (west end) and the Torre de la Vela ----
  alcazaba(kit, g)
  const vela = torreVela(kit)
  vela.position.set(ring[9][0], -DROP, ring[9][1])
  g.add(vela)

  // ---- Between the Alcazaba and the palaces: Puerta del Vino, Mexuar, cisterns square ----
  g.add(kit.box(3, 0.2, 26, PAVE, -34, 0, 0))
  const vino = tower(kit, 4.6, 8.5, RED, 1, true)
  vino.position.set(-30.5, 0, -6.5)
  g.add(vino)
  const mexuar = wing(kit, 6, 6.5, 8)
  mexuar.rotation.y = Math.PI / 2
  mexuar.position.set(-22.5, 0, -10)
  g.add(mexuar)
  for (const [x, z] of [[-29, -12], [-26, -3.6], [-31, -1.5], [-17.5, -14.5]]) {
    const t = orangeTree(kit, 3)
    t.position.set(x, 0, z)
    g.add(t)
  }

  // ---- Palace of Charles V ----
  const palace = palaceCharlesV(kit)
  palace.position.set(-26, 0, 6.5)
  g.add(palace)
  g.add(kit.lightHalo(6, -26, 4.5, 15, 0.4)) // night: soft floodlight on its south face

  // ---- Nasrid palaces: Myrtles with the Comares tower, Lions ----
  const myrtles = courtOfMyrtles(kit)
  myrtles.position.set(-9, 0, 0)
  g.add(myrtles)
  const comares = tower(kit, 12, 27 + DROP, RED_D, 2, false, DROP)
  comares.position.set(-9, -DROP, -14)
  g.add(comares)
  const lions = courtOfLions(kit)
  lions.position.set(9.5, 0, -6.2)
  g.add(lions)

  // Comares baths: white block with little domes, and an orange garden
  g.add(kit.box(7, 3.2, 4, WHITE, -9, 0, 14.5))
  for (const x of [-11.2, -9, -6.8]) g.add(kit.mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), WHITE, x, 3.2, 14.5))
  for (const x of [-15, -3]) {
    const t = orangeTree(kit, 3)
    t.position.set(x, 0, 14)
    g.add(t)
  }
  // Little Lindaraja-style garden in front of the baths
  for (const z of [11.3, 18]) {
    const f = flowerBed(kit, 7, 1.3, EARTH, FLOWERS)
    f.position.set(-9, 0, z)
    g.add(f)
  }
  g.add(kit.mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.6, 12), WHITE, -14.5, 0.3, 17.5))
  g.add(kit.mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.12, 12), WATER, -14.5, 0.62, 17.5))

  // ---- Partal ----
  const p = partal(kit)
  p.position.set(26.5, 0, -10)
  g.add(p)

  // ---- Calle Real, Santa Maria church and the medina ----
  g.add(kit.box(36, 0.15, 2.6, EARTH, 16, 0, 2.6))
  g.add(kit.box(2.6, 0.15, 14, EARTH, -1.5, 0, 9))
  const church = wing(kit, 5, 7, 11)
  church.rotation.y = Math.PI / 2
  church.position.set(4.5, 0, 9.5)
  g.add(church)
  const belfry = tower(kit, 3.2, 12, WHITE)
  belfry.position.set(-1.4 + 2.6, 0, 13.6)
  g.add(belfry)
  for (let x = 13; x <= 31; x += 4.4) {
    for (let z = 5.8; z <= 16; z += 4.2) {
      const hw = 1.4 + rand() * 0.6, hd = 1.3 + rand() * 0.5
      if (z + hd + 2.2 > almondHalf(x + Math.sign(x) * 2)) continue
      if (rand() < 0.22) {
        const t = rand() < 0.5 ? orangeTree(kit, 2.8) : cypress(kit, 5.5)
        t.position.set(x, 0, z)
        g.add(t)
        continue
      }
      const hs = house(kit, hw * 2, hd * 2, 2.6 + rand() * 1.6)
      hs.position.set(x + (rand() - 0.5) * 0.8, 0, z)
      hs.rotation.y = z < 7 ? Math.PI : 0 // doors toward the street
      g.add(hs)
    }
  }

  // ---- Generalife at the east end ----
  generalife(kit, g)

  // A few accent cypresses among the palaces
  for (const [x, z] of [[-17.5, 11], [-17.5, 15], [19, -2], [21.5, -1.5], [1.2, -14], [32, -12]]) {
    const c = cypress(kit, 6.5)
    c.position.set(x, 0, z)
    g.add(c)
  }
  return g
}

/**
 * The Sabika hill: a flat almond-shaped hilltop (where the palace city sits) with smooth sloped,
 * walkable sides that run out to the edge of the w x d footprint, covered with plump trees.
 * w and d: size of the base (model units). Returns the group and the height of the hilltop.
 */
export function buildAlhambraBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const H = HILL_H
  const hw = w / 2 - 0.2, hd = d / 2 - 0.2
  // The hilltop is the wall ring (the model is centred on its bounding box, which is symmetric);
  // the walls and towers reach down the slopes on their own foundations.
  const at = A0 + 1.4, bt = B0 + 1.4
  const N = 96, M = 10

  /** Point on the hilltop edge at angle t, and where its ray meets the footprint edge. */
  const edge = (t: number) => {
    const s = Math.sin(t)
    const ax = at * Math.cos(t), az = bt * Math.sign(s) * Math.pow(Math.abs(s), ALMOND * 2)
    // Foot of the hill: a rounded rectangle (superellipse) inside the footprint
    const f = 1 / Math.pow((Math.abs(ax) / hw) ** 4 + (Math.abs(az) / hd) ** 4, 0.25)
    return { ax, az, rx: ax * f, rz: az * f }
  }
  /** Hill profile across the slope (s = 0 at the hilltop edge, 1 at the foot), with soft ripples. */
  const heightAt = (t: number, s: number) => {
    const base = H * 0.5 * (1 + Math.cos(Math.PI * s))
    return s >= 1 ? -0.3 : base + Math.sin(t * 6) * 0.3 * Math.sin(Math.PI * s)
  }
  const pointAt = (t: number, s: number) => {
    const e = edge(t)
    return new THREE.Vector3(e.ax + (e.rx - e.ax) * s, heightAt(t, s), e.az + (e.rz - e.az) * s)
  }

  // Slopes: N rays x (M + 1) rings
  const pos: number[] = []
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2
    for (let k = 0; k <= M; k++) {
      const p = pointAt(t, k / M)
      pos.push(p.x, p.y, p.z)
    }
  }
  const idx: number[] = []
  for (let i = 0; i < N; i++) {
    const i2 = (i + 1) % N
    for (let k = 0; k < M; k++) {
      const a = i * (M + 1) + k, b = a + 1, c = i2 * (M + 1) + k, e = c + 1
      idx.push(a, b, c, b, e, c)
    }
  }
  // Hilltop: a fan from the centre
  const top: number[] = [0, H, 0]
  const topIdx: number[] = []
  for (let i = 0; i < N; i++) {
    const e = edge((i / N) * Math.PI * 2)
    top.push(e.ax, H, e.az)
    topIdx.push(0, 1 + i, 1 + ((i + 1) % N))
  }
  /** Builds the geometry, flipping the winding if its faces point down. */
  const make = (p: number[], ix: number[]) => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
    const v = (n: number) => new THREE.Vector3(p[ix[n] * 3], p[ix[n] * 3 + 1], p[ix[n] * 3 + 2])
    const n = new THREE.Vector3().crossVectors(v(1).sub(v(0)), v(2).sub(v(0)))
    if (n.y < 0) for (let j = 0; j < ix.length; j += 3) [ix[j + 1], ix[j + 2]] = [ix[j + 2], ix[j + 1]]
    geo.setIndex(ix)
    geo.computeVertexNormals()
    return geo
  }
  g.add(kit.mesh(make(pos, idx), SLOPE))
  g.add(kit.mesh(make(top, topIdx), GRASS))

  // Earth path straight up the south slope to the Puerta de la Justicia (kept free of trees)
  const PATH = 1.8
  const path: number[] = []
  const pathIdx: number[] = []
  for (let k = 0; k <= M * 2; k++) {
    const q = pointAt(Math.PI / 2, k / (M * 2))
    path.push(-PATH, q.y + 0.15, q.z, PATH, q.y + 0.15, q.z)
    if (k > 0) pathIdx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k)
  }
  g.add(kit.mesh(make(path, pathIdx), EARTH))

  // The Alhambra woods on the slopes: cypresses and round trees, seeded
  const rand = seeded(11)
  const placed: [number, number][] = []
  for (let n = 0; n < 400 && placed.length < 110; n++) {
    const t = rand() * Math.PI * 2, s = 0.18 + rand() * 0.66
    const p = pointAt(t, s)
    if (Math.abs(p.x) > hw - 2 || Math.abs(p.z) > hd - 2) continue
    if (p.z > 0 && Math.abs(p.x) < PATH + 2.2) continue // keep the path clear
    if (placed.some(([x, z]) => Math.hypot(x - p.x, z - p.z) < 2.6)) continue
    placed.push([p.x, p.z])
    const r = rand()
    const tree = r < 0.45 ? cypress(kit, 5 + rand() * 3) : roundTree(kit, 3.2 + rand() * 1.8, r < 0.75 ? TREE : TREE_L)
    tree.position.set(p.x, p.y - 0.3, p.z)
    g.add(tree)
  }
  return { group: g, top: H }
}
