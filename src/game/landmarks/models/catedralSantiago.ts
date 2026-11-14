// Catedral de Santiago de Compostela, cartoon style. Signature features, exaggerated: the Baroque
// Obradoiro façade (+Z) with its giant glazed window in a gold frame, the scallop shell of the
// Way of St. James, a big statue of St. James on top, two slim, tall, slightly wonky bell towers
// with fat bulbous domes, and the chunky double staircase. Behind it, the cross-shaped church
// with its crossing dome and the clock tower. Around it, the granite Obradoiro square.
// Units are roughly metres.
import * as THREE from 'three'
import { wonk, type Kit } from '../kit'
import { balustrade, onionDome, openStorey, pinnacle, scallopShell, statue } from '../ornaments'

const GRANITE = 0xeccb8a // golden granite, warm and bright
const GRANITE_D = 0xc9a265 // steps, plinths
const TRIM = 0xfff0cc
const ROOF = 0x5f8f86 // mossy slate
const DOME = 0x4f7f78
const GLASS = 0x2f4d73
const GOLD = 0xf2c14e
const DARK = 0x2b2540

const F_W = 22 // central body of the façade
const F_H = 36
const T_W = 9.5 // towers
const T_H = 40

/** Baroque tower: tapered shaft, two open storeys with balustrades, fat dome and spire. */
function bellTower(kit: Kit, seed: number) {
  const g = new THREE.Group()
  g.add(kit.taper(T_W + 1.2, T_W + 1.2, T_W, T_W, T_H, GRANITE))
  for (const x of [-T_W / 2, T_W / 2]) for (const z of [-T_W / 2, T_W / 2]) g.add(kit.box(1.3, T_H, 1.3, TRIM, x, 0, z)) // corner pilasters
  for (const y of [13, 22, 31]) {
    g.add(kit.slab(1.8, 3.6, 0.3, GLASS, 0, y, T_W / 2 + 0.2))
    g.add(kit.box(2.6, 0.6, 0.7, TRIM, 0, y + 3.6, T_W / 2 + 0.3))
  }
  let y = T_H
  const storey = (w: number, h: number, holeW: number, holeH: number) => {
    g.add(kit.box(w + 2.6, 1.2, w + 2.6, TRIM, 0, y, 0)) // fat cornice
    y += 1.2
    const rail = balustrade(kit, w + 1.8, w + 1.8, 1.4, TRIM)
    rail.position.y = y
    g.add(rail)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const p = pinnacle(kit, 3.4, TRIM, GOLD)
        p.position.set((sx * (w + 1.8)) / 2, y, (sz * (w + 1.8)) / 2)
        g.add(p)
      }
    }
    const s = openStorey(kit, w, h, holeW, holeH, 1.2, GRANITE, TRIM, DARK)
    s.position.y = y
    g.add(s)
    y += h
  }
  storey(7.8, 11, 3.6, 5.4)
  storey(6, 8.5, 2.8, 4)
  g.add(kit.box(7.4, 1, 7.4, TRIM, 0, y, 0))
  y += 1
  g.add(kit.mesh(new THREE.CylinderGeometry(2.7, 3, 2.6, 10), GRANITE, 0, y + 1.3, 0))
  y += 2.6
  const dome = onionDome(kit, 3.4, DOME, GOLD)
  dome.position.y = y
  g.add(dome)
  y += 3.4 * 1.5
  g.add(kit.mesh(new THREE.CylinderGeometry(0.9, 1, 2.4, 8), GRANITE, 0, y + 1.2, 0)) // little lantern
  y += 2.4
  g.add(kit.mesh(new THREE.ConeGeometry(1.1, 3.4, 8), DOME, 0, y + 1.7, 0))
  g.add(kit.box(0.35, 2.2, 0.35, GOLD, 0, y + 3.4, 0)) // cross
  g.add(kit.box(1.3, 0.35, 0.35, GOLD, 0, y + 4.6, 0))
  return wonk(g, seed, 0.035)
}

