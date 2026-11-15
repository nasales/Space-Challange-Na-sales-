// Small provincial-capital monuments of Catalonia, Aragon, Valencia and the Balearic Islands
// (cartoon low-poly, visual only). Front towards +Z, base at y = 0, model units.
import * as THREE from 'three'
import { wonk, type Kit } from '../../kit'
import { pinnacle } from '../../ornaments'
import { battlements, belfry, C, cyl, dome, gable, portal, pyramid, rose, roundTower, squareTower, stairs, windowRow } from './parts'

const WOOD = 0x8a5a36

/** Girona: the cathedral at the top of its grand Baroque staircase, with one bell tower. */
export function buildCatedralGirona(kit: Kit) {
  const g = new THREE.Group()
  const S = C.limestone
  const steps = 7, stepH = 0.9, run = 1.4
  const front = 14
  g.add(stairs(kit, 11, steps, stepH, run, C.trim, front))
  const floor = steps * stepH
  const back = front - steps * run
  g.add(kit.box(20, floor, 20, C.trim, 0, 0, back - 10)) // terrace
  g.add(kit.box(14, 16, 16, S, 0, floor, back - 9))
  g.add(gable(kit, 14.6, 4, 16, C.roof, 0, floor + 16, back - 9))
  g.add(kit.box(14, 20, 1.6, S, 0, floor, back - 0.8)) // Baroque façade
  g.add(kit.mesh(new THREE.CylinderGeometry(4, 4, 1.6, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), S, 0, floor + 20, back - 0.8)) // round crest
  g.add(rose(kit, 1.8, C.trim, C.blue, 0, floor + 15, back))
  g.add(kit.slab(3, 5, 0.3, C.dark, 0, floor, back + 0.05))
  for (const x of [-3, 3]) g.add(cyl(kit, 0.45, 0.5, 10, C.trim, x, floor, back + 0.3, 8))
  const t = squareTower(kit, 5, 19, S, C.trim, 2)
  t.group.add(belfry(kit, 4.2, 3.6, S, C.trim).translateY(t.top))
  t.group.add(dome(kit, 2, S, 0, t.top + 4.3, 0))
  t.group.position.set(9.5, floor, back - 6)
  g.add(t.group)
  return g
}

/** Lleida: La Seu Vella, the old cathedral on its hill with a tall octagonal bell tower. */
export function buildSeuVella(kit: Kit) {
  const g = new THREE.Group()
  const S = C.sandstone
  g.add(kit.box(15, 12, 11, S, -2, 0, 0))
  g.add(kit.pediment(11.6, 3.4, 15.6, C.roof, 12).rotateY(Math.PI / 2).translateZ(-2))
  windowRow(kit, g, 4, 1, 2.4, 5, 5.55, 10)
  g.add(cyl(kit, 2.4, 2.4, 3, S, -2, 12, 0, 8)) // crossing lantern
  g.add(cyl(kit, 0.05, 2.7, 2.4, C.roof, -2, 15, 0, 8))
  const t = new THREE.Group()
  t.add(kit.box(6, 10, 6, S))
  t.add(cyl(kit, 2.8, 3.1, 16, S, 0, 10, 0, 8))
  for (const y of [10, 18, 26]) t.add(cyl(kit, 3.3, 3.3, 0.6, C.trim, 0, y, 0, 8))
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8
    const o = kit.slab(1, 3, 0.3, C.dark, Math.sin(a) * 2.75, 21.5, Math.cos(a) * 2.75)
    o.rotation.y = a
    t.add(o)
  }
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4
    t.add(kit.box(0.9, 1, 0.7, S, Math.sin(a) * 2.6, 26.6, Math.cos(a) * 2.6))
  }
  t.position.set(9, 0, 1)
  g.add(wonk(t, 2, 0.015))
  return g
}

