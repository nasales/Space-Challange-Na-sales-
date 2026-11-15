// Alcazaba de Almería, cartoon style. The 10th-century Moorish fortress on a bare rocky ridge
// above the city and the sea: one long ring of ochre rammed-earth walls with square towers that
// steps up the hill in three enclosures. East (low): the first enclosure, the gardens, with a
// water channel, green plots and palms, entered by the Puerta de la Justicia at the top of a
// zigzag ramp up the south slope. Middle: the second enclosure, the old palace, with excavated
// foundations, a little patio pool, the cisterns and the Torre de la Vela with its bell on the
// cross wall. West (highest): the Christian castle of the Catholic Monarchs, with round artillery
// towers and the tall round-cornered keep (Torre del Homenaje). A short stub of the Muralla de la
// Hoya (Jayrán wall) runs down the north slope.
// Units are model units (squashed toy proportions); the long axis is X (castle west at -X, gardens
// east at +X), north is -Z. The hill is bare tan rock, not green, so it reads apart from the Alhambra.
import * as THREE from 'three'
import { seeded, wonk, type Kit } from '../kit'
import { bush, horseshoeArch, orangeTree, wallBetween } from '../ornaments'

const WALL = 0xdcab66 // ochre rammed earth
const WALL_D = 0xc48a4c // towers and wall feet
const CAP = 0xeac48a // merlon caps, top bands
const CASTLE = 0xcfa676 // Christian castle masonry, a touch greyer
const CASTLE_D = 0xb98f60
const EARTH = 0xe6c793 // courtyard floors
const PATH = 0xd2ad74
const RUIN = 0xcf9a5e // excavated palace foundations
const WHITE = 0xfff4de
const ROOF = 0xdb6a3a
const DARK = 0x2b2540
const GOLD = 0xf2c14e
const WATER = 0x35b6f0
const GREEN = 0x6fcf4f // garden plots
const HEDGE = 0x2f9a46
const PALM_LEAF = 0x3fbf4a
const TRUNK = 0x8a5a2e
const SLOPE = 0xc9a066 // bare rocky hill
const ROCK = 0xa47a4c
const SCRUB = 0x8cc04a
const APRON = 0xdcbb84

/** Height of the hilltop (base top) and how far the outer walls reach down the slopes. */
const HILL_H = 9
const DROP = HILL_H
/** Cross walls between the enclosures (x) and the floor level of each enclosure above the hilltop. */
const XC = -15 // castle | palace
const XM = 12 // palace | gardens
const LEVEL_CASTLE = 6
const LEVEL_PALACE = 3
const WALL_H = 5
const WALL_T = 2.4
/** Foot of the hill: a rounded rectangle (superellipse) of these half-sizes. */
const FOOT_X = 60
const FOOT_Z = 32

type P = [number, number]

/** Outer wall ring (x, z), clockwise from the west tip: narrow castle, jog, palace, wide gardens. */
const LOOP: P[] = [
  [-48, 0],
  // north side
  [-44, -8], [-34, -10.5], [-24, -11], [XC, -11], [XC, -14], [-4, -15], [6, -14.5], [XM, -15], [22, -17], [34, -16.5], [43, -12],
  [48, 0],
  // south side
  [43, 12], [34, 16.5], [22, 17], [XM, 15], [6, 14], [-4, 14.5], [XC, 14], [XC, 11], [-24, 11.5], [-34, 10.5], [-44, 8],
]

/** Floor level of the enclosure at x. */
const levelAt = (x: number) => (x <= XC + 0.01 ? LEVEL_CASTLE : x <= XM + 0.01 ? LEVEL_PALACE : 0)

/** Polygon pushed outward from the origin by d (radially; the ring is star-shaped from the centre). */
const inflate = (poly: P[], d: number): P[] =>
  poly.map(([x, z]) => {
    const k = 1 + d / Math.hypot(x, z)
    return [x * k, z * k]
  })

/** Flat hilltop: the wall ring plus a narrow band outside it, where the walls stand. */
const TOP = inflate(LOOP, 1.6)

