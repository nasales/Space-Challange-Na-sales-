// Catedral de Burgos, cartoon style. Signature features, exaggerated: the white Gothic west
// façade (+Z) with its big rose window, a gallery of kings and three pointed doors, two tall,
// slim, slightly wonky towers crowned by openwork spires (here: chunky octagonal needles banded
// with rings and ringed by pinnacles), and the octagonal crossing lantern bristling with
// pinnacles behind it. Around it, a pale stone square. Units are roughly metres.
import * as THREE from 'three'
import { wonk, type Kit } from '../kit'
import { balustrade, pinnacle, statue } from '../ornaments'

const STONE = 0xf6ecd6 // white limestone
const STONE_D = 0xd9c7a2 // plinths, buttresses
const TRIM = 0xfff6e0
const ROOF = 0x7f8fa6 // slate
const GLASS = 0x2f4d73
const DARK = 0x2b2540
const GOLD = 0xf2c14e

const F_W = 20 // central body of the façade
const F_H = 30
const T_W = 8 // towers
const T_H = 42

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

/** Rose window facing +Z, centre at (0, 0): glass disc, fat stone ring and spokes. */
function roseWindow(kit: Kit, r: number) {
  const g = new THREE.Group()
  g.add(kit.mesh(new THREE.CylinderGeometry(r, r, 0.3, 16).rotateX(Math.PI / 2), GLASS))
  g.add(kit.mesh(new THREE.TorusGeometry(r, r * 0.13, 6, 20), TRIM, 0, 0, 0.2))
  for (let k = 0; k < 6; k++) {
    const spoke = kit.box(r * 2, r * 0.09, r * 0.12, TRIM, 0, -r * 0.045, 0.25)
    spoke.rotation.z = (k * Math.PI) / 6
    g.add(spoke)
  }
  g.add(kit.mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.25, 0.5, 10).rotateX(Math.PI / 2), TRIM, 0, 0, 0.3))
  return g
}

/** Openwork spire: tall octagonal needle with stone rings, a ring of pinnacles at its foot. */
function spire(kit: Kit, r: number, h: number) {
  const g = new THREE.Group()
  const needle = new THREE.ConeGeometry(r, h, 8)
  needle.rotateY(Math.PI / 8)
  g.add(kit.mesh(needle, STONE, 0, h / 2, 0))
  for (const t of [0.18, 0.4, 0.62]) {
    const rr = r * (1 - t) + 0.25
    g.add(kit.mesh(new THREE.CylinderGeometry(rr, rr, 0.6, 8).rotateY(Math.PI / 8), TRIM, 0, h * t, 0))
  }
  // Dark slits between the rings: the "lace" of the openwork, read from far away
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2
    for (const t of [0.09, 0.29, 0.51]) {
      const rr = Math.cos(Math.PI / 8) * r * (1 - t - 0.06) + 0.05 // on the face, at the slit's middle
      const slit = kit.slab(r * 0.35, h * 0.12, 0.2, DARK, Math.sin(a) * rr, h * t, Math.cos(a) * rr)
      slit.rotation.order = 'YXZ'
      slit.rotation.set(-Math.atan(r / h), a, 0) // leans in with the needle
      g.add(slit)
    }
  }
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8
    const p = pinnacle(kit, 2.6, STONE, TRIM)
    p.position.set(Math.sin(a) * (r + 0.6), 0, Math.cos(a) * (r + 0.6))
    g.add(p)
  }
  g.add(kit.mesh(new THREE.IcosahedronGeometry(0.6, 1), GOLD, 0, h + 0.3, 0))
  g.add(kit.box(0.3, 2, 0.3, GOLD, 0, h + 0.6, 0)) // cross
  g.add(kit.box(1.2, 0.3, 0.3, GOLD, 0, h + 1.8, 0))
  return g
}