/** Tarragona: the Roman amphitheatre by the sea, an oval of stepped seats round a sandy arena. */
export function buildAmfiteatreTarragona(kit: Kit) {
  const g = new THREE.Group()
  const R = 12, FLAT = 0.72
  const tiers: [number, number][] = [[6.4, 1.2], [7.8, 2.4], [9.2, 3.6], [10.6, 4.8]]
  for (const [i, [r, h]] of tiers.entries()) {
    const shape = new THREE.Shape()
    shape.absarc(0, 0, R, 0, Math.PI * 2, false)
    const hole = new THREE.Path()
    hole.absarc(0, 0, r, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 14 }).rotateX(-Math.PI / 2)
    geo.scale(1, 1, FLAT)
    g.add(kit.mesh(geo, i % 2 ? C.trim : C.sandstone))
  }
  const arena = kit.mesh(new THREE.CylinderGeometry(6.5, 6.5, 0.4, 16), C.sand, 0, 0.2, 0)
  arena.scale.z = FLAT
  g.add(arena)
  // The ruined Romanesque church inside the arena
  g.add(kit.box(1, 3.4, 4.5, C.sandstone, -1.6, 0, 0))
  g.add(kit.box(1, 2.4, 3.5, C.sandstone, 1.6, 0, -0.4))
  g.add(kit.box(4.2, 2, 1, C.sandstone, 0, 0, -2.3))
  return g
}

/** Huesca: Gothic cathedral with a deep portal and the wooden Mudéjar eave over its façade. */
export function buildCatedralHuesca(kit: Kit) {
  const g = new THREE.Group()
  const S = C.sandstone
  g.add(kit.box(12, 13, 22, S, 0, 0, -11))
  g.add(gable(kit, 12.6, 3.6, 22, C.roof, 0, 13, -11))
  g.add(kit.box(15, 15, 2, S, 0, 0, 0.5))
  g.add(portal(kit, 6, 10, C.trim, 1.5))
  windowRow(kit, g, 7, 0.8, 1.2, 12.3, 1.55, 11) // little gallery under the eave
  const eave = kit.taper(16.4, 4.2, 16, 1.4, 1.3, WOOD, 0, 15, 1.6) // the wooden roof sticking out
  g.add(eave)
  const t = new THREE.Group()
  t.add(kit.box(5, 14, 5, S))
  t.add(cyl(kit, 2.4, 2.4, 7, S, 0, 14, 0, 8))
  t.add(kit.slab(1, 2.4, 0.3, C.dark, 0, 16.5, 2.35))
  t.add(cyl(kit, 2.6, 2.6, 0.5, C.trim, 0, 21, 0, 8))
  t.add(battlements(kit, 4, 4, 0.8, S, 21.5))
  t.position.set(8.5, 0, -8)
  g.add(t)
  return g
}

/** Teruel: Torre de El Salvador, a Mudéjar brick tower over a street arch, inlaid with green tiles. */
export function buildTorreSalvador(kit: Kit) {
  const g = new THREE.Group()
  const B = C.brick, W = 7
  for (const s of [-1, 1]) g.add(kit.box(2.2, 8, W, B, s * (W / 2 - 1.1), 0, 0)) // piers of the street arch
  g.add(kit.box(W, 1.6, W, B, 0, 6.6, 0)) // lintel over the street
  g.add(kit.taper(W, W, W - 0.4, W - 0.4, 20, B, 0, 8, 0))
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Group()
    const z = W / 2 - 0.1
    for (const y of [10, 15.5, 21]) face.add(kit.slab(W - 0.6, 0.5, 0.3, C.tile, 0, y, z)) // tile bands
    for (const x of [-1.8, 0, 1.8]) for (const y of [11.5, 17]) face.add(kit.mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 8).rotateX(Math.PI / 2), (x === 0 ? C.white : C.tile), x, y, z + 0.1)) // ceramic discs
    windowRow(kit, face, 2, 1, 2.4, 22.5, z, 2.8)
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  g.add(belfry(kit, W - 0.4, 5, B, C.tile).translateY(28))
  g.add(pyramid(kit, W, W, 3, C.roof, 0, 33.7, 0))
  return wonk(g, 6, 0.012)
}