/** Distance from the origin along the unit direction (dx, dz) to the edge of a star-shaped polygon. */
function rayHit(poly: P[], dx: number, dz: number) {
  let best = 0
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i]
    const [bx, bz] = poly[(i + 1) % poly.length]
    const ex = bx - ax, ez = bz - az
    const den = dx * ez - dz * ex
    if (Math.abs(den) < 1e-9) continue
    const t = (ax * ez - ex * az) / den
    const u = (dz * ax - dx * az) / den
    if (u >= -1e-6 && u <= 1 + 1e-6 && t > best) best = t
  }
  return best
}

/** Distance from the origin to the foot of the hill along the unit direction (dx, dz). */
const footR = (dx: number, dz: number, fx = FOOT_X, fz = FOOT_Z) => 1 / Math.pow((Math.abs(dx) / fx) ** 4 + (Math.abs(dz) / fz) ** 4, 0.25)

/** Hill profile: 1 at the hilltop edge (s = 0), 0 at the foot (s = 1). */
const profile = (s: number) => 0.5 * (1 + Math.cos(Math.PI * Math.min(1, Math.max(0, s))))

/** Height of the bare hill (without its rocky jitter) at (x, z), relative to the hilltop (0 on top, -HILL_H at the foot). */
function slopeY(x: number, z: number) {
  const r = Math.hypot(x, z)
  if (r < 1e-6) return 0
  const dx = x / r, dz = z / r
  const rt = rayHit(TOP, dx, dz)
  if (r <= rt) return 0
  const rf = Math.max(rt + 2, footR(dx, dz))
  return HILL_H * profile((r - rt) / (rf - rt)) - HILL_H
}

/** The part of a polygon with x0 <= x <= x1 (Sutherland-Hodgman on two vertical lines). */
function clipX(poly: P[], x0: number, x1: number): P[] {
  const clip = (src: P[], f: (p: P) => number) => {
    const out: P[] = []
    src.forEach((a, i) => {
      const b = src[(i + 1) % src.length]
      const fa = f(a), fb = f(b)
      if (fa >= 0) out.push(a)
      if ((fa >= 0) !== (fb >= 0)) {
        const t = fa / (fa - fb)
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
      }
    })
    return out.filter((p, i) => {
      const q = out[(i + 1) % out.length]
      return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4 // no duplicate points for the triangulation
    })
  }
  return clip(clip(poly, (p) => p[0] - x0), (p) => x1 - p[0])
}

/** Flat polygon ground of height h (base at y = 0), e.g. the raised floor of an enclosure. */
function terrace(kit: Kit, poly: P[], h: number, color: number) {
  const s = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)))
  const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false })
  geo.rotateX(-Math.PI / 2) // extrude upwards; shape y = -z
  return kit.mesh(geo, color)
}

/** Row of square merlons with little pyramid caps along X (centred), sitting on y = 0. */
function crenels(kit: Kit, length: number, size: number, color: number) {
  const g = new THREE.Group()
  const n = Math.max(1, Math.floor(length / (size * 1.8)))
  const step = length / n
  for (let i = 0; i < n; i++) {
    const x = -length / 2 + step * (i + 0.5)
    g.add(kit.box(size, size * 0.85, size * 0.7, color, x, 0, 0))
    g.add(kit.mesh(new THREE.ConeGeometry(size * 0.42, size * 0.45, 4).rotateY(Math.PI / 4), CAP, x, size * 0.85 + size * 0.22, 0))
  }
  return g
}

/** Crenels along the four edges of a w x w square (centred), sitting on y = 0. */
function crenelRing(kit: Kit, w: number, size: number, color: number) {
  const g = new THREE.Group()
  for (let k = 0; k < 4; k++) {
    const row = crenels(kit, k % 2 ? w - size * 1.4 : w, size, color)
    row.position.z = w / 2
    const side = new THREE.Group()
    side.add(row)
    side.rotation.y = (k * Math.PI) / 2
    g.add(side)
  }
  return g
}

