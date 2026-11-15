// Catedral de Murcia (Santa María), cartoon style. Signature features, exaggerated: the warm
// Baroque west façade by Jaime Bort (+Z), built like a stone altarpiece: two side streets with
// stacked columns and statue niches around a big concave exedra that holds the main door and is
// crowned by an arched attic; the very tall bell tower on the north side (-X), stacked stages
// ending in an open belfry, four little domed corner pavilions, an octagonal lantern and a dome;
// the Gothic church behind with buttresses and pinnacles; and the octagonal Vélez chapel at the
// east end, girdled by its stone chain. Around it, a warm paved square. Units are roughly metres.
import * as THREE from 'three'
import { wonk, type Kit } from '../kit'
import { archRing, balustrade, ionicColumn, onionDome, openStorey, pinnacle, statue } from '../ornaments'

const SAND = 0xe8c08a // warm sandstone
const SAND_D = 0xc9965c // plinths, buttresses
const TRIM = 0xf8e3b8 // cornices, columns, statues
const ROOF = 0xc76a42 // terracotta tiles
const DOME = 0xd9a066
const GLASS = 0x2f4d73
const DARK = 0x2b2540
const GOLD = 0xf2c14e

const F_W = 34 // façade width (= width of the church)
const SIDE_H = 24.2 // height of the side streets of the façade
const EX_R = 6.5 // inner radius of the concave exedra
const EX_T = 1 // thickness of its curved wall
const EX_Z = 3 // front plane of the façade (and centre of the exedra's half circle)
const EX_H = 26
const NAVE_Z = -33
const NAVE_L = 58
const TR_Z = -40 // transept
const VELEZ_X = -9 // Vélez chapel
const VELEZ_Z = -72

/** Extrudes a floor-plan shape upwards by h (shape x -> x, shape y -> -z); base at y = 0. */
function plan(kit: Kit, shape: THREE.Shape, h: number, color: number) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 10 })
  geo.rotateX(-Math.PI / 2)
  return kit.mesh(geo, color)
}

/** Half ring in plan (curved wall or concave cornice) open towards +Z, centre at the origin. */
function halfRing(kit: Kit, rIn: number, rOut: number, h: number, color: number) {
  const s = new THREE.Shape()
  s.absarc(0, 0, rOut, 0, Math.PI, false)
  s.lineTo(-rIn, 0)
  s.absarc(0, 0, rIn, Math.PI, 0, true)
  s.closePath()
  return plan(kit, s, h, color)
}

/** Half disc in plan on the -Z side of the origin (hood over the exedra). */
function halfDisc(kit: Kit, r: number, h: number, color: number) {
  const s = new THREE.Shape()
  s.absarc(0, 0, r, 0, Math.PI, false)
  s.closePath()
  return plan(kit, s, h, color)
}

/** Round-arched plate facing +Z, base at y = 0; h = height of the straight jambs. */
function roundArch(kit: Kit, w: number, h: number, depth: number, color: number) {
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

/** Pointed (Gothic) arch plate facing +Z, base at y = 0; h = height of the straight jambs. */
function pointedArch(kit: Kit, w: number, h: number, depth: number, color: number) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(w / 2, h)
  s.quadraticCurveTo(w / 2, h + w * 0.55, 0, h + w * 0.85)
  s.quadraticCurveTo(-w / 2, h + w * 0.55, -w / 2, h)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 })
  geo.translate(0, 0, -depth / 2)
  return kit.mesh(geo, color)
}

