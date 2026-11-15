// Plaza Mayor de Salamanca, cartoon style. Signature features, exaggerated: a closed square of
// golden sandstone buildings around a big paved plaza. Inside: a ground-floor arcade of round
// arches with the round portrait medallions above them, three storeys of windows with black iron
// balconies and a balustrade crown with pinnacles. The City Hall on the north side rises higher,
// with its clock and bell gable; the Royal Pavilion on the east side carries a crowned coat of
// arms. Terracotta roofs. Units are roughly metres.
import * as THREE from 'three'
import type { Kit } from '../kit'
import { balustrade, crownedShield, pinnacle } from '../ornaments'

const STONE = 0xf2c98a // golden Villamayor sandstone
const STONE_D = 0xd6a865 // plinths, cornices
const TRIM = 0xfff0cf
const ROOF = 0xdb6a3a
const IRON = 0x1d2128
const DARK = 0x2b2540
const GOLD = 0xf2c14e
const RED = 0xd23a30
const YELLOW = 0xf6c945

const OUT = 76 // outer size
const WING = 10
const IN = OUT - WING * 2 // size of the plaza
const H = 15
const ARCHES = 10

/** Inner façade of one side, facing +Z at z = -IN / 2 (the north side; rotate for the others). */
function innerSide(kit: Kit) {
  const g = new THREE.Group()
  const z = -IN / 2
  const step = IN / ARCHES
  const xs = Array.from({ length: ARCHES }, (_, i) => -IN / 2 + step * (i + 0.5))
  // Arcade: a plate with round arches, dark behind
  g.add(kit.slab(IN, 4.6, 0.2, DARK, 0, 0, z + 0.1))
  for (const x of xs) g.add(kit.lightPanel(step * 0.55, 2.4, x, 0.9, z + 1.4, 0, 0.75)) // night: the arcade glows
  const arcade = kit.facade(IN, 5.2, 1, xs.map((x) => ({ x, width: step * 0.66, height: 2.7, arch: true })), STONE)
  arcade.position.z = z + 0.7
  g.add(arcade)
  // Portrait medallions over the piers
  for (let i = 0; i <= ARCHES; i++) {
    const x = -IN / 2 + step * i
    g.add(kit.mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.3, 12).rotateX(Math.PI / 2), TRIM, x, 4.6, z + 1.3))
  }
  g.add(kit.box(IN, 0.5, 1.6, STONE_D, 0, 5.2, z + 0.6)) // string course
  // Three storeys of windows with iron balconies
  for (const x of xs) {
    for (const y of [6.6, 9.4, 12.2]) {
      g.add(kit.slab(1.5, 2.1, 0.2, DARK, x, y, z + 0.1))
      g.add(kit.box(2.2, 0.2, 0.9, STONE_D, x, y - 0.2, z + 0.45))
      g.add(kit.slab(2.2, 0.8, 0.1, IRON, x, y, z + 0.85))
    }
  }
  return g
}

/** Plain windows along an outer façade of length `len`, facing +Z at z. */
function outerWindows(kit: Kit, len: number, z: number) {
  const g = new THREE.Group()
  const n = Math.floor(len / 5)
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 5
    for (const y of [6.6, 9.4, 12.2]) g.add(kit.slab(1.4, 2, 0.2, DARK, x, y, z))
    if (Math.abs(x) > 4) g.add(kit.slab(1.6, 2.6, 0.2, DARK, x, 1.2, z))
  }
  g.add(kit.slab(5, 5, 0.2, DARK, 0, 0, z)) // passage into the plaza
  return g
}

