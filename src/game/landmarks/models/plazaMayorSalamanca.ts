// Plaza Mayor de Salamanca (1729-1755, Churriguera and García de Quiñones), cartoon style.
// An almost square plaza closed by four continuous three-storey blocks of golden Villamayor
// sandstone. Facing the square: a ground-floor arcade of round arches all around (88 in reality,
// 56 here) with round portrait medallions between them, three rows of balconied windows between
// pilasters, and a stone balustrade with finials along the roofline. The Town Hall (north) rises
// higher, with giant pilasters, four statues, the clock and a two-stage bell gable; the Royal
// Pavilion (east) has a wider arch, the bust medallion of Philip V and a Baroque crest with the
// crowned royal arms. Two streets enter through open gaps in the south block, so the detective
// can walk or drive into the square at plaza level (an arcade with a roof over it counts as roof
// in the height map). Granite paving with a central rosette and four lampposts.
// Units are roughly metres; the model faces south (+Z).
import * as THREE from 'three'
import type { Kit } from '../kit'
import { archRing, crownedShield, pinnacle, statue } from '../ornaments'

const STONE = 0xf0bf6e // golden Villamayor sandstone (warm honey)
const STONE_D = 0xcf9549 // cornices, string courses, pilasters
const TRIM = 0xffe6b0 // window frames, medallions, balustrade, statues
const ROOF = 0xd9643a
const IRON = 0x1d2128
const DARK = 0x2b2540
const GOLD = 0xf2c14e
const RED = 0xd23a30
const YELLOW = 0xf6c945
const BRONZE = 0xb57a2c
const CLOCK = 0xfff8e6
const PAVE = 0xe6d6b4 // light granite
const PAVE_D = 0xbfa47c // darker granite bands
const LAMP = 0xffe9a8

const OUT = 76 // outer size
const WING = 10 // depth of a block
const IN = OUT - WING * 2 // size of the plaza
const H = 15 // top of the façades (base of the cornice)
const FY = 0.8 // top of the plinth (and of the street gaps)
const PY = FY + 0.15 // plaza floor
const ARC_TOP = 6 // top of the arcade storey
const GAL = 3.2 // depth of the arcade gallery
const BAYS = 15 // arches per side
const STEP = IN / BAYS
const ARCH_W = 2.5
const ARCH_H = 2.6 // straight part of an arch (a half circle goes on top)
/** In a side's own frame (the north side; the others are rotated): centre line of the block and inner façade plane. */
const MID = -(OUT + IN) / 4
const Z0 = -IN / 2
const pier = (i: number) => -IN / 2 + STEP * i
const bay = (i: number) => -IN / 2 + STEP * (i + 0.5)
/** The three storeys above the arcade: window base, height, width and balcony. */
const STOREYS = [
  { y: 6.8, h: 2.2, w: 1.6, balcony: 'big' },
  { y: 10.5, h: 1.8, w: 1.5, balcony: 'small' },
  { y: 13, h: 1.2, w: 1.3, balcony: 'none' },
] as const

/** Inclusive range of bays [first, last]. */
type Range = [number, number]

interface Side {
  /** Half-lengths along the side of the arcade façade, the upper storeys and the ground floor. */
  facadeEnd: number
  bodyEnd: number
  lowEnd: number
  /** Bays opened as streets into the square (open to the sky), sorted. */
  gaps: Range[]
  /** This side carries the finials on the corners (only two sides do, so they are not doubled). */
  corners: boolean
  special?: 'hall' | 'royal'
}

/** Pieces of [-end, end] left between the gaps (x ranges). */
function segments(gaps: Range[], end: number): Range[] {
  const out: Range[] = []
  let from = -end
  for (const [a, b] of gaps) {
    out.push([from, pier(a)])
    from = pier(b + 1)
  }
  out.push([from, end])
  return out
}
const bayInGap = (gaps: Range[], i: number) => gaps.some(([a, b]) => i >= a && i <= b)
const pierInGap = (gaps: Range[], i: number) => gaps.some(([a, b]) => i > a && i <= b)
const pierAtGapEdge = (gaps: Range[], i: number) => gaps.some(([a, b]) => i === a || i === b + 1)

