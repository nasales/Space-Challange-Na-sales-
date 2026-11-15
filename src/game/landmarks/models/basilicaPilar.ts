// Basílica del Pilar (Zaragoza), cartoon style. Signature features, exaggerated: a long warm
// brick body lying along the Ebro, four tall, slim corner towers with open belfries and spires,
// and its crown of domes covered in glazed tiles: green, with yellow, white and blue ribs, a big
// one in the middle and smaller ones around it. The main door looks onto the Plaza del Pilar
// (+Z). Units are roughly metres.
import * as THREE from 'three'
import { wonk, type Kit } from '../kit'
import { balustrade, onionDome, openStorey, pinnacle } from '../ornaments'

const BRICK = 0xe8b27a // warm pinkish brick
const BRICK_D = 0xc98d5a // plinth, cornices
const TRIM = 0xfff0cf
const TILE = 0x3f9a6b // green glazed tiles
const TILE_COLORS = [0xf2c14e, 0xffffff, 0x3d6fb0] // ribs on the domes
const ROOF = 0xdb6a3a
const DARK = 0x2b2540
const GOLD = 0xf2c14e

const L = 88 // length along X
const D = 42
const H = 22

/** Tiled dome on a short drum: green half sphere with coloured ribs and a little lantern. */
function tiledDome(kit: Kit, r: number, ribs: number) {
  const g = new THREE.Group()
  const drumH = r * 0.6
  g.add(kit.mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.1, drumH, 12), BRICK, 0, drumH / 2, 0))
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3
    const w = kit.slab(r * 0.3, drumH * 0.55, 0.2, DARK, Math.sin(a) * r * 1.07, drumH * 0.2, Math.cos(a) * r * 1.07)
    w.rotation.y = a
    g.add(w)
  }
  g.add(kit.mesh(new THREE.CylinderGeometry(r * 1.15, r * 1.15, r * 0.12, 12), TRIM, 0, drumH, 0))
  const y = drumH + r * 0.12
  g.add(kit.mesh(new THREE.SphereGeometry(r, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), TILE, 0, y, 0))
  for (let k = 0; k < ribs; k++) {
    const rib = new THREE.TorusGeometry(r * 1.01, r * 0.06, 4, 14, Math.PI)
    rib.rotateY((k * Math.PI) / ribs)
    g.add(kit.mesh(rib, TILE_COLORS[k % TILE_COLORS.length], 0, y, 0))
  }
  g.add(kit.mesh(new THREE.CylinderGeometry(r * 0.22, r * 0.26, r * 0.45, 8), TRIM, 0, y + r + r * 0.2, 0)) // lantern
  const tip = onionDome(kit, r * 0.2, TILE, GOLD)
  tip.position.y = y + r * 1.42
  g.add(tip)
  return g
}

/** Corner tower: tall square shaft, two open belfries, a tiled cupola and a spire with a cross. */
function tower(kit: Kit, seed: number) {
  const g = new THREE.Group()
  const W = 7.5, TH = 44
  g.add(kit.taper(W + 1, W + 1, W, W, TH, BRICK))
  for (const x of [-W / 2, W / 2]) for (const z of [-W / 2, W / 2]) g.add(kit.box(1, TH, 1, TRIM, x, 0, z))
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Group()
    for (const y of [26, 34]) face.add(kit.slab(1.6, 3, 0.3, DARK, 0, y, (W + 1 - y / TH) / 2 + 0.1))
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  let y = TH
  g.add(kit.box(W + 2, 1, W + 2, TRIM, 0, y, 0))
  y += 1
  const rail = balustrade(kit, W + 1, W + 1, 1.2, TRIM)
  rail.position.y = y
  g.add(rail)
  const s1 = openStorey(kit, 6.2, 7, 2.8, 3.8, 1, BRICK, TRIM, DARK)
  s1.position.y = y
  g.add(s1)
  y += 7
  g.add(kit.box(7.4, 0.9, 7.4, TRIM, 0, y, 0))
  y += 0.9
  const s2 = openStorey(kit, 4.6, 5, 2, 2.8, 0.8, BRICK, TRIM, DARK)
  s2.position.y = y
  g.add(s2)
  y += 5
  g.add(kit.box(5.6, 0.8, 5.6, TRIM, 0, y, 0))
  y += 0.8
  const cup = onionDome(kit, 2.4, TILE, TILE_COLORS[0])
  cup.position.y = y
  g.add(cup)
  y += 2.4 * 1.5
  g.add(kit.mesh(new THREE.ConeGeometry(0.7, 3.4, 8), TILE, 0, y + 1.7, 0))
  g.add(kit.box(0.3, 2, 0.3, GOLD, 0, y + 3.4, 0)) // cross
  g.add(kit.box(1.2, 0.3, 0.3, GOLD, 0, y + 4.6, 0))
  return wonk(g, seed, 0.03)
}

