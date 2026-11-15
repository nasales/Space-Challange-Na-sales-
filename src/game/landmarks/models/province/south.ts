// Small provincial-capital monuments of Andalusia (cartoon low-poly, visual only).
// Front towards +Z, base at y = 0, model units.
import * as THREE from 'three'
import { wonk, type Kit } from '../../kit'
import { balustrade, pinnacle } from '../../ornaments'
import { belfry, C, cyl, dome, squareTower } from './parts'

/** Huelva: Monumento a la Fe Descubridora, the giant stone friar holding a tau cross, at the river mouth. */
export function buildColonHuelva(kit: Kit) {
  const g = new THREE.Group()
  const S = 0xd7d0c0
  g.add(kit.box(9, 2, 9, C.trim))
  g.add(kit.box(6.4, 2.4, 6.4, S, 0, 2, 0))
  const fig = new THREE.Group()
  fig.add(kit.taper(5, 3.6, 2.6, 2, 20, S, 0, 4.4, 0)) // the friar's habit
  fig.add(kit.taper(2.8, 2.4, 1.2, 1.2, 3.4, S, 0, 24.4, 0)) // hooded head
  fig.add(kit.box(0.9, 7, 0.9, S, 0, 25, 1.4)) // tau cross held up in front
  fig.add(kit.box(4.4, 0.9, 0.9, S, 0, 31.2, 1.4))
  fig.add(kit.box(2.6, 1.4, 1.4, S, 0, 20, 1.6)) // hands on the cross
  g.add(wonk(fig, 7, 0.015))
  return g
}

/** Jaén: the Renaissance cathedral, a columned façade between two square towers, and its dome. */
export function buildCatedralJaen(kit: Kit) {
  const g = new THREE.Group()
  const S = C.sandstone
  g.add(kit.box(18, 16, 22, S, 0, 0, -11))
  g.add(balustrade(kit, 18, 22, 1.2, S).translateY(16).translateZ(-11))
  g.add(kit.box(14, 20, 1.6, S, 0, 0, 0.6)) // façade between the towers
  for (const x of [-5, -1.7, 1.7, 5]) g.add(cyl(kit, 0.55, 0.6, 12, C.trim, x, 1, 1.6, 10))
  g.add(kit.box(14.6, 1, 2.2, C.trim, 0, 13, 0.8))
  g.add(kit.slab(2.6, 6, 0.3, C.dark, 0, 0, 1.45))
  g.add(kit.mesh(new THREE.CircleGeometry(1.3, 8, 0, Math.PI), C.dark, 0, 6, 1.62))
  for (const x of [-4, 0, 4]) g.add(pinnacle(kit, 2.4, S).translateX(x).translateY(20).translateZ(0.8)) // statues on the top
  for (const s of [-1, 1]) {
    const t = squareTower(kit, 5.4, 20, S, C.trim, 2)
    t.group.add(belfry(kit, 4.6, 4.2, S, C.trim).translateY(t.top))
    t.group.add(dome(kit, 2.1, S, 0, t.top + 4.9, 0))
    t.group.add(kit.mesh(new THREE.IcosahedronGeometry(0.35, 0), C.gold, 0, t.top + 7.2, 0))
    t.group.position.set(s * 9.6, 0, 0)
    g.add(t.group)
  }
  g.add(cyl(kit, 4.4, 4.4, 3.6, S, 0, 16, -12, 12)) // drum
  g.add(dome(kit, 4.6, C.trim, 0, 19.6, -12))
  g.add(cyl(kit, 0.7, 0.9, 2, S, 0, 24.1, -12, 8))
  return g
}

/** Málaga: the cathedral nicknamed "La Manquita" (the one-armed lady): its south tower was never finished. */
export function buildManquita(kit: Kit) {
  const g = new THREE.Group()
  const S = 0xe2c99d
  g.add(kit.box(18, 17, 24, S, 0, 0, -12))
  for (const x of [-5, 0, 5]) for (const z of [-6, -16]) g.add(dome(kit, 2.4, C.trim, x, 17, z)) // the little domes on the flat roof
  g.add(kit.box(14, 19, 1.6, S, 0, 0, 0.5))
  g.add(kit.facade(14, 9, 1.2, [-4.4, 0, 4.4].map((x) => ({ x, width: 2.8, height: 4.4, arch: true })), C.trim).translateZ(1.6))
  g.add(kit.box(12, 9, 0.4, C.dark, 0, 0, 1.2))
  for (const x of [-6.6, -2.2, 2.2, 6.6]) g.add(cyl(kit, 0.5, 0.55, 9, 0xb9825e, x, 0, 2.4, 10)) // red marble columns
  g.add(kit.pediment(14, 3, 1.6, S, 19).translateZ(0.5))
  // North tower: finished, with two belfry stages and a little dome
  const north = squareTower(kit, 6, 20, S, C.trim, 2)
  north.group.add(belfry(kit, 5.4, 4.6, S, C.trim).translateY(north.top))
  north.group.add(cyl(kit, 2.2, 2.2, 3.4, S, 0, north.top + 5.3, 0, 8))
  north.group.add(dome(kit, 2.3, C.trim, 0, north.top + 8.7, 0))
  north.group.position.set(-10, 0, 0)
  g.add(wonk(north.group, 9, 0.015))
  // South tower: stops at roof height, with just a balustrade
  const south = squareTower(kit, 6, 17, S, C.trim, 2)
  south.group.add(balustrade(kit, 5.6, 5.6, 1, S).translateY(south.top))
  south.group.position.set(10, 0, 0)
  g.add(south.group)
  return g
}