/** Stretch of wall between two points with crenels on top. top: height of the walkway; base at -DROP. */
function curtain(kit: Kit, g: THREE.Group, [ax, az]: P, [bx, bz]: P, top: number, color = WALL, foot = WALL_D) {
  g.add(wallBetween(kit, ax, az, bx, bz, top + DROP, WALL_T, color).translateY(-DROP))
  g.add(wallBetween(kit, ax, az, bx, bz, top - WALL_H + 1.2 + DROP, WALL_T + 1.2, foot).translateY(-DROP)) // chunky foot
  const len = Math.hypot(bx - ax, bz - az)
  if (len < 4) return
  const row = crenels(kit, len - 3, 1.3, color)
  row.position.set((ax + bx) / 2, top, (az + bz) / 2)
  row.rotation.y = Math.atan2(-(bz - az), bx - ax)
  g.add(row)
}

/** Moorish square tower: splayed feet, top band, capped crenels, dark arrow slits. Base at y = 0; foot = buried part. */
let towerSeed = 1
function squareTower(kit: Kit, w: number, h: number, foot: number, color = WALL_D) {
  const g = new THREE.Group()
  const wb = w * 1.22
  g.add(kit.taper(wb, wb, w, w, h, color))
  g.add(kit.box(w + 0.8, 0.8, w + 0.8, CAP, 0, h - 0.8, 0))
  const crown = crenelRing(kit, w + 0.4, Math.max(1.1, w * 0.26), color)
  crown.position.y = h
  g.add(crown)
  const y = foot + (h - foot) * 0.55
  const half = (wb + ((w - wb) * y) / h) / 2
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Group()
    face.add(kit.slab(0.5, 1.6, 0.3, DARK, 0, y, half + 0.05))
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  return wonk(g, towerSeed++, 0.03)
}

/** Christian round tower (cubo): fat cylinder, band, merlons around the top. Base at y = 0. */
function roundTower(kit: Kit, r: number, h: number, color = CASTLE) {
  const g = new THREE.Group()
  g.add(kit.mesh(new THREE.CylinderGeometry(r, r * 1.18, h, 12), color, 0, h / 2, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(r * 1.14, r * 1.06, 0.9, 12), CAP, 0, h - 0.45, 0))
  const n = Math.max(5, Math.round(r * 2.4))
  for (let k = 0; k < n; k++) {
    const a = (k * Math.PI * 2) / n
    const m = kit.box(r * 0.5, r * 0.45, r * 0.4, color, Math.sin(a) * r * 0.92, h, Math.cos(a) * r * 0.92)
    m.rotation.y = a
    g.add(m)
  }
  return wonk(g, towerSeed++, 0.03)
}

/** Torre del Homenaje: tall square keep with fat rounded corners, corbelled crown, windows and a door. */
function keep(kit: Kit) {
  const g = new THREE.Group()
  const W = 10, H = 15, R = 1.9
  const c = W / 2 - R * 0.55
  g.add(kit.box(W, H, W, CASTLE))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(kit.mesh(new THREE.CylinderGeometry(R, R * 1.12, H, 10), CASTLE, sx * c, H / 2, sz * c))
  // Corbelled crown: a wider band over the walls and the rounded corners
  g.add(kit.box(W + 1.6, 1.4, W + 1.6, CASTLE_D, 0, H - 0.4, 0))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(kit.mesh(new THREE.CylinderGeometry(R * 1.3, R, 1.4, 10), CASTLE_D, sx * c, H + 0.3, sz * c))
  const crown = crenelRing(kit, W + 1.4, 1.5, CASTLE)
  crown.position.y = H + 1
  g.add(crown)
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Group()
    const z = W / 2 + 0.05
    face.add(kit.slab(1.3, 2.4, 0.3, DARK, -1.6, 8, z))
    face.add(kit.slab(1.3, 2.4, 0.3, DARK, 1.6, 11.2, z))
    face.add(kit.lightPanel(1, 2, k % 2 ? 1.6 : -1.6, k % 2 ? 11.4 : 8.2, z + 0.25)) // night: lit windows
    if (k === 1) {
      face.add(kit.slab(2.2, 3.4, 0.3, DARK, 0, 0, z)) // door toward the palace enclosure (east)
      face.add(kit.lightHalo(2.4, 0, 2, z + 0.8, 0.7))
    }
    face.add(kit.lightHalo(7, 0, 9, W / 2 + 3, 0.3)) // soft floodlight on each face
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  return wonk(g, 77, 0.02)
}