/** Straight balustrade along X (centred, base at y = 0): rails and turned balusters. */
function railRow(kit: Kit, len: number, h: number, color: number) {
  const g = new THREE.Group()
  const rail = h * 0.18
  g.add(kit.box(len, rail, rail * 1.6, color))
  g.add(kit.box(len + rail, rail, rail * 2, color, 0, h - rail, 0))
  const n = Math.max(1, Math.round(len / (h * 0.55)))
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (len * (i + 0.5)) / n
    g.add(kit.mesh(new THREE.CylinderGeometry(rail * 0.4, rail * 0.65, h - rail * 2, 6), color, x, h / 2, 0))
  }
  return g
}

/** Iron balcony on a stone slab in front of a window: w wide, d deep, railing h high; z = wall face. */
function balcony(kit: Kit, g: THREE.Group, x: number, y: number, z: number, w: number, d: number, h: number) {
  g.add(kit.box(w + 0.1, 0.25, d, STONE_D, x, y - 0.25, z + d / 2))
  g.add(kit.slab(w, h, 0.07, IRON, x, y, z + d - 0.04))
  for (const sx of [-1, 1]) g.add(kit.slab(0.07, h, d, IRON, x + (sx * w) / 2, y, z + d / 2))
}

/** Bronze bell hanging in an opening (bottom at y). */
function bell(kit: Kit, x: number, y: number, z: number, s = 1) {
  const g = new THREE.Group()
  g.add(kit.mesh(new THREE.CylinderGeometry(0.3 * s, 0.68 * s, s, 10), BRONZE, 0, 0.5 * s, 0))
  g.add(kit.mesh(new THREE.IcosahedronGeometry(0.22 * s, 0), BRONZE, 0, 1.05 * s, 0))
  g.position.set(x, y, z)
  return g
}

/** Spanish flag on a pole (pole along +Y, flag towards +X), to tilt out of a balcony. */
function flag(kit: Kit) {
  const g = new THREE.Group()
  g.add(kit.mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6), GOLD, 0, 1.7, 0))
  const fw = 2.2, fh = 1.4, top = 3.3
  g.add(kit.slab(fw, fh * 0.25, 0.05, RED, fw / 2 + 0.06, top - fh * 0.25, 0))
  g.add(kit.slab(fw, fh * 0.5, 0.05, YELLOW, fw / 2 + 0.06, top - fh * 0.75, 0))
  g.add(kit.slab(fw, fh * 0.25, 0.05, RED, fw / 2 + 0.06, top - fh, 0))
  return g
}

