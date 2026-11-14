// Alcázar de Toledo, cartoon style. Signature features, exaggerated: a massive square fortress
// of sandy stone with rows of windows, four square corner towers each crowned by a tall, pointed
// slate spire with a golden finial, a Renaissance portal with the imperial coat of arms on the
// front (+Z), and an arcaded courtyard with the statue of Charles V. It stands on a rocky
// terrace, as on the hilltop of Toledo. Units are roughly metres.
import * as THREE from 'three'
import type { Kit } from '../kit'
import { crownedShield, statue } from '../ornaments'

const STONE = 0xe9c98f // sandy stone
const STONE_D = 0xc9a265 // plinth, cornices, quoins
const TRIM = 0xfff0cf
const SLATE = 0x56657c // spires and roofs
const DARK = 0x2b2540
const GOLD = 0xf2c14e
const RED = 0xd23a30
const YELLOW = 0xf6c945

const S = 58 // outer size of the square block
const WING = 12 // depth of each wing
const H = 20
const T = 13 // corner towers
const TH = 27

/** Rows of dark windows along a façade of length `len`, facing +Z at z, with stone sills. */
function windowRows(kit: Kit, len: number, z: number, rows: number[], skip = 0) {
  const g = new THREE.Group()
  const n = Math.max(1, Math.floor((len - 2) / 4))
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 4 // centred on the façade
    if (Math.abs(x) < skip) continue
    for (const y of rows) {
      g.add(kit.slab(1.6, 2.6, 0.3, DARK, x, y, z))
      g.add(kit.box(2.2, 0.4, 0.6, TRIM, x, y - 0.4, z))
    }
  }
  return g
}