/** Bell tower, centred at the origin: two massive stages, open belfry, corner pavilions, lantern and dome. */
function bellTower(kit: Kit) {
  const g = new THREE.Group()
  // Stage 1: massive Renaissance base with corner pilasters
  g.add(kit.taper(15, 15, 14, 14, 20, SAND))
  for (const x of [-7, 7]) for (const z of [-7, 7]) g.add(kit.box(1.3, 20, 1.3, TRIM, x, 0, z))
  g.add(kit.box(16, 1.2, 16, TRIM, 0, 20, 0))
  // Stage 2: pilasters and a tall arched window on every face
  g.add(kit.box(13.4, 16, 13.4, SAND, 0, 21.2, 0))
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Group()
    face.add(roundArch(kit, 1.6, 2.4, 0.3, DARK).translateY(11).translateZ(7.35))
    for (const x of [-4.4, 4.4]) face.add(kit.box(0.9, 16, 0.5, TRIM, x, 21.2, 6.75))
    face.add(roundArch(kit, 2.6, 4.6, 0.3, DARK).translateY(27).translateZ(6.85))
    if (k % 2 === 0) face.add(kit.lightPanel(2.6, 5.9, 0, 27, 7.1, 0, 0.7)) // lit at night
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  g.add(kit.box(14.6, 1.2, 14.6, TRIM, 0, 37.2, 0))
  // Stage 3: the open belfry
  const belfry = openStorey(kit, 11, 10, 3.4, 5.2, 1.4, SAND, TRIM, DARK)
  belfry.position.y = 38.4
  g.add(belfry)
  g.add(kit.lightHalo(5, 0, 43.5, 0, 0.8)) // night: the bells glow from inside
  g.add(kit.box(12.6, 1, 12.6, TRIM, 0, 48.4, 0))
  let y = 49.4
  const rail = balustrade(kit, 12, 12, 1.2, TRIM)
  rail.position.y = y
  g.add(rail)
  // Four little domed pavilions at the corners of the terrace
  for (const x of [-4.6, 4.6]) {
    for (const z of [-4.6, 4.6]) {
      g.add(kit.mesh(new THREE.CylinderGeometry(1.1, 1.2, 2.6, 8), SAND, x, y + 1.3, z))
      g.add(kit.mesh(new THREE.SphereGeometry(1.25, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), DOME, x, y + 2.6, z))
      g.add(kit.mesh(new THREE.IcosahedronGeometry(0.35, 0), GOLD, x, y + 4, z))
    }
  }
  // Stage 4: octagonal lantern with windows, ribbed dome, small lantern and cross
  const drum = new THREE.CylinderGeometry(4, 4.3, 7, 8)
  drum.rotateY(Math.PI / 8)
  g.add(kit.mesh(drum, SAND, 0, y + 3.5, 0))
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4
    const w = roundArch(kit, 1.2, 2.2, 0.2, DARK)
    w.position.set(Math.sin(a) * 3.98, y + 2, Math.cos(a) * 3.98)
    w.rotation.y = a
    g.add(w)
  }
  y += 7
  g.add(kit.mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.8, 8).rotateY(Math.PI / 8), TRIM, 0, y + 0.4, 0))
  y += 0.8
  g.add(kit.mesh(new THREE.SphereGeometry(4.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), DOME, 0, y, 0))
  for (let k = 0; k < 4; k++) {
    const rib = new THREE.TorusGeometry(4.25, 0.22, 4, 12, Math.PI)
    rib.rotateY((k * Math.PI) / 4)
    g.add(kit.mesh(rib, TRIM, 0, y, 0))
  }
  y += 4.2
  g.add(kit.mesh(new THREE.CylinderGeometry(0.9, 1.1, 3, 8), TRIM, 0, y + 1.5, 0))
  g.add(kit.lightHalo(2.4, 0, y + 1.5, 0, 0.7)) // night: the lantern on top
  y += 3
  const tip = onionDome(kit, 1.1, DOME, GOLD)
  tip.position.y = y
  g.add(tip)
  y += 1.1 * 1.8
  g.add(kit.box(0.3, 2.2, 0.3, GOLD, 0, y, 0)) // cross
  g.add(kit.box(1.2, 0.3, 0.3, GOLD, 0, y + 1.4, 0))
  return wonk(g, 7, 0.02)
}