/** Town Hall over bays 5-9 of the north side (side frame): taller pavilion, clock and bell gable. */
function townHall(kit: Kit) {
  const g = new THREE.Group()
  const HT = H + 2.6 // the extra attic storey
  const w = STEP * 5 + 0.6
  const zf = Z0 + 0.6 // the pavilion stands a little forward
  g.add(kit.slab(w, HT - ARC_TOP, 0.6, STONE, 0, ARC_TOP, Z0 + 0.3))
  g.add(kit.slab(w, HT - H, 7, STONE, 0, H, zf - 3.5)) // attic block over the roof
  g.add(kit.box(w + 0.4, 0.45, 0.6, STONE_D, 0, ARC_TOP, zf + 0.1)) // string course
  // Giant pilasters from the string course to the attic
  for (let i = 5; i <= 10; i++) g.add(kit.box(0.8, HT - ARC_TOP - 0.45, 0.35, TRIM, pier(i), ARC_TOP + 0.45, zf + 0.17))
  for (let i = 5; i <= 9; i++) {
    g.add(kit.slab(1.6, 1.5, 0.14, TRIM, bay(i), H + 0.75, zf + 0.07)) // attic windows
    g.add(kit.slab(1.1, 1.1, 0.1, DARK, bay(i), H + 0.95, zf + 0.16))
  }
  // Long iron balcony of the main floor, with the flag
  balcony(kit, g, 0, STOREYS[0].y, zf, STEP * 3 - 0.6, 0.9, 0.95)
  const f = flag(kit)
  f.position.set(-1, STOREYS[0].y + 0.9, zf + 0.85)
  f.rotation.x = 0.75
  g.add(f)
  // Cornice, attic balustrade and the four allegorical statues beside the belfry
  g.add(kit.box(w + 1.2, 0.7, 7.8, STONE_D, 0, HT, zf - 3.5))
  for (const sx of [-1, 1]) {
    const len = w / 2 - 4.6
    const r = railRow(kit, len, 1.3, TRIM)
    r.position.set(sx * (4.6 + len / 2), HT + 0.7, zf + 0.1)
    g.add(r)
    for (const x of [5.6, 8.8]) {
      g.add(kit.box(1.2, 1.5, 1.2, STONE_D, sx * x, HT + 0.7, zf + 0.1))
      const st = statue(kit, 2.6, TRIM)
      st.position.set(sx * x, HT + 2.2, zf + 0.1)
      g.add(st)
    }
  }

  // ---- Belfry: clock stage, bell gable with two bells, top stage with one ----
  const by = HT + 0.7, zc = zf - 1.3
  g.add(kit.box(8.4, 4, 2.6, STONE, 0, by, zc))
  for (const sx of [-1, 1]) g.add(kit.box(0.7, 4, 0.3, TRIM, sx * 3.6, by, zf + 0.05))
  g.add(kit.box(9.2, 0.5, 3.2, STONE_D, 0, by + 4, zc))
  const clockY = by + 2
  g.add(kit.mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.2, 20).rotateX(Math.PI / 2), GOLD, 0, clockY, zf + 0.1))
  g.add(kit.mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.3, 20).rotateX(Math.PI / 2), CLOCK, 0, clockY, zf + 0.15))
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2
    g.add(kit.box(0.22, 0.22, 0.1, DARK, Math.sin(a) * 1.15, clockY + Math.cos(a) * 1.15 - 0.11, zf + 0.33))
  }
  g.add(kit.box(0.2, 1.1, 0.08, DARK, 0, clockY, zf + 0.36)) // hands
  g.add(kit.box(0.8, 0.18, 0.08, DARK, 0.4, clockY - 0.09, zf + 0.36))

  const b1 = by + 4.5
  const gable = kit.facade(7, 4.2, 1.3, [-1.6, 1.6].map((x) => ({ x, width: 1.8, height: 1.6, arch: true, bottom: 0.8 })), STONE)
  gable.position.set(0, b1, zc)
  g.add(gable)
  for (const x of [-1.6, 1.6]) g.add(bell(kit, x, b1 + 0.9, zc))
  g.add(kit.box(7.8, 0.45, 1.8, STONE_D, 0, b1 + 4.2, zc))
  const b2 = b1 + 4.65
  const upper = kit.facade(3.6, 3, 1.3, [{ x: 0, width: 1.5, height: 1, arch: true, bottom: 0.6 }], STONE)
  upper.position.set(0, b2, zc)
  g.add(upper)
  g.add(bell(kit, 0, b2 + 0.65, zc, 0.8))
  const cap = kit.pediment(4.2, 1.4, 1.5, STONE_D, b2 + 3)
  cap.position.z = zc
  g.add(cap)
  const fin = pinnacle(kit, 1.8, TRIM, GOLD)
  fin.position.set(0, b2 + 4.4, zc)
  g.add(fin)
  for (const sx of [-1, 1]) {
    const p = pinnacle(kit, 2.2, TRIM, GOLD)
    p.position.set(sx * 4.1, b1, zc)
    g.add(p)
    const q = pinnacle(kit, 1.6, TRIM, GOLD)
    q.position.set(sx * 2.6, b2, zc)
    g.add(q)
  }

  // Night: lit main-floor windows, glowing clock, bell gable and a floodlight on the façade
  for (let i = 5; i <= 9; i++) g.add(kit.lightPanel(STOREYS[0].w, STOREYS[0].h, bay(i), STOREYS[0].y, zf + 0.25, 0, 0.8))
  g.add(kit.lightHalo(1.9, 0, clockY, zf + 0.6, 1))
  g.add(kit.lightHalo(3.2, 0, b1 + 2, zc, 0.6))
  g.add(kit.lightHalo(5, 0, 11, zf + 5, 0.35))
  return g
}