export function buildCatedralSantiago(kit: Kit): THREE.Group {
  const g = new THREE.Group()

  // ---- Church behind the façade (Latin cross along -Z) ----
  const NAVE_Z = -36, NAVE_L = 64
  g.add(kit.box(30, 14, NAVE_L - 4, GRANITE, 0, 0, NAVE_Z)) // side aisles
  g.add(kit.box(31.4, 1.2, NAVE_L - 3, ROOF, 0, 14, NAVE_Z))
  g.add(kit.box(18, 23, NAVE_L, GRANITE, 0, 0, NAVE_Z)) // nave
  const naveRoof = kit.pediment(19, 7, NAVE_L + 1, ROOF, 23)
  naveRoof.position.z = NAVE_Z
  g.add(naveRoof)
  const TR_Z = -44
  g.add(kit.box(56, 21, 14, GRANITE, 0, 0, TR_Z)) // transept
  const trRoof = kit.pediment(15, 6.5, 57, ROOF, 21)
  trRoof.rotation.y = Math.PI / 2
  trRoof.position.z = TR_Z
  g.add(trRoof)
  for (const side of [-1, 1]) {
    for (let z = -10; z > -64; z -= 7) {
      if (Math.abs(z - TR_Z) < 9) continue
      g.add(kit.slab(0.3, 5, 2.2, GLASS, side * 9.1, 15.5, z)) // tall windows
    }
  }
  // Crossing dome: drum, fat dome, lantern
  const drum = new THREE.CylinderGeometry(6.2, 6.8, 8, 8)
  drum.rotateY(Math.PI / 8)
  g.add(kit.mesh(drum, GRANITE, 0, 25 + 4, TR_Z))
  const crossing = onionDome(kit, 6.4, DOME, GOLD)
  crossing.position.set(0, 33, TR_Z)
  g.add(crossing)
  // Clock tower (Berenguela) by the south arm of the transept
  const clock = new THREE.Group()
  clock.add(kit.taper(9, 9, 8, 8, 32, GRANITE))
  const face = kit.mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.4, 16).rotateX(Math.PI / 2), TRIM, 0, 26, 4.2)
  clock.add(face, kit.box(0.3, 1.8, 0.2, DARK, 0, 26, 4.45), kit.box(1.4, 0.3, 0.2, DARK, 0.6, 26, 4.45))
  clock.add(kit.box(10, 1, 10, TRIM, 0, 32, 0))
  const cs = openStorey(kit, 7, 8.5, 3, 4.4, 1, GRANITE, TRIM, DARK)
  cs.position.y = 33
  clock.add(cs)
  const clockDome = onionDome(kit, 3.8, DOME, GOLD)
  clockDome.position.y = 41.5
  clock.add(clockDome)
  clock.position.set(20, 0, -58)
  g.add(wonk(clock, 3, 0.03))

  // ---- Obradoiro façade ----
  g.add(kit.taper(F_W + 1, 7, F_W - 1, 6, F_H, GRANITE, 0, 0, 0))
  const front = 3.2
  for (const x of [-10, -6.6, 6.6, 10]) g.add(kit.box(1.2, F_H, 1.2, TRIM, x, 0, front)) // fat columns
  // The giant glazed window in a thick gold frame
  g.add(kit.slab(11, 17, 0.3, GLASS, 0, 11, front + 0.2))
  g.add(kit.box(12.6, 1, 1, GOLD, 0, 10.4, front + 0.4), kit.box(12.6, 1, 1, GOLD, 0, 28, front + 0.4))
  for (const x of [-6, 6]) g.add(kit.box(1, 18.6, 1, GOLD, x, 10.4, front + 0.4))
  for (const x of [-2, 2]) g.add(kit.box(0.5, 17, 0.5, TRIM, x, 11, front + 0.5))
  for (const y of [15.3, 19.6, 23.9]) g.add(kit.box(11, 0.5, 0.5, TRIM, 0, y, front + 0.5))
  // Door and, above the window, the scallop shell of the pilgrims
  g.add(kit.slab(4.4, 5.4, 0.3, DARK, 0, 5, front + 0.2))
  g.add(kit.box(6, 0.9, 1, TRIM, 0, 10.2, front + 0.5))
  const shell = scallopShell(kit, 6, GOLD, TRIM)
  shell.position.set(0, 29.5, front + 0.6)
  g.add(shell)
  // Stepped crown with a big St. James on top
  g.add(kit.box(F_W + 2, 1.4, 8, TRIM, 0, F_H, 0))
  g.add(kit.box(14, 6.5, 5.5, GRANITE, 0, F_H + 1.4, 0))
  g.add(kit.box(15.4, 1, 6.2, TRIM, 0, F_H + 7.9, 0))
  g.add(kit.box(8.4, 5, 4.4, GRANITE, 0, F_H + 8.9, 0))
  g.add(kit.pediment(9.6, 3.6, 4.8, TRIM, F_H + 13.9))
  const james = statue(kit, 5.5, TRIM)
  james.position.set(0, F_H + 17.5, 0)
  g.add(james)
  for (const x of [-10.6, -6.6, 6.6, 10.6]) {
    const p = pinnacle(kit, 3.6, TRIM, GOLD)
    p.position.set(x, F_H + 1.4, 2.4)
    g.add(p)
  }

  // ---- Towers ----
  for (const side of [-1, 1]) {
    const t = bellTower(kit, side > 0 ? 11 : 5)
    t.position.x = side * (F_W / 2 + T_W / 2 + 0.4)
    g.add(t)
  }

  // ---- Chunky staircase: a landing in front of the door and big steps down to the square ----
  g.add(kit.box(26, 5, 6, GRANITE_D, 0, 0, front + 3))
  for (let i = 1; i <= 5; i++) g.add(kit.box(26 - i * 0.8, 5 - i, 1.5, GRANITE_D, 0, 0, front + 6 + (i - 0.5) * 1.5))
  const rail = balustrade(kit, 26, 6, 1.4, TRIM)
  rail.position.set(0, 5, front + 3)
  g.add(rail)
  return g
}

/**
 * Obradoiro square: granite paving with a grid of darker joints.
 * w and d: size of the square (model units). Returns the group and the height of its surface.
 */
export function buildCatedralSantiagoBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 0.3
  g.add(kit.box(w + 4, 0.03, d + 4, 0xd9cfb5))
  g.add(kit.box(w, top, d, 0xd3c6a6))
  const step = 6
  for (let x = -w / 2 + step; x < w / 2; x += step) g.add(kit.slab(0.3, 0.05, d, 0xb3a586, x, top, 0))
  for (let z = -d / 2 + step; z < d / 2; z += step) g.add(kit.slab(w, 0.05, 0.3, 0xb3a586, 0, top, z))
  return { group: g, top }
}
