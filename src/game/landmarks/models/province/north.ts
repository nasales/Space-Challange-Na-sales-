// Small provincial-capital monuments of the north (Asturias, Cantabria, Galicia, Basque Country,
// Navarre, La Rioja): cartoon low-poly, visual only. Front towards +Z, base at y = 0, model units.
import * as THREE from 'three'
import { wonk, type Kit } from '../../kit'
import { pinnacle } from '../../ornaments'
import { belfry, C, cyl, dome, gable, portal, pyramid, rose, squareTower, windowRow } from './parts'

/** Oviedo: Gothic cathedral with a three-arched porch and one tall tower with an openwork spire. */
export function buildCatedralOviedo(kit: Kit) {
  const g = new THREE.Group()
  const S = C.limestone
  g.add(kit.box(12, 14, 22, S, 0, 0, -11))
  g.add(gable(kit, 12.6, 4, 22, C.slate, 0, 14, -11))
  g.add(kit.facade(15, 9, 3, [-4.6, 0, 4.6].map((x) => ({ x, width: 3.2, height: 4, arch: true })), S).translateZ(1.5))
  g.add(kit.box(15.6, 0.8, 3.6, C.trim, 0, 9, 1.5))
  g.add(rose(kit, 2.2, C.trim, C.blue, 0, 11.5, 0.3))
  const t = squareTower(kit, 6, 24, S, C.trim, 3)
  t.group.add(belfry(kit, 5, 4, S, C.trim).translateY(t.top))
  t.group.add(cyl(kit, 0.05, 2.8, 12, S, 0, t.top + 4.7, 0, 8)) // spire
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.group.add(pinnacle(kit, 3, S).translateX(sx * 2.7).translateY(t.top + 4.7).translateZ(sz * 2.7))
  t.group.position.set(-9.5, 0, 0)
  g.add(wonk(t.group, 5, 0.015))
  g.add(kit.box(5, 12, 5, S, 9.5, 0, -0.5)) // the unfinished south side
  return g
}

/** Santander: Palacio de la Magdalena, the seaside palace with steep slate roofs and corner towers. */
export function buildPalacioMagdalena(kit: Kit) {
  const g = new THREE.Group()
  const W = C.limestone
  g.add(kit.box(24, 10, 11, W))
  g.add(kit.taper(24.4, 11.4, 20, 4, 5, C.slate, 0, 10, 0))
  for (const z of [5.55, -5.55]) {
    const face = new THREE.Group()
    windowRow(kit, face, 6, 1.3, 2.2, 2, 0, 16, false)
    windowRow(kit, face, 6, 1.3, 2.2, 6.4, 0, 16, false)
    face.position.z = z
    if (z < 0) face.rotation.y = Math.PI
    g.add(face)
  }
  g.add(kit.box(7, 12.5, 3, W, 0, 0, 6.5)) // central pavilion
  g.add(pyramid(kit, 7.4, 3.4, 4, C.slate, 0, 12.5, 6.5))
  g.add(kit.slab(2.2, 3.6, 0.3, C.dark, 0, 0, 8.05))
  for (const s of [-1, 1]) {
    g.add(kit.box(5, 14, 5, W, s * 12, 0, 3))
    g.add(pyramid(kit, 5.4, 5.4, 6, C.slate, s * 12, 14, 3))
    g.add(kit.slab(1.3, 2.2, 0.3, C.dark, s * 12, 9.5, 5.55))
    g.add(kit.box(1.2, 3, 1.2, C.brick, s * 5, 13, -2)) // chimneys
  }
  return g
}

/** Lugo: a stretch of the Roman walls, dark schist with round towers (cubos) and a gate. */
export function buildMurallaLugo(kit: Kit) {
  const g = new THREE.Group()
  const S = C.schist
  for (const s of [-1, 1]) g.add(kit.box(17, 10, 5, S, s * 11.5, 0, 0))
  g.add(kit.facade(6, 10, 5, [{ x: 0, width: 3.4, height: 4.6, arch: true }], S))
  g.add(kit.box(40.4, 0.8, 5.6, C.granite, 0, 10, 0)) // walkway on top
  for (const x of [-17, -9, 9, 17]) {
    g.add(cyl(kit, 3, 3.2, 11, S, x, 0, 2.6, 12))
    g.add(cyl(kit, 3.1, 3.1, 0.7, C.granite, x, 11, 2.6, 12))
  }
  for (const s of [-1, 1]) g.add(kit.box(0.6, 1.4, 5.6, C.granite, s * 3.6, 10.8, 0)) // gate parapet
  return g
}