export function buildPlazaMayorSalamanca(kit: Kit): THREE.Group {
  const g = new THREE.Group()

  // ---- The plaza floor ----
  const FY = 0.8 // the plaza floor sits on the plinth
  g.add(kit.box(IN, 0.15, IN, 0xe8d6b0, 0, FY, 0))
  for (const k of [-1, 1]) g.add(kit.slab(IN - 4, 0.05, 1.2, 0xc9b08a, 0, FY + 0.15, (k * IN) / 4))
  for (const k of [-1, 1]) g.add(kit.slab(1.2, 0.05, IN - 4, 0xc9b08a, (k * IN) / 4, FY + 0.15, 0))
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      // Street lamps
      g.add(kit.box(0.3, 4, 0.3, IRON, (sx * IN) / 4, FY, (sz * IN) / 4))
      g.add(kit.mesh(new THREE.IcosahedronGeometry(0.5, 1), 0xffe9a8, (sx * IN) / 4, FY + 4.3, (sz * IN) / 4))
      g.add(kit.lightHalo(2.2, (sx * IN) / 4, FY + 4.3, (sz * IN) / 4, 0.8)) // night: the lamps glow
    }
  }

  // ---- The four wings ----
  g.add(kit.box(OUT + 1, FY, OUT + 1, STONE_D)) // plinth (under the floor of the plaza too)
  for (const z of [-(OUT - WING) / 2, (OUT - WING) / 2]) g.add(kit.box(OUT, H, WING, STONE, 0, 0, z))
  for (const x of [-(OUT - WING) / 2, (OUT - WING) / 2]) g.add(kit.box(WING, H, IN, STONE, x, 0, 0))
  for (let k = 0; k < 4; k++) {
    const inner = innerSide(kit)
    inner.rotation.y = (k * Math.PI) / 2
    g.add(inner)
    const outer = outerWindows(kit, OUT - 6, OUT / 2 + 0.05)
    outer.rotation.y = (k * Math.PI) / 2
    g.add(outer)
  }
  // Cornice, balustrade crown along the plaza with pinnacles, terracotta roofs
  g.add(kit.box(OUT + 1, 0.8, OUT + 1, STONE_D, 0, H, 0))
  const crown = balustrade(kit, IN + 0.4, IN + 0.4, 1.4, TRIM)
  crown.position.y = H + 0.8
  g.add(crown)
  for (let i = 0; i <= 4; i++) {
    const t = -IN / 2 - 0.2 + ((IN + 0.4) * i) / 4
    for (const [x, z] of [[t, -IN / 2 - 0.2], [t, IN / 2 + 0.2], [-IN / 2 - 0.2, t], [IN / 2 + 0.2, t]]) {
      const p = pinnacle(kit, 2.6, TRIM, GOLD)
      p.position.set(x, H + 0.8, z)
      g.add(p)
    }
  }
  for (const z of [-(OUT - WING) / 2, (OUT - WING) / 2]) {
    const r = kit.pediment(WING - 1, 3, OUT - 1, ROOF, H + 0.8)
    r.rotation.y = Math.PI / 2
    r.position.z = z
    g.add(r)
  }
  for (const x of [-(OUT - WING) / 2, (OUT - WING) / 2]) {
    const r = kit.pediment(WING - 1, 3, IN, ROOF, H + 0.8)
    r.position.x = x
    g.add(r)
  }

  // ---- City Hall (north side): a higher attic with the clock and the bell gable ----
  const hallZ = -IN / 2
  g.add(kit.box(22, 5, 4, STONE, 0, H + 0.8, hallZ - 2.6))
  g.add(kit.box(23, 0.8, 4.6, STONE_D, 0, H + 5.8, hallZ - 2.6))
  for (const x of [-9, -3, 3, 9]) g.add(kit.box(1, 5, 0.6, TRIM, x, H + 0.8, hallZ - 0.4))
  g.add(kit.mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.4, 16).rotateX(Math.PI / 2), TRIM, 0, H + 3.4, hallZ - 0.4)) // clock
  g.add(kit.box(0.25, 1.3, 0.15, DARK, 0, H + 3.3, hallZ - 0.1))
  g.add(kit.box(1, 0.25, 0.15, DARK, 0.45, H + 3.3, hallZ - 0.1))
  const belfry = kit.facade(10, 5.5, 1.4, [-3, 0, 3].map((x) => ({ x, width: 1.8, height: 2.2, arch: true, bottom: 1.2 })), STONE)
  belfry.position.set(0, H + 6.6, hallZ - 1.6)
  g.add(belfry)
  g.add(kit.lightHalo(2.2, 0, H + 3.4, hallZ + 0.2, 0.7)) // night: clock and bells lit
  for (const x of [-3, 0, 3]) g.add(kit.lightHalo(1.4, x, H + 6.6 + 2.4, hallZ - 0.6, 0.6))
  for (const x of [-3, 0, 3]) g.add(kit.mesh(new THREE.IcosahedronGeometry(0.6, 1), GOLD, x, H + 6.6 + 2.2, hallZ - 1.6))
  g.add(kit.pediment(10.6, 2.4, 1.8, STONE_D, H + 12.1).translateZ(hallZ - 1.6))
  for (const x of [-5, 5]) {
    const p = pinnacle(kit, 2.4, TRIM, GOLD)
    p.position.set(x, H + 12.1, hallZ - 1.6)
    g.add(p)
  }

  // ---- Royal Pavilion (east side): a gable with the crowned coat of arms ----
  const pav = new THREE.Group()
  pav.add(kit.pediment(16, 4, 1.4, STONE, H + 0.8))
  const shield = crownedShield(kit, 3.6, RED, YELLOW, GOLD)
  shield.position.set(0, H + 1.2, 0.7)
  pav.add(shield)
  pav.rotation.y = -Math.PI / 2
  pav.position.x = IN / 2 + 1.6 // just behind the balustrade
  g.add(pav)
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