/** Royal Pavilion over bays 6-8 of the east side (side frame): wide arch, bust of Philip V, royal crest. */
function royalPavilion(kit: Kit) {
  const g = new THREE.Group()
  const w = STEP * 3 + 0.6
  const zf = Z0 + 0.5
  g.add(kit.slab(w, H - ARC_TOP, 0.5, STONE, 0, ARC_TOP, Z0 + 0.25))
  g.add(kit.box(w + 0.4, 0.45, 0.6, STONE_D, 0, ARC_TOP, zf + 0.1))
  for (let i = 6; i <= 9; i++) g.add(kit.box(0.8, H - ARC_TOP - 0.45, 0.35, TRIM, pier(i), ARC_TOP + 0.45, zf + 0.17))
  g.add(kit.box(w + 1.4, 0.8, 1.6, STONE_D, 0, H, Z0 + 0.4)) // cornice
  // The wider royal arch: moulded ring with a golden keystone
  const ring = archRing(kit, 0, PY + 3, 1.7, 0.3, 1.1, TRIM, GOLD)
  ring.position.z = Z0 - 0.4
  g.add(ring)
  balcony(kit, g, 0, STOREYS[0].y, zf, STEP * 3 - 0.6, 0.9, 0.95)
  // Medallion with the bust of Philip V (in place of the top window of the central bay)
  const my = 13.85
  g.add(kit.mesh(new THREE.CylinderGeometry(1, 1, 0.25, 16).rotateX(Math.PI / 2), GOLD, 0, my, zf + 0.12))
  g.add(kit.mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.3, 16).rotateX(Math.PI / 2), STONE_D, 0, my, zf + 0.2))
  g.add(kit.box(0.9, 0.45, 0.3, TRIM, 0, my - 0.65, zf + 0.4)) // shoulders
  g.add(kit.mesh(new THREE.IcosahedronGeometry(0.32, 1), TRIM, 0, my + 0.05, zf + 0.45)) // head

  // Baroque crest over the cornice with the crowned royal arms
  const s = new THREE.Shape()
  s.moveTo(-5.6, 0)
  s.lineTo(5.6, 0)
  s.lineTo(5.6, 1)
  s.quadraticCurveTo(3, 1.2, 2.6, 2.6)
  s.lineTo(2.6, 3.4)
  s.quadraticCurveTo(2.4, 4.9, 0, 5)
  s.quadraticCurveTo(-2.4, 4.9, -2.6, 3.4)
  s.lineTo(-2.6, 2.6)
  s.quadraticCurveTo(-3, 1.2, -5.6, 1)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 8 })
  geo.translate(0, 0, -0.5)
  g.add(kit.mesh(geo, STONE, 0, H + 0.8, Z0 + 0.5))
  const shield = crownedShield(kit, 3.4, RED, YELLOW, GOLD)
  shield.position.set(0, H + 1.5, Z0 + 1)
  g.add(shield)
  for (const sx of [-1, 1]) {
    const p = pinnacle(kit, 2.2, TRIM, GOLD)
    p.position.set(sx * 5.6, H + 1.8, Z0 + 0.5)
    g.add(p)
    const q = pinnacle(kit, 1.6, TRIM, GOLD)
    q.position.set(sx * 2.6, H + 4.2, Z0 + 0.5)
    g.add(q)
  }
  const top = pinnacle(kit, 1.6, TRIM, GOLD)
  top.position.set(0, H + 5.8, Z0 + 0.5)
  g.add(top)
  g.add(kit.lightHalo(3.6, 0, H + 3.2, Z0 + 3, 0.5)) // floodlit crest
  return g
}