/** Jaime Bort's west façade: an altarpiece in stone around a concave exedra. Front plane at EX_Z. */
function westFacade(kit: Kit) {
  const g = new THREE.Group()
  g.add(kit.box(F_W + 1.6, 1.2, 10.2, SAND_D, 0, 0, 0.1)) // stepped platform

  // ---- Side streets: two orders of columns, statue niches, an attic on top ----
  const sideW = F_W / 2 - (EX_R + EX_T)
  for (const side of [-1, 1]) {
    const cx = side * (EX_R + EX_T + sideW / 2)
    g.add(kit.box(sideW, SIDE_H, 7, SAND, cx, 0, EX_Z - 3.5))
    for (const x of [EX_R + EX_T + 0.8, F_W / 2 - 0.9]) {
      const low = ionicColumn(kit, 11, 0.75, SAND, TRIM)
      low.position.set(side * x, 1.2, EX_Z + 0.9)
      g.add(low)
      const up = ionicColumn(kit, 8.8, 0.65, SAND, TRIM)
      up.position.set(side * x, 13.8, EX_Z + 0.9)
      g.add(up)
    }
    for (const y of [12.2, 22.6]) g.add(kit.box(sideW + 1.1, 1.6, 2.2, TRIM, cx + side * 0.3, y, EX_Z + 0.9)) // entablatures
    for (const [y, h, sh] of [[2.2, 4.2, 3.6], [15, 3.2, 3]]) {
      g.add(roundArch(kit, 3, h, 0.3, DARK).translateX(cx).translateY(y).translateZ(EX_Z + 0.1))
      g.add(kit.box(1.6, 1, 1.4, TRIM, cx, y - 1, EX_Z + 0.6)) // bracket
      const s = statue(kit, sh, TRIM)
      s.position.set(cx, y, EX_Z + 0.7)
      g.add(s)
    }
    g.add(kit.lightHalo(2.2, cx, 5, EX_Z + 1.5, 0.45)) // night: lit statue in the lower niche
    g.add(kit.box(sideW - 1, 2.4, 5, SAND, cx, SIDE_H, EX_Z - 3.5)) // attic
    const top = statue(kit, 2.8, TRIM)
    top.position.set(cx, SIDE_H + 2.4, EX_Z - 2)
    g.add(top)
    const p = pinnacle(kit, 3, TRIM, GOLD)
    p.position.set(side * (F_W / 2 - 0.8), SIDE_H, EX_Z - 0.6)
    g.add(p)
    // Scroll joining the attic to the central crown
    g.add(kit.mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.2, 10).rotateX(Math.PI / 2), TRIM, side * 7.6, SIDE_H + 1.6, EX_Z - 1.6))
  }

  // ---- Central exedra: a tall concave niche with concave cornices ----
  const ex = halfRing(kit, EX_R, EX_R + EX_T, EX_H, SAND)
  ex.position.z = EX_Z
  g.add(ex)
  for (const y of [12.2, 22.6]) {
    const c = halfRing(kit, EX_R - 0.9, EX_R + 0.5, 1.6, TRIM)
    c.position.set(0, y, EX_Z)
    g.add(c)
  }
  // Main door (Puerta del Perdón) at the back of the exedra
  const backZ = EX_Z - EX_R
  g.add(roundArch(kit, 5, 6, 0.4, TRIM).translateY(1.2).translateZ(backZ + 1.2))
  g.add(roundArch(kit, 3.4, 4.8, 0.3, DARK).translateY(1.2).translateZ(backZ + 1.55))
  g.add(kit.lightPanel(3.4, 6.5, 0, 1.2, backZ + 1.85, 0, 0.8)) // night: the open door
  // The Virgin on the lower cornice, an oval window above
  const virgin = statue(kit, 3.4, TRIM)
  virgin.position.set(0, 13.8, backZ + 0.5)
  g.add(virgin)
  g.add(kit.mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.3, 14).rotateX(Math.PI / 2), GLASS, 0, 19.5, backZ + 0.9))
  g.add(kit.mesh(new THREE.TorusGeometry(1.7, 0.3, 4, 14), TRIM, 0, 19.5, backZ + 1.1))
  g.add(kit.lightHalo(4.5, 0, 14, EX_Z - 2, 0.45)) // night: glow inside the exedra
  // Hood over the exedra and the arched crown on top
  const hood = halfDisc(kit, EX_R + EX_T + 0.4, 1.2, TRIM)
  hood.position.set(0, EX_H, EX_Z)
  g.add(hood)
  const crownY = EX_H + 1.2, crownZ = EX_Z - 2
  g.add(roundArch(kit, 13, 3, 1.6, SAND).translateY(crownY).translateZ(crownZ))
  const ring = archRing(kit, 0, crownY + 3, 5.6, 1, 0.6, TRIM, GOLD)
  ring.position.z = crownZ + 1.1
  g.add(ring)
  g.add(kit.mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.3, 14).rotateX(Math.PI / 2), GLASS, 0, crownY + 3.6, crownZ + 0.85))
  g.add(kit.lightHalo(2.2, 0, crownY + 3.6, crownZ + 1.4, 0.5)) // night: round window of the crown
  const crownStatue = statue(kit, 3.4, TRIM)
  crownStatue.position.set(0, crownY + 3 + 6.5 - 0.3, crownZ)
  g.add(crownStatue)
  return g
}

