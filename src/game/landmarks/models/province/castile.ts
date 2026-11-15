// Small provincial-capital monuments of Castile, Extremadura and the centre (cartoon low-poly,
// visual only). Front towards +Z, base at y = 0, model units (scaled in landmarks.json).
import * as THREE from 'three'
import { wonk, type Kit } from '../../kit'
import { beam } from '../../ornaments'
import { battlements, C, cyl, dome, gable, portal, pyramid, rose, roundTower, squareTower, windowRow } from './parts'

/** Ávila: Puerta del Alcázar, the gate of the medieval walls between two massive round towers. */
export function buildMurallaAvila(kit: Kit) {
  const g = new THREE.Group()
  const S = C.granite
  g.add(kit.facade(8, 13, 7, [{ x: 0, width: 3.6, height: 5.5, arch: true }], S))
  g.add(battlements(kit, 8, 7, 1.2, S, 13))
  for (const s of [-1, 1]) {
    const big = roundTower(kit, 4.2, 16, S, C.trim, 8)
    big.position.set(s * 6, 0, 0.8)
    g.add(wonk(big, s + 4, 0.02))
    g.add(kit.box(11, 11, 4, S, s * 15, 0, -0.5)) // wall stretch
    g.add(battlements(kit, 11, 4, 1.1, S, 11).translateX(s * 15).translateZ(-0.5))
    const end = roundTower(kit, 3.2, 13, S, C.trim, 6)
    end.position.set(s * 21, 0, 0.2)
    g.add(end)
  }
  return g
}

/** León: Gothic cathedral with two spired towers, a big rose window and walls of stained glass. */
export function buildCatedralLeon(kit: Kit) {
  const g = new THREE.Group()
  const S = C.limestone
  g.add(kit.box(10, 16, 26, S, 0, 0, -13))
  g.add(gable(kit, 10.6, 5, 26, C.slate, 0, 16, -13))
  for (const s of [-1, 1]) {
    g.add(kit.box(4, 9, 24, S, s * 7, 0, -13)) // aisle
    for (let z = -23; z <= -3; z += 5) {
      g.add(kit.slab(0.3, 5.5, 2.2, C.blue, s * 5.1, 9.8, z)) // clerestory glass
      g.add(kit.box(1.2, 11, 1.6, S, s * 9.4, 0, z + 2.5)) // buttress pier
      g.add(beam(kit, new THREE.Vector3(s * 9.4, 11, z + 2.5), new THREE.Vector3(s * 5.2, 15, z + 2.5), 0.7, S)) // flying buttress
    }
  }
  g.add(kit.box(11, 19, 2, S, 0, 0, 0.5)) // west front
  g.add(kit.pediment(11, 5, 2, S, 19).translateZ(0.5))
  g.add(rose(kit, 2.6, C.trim, C.blue, 0, 13, 1.6))
  for (const x of [-3.6, 0, 3.6]) g.add(portal(kit, 3, 6.5, C.trim, 1.6, x))
  for (const s of [-1, 1]) {
    const t = squareTower(kit, 6, 22, S, C.trim, 3)
    t.group.position.set(s * 8, 0, 0)
    t.group.add(cyl(kit, 0.05, 2.9, 11, S, 0, t.top, 0, 8)) // spire
    g.add(wonk(t.group, s + 7, 0.02))
  }
  return g
}