/** One block seen from the square, in the frame of the north side (inner façade facing +Z at z = Z0). */
function buildSide(kit: Kit, s: Side) {
  const g = new THREE.Group()
  const { gaps, special } = s
  const isHall = (i: number) => special === 'hall' && i >= 5 && i <= 9
  const isRoyal = (i: number) => special === 'royal' && i >= 6 && i <= 8
  /** Plane of the upper façade of bay i (the pavilions stand forward). */
  const front = (i: number) => Z0 + (isHall(i) ? 0.6 : isRoyal(i) ? 0.5 : 0)

  // ---- Block: upper storeys over the full depth, ground floor behind the arcade gallery ----
  for (const [a, b] of segments(gaps, s.bodyEnd)) {
    const m = (a + b) / 2, l = b - a
    g.add(kit.slab(l, H - ARC_TOP, WING, STONE, m, ARC_TOP, MID))
    g.add(kit.box(l + 0.8, 0.8, WING + 0.8, STONE_D, m, H, MID)) // cornice
    const roof = kit.pediment(WING - 1.4, 3, l, ROOF, H + 0.8)
    roof.rotation.y = Math.PI / 2
    roof.position.set(m, H + 0.8, MID)
    g.add(roof)
  }
  for (const [a, b] of segments(gaps, s.lowEnd)) g.add(kit.slab(b - a, ARC_TOP, WING - GAL, STONE, (a + b) / 2, 0, -OUT / 2 + (WING - GAL) / 2))
  // Shadowed back wall of the gallery (reads as depth through the arches)
  for (const [a, b] of segments(gaps, IN / 2 + GAL)) g.add(kit.slab(b - a, ARC_TOP - PY, 0.1, DARK, (a + b) / 2, PY, Z0 - GAL + 0.06))

  // ---- Arcade: one plate with round arches per stretch, moulded rings, string course ----
  for (const [a, b] of segments(gaps, s.facadeEnd)) {
    const m = (a + b) / 2
    const holes = []
    for (let i = 0; i < BAYS; i++) {
      if (bay(i) <= a || bay(i) >= b) continue
      const wide = special === 'royal' && i === 7
      holes.push({ x: bay(i) - m, width: wide ? 3.4 : ARCH_W, height: wide ? 3 : ARCH_H, arch: true, bottom: PY })
      if (!wide) {
        const ring = archRing(kit, bay(i), PY + ARCH_H, ARCH_W / 2, 0.22, 1, TRIM, STONE_D)
        ring.position.z = Z0 - 0.4
        g.add(ring)
      }
    }
    const plate = kit.facade(b - a, ARC_TOP, 0.8, holes, STONE)
    plate.position.set(m, 0, Z0 - 0.4)
    g.add(plate)
    g.add(kit.box(b - a, 0.45, 0.8, STONE_D, m, ARC_TOP, Z0 + 0.2))
  }
  // Portrait medallions between the arches
  for (let i = 1; i < BAYS; i++) {
    if (pierInGap(gaps, i) || pierAtGapEdge(gaps, i) || (special === 'royal' && (i === 7 || i === 8))) continue
    g.add(kit.mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 12).rotateX(Math.PI / 2), TRIM, pier(i), 5.35, Z0 + 0.12))
    g.add(kit.mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 10).rotateX(Math.PI / 2), STONE_D, pier(i), 5.35, Z0 + 0.27))
  }

  // ---- Upper storeys: framed windows over each arch, iron balconies, pilasters ----
  for (let i = 0; i < BAYS; i++) {
    if (bayInGap(gaps, i)) continue
    const x = bay(i), zf = front(i)
    const wide = special === 'royal' && i === 7
    g.add(kit.lightPanel(wide ? 3.2 : 2.4, 3.2, x, PY + 0.2, Z0 - GAL + 0.2, 0, 0.55)) // lit arcade
    STOREYS.forEach((st, f) => {
      if (wide && f === 2) return // the bust medallion goes there
      const { y, h, w } = st
      g.add(kit.slab(w + 0.5, h + 0.45, 0.14, TRIM, x, y - 0.2, zf + 0.07))
      g.add(kit.slab(w, h, 0.1, DARK, x, y, zf + 0.16))
      if (f === 0) {
        const cap = kit.pediment(w + 1, 0.6, 0.35, STONE_D, y + h + 0.3)
        cap.position.x = x
        cap.position.z = zf + 0.2
        g.add(cap)
      } else if (f === 1) g.add(kit.box(w + 0.8, 0.3, 0.35, STONE_D, x, y + h + 0.25, zf + 0.18))
      const long = f === 0 && special !== undefined && i >= 6 && i <= 8 // the pavilion's long balcony
      if (long) return
      if (st.balcony === 'none') g.add(kit.box(w + 0.5, 0.2, 0.35, STONE_D, x, y - 0.2, zf + 0.17))
      else if (st.balcony === 'big') balcony(kit, g, x, y, zf, w + 1, 0.8, 0.9)
      else balcony(kit, g, x, y, zf, w + 0.6, 0.6, 0.75)
    })
  }
  for (let i = 0; i <= BAYS; i++) {
    if (pierInGap(gaps, i) || pierAtGapEdge(gaps, i)) continue
    if ((special === 'hall' && i >= 5 && i <= 10) || (special === 'royal' && i >= 6 && i <= 9)) continue
    g.add(kit.box(0.55, H - ARC_TOP - 0.45, 0.3, STONE_D, pier(i), ARC_TOP + 0.45, Z0 + 0.15))
  }
  // Trimmed corners where the streets cut through the block
  for (const [a, b] of gaps) {
    for (const [x, d] of [[pier(a), -1], [pier(b + 1), 1]]) {
      for (const z of [Z0 + 0.2, -OUT / 2 - 0.2]) g.add(kit.box(0.7, H - FY, 0.4, STONE_D, x + d * 0.35, FY, z))
    }
  }

  // ---- Roofline: balustrade along the square with finials every third pier ----
  const railGaps: Range[] = [...gaps]
  if (special === 'hall') railGaps.push([5, 9])
  if (special === 'royal') railGaps.push([6, 8])
  railGaps.sort((p, q) => p[0] - q[0])
  const rails = segments(railGaps, IN / 2 + 0.3)
  for (const [a, b] of rails) {
    const r = railRow(kit, b - a, 1.3, TRIM)
    r.position.set((a + b) / 2, H + 0.8, Z0 + 0.15)
    g.add(r)
  }
  for (let i = 0; i <= BAYS; i += 3) {
    if (!s.corners && (i === 0 || i === BAYS)) continue
    const seg = rails.find(([a, b]) => pier(i) >= a - 1e-6 && pier(i) <= b + 1e-6)
    if (!seg) continue
    const p = pinnacle(kit, 2.4, TRIM, GOLD)
    p.position.set(Math.min(seg[1] - 0.45, Math.max(seg[0] + 0.45, pier(i))), H + 0.8, Z0 + 0.15)
    g.add(p)
  }

  // ---- Outer façade (facing -Z at z = -OUT/2): plainer windows, shops, quoins ----
  const oz = -OUT / 2
  for (const [a, b] of segments(gaps, OUT / 2)) g.add(kit.box(b - a, 0.4, 0.5, STONE_D, (a + b) / 2, ARC_TOP, oz))
  for (let j = 0; j < 18; j++) {
    const x = -34 + j * 4
    if (gaps.some(([a, b]) => x > pier(a) - 1.4 && x < pier(b + 1) + 1.4)) continue
    for (const st of STOREYS) {
      g.add(kit.slab(1.9, st.h + 0.35, 0.12, TRIM, x, st.y - 0.15, oz - 0.06))
      g.add(kit.slab(1.4, st.h, 0.1, DARK, x, st.y, oz - 0.14))
    }
    g.add(kit.box(2.2, 0.22, 0.5, STONE_D, x, STOREYS[0].y - 0.22, oz - 0.25))
    g.add(kit.slab(2.1, 0.7, 0.06, IRON, x, STOREYS[0].y, oz - 0.48))
    g.add(kit.slab(j % 2 ? 2.2 : 1.6, j % 2 ? 2.6 : 3.2, 0.1, DARK, x, FY, oz - 0.08)) // shops and doors
  }
  for (const x of [-OUT / 2 + 0.6, OUT / 2 - 0.6]) g.add(kit.box(1.2, H - FY, 0.3, STONE_D, x, FY, oz - 0.1))

  if (special === 'hall') g.add(townHall(kit))
  if (special === 'royal') g.add(royalPavilion(kit))
  return g
}