/** Octagonal Vélez chapel, centred at the origin, girdled by its carved stone chain. */
function velezChapel(kit: Kit) {
  const g = new THREE.Group()
  const R = 7, H = 18
  g.add(kit.mesh(new THREE.CylinderGeometry(R + 0.9, R + 0.9, 1.2, 8).rotateY(Math.PI / 8), SAND_D, 0, 0.6, 0)) // plinth
  g.add(kit.mesh(new THREE.CylinderGeometry(R, R + 0.4, H, 8).rotateY(Math.PI / 8), SAND, 0, H / 2, 0))
  // The stone chain: an octagonal ring hugging the walls
  const chain = new THREE.TorusGeometry(R + 0.45, 0.45, 4, 8)
  chain.rotateX(Math.PI / 2)
  chain.rotateY(Math.PI / 8)
  g.add(kit.mesh(chain, TRIM, 0, 11.5, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(R + 0.8, R + 0.8, 1.2, 8).rotateY(Math.PI / 8), TRIM, 0, H + 0.6, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(0.8, R, 3.5, 8).rotateY(Math.PI / 8), ROOF, 0, H + 1.2 + 1.75, 0)) // low roof
  for (let k = 0; k < 8; k++) {
    const c = (k * Math.PI) / 4 + Math.PI / 8 // corner
    const p = pinnacle(kit, 3.4, TRIM, GOLD)
    p.position.set(Math.sin(c) * (R + 0.4), H + 1.2, Math.cos(c) * (R + 0.4))
    g.add(p)
    const a = (k * Math.PI) / 4 // middle of a face
    const m = kit.box(1.2, 1.2, 0.6, TRIM, Math.sin(a) * (R * 0.92 + 0.3), H + 1.2, Math.cos(a) * (R * 0.92 + 0.3))
    m.rotation.y = a
    g.add(m)
    const w = pointedArch(kit, 1.8, 4.5, 0.3, GLASS)
    w.position.set(Math.sin(a) * 6.85, 3.5, Math.cos(a) * 6.85)
    w.rotation.y = a
    g.add(w)
  }
  return g
}