/** Palencia: Cristo del Otero, the tall Art Deco statue of Christ blessing the city from its hill. */
export function buildCristoOtero(kit: Kit) {
  const g = new THREE.Group()
  const S = C.limestone
  g.add(kit.box(5.5, 2.5, 5.5, C.trim))
  const fig = new THREE.Group()
  fig.add(kit.taper(4.6, 3.2, 2.8, 2.2, 15, S, 0, 2.5, 0)) // robe
  fig.add(kit.taper(3.4, 2.4, 2.2, 1.8, 2, S, 0, 17.5, 0)) // shoulders
  fig.add(kit.mesh(new THREE.IcosahedronGeometry(1.2, 1), S, 0, 20.6, 0.1)) // head
  for (const s of [-1, 1]) fig.add(beam(kit, new THREE.Vector3(s * 1.6, 18.6, 0.3), new THREE.Vector3(s * 4.2, 20.8, 1.4), 1, S)) // arms raised to bless
  g.add(wonk(fig, 3, 0.02))
  // Hermitage at its feet
  g.add(kit.box(5, 4, 6, C.white, -7.5, 0, 0))
  g.add(gable(kit, 5.6, 2, 6.4, C.roof, -7.5, 4, 0))
  g.add(kit.slab(1.4, 2.2, 0.3, C.dark, -7.5, 0, 3.05))
  return g
}

/** Soria: the cloister of San Juan de Duero with its arcades and the little Romanesque church. */
export function buildArcosSoria(kit: Kit) {
  const g = new THREE.Group()
  const S = C.sandstone
  const arches = (w: number) => [-2, -1, 0, 1, 2].map((i) => ({ x: (i * w) / 5.4, width: w / 8, height: 2.4, arch: true }))
  for (let k = 0; k < 4; k++) {
    const side = new THREE.Group()
    side.add(kit.facade(k % 2 ? 15.6 : 18, 5, 1.2, arches(15), S).translateZ(8.4))
    side.rotation.y = (k * Math.PI) / 2
    g.add(side)
  }
  // Church behind the cloister: nave, apse and a bell gable (espadaña) on its front
  g.add(kit.box(8, 7, 9, S, 0, 0, -14))
  g.add(gable(kit, 8.6, 3, 9.4, C.roof, 0, 7, -14))
  g.add(cyl(kit, 3, 3, 6, S, 0, 0, -18.5, 10))
  g.add(kit.facade(3.4, 3.6, 0.8, [{ x: 0, width: 1.2, height: 1.2, arch: true, bottom: 0.8 }], S).translateY(9.5).translateZ(-9.4))
  return g
}

/** Valladolid: Iglesia de San Pablo, a richly carved Gothic façade between two plain square towers. */
export function buildSanPabloValladolid(kit: Kit) {
  const g = new THREE.Group()
  const S = C.sandstone
  g.add(kit.box(12, 16, 22, S, 0, 0, -12))
  g.add(gable(kit, 12.6, 4, 22, C.roof, 0, 16, -12))
  g.add(kit.box(13, 22, 2, C.limestone, 0, 0, 0))
  g.add(kit.pediment(13, 4, 2, C.limestone, 22))
  for (let r = 0; r < 4; r++) for (let c = -1; c <= 1; c++) g.add(kit.slab(3, 2.6, 0.4, C.trim, c * 3.8, 9 + r * 3.1, 1.1)) // carved panels
  g.add(kit.mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.5, 12).rotateX(Math.PI / 2), C.gold, 0, 19.5, 1.2)) // coat of arms
  g.add(portal(kit, 4.6, 8, C.trim, 1.1))
  for (const s of [-1, 1]) {
    const t = squareTower(kit, 5, 25, S, C.trim, 3)
    t.group.position.set(s * 9, 0, -1)
    t.group.add(pyramid(kit, 5.4, 5.4, 5, C.slate, 0, t.top, 0))
    g.add(t.group)
  }
  return g
}