/** Cartoon palm: leaning trunk with a few rings, a crown of drooping leaves and a coconut bunch. */
function palm(kit: Kit, h: number, seed: number) {
  const g = new THREE.Group()
  const rand = seeded(seed)
  const lean = (rand() - 0.5) * 0.35
  const trunk = kit.mesh(new THREE.CylinderGeometry(0.32, 0.5, h, 6), TRUNK, -Math.sin(lean) * (h / 2), Math.cos(lean) * (h / 2), 0)
  trunk.rotation.z = lean
  g.add(trunk)
  const tx = -Math.sin(lean) * h, ty = Math.cos(lean) * h
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + rand()
    const leaf = kit.box(3.6, 0.3, 1.1, PALM_LEAF)
    leaf.position.set(tx + Math.cos(a) * 1.5, ty - 0.35, -Math.sin(a) * 1.5)
    leaf.rotation.set(0, a, -0.45)
    g.add(leaf)
  }
  g.add(kit.box(0.9, 0.8, 0.9, 0x7a5a2e, tx, ty - 0.8, 0))
  return g
}

/** Tilted path slab whose top runs from p to q (width w, thickness t below the top). */
function ramp(kit: Kit, p: THREE.Vector3, q: THREE.Vector3, w: number, t: number, color: number) {
  const outer = new THREE.Group()
  const dx = q.x - p.x, dz = q.z - p.z, flat = Math.hypot(dx, dz)
  const inner = new THREE.Group()
  inner.add(kit.box(Math.hypot(flat, q.y - p.y) + 0.4, t, w, color, 0, -t, 0))
  inner.rotation.z = Math.atan2(q.y - p.y, flat)
  outer.add(inner)
  outer.position.set((p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2)
  outer.rotation.y = Math.atan2(-dz, dx)
  return outer
}

/** Bell gable (espadaña) of the Torre de la Vela: white wall with an arch, the bell and a tile cap. */
function bellGable(kit: Kit) {
  const g = new THREE.Group()
  g.add(kit.facade(3.6, 4, 0.9, [{ x: 0, width: 1.7, height: 1.6, arch: true, bottom: 0.7 }], WHITE))
  g.add(kit.pediment(4, 1.2, 1.1, ROOF, 4))
  g.add(kit.mesh(new THREE.CylinderGeometry(0.3, 0.65, 1.1, 10), GOLD, 0, 2, 0))
  g.add(kit.lightHalo(2.2, 0, 2, 0.5, 0.8)) // night: the bell that warned the city
  return g
}

/** Shared state: where the model's bounding-box centre is, so the hill lines up with the walls. */
let centre = { x: 0, z: 0 }

export function buildAlcazabaAlmeria(kit: Kit): THREE.Group {
  const g = new THREE.Group()
  towerSeed = 1

  // ---- Raised floors of the palace and castle enclosures (the gardens use the hilltop) ----
  g.add(terrace(kit, clipX(LOOP, -100, XC - 0.01), LEVEL_CASTLE, EARTH)) // just short of XC: no doubled-back edge at the jog
  g.add(terrace(kit, clipX(LOOP, XC, XM), LEVEL_PALACE, EARTH))

  // ---- Outer wall ring, stepping up the ridge, with a tower on every corner ----
  const segLevel = (i: number) => levelAt((LOOP[i][0] + LOOP[(i + 1) % LOOP.length][0]) / 2)
  LOOP.forEach((a, i) => {
    const b = LOOP[(i + 1) % LOOP.length]
    const castle = segLevel(i) === LEVEL_CASTLE
    curtain(kit, g, a, b, segLevel(i) + WALL_H, castle ? CASTLE : WALL, castle ? CASTLE_D : WALL_D)
  })
  LOOP.forEach(([x, z], i) => {
    const level = Math.max(segLevel(i), segLevel((i + LOOP.length - 1) % LOOP.length))
    const top = level + WALL_H + 2.6
    let t: THREE.Group
    if (i === 0) t = roundTower(kit, 4.4, top + 2 + DROP) // west tip: the big round artillery tower
    else if (x <= XC + 0.01) t = roundTower(kit, 2.6, top + DROP) // Christian castle: round cubos
    else if (x === 48) t = squareTower(kit, 6.5, top + 1.5 + DROP, DROP) // east tip: stout square tower
    else t = squareTower(kit, 4.2, top + DROP, DROP)
    t.position.set(x, -DROP, z)
    g.add(t)
  })
  // Extra square towers halfway along the long Moorish stretches
  LOOP.forEach((a, i) => {
    const b = LOOP[(i + 1) % LOOP.length]
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 10.5 || segLevel(i) === LEVEL_CASTLE) return
    if (mz > 0 && Math.abs(mx - 28) < 5) return // the Puerta de la Justicia stands here
    const t = squareTower(kit, 3.4, segLevel(i) + WALL_H + 2 + DROP, DROP)
    t.position.set(mx, -DROP, mz)
    g.add(t)
  })

  // ---- Cross wall palace | gardens, with its gate and the Torre de la Vela ----
  const zm = 14.6
  for (const [z0, z1] of [[-zm, 0.6], [5.4, zm]]) {
    g.add(wallBetween(kit, XM, z0, XM, z1, LEVEL_PALACE + WALL_H, WALL_T, WALL))
    const row = crenels(kit, z1 - z0 - 1.5, 1.3, WALL)
    row.rotation.y = Math.PI / 2
    row.position.set(XM, LEVEL_PALACE + WALL_H, (z0 + z1) / 2)
    g.add(row)
  }
  const gateM = squareTower(kit, 4.8, LEVEL_PALACE + WALL_H + 3, 0)
  gateM.position.set(XM, 0, 3)
  g.add(gateM)
  const doorM = horseshoeArch(kit, 1.8, 1.6, 0.4, DARK)
  doorM.rotation.y = Math.PI / 2
  doorM.position.set(XM + 2.85, LEVEL_PALACE, 3)
  g.add(doorM)
  g.add(kit.lightHalo(2.2, XM + 3.6, LEVEL_PALACE + 1.5, 3, 0.75))
  g.add(ramp(kit, new THREE.Vector3(XM + 11, 0.2, 3), new THREE.Vector3(XM + 2.4, LEVEL_PALACE + 0.05, 3), 2.6, 1.5, PATH))
  const vela = squareTower(kit, 5.4, LEVEL_PALACE + WALL_H + 6, 0)
  vela.position.set(XM, 0, -9)
  g.add(vela)
  const gable = bellGable(kit)
  gable.rotation.y = Math.PI / 2
  gable.position.set(XM, LEVEL_PALACE + WALL_H + 6, -9)
  g.add(gable)

  // ---- Cross wall castle | palace: a high Christian wall with round towers and the castle gate ----
  const zc = 10.6
  for (const [z0, z1] of [[-zc, -1.4], [1.4, zc]]) g.add(wallBetween(kit, XC, z0, XC, z1, LEVEL_CASTLE + WALL_H + 1, 3, CASTLE))
  g.add(kit.box(3, LEVEL_CASTLE + WALL_H + 1 - (LEVEL_CASTLE + 3), 3, CASTLE, XC, LEVEL_CASTLE + 3, 0)) // lintel over the gate
  for (const z of [-zc / 2, zc / 2]) {
    const row = crenels(kit, zc - 2.6, 1.4, CASTLE)
    row.rotation.y = Math.PI / 2
    row.position.set(XC, LEVEL_CASTLE + WALL_H + 1, z)
    g.add(row)
  }
  for (const z of [-3.2, 3.2]) {
    const t = roundTower(kit, 2.2, LEVEL_CASTLE + WALL_H + 3 - LEVEL_PALACE)
    t.position.set(XC + 1.2, LEVEL_PALACE, z)
    g.add(t)
  }
  g.add(kit.slab(0.3, 3, 2.8, DARK, XC + 1.55, LEVEL_CASTLE, 0)) // the gate opening
  g.add(kit.lightHalo(2.2, XC + 2.4, LEVEL_CASTLE + 1.5, 0, 0.75))
  g.add(ramp(kit, new THREE.Vector3(XC + 11, LEVEL_PALACE + 0.2, 0), new THREE.Vector3(XC + 1.6, LEVEL_CASTLE + 0.05, 0), 2.6, 1.5, PATH))

  // ---- Christian castle (west, highest) ----
  const k = keep(kit)
  k.position.set(-23, LEVEL_CASTLE, -3.5)
  g.add(k)
  g.add(kit.box(14, 0.15, 13, PATH, -37, LEVEL_CASTLE, 0)) // parade ground
  g.add(kit.mesh(new THREE.CylinderGeometry(1.1, 1.2, 1, 10), CASTLE_D, -36, LEVEL_CASTLE + 0.5, 3)) // well
  g.add(kit.mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.1, 10), WATER, -36, LEVEL_CASTLE + 1, 3))
  g.add(kit.box(6, 2.4, 3.4, CASTLE, -40, LEVEL_CASTLE, -6)) // little barracks block
  g.add(kit.box(6.6, 0.6, 4, CASTLE_D, -40, LEVEL_CASTLE + 2.4, -6))

  // ---- Palace enclosure (middle) ----
  g.add(kit.box(26, 0.15, 3, PATH, -1.5, LEVEL_PALACE, 0)) // path between the two gates
  // Excavated palace foundations: a grid of low walls on bare earth
  g.add(kit.box(11, 0.2, 8, RUIN, -6.5, LEVEL_PALACE, -7.5))
  for (const x of [-11.5, -8, -4.5, -1.5]) g.add(kit.box(0.7, 1.3, 7.4, WALL, x, LEVEL_PALACE, -7.5))
  for (const z of [-11, -7.6, -4.2]) g.add(kit.box(10.4, 1.3, 0.7, WALL, -6.5, LEVEL_PALACE, z))
  // Reconstructed palace wing with a tile roof, its patio pool and orange trees
  g.add(kit.box(8, 4, 4, WHITE, 5, LEVEL_PALACE, -10.4))
  g.add(kit.taper(9, 5, 5, 1, 1.8, ROOF, 5, LEVEL_PALACE + 4, -10.4))
  for (const x of [3, 7]) g.add(kit.slab(1, 1.8, 0.2, DARK, x, LEVEL_PALACE, -8.3))
  g.add(kit.lightPanel(0.8, 1.5, 3, LEVEL_PALACE + 0.1, -8.05))
  g.add(kit.box(6.4, 0.35, 2.6, WHITE, 5, LEVEL_PALACE, -4.6))
  g.add(kit.box(5.6, 0.45, 1.8, WATER, 5, LEVEL_PALACE, -4.6))
  for (const x of [0.8, 9.2]) {
    const t = orangeTree(kit, 2.6)
    t.position.set(x, LEVEL_PALACE, -4.6)
    g.add(t)
  }
  // Cisterns (aljibes): a long block with little domes
  g.add(kit.box(8, 2.6, 3.6, WALL_D, -6, LEVEL_PALACE, 8.5))
  for (const x of [-8.6, -6, -3.4]) g.add(kit.mesh(new THREE.SphereGeometry(1.2, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), CAP, x, LEVEL_PALACE + 2.6, 8.5))
  // Little white hermitage (old mosque) with a square belfry
  g.add(kit.box(6, 3.4, 4, WHITE, 5, LEVEL_PALACE, 8.5))
  g.add(kit.taper(7, 5, 3, 1, 1.5, ROOF, 5, LEVEL_PALACE + 3.4, 8.5))
  g.add(kit.box(1.8, 6, 1.8, WHITE, 8.6, LEVEL_PALACE, 7.4))
  g.add(kit.slab(1, 1.6, 0.2, DARK, 5, LEVEL_PALACE, 6.45))
  g.add(kit.lightHalo(1.6, 5, LEVEL_PALACE + 1.2, 6, 0.6))

  // ---- Garden enclosure (east, on the hilltop) ----
  g.add(kit.box(30, 0.3, 2.2, WHITE, 30, 0, -2)) // water channel with a white rim
  g.add(kit.box(29, 0.4, 1.3, WATER, 30, 0, -2))
  for (const x of [20, 30, 40]) {
    g.add(kit.mesh(new THREE.CylinderGeometry(1.6, 1.7, 0.4, 12), WHITE, x, 0.2, -2))
    g.add(kit.mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.5, 12), WATER, x, 0.25, -2))
  }
  for (const [x, z, w, d] of [[19, -8.5, 8, 6], [31, -9.5, 9, 7], [41, -7.5, 6, 6], [19, 5, 8, 7], [31, 6, 9, 8], [41, 4.5, 6, 6]]) {
    g.add(kit.box(w, 0.5, d, GREEN, x, 0, z))
    g.add(kit.box(w + 0.6, 0.9, 0.6, HEDGE, x, 0, z + (z < 0 ? d / 2 : -d / 2)))
  }
  g.add(kit.box(2.6, 0.15, 13, PATH, 26, 0, 9.5)) // path from the Puerta de la Justicia to the channel
  g.add(kit.box(16, 0.15, 2.6, PATH, 18, 0, 2.6))
  const palms: [number, number, number][] = [[16, -11, 8], [24, -12, 9.5], [36, -12.5, 8.5], [44, -5, 7.5], [22, 9.5, 9], [36, 11, 8], [43, 7, 9.5], [15, 6, 7]]
  palms.forEach(([x, z, h], i) => {
    const p = palm(kit, h, 40 + i * 7)
    p.position.set(x, 0, z)
    g.add(p)
  })
  for (const [x, z] of [[27, -6], [35, -6], [27, 3.5], [35, 3.5], [16.5, -5]]) {
    const b = bush(kit, 2.4, HEDGE, TRUNK)
    b.position.set(x, 0.5, z)
    g.add(b)
  }
  for (const x of [20, 30, 40]) g.add(kit.lightHalo(1.6, x, 1.4, -2, 0.55)) // night: lanterns by the pools

  // ---- Puerta de la Justicia (south wall of the gardens) and the zigzag ramp below it ----
  const jx = 28, jz = 16.8
  const gate = squareTower(kit, 5.6, WALL_H + 3.2 + DROP, DROP)
  gate.position.set(jx, -DROP, jz + 1.2)
  g.add(gate)
  const door = horseshoeArch(kit, 2, 1.8, 0.4, DARK)
  door.position.set(jx, 0, jz + 4.35) // on the sloped face of the gate tower
  g.add(door)
  g.add(kit.lightHalo(2.4, jx, 1.6, jz + 5, 0.8))
  const onSlope = (x: number, z: number) => new THREE.Vector3(x, slopeY(x, z) + 0.6, z)
  const legs: [THREE.Vector3, THREE.Vector3][] = [
    [new THREE.Vector3(jx, 0.2, jz + 5.6), onSlope(44, 22.6)],
    [onSlope(44.5, 25), onSlope(14, 29.6)],
  ]
  legs.forEach(([p, q]) => {
    g.add(ramp(kit, p, q, 3, 5, PATH))
    // Low parapet on the downhill side
    const side = new THREE.Vector3(0, 1.1, 1.7)
    g.add(ramp(kit, p.clone().add(side), q.clone().add(side), 0.7, 2.6, WALL))
  })
  const landing = legs[0][1]
  g.add(kit.box(4, 6, 5, PATH, 45, landing.y - 6, 23.8))

  // ---- Stub of the Muralla de la Hoya (Jayrán wall) running down the north slope ----
  const sx = -6
  const stops = [-14.6, -20.5, -26, -30.5]
  for (let i = 0; i + 1 < stops.length; i++) {
    const top = slopeY(sx, stops[i]) + WALL_H - 0.5 - i * 0.5
    curtain(kit, g, [sx, stops[i]], [sx, stops[i + 1]], top)
    const t = squareTower(kit, 3.2, top + 2.2 + DROP, DROP)
    t.position.set(sx, -DROP, stops[i + 1])
    g.add(t)
  }

  // Night: floodlights on the long south face, toward the city
  for (const [x, z] of [[-34, 10.5], [-4, 14.5], [16, 16], [40, 13.5]]) g.add(kit.lightHalo(5, x, levelAt(x) + 1.5, z + 3, 0.35))

  // Remember the bounding-box centre: createLandmarks centres the model on it, and the hill must follow
  const box = new THREE.Box3().setFromObject(g, true)
  centre = { x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2 }
  return g
}