export function buildBasilicaPilar(kit: Kit): THREE.Group {
  const g = new THREE.Group()

  // ---- Body ----
  g.add(kit.box(L + 1.4, 1.4, D + 1.4, BRICK_D)) // plinth
  g.add(kit.box(L, H, D, BRICK))
  g.add(kit.box(L + 1.6, 1.2, D + 1.6, TRIM, 0, H, 0)) // cornice
  g.add(kit.box(L - 2, 1.4, D - 2, ROOF, 0, H + 1.2, 0)) // flat tiled roof
  // Pilasters and two rows of windows on the long sides, small windows on the short sides
  for (const side of [-1, 1]) {
    const z = side * (D / 2 + 0.2)
    for (let x = -L / 2 + 6; x <= L / 2 - 6 + 1e-6; x += 6.33) {
      g.add(kit.box(1, H, 0.6, TRIM, x, 0, z))
      for (const y of [6, 14]) g.add(kit.slab(1.8, 3.6, 0.3, DARK, x + 3.17, y, z))
    }
    for (let zz = -D / 2 + 7; zz < D / 2 - 5; zz += 7) g.add(kit.slab(0.3, 3.6, 1.8, DARK, side * (L / 2 + 0.2), 14, zz))
  }
  // Main door on the square: a tall stone portal with a pediment and the Virgin's niche
  const portal = new THREE.Group()
  portal.add(kit.box(12, 16, 1.6, TRIM))
  portal.add(kit.slab(5, 8, 0.3, DARK, 0, 0, 0.85))
  portal.add(kit.slab(2.4, 3.4, 0.3, DARK, 0, 10.2, 0.85))
  portal.add(kit.mesh(new THREE.IcosahedronGeometry(0.8, 1), GOLD, 0, 11.6, 1.1)) // the Virgin on her pillar
  portal.add(kit.box(0.6, 1.6, 0.6, GOLD, 0, 10.2, 1.1))
  const ped = kit.pediment(13, 3, 2, TRIM, 16)
  portal.add(ped)
  portal.position.z = D / 2 + 0.6
  g.add(portal)

  // ---- Domes on the roof: the big central one, two medium and eight small ----
  const roofY = H + 2.6
  const big = tiledDome(kit, 9, 8)
  big.position.y = roofY
  g.add(big)
  for (const x of [-22, 22]) {
    const m = tiledDome(kit, 6.2, 6)
    m.position.set(x, roofY, 0)
    g.add(m)
  }
  for (const x of [-34, -11, 11, 34]) {
    for (const z of [-12, 12]) {
      const s = tiledDome(kit, 4, 4)
      s.position.set(x, roofY, z)
      g.add(s)
    }
  }
  // Pinnacles along the cornice
  for (let x = -L / 2 + 8; x <= L / 2 - 8 + 1e-6; x += 12) {
    for (const z of [-D / 2, D / 2]) {
      const p = pinnacle(kit, 2.6, TRIM, GOLD)
      p.position.set(x, H + 1.2, z)
      g.add(p)
    }
  }

  // ---- Corner towers ----
  let seed = 3
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const t = tower(kit, seed++)
      t.position.set(sx * (L / 2 + 1), 0, sz * (D / 2 + 1))
      g.add(t)
    }
  }
  return g
}

/**
 * Plaza del Pilar: wide pale paving with a darker border.
 * w and d: size of the square (model units). Returns the group and the height of its surface.
 */
export function buildBasilicaPilarBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 0.3
  g.add(kit.box(w + 4, 0.03, d + 4, 0xece0c6))
  g.add(kit.box(w, top, d, 0xe4d3b2))
  g.add(kit.slab(w - 3, 0.05, 0.6, 0xc9b38c, 0, top, d / 2 - 1.5))
  g.add(kit.slab(w - 3, 0.05, 0.6, 0xc9b38c, 0, top, -d / 2 + 1.5))
  return { group: g, top }
}