/** Granite paving of the square: border band, cross, diagonals and a central rosette. */
function paving(kit: Kit) {
  const g = new THREE.Group()
  const span = IN - 4.4
  for (const k of [-1, 1]) {
    g.add(kit.slab(span, 0.04, 0.9, PAVE_D, 0, PY, (k * span) / 2))
    g.add(kit.slab(0.9, 0.04, span, PAVE_D, (k * span) / 2, PY, 0))
  }
  g.add(kit.slab(span, 0.04, 1.1, PAVE_D, 0, PY, 0))
  g.add(kit.slab(1.1, 0.04, span, PAVE_D, 0, PY, 0))
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const d = kit.slab(span * Math.SQRT2, 0.04, 0.8, PAVE_D, 0, PY, 0)
    d.rotation.y = a
    g.add(d)
  }
  g.add(kit.mesh(new THREE.CylinderGeometry(6, 6, 0.08, 24), PAVE_D, 0, PY + 0.04, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(5, 5, 0.1, 24), PAVE, 0, PY + 0.05, 0))
  for (const a of [0, Math.PI / 4]) {
    const sq = kit.slab(5, 0.12, 5, PAVE_D, 0, PY, 0)
    sq.rotation.y = a
    g.add(sq)
  }
  g.add(kit.mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.14, 16), STONE, 0, PY + 0.07, 0))
  return g
}