/**
 * The rocky ridge: a flat hilltop that follows the wall ring, faceted bare-rock slopes down to a
 * rounded foot, boulders and scrub on them, and dusty flat ground over the rest of the w x d
 * footprint. All of it is walkable. Returns the group and the height of the hilltop.
 */
export function buildAlcazabaAlmeriaBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  g.add(kit.box(w, 0.3, d, APRON, 0, -0.32, 0))
  // The hill is drawn in model coordinates, shifted like the model (centred on its bounding box)
  const hill = new THREE.Group()
  hill.position.set(-centre.x, 0, -centre.z)
  g.add(hill)
  const fx = Math.min(FOOT_X, w / 2 - 0.5 - Math.abs(centre.x))
  const fz = Math.min(FOOT_Z, d / 2 - 0.5 - Math.abs(centre.z))

  // Hilltop edge, densified so the slope mesh meets every corner of the flat top exactly
  const edge: P[] = []
  TOP.forEach((a, i) => {
    const b = TOP[(i + 1) % TOP.length]
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3.5))
    for (let j = 0; j < n; j++) edge.push([a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n])
  })
  const N = edge.length, M = 6
  const rand = seeded(5)
  const pointAt = (i: number, s: number, jitter = 0) => {
    const [ex, ez] = edge[i]
    const rt = Math.hypot(ex, ez), dx = ex / rt, dz = ez / rt
    const rf = Math.max(rt + 2, footR(dx, dz, fx, fz))
    const r = rt + (rf - rt) * s
    return new THREE.Vector3(dx * r, s >= 1 ? 0 : HILL_H * profile(s) + jitter, dz * r)
  }
  const pos: number[] = []
  for (let i = 0; i < N; i++) {
    for (let k = 0; k <= M; k++) {
      const p = pointAt(i, k / M, k > 0 && k < M ? (rand() - 0.5) * 0.8 : 0) // rocky, uneven facets
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
  let geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  // Flip the winding if the faces point down
  const v = (n: number) => new THREE.Vector3(pos[idx[n] * 3], pos[idx[n] * 3 + 1], pos[idx[n] * 3 + 2])
  if (new THREE.Vector3().crossVectors(v(1).sub(v(0)), v(2).sub(v(0))).y < 0) for (let j = 0; j < idx.length; j += 3) [idx[j + 1], idx[j + 2]] = [idx[j + 2], idx[j + 1]]
  geo.setIndex(idx)
  geo = geo.toNonIndexed() // flat facets: chiselled rock
  geo.computeVertexNormals()
  hill.add(kit.mesh(geo, SLOPE))

  // Flat hilltop
  const top = new THREE.ShapeGeometry(new THREE.Shape(TOP.map(([x, z]) => new THREE.Vector2(x, -z))))
  top.rotateX(-Math.PI / 2)
  top.translate(0, HILL_H, 0)
  hill.add(kit.mesh(top, EARTH))

  // Boulders and scrub on the slopes, kept off the ramp and the Jayrán wall
  const placed: [number, number][] = []
  for (let n = 0; n < 300 && placed.length < 34; n++) {
    const i = Math.floor(rand() * N), s = 0.22 + rand() * 0.62
    const p = pointAt(i, s)
    if (p.z > 17 && p.x > 8) continue // zigzag ramp
    if (p.z < -13 && Math.abs(p.x + 6) < 5) continue // Jayrán wall
    if (placed.some(([x, z]) => Math.hypot(x - p.x, z - p.z) < 3.2)) continue
    placed.push([p.x, p.z])
    if (placed.length % 3 === 0) {
      const sc = kit.mesh(new THREE.IcosahedronGeometry(0.9 + rand() * 0.5, 0), SCRUB, p.x, p.y + 0.4, p.z)
      sc.scale.y = 0.7
      hill.add(sc)
    } else {
      const size = 1 + rand() * 1.1
      const rock = kit.mesh(new THREE.IcosahedronGeometry(size, 0), ROCK, p.x, p.y - size * 0.25, p.z)
      rock.rotation.set(rand() * 3, rand() * 3, 0)
      hill.add(rock)
    }
  }
  return { group: g, top: HILL_H }
}