function tower(kit: Kit, seed: number) {
  const g = new THREE.Group()
  g.add(kit.taper(T_W + 1.2, T_W + 1.2, T_W, T_W, T_H, STONE))
  for (const x of [-T_W / 2, T_W / 2]) for (const z of [-T_W / 2, T_W / 2]) g.add(kit.box(1.2, T_H, 1.2, STONE_D, x, 0, z)) // buttresses
  // Tall pointed windows up the front and sides
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Group()
    for (const y of [20, 31]) {
      const w = pointedArch(kit, 2.2, 5, 0.3, DARK)
      w.position.set(0, y, (T_W + 1.2 - (1.2 * y) / T_H) / 2 + 0.1)
      face.add(w)
    }
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  g.add(kit.box(T_W + 2, 1, T_W + 2, TRIM, 0, T_H, 0))
  const rail = balustrade(kit, T_W + 1.2, T_W + 1.2, 1.3, TRIM)
  rail.position.y = T_H + 1
  g.add(rail)
  const s = spire(kit, 3.4, 24)
  s.position.y = T_H + 1
  g.add(s)
  return wonk(g, seed, 0.035)
}

export function buildCatedralBurgos(kit: Kit): THREE.Group {
  const g = new THREE.Group()

  // ---- Church behind the façade (Latin cross along -Z) ----
  const NAVE_Z = -32, NAVE_L = 56
  g.add(kit.box(28, 13, NAVE_L - 4, STONE, 0, 0, NAVE_Z)) // aisles
  g.add(kit.box(29, 1, NAVE_L - 3, ROOF, 0, 13, NAVE_Z))
  g.add(kit.box(15, 22, NAVE_L, STONE, 0, 0, NAVE_Z)) // nave
  const naveRoof = kit.pediment(16, 7, NAVE_L + 1, ROOF, 22)
  naveRoof.position.z = NAVE_Z
  g.add(naveRoof)
  const TR_Z = -38
  g.add(kit.box(46, 20, 12, STONE, 0, 0, TR_Z)) // transept
  const trRoof = kit.pediment(13, 6, 47, ROOF, 20)
  trRoof.rotation.y = Math.PI / 2
  trRoof.position.z = TR_Z
  g.add(trRoof)
  // Flying buttresses along the aisles, with pinnacles
  for (const side of [-1, 1]) {
    for (let z = -10; z > -60; z -= 8) {
      if (Math.abs(z - TR_Z) < 8) continue
      g.add(kit.box(1.4, 15, 3, STONE_D, side * 14.6, 0, z))
      const p = pinnacle(kit, 3, STONE, TRIM)
      p.position.set(side * 14.6, 15, z)
      g.add(p)
      const w = pointedArch(kit, 2, 4, 0.3, GLASS)
      w.position.set(side * 7.6, 13.5, z + 4)
      w.rotation.y = (side * Math.PI) / 2
      g.add(w)
    }
  }

  // ---- Crossing lantern (cimborrio): octagonal drum with pinnacles at every corner ----
  const drum = new THREE.CylinderGeometry(7, 7.4, 12, 8)
  drum.rotateY(Math.PI / 8)
  g.add(kit.mesh(drum, STONE, 0, 22 + 6, TR_Z))
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4
    const w = pointedArch(kit, 2, 4.4, 0.3, GLASS)
    w.position.set(Math.sin(a) * 6.9, 25, TR_Z + Math.cos(a) * 6.9)
    w.rotation.y = a
    g.add(w)
    const c = (k * Math.PI) / 4 + Math.PI / 8
    const p = pinnacle(kit, 5, STONE, TRIM)
    p.position.set(Math.sin(c) * 7.6, 34, TR_Z + Math.cos(c) * 7.6)
    g.add(p)
  }
  g.add(kit.mesh(new THREE.CylinderGeometry(8, 8, 1, 8).rotateY(Math.PI / 8), TRIM, 0, 34.5, TR_Z))
  const cap = new THREE.ConeGeometry(7.2, 6, 8)
  cap.rotateY(Math.PI / 8)
  g.add(kit.mesh(cap, ROOF, 0, 35 + 3, TR_Z))
  const crown = spire(kit, 1.4, 7)
  crown.position.set(0, 40, TR_Z)
  g.add(crown)

  // ---- West façade ----
  g.add(kit.taper(F_W + 1, 7, F_W - 1, 6, F_H, STONE, 0, 0, 0))
  const front = 3.2
  for (const x of [-9.4, -3.4, 3.4, 9.4]) g.add(kit.box(1.2, F_H, 1.2, STONE_D, x, 0, front)) // buttresses
  // Three pointed doors, the middle one bigger
  for (const [x, w, h] of [[-6.4, 3, 4], [0, 4, 5.2], [6.4, 3, 4]]) {
    g.add(pointedArch(kit, w + 1.4, h, 0.4, TRIM).translateX(x).translateZ(front + 0.2))
    g.add(pointedArch(kit, w, h, 0.4, DARK).translateX(x).translateZ(front + 0.45))
  }
  // Big rose window between two lancet windows
  const rose = roseWindow(kit, 4.3)
  rose.position.set(0, 16.5, front + 0.3)
  g.add(rose)
  for (const x of [-6.4, 6.4]) g.add(pointedArch(kit, 2, 5, 0.3, GLASS).translateX(x).translateY(13).translateZ(front + 0.3))
  // Gallery of kings: a ledge with a row of statues
  g.add(kit.box(F_W, 0.8, 1.6, TRIM, 0, 22.4, front + 0.4))
  for (let i = 0; i < 6; i++) {
    const k = statue(kit, 2.6, TRIM)
    k.position.set(-6.25 + i * 2.5, 23.2, front + 0.4)
    g.add(k)
  }
  g.add(kit.box(F_W + 1.4, 1, 7.4, TRIM, 0, F_H, 0)) // cornice
  const rail = balustrade(kit, F_W - 0.4, 6.2, 1.4, TRIM)
  rail.position.y = F_H + 1
  g.add(rail)
  const virgin = statue(kit, 3.4, TRIM) // statue of the Virgin over the central gable
  virgin.position.set(0, F_H + 1, front - 0.4)
  g.add(virgin)

  // ---- Towers ----
  for (const side of [-1, 1]) {
    const t = tower(kit, side > 0 ? 13 : 4)
    t.position.x = side * (F_W / 2 + T_W / 2 + 0.3)
    g.add(t)
  }

  // ---- Night lights: rose window and doors lit from inside, belfries, floodlights on the façade ----
  g.add(kit.lightPanel(7.6, 7.6, 0, 16.5 - 3.8, front + 0.7, 0, 0.9))
  for (const [x, w, h] of [[-6.4, 3, 4], [0, 4, 5.2], [6.4, 3, 4]]) g.add(kit.lightPanel(w, h, x, 0, front + 0.8, 0, 0.8))
  for (const x of [-6.4, 6.4]) g.add(kit.lightPanel(2, 5, x, 13, front + 0.7, 0, 0.6))
  for (const side of [-1, 1]) g.add(kit.lightHalo(4, side * (F_W / 2 + T_W / 2 + 0.3), T_H - 6, T_W / 2 + 1, 0.7))
  for (const x of [-12, 0, 12]) g.add(kit.lightHalo(5.5, x, 3, front + 6, 0.35))
  return g
}

/**
 * Plaza de Santa María: pale paving with darker joints.
 * w and d: size of the square (model units). Returns the group and the height of its surface.
 */
export function buildCatedralBurgosBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 0.3
  g.add(kit.box(w + 4, 0.03, d + 4, 0xe6dcc6))
  g.add(kit.box(w, top, d, 0xdccfb3))
  const step = 6
  for (let x = -w / 2 + step; x < w / 2; x += step) g.add(kit.slab(0.3, 0.05, d, 0xbfb092, x, top, 0))
  for (let z = -d / 2 + step; z < d / 2; z += step) g.add(kit.slab(w, 0.05, 0.3, 0xbfb092, 0, top, z))
  return { group: g, top }
}