/** Zamora: Romanesque cathedral famous for its scaled dome with four turrets, and its square tower. */
export function buildCatedralZamora(kit: Kit) {
  const g = new THREE.Group()
  const S = C.sandstone
  g.add(kit.box(10, 12, 24, S, 0, 0, -2))
  g.add(gable(kit, 10.6, 3, 24, C.roof, 0, 12, -2))
  windowRow(kit, g, 3, 1.2, 2.4, 6, 10.05, 5)
  // Crossing dome (cimborrio): drum, scaled dome in bands, four corner turrets and gables between
  const top = 13
  g.add(kit.box(9, 2, 9, S, 0, top - 2, 0))
  g.add(cyl(kit, 4, 4, 3.5, S, 0, top, 0, 12))
  const cap = dome(kit, 4, C.trim, 0, top + 3.5, 0)
  cap.scale.y = 1.4
  g.add(cap)
  for (const y of [1, 2.4, 3.6]) g.add(cyl(kit, 4.1 * Math.sqrt(1 - (y / 5.6) ** 2), 4.1 * Math.sqrt(1 - (y / 5.6) ** 2), 0.35, S, 0, top + 3.5 + y, 0, 12)) // scale rows
  g.add(cyl(kit, 0.4, 0.7, 1.4, S, 0, top + 9, 0, 6))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(cyl(kit, 1.2, 1.2, 4.5, S, sx * 4.2, top, sz * 4.2, 8))
    g.add(dome(kit, 1.25, C.trim, sx * 4.2, top + 4.5, sz * 4.2))
  }
  for (let k = 0; k < 4; k++) {
    const f = new THREE.Group()
    f.add(kit.pediment(3.6, 2.4, 0.8, S, top + 3.4).translateZ(4.1))
    f.rotation.y = (k * Math.PI) / 2
    g.add(f)
  }
  const t = squareTower(kit, 6.5, 19, S, C.trim, 3)
  t.group.position.set(0, 0, -16)
  t.group.add(pyramid(kit, 7, 7, 2.5, C.roof, 0, t.top, 0))
  g.add(t.group)
  return g
}

/** Guadalajara: Palacio del Infantado, a façade studded with diamond points under an arcaded gallery. */
export function buildPalacioInfantado(kit: Kit) {
  const g = new THREE.Group()
  const S = C.sandstone
  g.add(kit.box(30, 14, 12, S))
  for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) {
    if (r < 2 && c === 4) continue // portal
    const stud = kit.taper(1.3, 1.3, 0.15, 0.15, 0.7, C.trim, -12 + c * 3, 2.5 + r * 3, 6)
    stud.rotation.x = Math.PI / 2
    g.add(stud)
  }
  g.add(kit.facade(3.4, 6, 0.6, [{ x: 0, width: 2.2, height: 3.6, arch: true }], C.trim).translateZ(6.1))
  g.add(kit.slab(2.2, 5, 0.3, C.dark, 0, 0, 5.9))
  g.add(kit.box(2.4, 2, 0.6, C.gold, 0, 7.2, 6.2)) // coat of arms
  // Upper gallery: arcade in front of a dark loggia, two round lookout turrets at the corners
  g.add(kit.box(28, 4, 9, C.dark, 0, 14, -1))
  g.add(kit.facade(30, 4.6, 1, Array.from({ length: 11 }, (_, i) => ({ x: -12.5 + i * 2.5, width: 1.6, height: 2.2, arch: true, bottom: 0.6 })), S).translateY(14).translateZ(5.5))
  for (const s of [-1, 1]) {
    g.add(cyl(kit, 1.5, 1.5, 5.5, S, s * 14.5, 14, 5.5, 10))
    g.add(cyl(kit, 0.05, 1.8, 2.4, C.roof, s * 14.5, 19.5, 5.5, 10))
  }
  g.add(kit.taper(30, 12, 25, 7, 2.6, C.roof, 0, 18.6, 0))
  return g
}

/** Ciudad Real: Puerta de Toledo, the Gothic-Mudéjar city gate between two crenellated towers. */
export function buildPuertaToledoCR(kit: Kit) {
  const g = new THREE.Group()
  const S = 0xd9a878 // warm stone
  g.add(kit.facade(9, 12, 8, [{ x: 0, width: 4, height: 5, arch: true }], S))
  g.add(kit.facade(5.6, 8.4, 0.5, [{ x: 0, width: 4, height: 5, arch: true }], C.trim).translateZ(4.2)) // alfiz frame
  g.add(battlements(kit, 9, 8, 1.1, S, 12))
  for (const s of [-1, 1]) {
    const t = new THREE.Group()
    t.add(cyl(kit, 2.8, 3, 14, S, 0, 0, 0, 8))
    t.add(cyl(kit, 3.1, 3.1, 0.7, C.trim, 0, 14, 0, 8))
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3
      t.add(kit.box(1, 1.2, 0.8, S, Math.sin(a) * 2.6, 14.7, Math.cos(a) * 2.6))
    }
    t.position.set(s * 6.2, 0, 0.4)
    g.add(wonk(t, s + 9, 0.02))
    g.add(kit.box(6, 8, 3, S, s * 11.5, 0, -1)) // wall stubs
  }
  return g
}