/** Pontevedra: Santuario da Peregrina, the round church with a convex scallop-shaped front. */
export function buildPeregrina(kit: Kit) {
  const g = new THREE.Group()
  const S = C.granite
  g.add(cyl(kit, 6, 6, 11, S, 0, 0, -4, 12)) // round body
  g.add(dome(kit, 5.4, S, 0, 11, -4))
  g.add(cyl(kit, 0.9, 1, 2.8, S, 0, 16.2, -4, 8))
  g.add(dome(kit, 1, S, 0, 19, -4))
  const front = kit.mesh(new THREE.CylinderGeometry(4.6, 4.6, 10, 12, 1, false, -Math.PI / 2, Math.PI), S, 0, 5, 0)
  g.add(front)
  g.add(kit.box(9.6, 0.8, 5, C.trim, 0, 10, 0.4))
  g.add(kit.slab(2, 3.6, 0.3, C.dark, 0, 0, 4.65))
  g.add(kit.mesh(new THREE.CircleGeometry(1, 8, 0, Math.PI), C.dark, 0, 3.6, 4.82))
  g.add(kit.slab(1.4, 1.4, 0.3, C.dark, 0, 6.5, 4.65))
  for (const s of [-1, 1]) {
    const t = new THREE.Group()
    t.add(kit.box(2.8, 13, 2.8, S))
    t.add(belfry(kit, 2.8, 3, S, C.trim).translateY(13))
    t.add(dome(kit, 1.5, S, 0, 16.7, 0))
    t.add(kit.mesh(new THREE.IcosahedronGeometry(0.4, 0), C.trim, 0, 18.5, 0))
    t.position.set(s * 5.2, 0, -0.6)
    g.add(t)
  }
  return g
}

/** San Sebastián: Catedral del Buen Pastor, neo-Gothic with one very tall central spire. */
export function buildBuenPastor(kit: Kit) {
  const g = new THREE.Group()
  const S = C.granite
  g.add(kit.box(11, 14, 24, S, 0, 0, -12))
  g.add(gable(kit, 11.6, 5, 24, C.slate, 0, 14, -12))
  for (const s of [-1, 1]) for (let z = -21; z <= -3; z += 6) g.add(kit.slab(0.3, 6, 2, C.blue, s * 5.55, 5, z))
  const t = squareTower(kit, 7, 25, S, C.trim, 2)
  t.group.add(portal(kit, 3.6, 7, C.trim, 3.5))
  t.group.add(rose(kit, 1.6, C.trim, C.blue, 0, 13, 3.6))
  t.group.add(belfry(kit, 6, 5, S, C.trim).translateY(t.top))
  t.group.add(cyl(kit, 0.05, 3.2, 17, S, 0, t.top + 5.7, 0, 8))
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.group.add(pinnacle(kit, 4, S).translateX(sx * 3.2).translateY(t.top + 5.7).translateZ(sz * 3.2))
  t.group.position.z = 0.5
  g.add(wonk(t.group, 8, 0.012))
  return g
}

/** Vitoria-Gasteiz: Catedral de Santa María, with its deep Gothic porch and the bell tower beside it. */
export function buildSantaMariaVitoria(kit: Kit) {
  const g = new THREE.Group()
  const S = C.sandstone
  g.add(kit.box(11, 13, 22, S, 0, 0, -11))
  g.add(gable(kit, 11.6, 3.6, 22, C.roof, 0, 13, -11))
  g.add(kit.facade(12, 8, 4, [-3.8, 0, 3.8].map((x) => ({ x, width: 2.6, height: 3.6, arch: true })), S).translateZ(2))
  g.add(gable(kit, 12.6, 2, 4.4, C.roof, 0, 8, 2))
  g.add(portal(kit, 2.8, 6, C.trim, 0.2))
  const t = squareTower(kit, 6, 20, S, C.trim, 3)
  t.group.add(belfry(kit, 5.2, 4, S, C.trim).translateY(t.top))
  t.group.add(cyl(kit, 0.05, 2.9, 6, C.roof, 0, t.top + 4.7, 0, 8))
  t.group.position.set(9, 0, -1)
  g.add(t.group)
  return g
}