/** Castellón: El Fadrí, the free-standing octagonal Gothic bell tower. */
export function buildFadri(kit: Kit) {
  const g = new THREE.Group()
  const S = C.limestone
  let y = 0
  for (const [i, h] of [9, 8, 7, 7].entries()) {
    const r = 3.8 - i * 0.15
    g.add(cyl(kit, r, r + 0.05, h, S, 0, y, 0, 8))
    if (i === 3) {
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4 + Math.PI / 8
        const o = kit.slab(1.3, 3.6, 0.3, C.dark, Math.sin(a) * r * 0.93, y + 1.6, Math.cos(a) * r * 0.93)
        o.rotation.y = a
        g.add(o)
      }
    } else if (i > 0) {
      const o = kit.slab(0.8, 1.8, 0.3, C.dark, 0, y + 3, r * 0.93)
      o.rotation.y = Math.PI / 8
      g.add(o)
    }
    y += h
    g.add(cyl(kit, r + 0.35, r + 0.35, 0.6, C.trim, 0, y, 0, 8))
    y += 0.6
  }
  g.add(cyl(kit, 1.7, 1.9, 3, S, 0, y, 0, 8)) // little top temple
  g.add(dome(kit, 1.8, C.trim, 0, y + 3, 0))
  g.add(kit.mesh(new THREE.IcosahedronGeometry(0.5, 0), C.gold, 0, y + 5.1, 0))
  g.add(kit.box(9, 0.8, 9, C.trim))
  return wonk(g, 4, 0.012)
}

/** Alicante: Castillo de Santa Bárbara, walls and towers on top of the rock of Mount Benacantil. */
export function buildSantaBarbara(kit: Kit) {
  const g = new THREE.Group()
  const S = 0xd6c29a
  const w = 18, d = 10
  for (const s of [-1, 1]) {
    g.add(kit.box(w, 4, 1.4, S, 0, 0, (s * (d - 1.4)) / 2))
    g.add(kit.box(1.4, 4, d - 2.8, S, (s * (w - 1.4)) / 2, 0, 0))
  }
  g.add(battlements(kit, w, d, 1, S, 4))
  const keep = squareTower(kit, 5, 9, S, C.trim, 2)
  keep.group.add(battlements(kit, 5.6, 5.6, 0.9, S, keep.top))
  keep.group.position.set(-4, 0, -1)
  g.add(keep.group)
  const round = roundTower(kit, 2.2, 7, S, C.trim, 6)
  round.position.set(w / 2 - 0.6, 0, d / 2 - 0.6)
  g.add(round)
  g.add(kit.facade(4, 5, 1.6, [{ x: 0, width: 2, height: 2.4, arch: true }], S).translateX(3).translateZ(d / 2 - 0.7))
  return g
}

/** Palma: La Seu, the Gothic cathedral by the sea with its row of tall buttresses and pinnacles. */
export function buildLaSeuPalma(kit: Kit) {
  const g = new THREE.Group()
  const S = C.sandstone
  g.add(kit.box(32, 19, 9, S))
  g.add(gable(kit, 9.6, 3, 32, C.roof, 0, 19, 0).rotateY(Math.PI / 2))
  for (const s of [-1, 1]) {
    g.add(kit.box(32, 11, 3.5, S, 0, 0, s * 6.2)) // aisles
    for (let i = 0; i < 8; i++) {
      const x = -14 + i * 4
      g.add(kit.box(1.4, 18, 2.6, S, x, 0, s * 8.6)) // buttress
      g.add(pinnacle(kit, 4.4, S).translateX(x).translateY(18).translateZ(s * 8.6))
      if (i < 7) g.add(kit.slab(1.6, 6, 0.3, C.blue, x + 2, 11.5, s * 4.6))
    }
  }
  // East end: rose window; west end: front with two slim turrets
  const east = rose(kit, 2.8, C.trim, C.blue, 0, 14, 0)
  east.rotation.y = Math.PI / 2
  east.position.x = 16.1
  g.add(east)
  for (const s of [-1, 1]) g.add(cyl(kit, 0.9, 1, 23, S, -16, 0, s * 4, 8)).add(cyl(kit, 0.05, 1, 3, S, -16, 23, s * 4, 8))
  g.add(portal(kit, 4, 7, C.trim, 0).rotateY(-Math.PI / 2).translateZ(16.2))
  const bell = squareTower(kit, 5, 19, S, C.trim, 2)
  bell.group.position.set(10, 0, -9.5)
  g.add(bell.group)
  return g
}