export function buildCatedralMurcia(kit: Kit): THREE.Group {
  const g = new THREE.Group()

  // ---- Gothic church behind the façade (along -Z) ----
  g.add(kit.box(F_W, 14, NAVE_L, SAND, 0, 0, NAVE_Z)) // aisles and side chapels
  g.add(kit.box(F_W + 1, 1, NAVE_L + 1, ROOF, 0, 14, NAVE_Z))
  g.add(kit.box(16, 23, NAVE_L, SAND, 0, 0, NAVE_Z)) // nave
  const naveRoof = kit.pediment(17, 6, NAVE_L + 1, ROOF, 23)
  naveRoof.position.z = NAVE_Z
  g.add(naveRoof)
  g.add(kit.box(42, 20, 11, SAND, 0, 0, TR_Z)) // transept
  const trRoof = kit.pediment(12, 5, 43, ROOF, 20)
  trRoof.rotation.y = Math.PI / 2
  trRoof.position.z = TR_Z
  g.add(trRoof)
  // Transept doors (Apóstoles to the south, Cadenas to the north) and a window above each
  for (const side of [-1, 1]) {
    const rot = (side * Math.PI) / 2
    const frame = pointedArch(kit, 5.6, 5.5, 0.3, TRIM)
    frame.position.set(side * 21.1, 0, TR_Z)
    frame.rotation.y = rot
    const door = pointedArch(kit, 4, 4.6, 0.3, DARK)
    door.position.set(side * 21.3, 0, TR_Z)
    door.rotation.y = rot
    const win = pointedArch(kit, 3, 3.6, 0.3, GLASS)
    win.position.set(side * 21.15, 11.5, TR_Z)
    win.rotation.y = rot
    g.add(frame, door, win, kit.lightPanel(4, 8, side * 21.5, 0, TR_Z, rot, 0.6))
  }
  // Buttresses with pinnacles; clerestory and aisle windows between them
  for (const side of [-1, 1]) {
    let i = 0
    for (let z = -10; z > -60; z -= 8) {
      if (Math.abs(z - TR_Z) < 8) continue
      if (side < 0 && z > -18) continue // the bell tower stands here
      const rot = (side * Math.PI) / 2
      g.add(kit.box(1.4, 16, 3, SAND_D, side * 17.6, 0, z))
      const p = pinnacle(kit, 3, SAND, TRIM)
      p.position.set(side * 17.6, 16, z)
      g.add(p)
      const high = pointedArch(kit, 2, 4.2, 0.3, GLASS)
      high.position.set(side * 8.1, 15, z + 4)
      high.rotation.y = rot
      const low = pointedArch(kit, 2, 3.5, 0.3, GLASS)
      low.position.set(side * 17.15, 5, z + 4)
      low.rotation.y = rot
      g.add(high, low)
      if (i++ % 2 === 0) g.add(kit.lightPanel(2, 5.9, side * 8.35, 15, z + 4, rot, 0.8)) // lit at night
    }
  }
  // Stepped polygonal chevet: low ambulatory and the taller apse of the nave
  const endZ = NAVE_Z - NAVE_L / 2
  g.add(kit.mesh(new THREE.CylinderGeometry(15, 15.5, 14, 6, 1, false, Math.PI / 2, Math.PI), SAND, 0, 7, endZ))
  g.add(kit.mesh(new THREE.ConeGeometry(16, 5, 6, 1, false, Math.PI / 2, Math.PI), ROOF, 0, 14 + 2.5, endZ))
  g.add(kit.mesh(new THREE.CylinderGeometry(8, 8, 23, 6, 1, false, Math.PI / 2, Math.PI), SAND, 0, 11.5, endZ))
  g.add(kit.mesh(new THREE.ConeGeometry(8.5, 6, 6, 1, false, Math.PI / 2, Math.PI), ROOF, 0, 23 + 3, endZ))
  for (let k = 1; k < 6; k++) {
    const a = Math.PI / 2 + (k * Math.PI) / 6
    const p = pinnacle(kit, 2.6, SAND, TRIM)
    p.position.set(Math.sin(a) * 15.3, 14, endZ + Math.cos(a) * 15.3)
    g.add(p)
  }

  // ---- Vélez chapel at the east end ----
  const velez = velezChapel(kit)
  velez.position.set(VELEZ_X, 0, VELEZ_Z)
  g.add(velez)
  g.add(kit.lightHalo(6, VELEZ_X, 8, VELEZ_Z - 9.5, 0.35)) // night: soft floodlight on the chapel

  // ---- West façade and the bell tower on its north side ----
  g.add(westFacade(kit))
  const tower = bellTower(kit)
  tower.position.set(-(F_W / 2 + 7.7), 0, -9)
  g.add(tower)
  return g
}

/**
 * Plaza del Cardenal Belluga: warm paving in big squares with darker joints and a border.
 * w and d: size of the square (model units). Returns the group and the height of its surface.
 */
export function buildCatedralMurciaBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 0.3
  const joint = 0xc8a676
  g.add(kit.box(w + 4, 0.03, d + 4, 0xeedcbc))
  g.add(kit.box(w, top, d, 0xe6cfa6))
  const step = 7
  for (let x = -w / 2 + step; x < w / 2 - 1; x += step) g.add(kit.slab(0.3, 0.05, d - 2, joint, x, top, 0))
  for (let z = -d / 2 + step; z < d / 2 - 1; z += step) g.add(kit.slab(w - 2, 0.05, 0.3, joint, 0, top, z))
  for (const s of [-1, 1]) {
    g.add(kit.slab(w - 1, 0.05, 0.6, joint, 0, top, s * (d / 2 - 0.8)))
    g.add(kit.slab(0.6, 0.05, d - 1, joint, s * (w / 2 - 0.8), top, 0))
  }
  return { group: g, top }
}