/** Albacete: Puerta de Hierros, the white entrance gate of the fairground with its two towers. */
export function buildPuertaHierros(kit: Kit) {
  const g = new THREE.Group()
  const W = C.white
  g.add(kit.facade(20, 10, 2, [{ x: 0, width: 6, height: 5, arch: true }, { x: -6, width: 2.6, height: 3, arch: true }, { x: 6, width: 2.6, height: 3, arch: true }], W))
  g.add(kit.box(21, 0.9, 2.6, C.sandstone, 0, 10, 0))
  g.add(kit.pediment(8, 3, 2, W, 10.9))
  g.add(kit.mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.4, 12).rotateX(Math.PI / 2), C.gold, 0, 12, 1.1)) // clock
  for (let i = -2; i <= 2; i++) g.add(kit.box(0.35, 7.5, 0.35, C.iron, i * 1.1, 0, 0)) // iron gate
  for (const s of [-1, 1]) {
    const t = new THREE.Group()
    t.add(kit.box(4.2, 17, 4.2, W))
    for (const y of [5, 10, 15]) t.add(kit.box(4.6, 0.6, 4.6, C.sandstone, 0, y, 0))
    t.add(kit.slab(1.2, 2.4, 0.3, C.dark, 0, 11.5, 2.15))
    t.add(cyl(kit, 0.05, 2.6, 5, C.slate, 0, 17, 0, 8))
    t.position.set(s * 11.5, 0, 0)
    g.add(t)
  }
  return g
}

/** Cáceres: Torre de Bujaco, the crenellated tower over the Arco de la Estrella on the Plaza Mayor. */
export function buildTorreBujaco(kit: Kit) {
  const g = new THREE.Group()
  const S = 0xcfb48a
  const t = squareTower(kit, 8, 21, S, C.trim, 3)
  t.group.add(battlements(kit, 8.8, 8.8, 1.3, S, t.top))
  t.group.add(kit.box(3.4, 2.4, 1.6, S, 0, 16, 4.6)) // machicolation
  t.group.add(cyl(kit, 1.3, 1.1, 0.9, 0x8a6a4a, 2, t.top, -2, 8)) // stork's nest
  t.group.position.x = -6
  g.add(t.group)
  g.add(kit.facade(12, 10, 3.5, [{ x: 0, width: 4, height: 4.5, arch: true }], S).translateX(4))
  g.add(battlements(kit, 12, 3.5, 1.1, S, 10).translateX(4))
  g.add(kit.box(2.2, 2, 0.5, C.gold, 4, 7.6, 1.9)) // the star
  return g
}

/** Badajoz: Puerta de Palmas, the Renaissance gate between two round crenellated towers. */
export function buildPuertaPalmas(kit: Kit) {
  const g = new THREE.Group()
  const S = C.limestone
  g.add(kit.facade(7, 11, 6, [{ x: 0, width: 3.4, height: 4.6, arch: true }], S))
  g.add(battlements(kit, 7, 6, 1, S, 11))
  g.add(kit.box(2.6, 2.4, 0.6, C.gold, 0, 7.6, 3.2)) // imperial coat of arms
  for (const s of [-1, 1]) {
    const t = roundTower(kit, 3.3, 14, S, C.trim, 8)
    t.position.set(s * 5.6, 0, 0.6)
    g.add(t)
  }
  return g
}