/** Corner tower: square block, fat cornice and a tall pointed slate spire with a lantern. */
function tower(kit: Kit) {
  const g = new THREE.Group()
  g.add(kit.box(T, TH, T, STONE))
  for (const x of [-T / 2, T / 2]) for (const z of [-T / 2, T / 2]) g.add(kit.box(1.2, TH, 1.2, STONE_D, x, 0, z)) // quoins
  for (let k = 0; k < 4; k++) {
    const face = windowRows(kit, T, T / 2 + 0.15, [21.5])
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  g.add(kit.box(T + 1.6, 1.2, T + 1.6, STONE_D, 0, TH, 0))
  // Square pyramid (four segments turned 45 degrees: faces toward the axes)
  const spire = new THREE.ConeGeometry((T + 0.6) * Math.SQRT1_2, 13, 4)
  spire.rotateY(Math.PI / 4)
  g.add(kit.mesh(spire, SLATE, 0, TH + 1.2 + 6.5, 0))
  // Little lantern half way up and a thin needle with a golden ball
  g.add(kit.box(2.4, 2, 2.4, SLATE, 0, TH + 1.2 + 9, 0))
  g.add(kit.mesh(new THREE.ConeGeometry(0.9, 4.5, 4).rotateY(Math.PI / 4), SLATE, 0, TH + 1.2 + 13 + 2.2, 0))
  g.add(kit.mesh(new THREE.IcosahedronGeometry(0.7, 1), GOLD, 0, TH + 1.2 + 17.8, 0))
  g.add(kit.box(0.25, 1.6, 0.25, GOLD, 0, TH + 1.2 + 18.2, 0))
  return g
}

export function buildAlcazarToledo(kit: Kit): THREE.Group {
  const g = new THREE.Group()
  const inner = S - WING * 2

  // ---- Four wings around the courtyard ----
  g.add(kit.box(S + 1.6, 1.6, S + 1.6, STONE_D)) // plinth
  for (const z of [-(S - WING) / 2, (S - WING) / 2]) g.add(kit.box(S, H, WING, STONE, 0, 0, z))
  for (const x of [-(S - WING) / 2, (S - WING) / 2]) g.add(kit.box(WING, H, inner, STONE, x, 0, 0))
  g.add(kit.box(inner, 0.3, inner, 0xe2cb9f)) // courtyard floor
  // Slate roofs: ridged along each wing
  for (const z of [-(S - WING) / 2, (S - WING) / 2]) {
    const r = kit.pediment(WING + 1, 4, S, SLATE, H)
    r.rotation.y = Math.PI / 2
    r.position.z = z
    g.add(r)
  }
  for (const x of [-(S - WING) / 2, (S - WING) / 2]) {
    const r = kit.pediment(WING + 1, 4, inner, SLATE, H)
    r.position.x = x
    g.add(r)
  }
  g.add(kit.box(S + 1, 1, S + 1, STONE_D, 0, H - 1, 0)) // cornice under the roofs (outside)

  // ---- Windows on the four outer faces (the front leaves room for the portal) ----
  for (let k = 0; k < 4; k++) {
    const face = windowRows(kit, S - T * 2, S / 2 + 0.15, [4.5, 10, 15.5], k === 0 ? 6 : 0)
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }

  // ---- Portal with the imperial coat of arms ----
  const front = S / 2
  g.add(kit.box(10, 17, 1.4, TRIM, 0, 0, front + 0.5))
  g.add(kit.slab(4, 6, 0.3, DARK, 0, 1.6, front + 1.25))
  g.add(kit.mesh(new THREE.CylinderGeometry(2, 2, 0.3, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), DARK, 0, 7.6, front + 1.25))
  for (const x of [-3.6, 3.6]) g.add(kit.box(1, 11, 1, STONE_D, x, 1.6, front + 1.3))
  const shield = crownedShield(kit, 4.6, RED, YELLOW, GOLD)
  shield.position.set(0, 11, front + 1.2)
  g.add(shield)

  // ---- Courtyard: two storeys of arcades on all four sides, Charles V in the middle ----
  for (let k = 0; k < 4; k++) {
    const side = new THREE.Group()
    const n = 6
    const step = inner / n
    const opening = (height: number, bottom: number) =>
      Array.from({ length: n }, (_, i) => ({ x: -inner / 2 + step * (i + 0.5), width: step * 0.62, height, arch: true, bottom }))
    const lower = kit.facade(inner, 8.5, 0.8, opening(4.2, 0), TRIM)
    lower.position.z = inner / 2 - 2
    const upper = kit.facade(inner, 7.5, 0.8, opening(3.6, 0.8), TRIM)
    upper.position.set(0, 8.5, inner / 2 - 2)
    side.add(lower, upper)
    side.add(kit.slab(inner, 16, 0.2, DARK, 0, 0, inner / 2 - 0.2)) // shadow behind the arches
    side.rotation.y = (k * Math.PI) / 2
    g.add(side)
  }
  g.add(kit.box(4, 2, 4, STONE_D, 0, 0.3, 0))
  const emperor = statue(kit, 5, 0x6f7f8f)
  emperor.position.y = 2.3
  g.add(emperor)

  // ---- Corner towers ----
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const t = tower(kit)
      t.position.set(sx * (S / 2 - T / 2 + 1.5), 0, sz * (S / 2 - T / 2 + 1.5))
      g.add(t)
    }
  }
  return g
}

/**
 * Rocky terrace: a stone hill with a paved top and a ramp of steps up to the portal.
 * w and d: size of the base (model units). Returns the group and the height of its surface.
 */
export function buildAlcazarToledoBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 2.4
  g.add(kit.taper(w, d, w - 3, d - 3, top - 0.3, 0xb5a283))
  g.add(kit.box(w - 3, 0.3, d - 3, 0xe2cb9f, 0, top - 0.3, 0))
  for (let i = 0; i < 4; i++) g.add(kit.box(10, top - i * 0.6, 0.4, 0xd3c6a6, 0, 0, d / 2 - 1.4 + i * 0.4)) // steps down the slope
  return { group: g, top }
}
