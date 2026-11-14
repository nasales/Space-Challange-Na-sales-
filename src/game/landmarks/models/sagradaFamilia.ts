// Sagrada Familia (Barcelona): cuerpo en cruz con ábside y muchas torres afiladas
// con remates de colores (como los frutos de Gaudí). La torre central es la más alta.
import * as THREE from 'three'
import type { Kit } from '../kit'

const STONE = 0xd9c39a
const ROOF = 0xb89f72
const FINIALS = [0xe5322d, 0xf2b632, 0x3fa34d, 0x2a6bd1]

export function buildSagradaFamilia(kit: Kit): THREE.Group {
  const g = new THREE.Group()
  const BODY_H = 14

  // Cuerpo: nave (eje X), crucero (eje Z) y ábside redondo
  g.add(kit.box(34, BODY_H, 14, STONE, 0, 0, 0))
  g.add(kit.box(14, BODY_H, 30, STONE, 0, 0, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(8, 8, BODY_H + 2, 10), STONE, 17, (BODY_H + 2) / 2, 0))
  g.add(kit.box(34.6, 1, 14.6, ROOF, 0, BODY_H, 0))
  g.add(kit.box(14.6, 1, 30.6, ROOF, 0, BODY_H, 0))

  let finial = 0
  /** Torre: fuste que se estrecha, punta cónica y remate esférico. */
  const tower = (x: number, z: number, r: number, h: number, base = 0, top?: number) => {
    g.add(kit.mesh(new THREE.CylinderGeometry(r * 0.5, r, h, 8), STONE, x, base + h / 2, z))
    g.add(kit.mesh(new THREE.ConeGeometry(r * 0.55, h * 0.22, 8), ROOF, x, base + h + h * 0.11, z))
    const color = top ?? FINIALS[finial++ % FINIALS.length]
    g.add(kit.mesh(new THREE.IcosahedronGeometry(r * 0.55, 0), color, x, base + h * 1.24, z))
  }

  // 12 torres de los apóstoles: 4 en cada fachada (Nacimiento, Pasión y Gloria)
  for (const [i, x] of [-6, -2, 2, 6].entries()) {
    const h = i === 0 || i === 3 ? 30 : 35
    tower(x, 15.6, 1.6, h)
    tower(x, -15.6, 1.6, h)
    tower(-17.6, x, 1.6, h + 2)
  }
  // 4 torres de los evangelistas alrededor del centro
  for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) tower(x, z, 2, 30, BODY_H, 0xffffff)
  // Torre de la Virgen sobre el ábside
  tower(13, 0, 2.2, 32, BODY_H, 0x8fd3ff)
  // Torre central de Jesús, la más alta, con cruz
  tower(0, 0, 3, 42, BODY_H, 0xffffff)
  const crossY = BODY_H + 42 * 1.24 + 2
  g.add(kit.box(0.6, 4, 0.6, 0xffffff, 0, crossY, 0))
  g.add(kit.box(2.6, 0.6, 0.6, 0xffffff, 0, crossY + 2.4, 0))

  // ---- Night lights: tall lit windows between the facade towers and on the nave, and the
  // glowing tips of the central towers (the Virgin's tower carries a lit star) ----
  for (const side of [-1, 1]) {
    const turn = side > 0 ? 0 : Math.PI
    for (const x of [-4, 0, 4]) g.add(kit.lightPanel(1.4, 5, x * side, 4, side * 15.1, turn))
    for (const x of [-10.5, 10.5]) g.add(kit.lightPanel(1.4, 4, x, 5, side * 7.1, turn))
  }
  g.add(kit.lightHalo(3.6, 0, BODY_H + 42 * 1.24, 0, 1))
  g.add(kit.lightHalo(3, 13, BODY_H + 32 * 1.24, 0, 1))
  for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) g.add(kit.lightHalo(2, x, BODY_H + 30 * 1.24, z, 0.6))
  return g
}