/** Pamplona: the Baroque town hall, a narrow façade of iron balconies crowned by statues and a bell. */
export function buildAyuntamientoPamplona(kit: Kit) {
  const g = new THREE.Group()
  const S = C.limestone
  g.add(kit.box(11, 17, 7, S))
  for (const y of [5.2, 10.4]) g.add(kit.box(11.6, 0.6, 7.6, C.trim, 0, y, 0))
  g.add(kit.facade(4, 4.6, 0.6, [{ x: 0, width: 2.4, height: 2.6, arch: true }], C.trim).translateZ(3.6))
  g.add(kit.slab(2.4, 3.8, 0.3, C.dark, 0, 0, 3.4))
  for (const [i, y] of [6.2, 11.4].entries()) {
    for (const x of [-3.4, 0, 3.4]) {
      g.add(kit.slab(1.5, 2.8, 0.3, C.dark, x, y, 3.55))
      g.add(kit.box(2.4, 0.3, 1.2, C.iron, x, y - 0.2, 4.1)) // balcony floor
      g.add(kit.box(2.4, 1, 0.15, C.iron, x, y, 4.65)) // railing
    }
    if (i === 0) g.add(kit.box(11.6, 0.4, 1.6, C.iron, 0, y - 0.6, 4.2)) // the long main balcony
  }
  for (const x of [-4.6, -1.5, 1.5, 4.6]) g.add(cyl(kit, 0.4, 0.45, 10.6, C.trim, x, 5.8, 3.8, 8)) // columns
  g.add(kit.pediment(11, 3.6, 2, S, 17).translateZ(2.5))
  g.add(kit.facade(3, 3, 0.8, [{ x: 0, width: 1.3, height: 1, arch: true, bottom: 0.4 }], S).translateY(20.4).translateZ(2.5))
  g.add(kit.mesh(new THREE.IcosahedronGeometry(0.45, 0), C.gold, 0, 21, 2.5)) // bell
  for (const s of [-1, 1]) g.add(pinnacle(kit, 3, S, C.gold).translateX(s * 5.2).translateY(17).translateZ(3))
  return g
}

/** Logroño: Concatedral de La Redonda and its Baroque twin towers ("las gemelas"). */
export function buildLaRedonda(kit: Kit) {
  const g = new THREE.Group()
  const S = C.sandstone
  g.add(kit.box(12, 13, 22, S, 0, 0, -11))
  g.add(gable(kit, 12.6, 3.6, 22, C.roof, 0, 13, -11))
  g.add(kit.box(9, 15, 1.6, S, 0, 0, 0.3))
  g.add(kit.box(5, 11, 0.6, C.trim, 0, 0, 1.3)) // retablo portal
  g.add(kit.slab(2.6, 5, 0.3, C.dark, 0, 0, 1.6))
  g.add(kit.mesh(new THREE.CircleGeometry(1.3, 8, 0, Math.PI), C.dark, 0, 5, 1.78))
  for (const s of [-1, 1]) {
    const t = new THREE.Group()
    t.add(kit.box(5, 15, 5, S))
    t.add(kit.box(5.6, 0.8, 5.6, C.trim, 0, 15, 0))
    let y = 15.8
    for (const [i, r] of [2.4, 1.9].entries()) {
      const h = i === 0 ? 4.6 : 3.4
      t.add(cyl(kit, r, r, h, S, 0, y, 0, 8))
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + Math.PI / 8
        const o = kit.slab(r * 0.55, h * 0.55, 0.3, C.dark, Math.sin(a) * r * 0.93, y + h * 0.2, Math.cos(a) * r * 0.93)
        o.rotation.y = a
        t.add(o)
      }
      t.add(cyl(kit, r + 0.3, r + 0.3, 0.5, C.trim, 0, y + h, 0, 8))
      y += h + 0.5
    }
    t.add(dome(kit, 1.7, C.trim, 0, y, 0))
    t.add(cyl(kit, 0.25, 0.35, 2, S, 0, y + 1.5, 0, 6))
    t.add(kit.mesh(new THREE.IcosahedronGeometry(0.4, 0), C.gold, 0, y + 3.7, 0))
    t.position.set(s * 7, 0, -0.5)
    g.add(wonk(t, s + 12, 0.015))
  }
  return g
}