/** Iron lamppost with three lanterns, standing on the plaza floor. */
function lamppost(kit: Kit, x: number, z: number) {
  const g = new THREE.Group()
  g.add(kit.box(1, 0.8, 1, IRON))
  g.add(kit.mesh(new THREE.CylinderGeometry(0.14, 0.22, 4.4, 8), IRON, 0, 3, 0))
  g.add(kit.box(2.8, 0.2, 0.2, IRON, 0, 4.6, 0))
  for (const sx of [-1, 1]) g.add(kit.mesh(new THREE.IcosahedronGeometry(0.4, 1), LAMP, sx * 1.3, 4.25, 0))
  g.add(kit.mesh(new THREE.IcosahedronGeometry(0.45, 1), LAMP, 0, 5.3, 0))
  g.add(kit.lightHalo(2.6, 0, 4.6, 0, 0.9))
  g.position.set(x, PY, z)
  g.rotation.y = Math.atan2(x, z) + Math.PI / 2 // crossbar across the diagonal
  return g
}

export function buildPlazaMayorSalamanca(kit: Kit): THREE.Group {
  const g = new THREE.Group()

  // ---- Plinth and the paved square (the floor runs under the arcade galleries too) ----
  g.add(kit.box(OUT + 1, FY, OUT + 1, STONE_D))
  g.add(kit.box(IN + GAL * 2, 0.15, IN + GAL * 2, PAVE, 0, FY, 0))
  g.add(paving(kit))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(lamppost(kit, sx * 13, sz * 13))

  // ---- The four blocks: k = 0 north, 1 west, 2 south, 3 east (rotated copies of the north frame) ----
  const ns = { facadeEnd: IN / 2 + 0.8, bodyEnd: OUT / 2, lowEnd: OUT / 2, corners: true }
  const we = { facadeEnd: IN / 2, bodyEnd: IN / 2, lowEnd: IN / 2 + GAL, corners: false, gaps: [] }
  const sides: Side[] = [
    { ...ns, gaps: [], special: 'hall' },
    { ...we },
    { ...ns, gaps: [[1, 2], [12, 13]] }, // two streets into the square
    { ...we, special: 'royal' },
  ]
  sides.forEach((s, k) => {
    const side = buildSide(kit, s)
    side.rotation.y = (k * Math.PI) / 2
    g.add(side)
  })
  return g
}

/**
 * Streets around the square: warm paving.
 * w and d: size of the base (model units). Returns the group and the height of its surface.
 */
export function buildPlazaMayorSalamancaBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 0.3
  g.add(kit.box(w + 4, 0.03, d + 4, 0xecd9b4))
  g.add(kit.box(w, top, d, 0xe2cb9f))
  return { group: g, top }
}
