// Alcázar de Toledo, cartoon style. Signature features, exaggerated: a massive square block of
// warm limestone around an arcaded courtyard (two storeys of round arches, with the statue of
// Charles V in the middle), four square corner towers crowned by dark slate pyramidal spires
// (Herrerian style), regular rows of windows on every façade and, on the main façade, a central
// portal with the imperial coat of arms. It crowns the hill of Toledo: a terraced rocky base.
// The main façade faces +Z (the real one faces north: heading 180). Units are model units.
import * as THREE from 'three'
import { wonk, type Kit } from '../kit'
import { crownedShield, statue } from '../ornaments'

const STONE = 0xe9cf9b // warm limestone
const STONE_D = 0xc9a874 // cornices, sills, portal frame
const GRANITE = 0xa9a08f // plinth course
const SLATE = 0x3d4a63 // dark blue-grey slate
const DARK = 0x2b2540 // window and door openings
const GOLD = 0xf2c14e
const RED = 0xd23a30
const YELLOW = 0xf6c945
const BRONZE = 0x56685c
const PAVE = 0xe4d3ad
const ROCK = 0xa39a86
const ROCK_D = 0x8e8573
const SCRUB = 0xb5bf62 // dry Toledo grass

const OUT = 44 // outer size of the block
const WING = 9
const IN = OUT - WING * 2 // size of the courtyard
const H = 16 // height of the wings
const FY = 1.2 // plinth / courtyard floor height
const TOWER = 10
const TOWER_H = 22
const CORNER = OUT / 2 - 1 // tower centres: they stick out of the block on both sides
const SPIRE_H = 11
const WIN_YS = [4.2, 8.2, 12.2] // window storeys

/** Windows along an outer façade between the towers, facing +Z at z = OUT / 2; `portal` leaves the middle free. */
function outerFacade(kit: Kit, portal: boolean, lit: number[]) {
  const g = new THREE.Group()
  const z = OUT / 2
  const n = 7
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 4
    if (portal && Math.abs(x) < 3) continue
    for (const [row, y] of WIN_YS.entries()) {
      g.add(kit.slab(1.5, 2.3, 0.2, DARK, x, y, z + 0.02))
      g.add(kit.box(2.2, 0.35, 0.7, STONE_D, x, y - 0.35, z + 0.2)) // sill
      if (lit.includes(i * 3 + row)) g.add(kit.lightPanel(1.2, 1.9, x, y + 0.2, z + 0.2))
    }
  }
  g.add(kit.lightHalo(14, 0, 9, z + 5, 0.35)) // night: soft floodlight on the façade
  return g
}

/** Main portal on the +Z façade: arched door in a stone frame, coat of arms and a small pediment. */
function portal(kit: Kit) {
  const g = new THREE.Group()
  const z = OUT / 2
  g.add(kit.slab(3.6, 6, 0.2, DARK, 0, FY, z + 0.02))
  const frame = kit.facade(8, 9.5, 1.2, [{ x: 0, width: 3.6, height: 4.2, arch: true }], STONE_D)
  frame.position.set(0, FY, z + 0.6)
  g.add(frame)
  for (const x of [-3.2, 3.2]) g.add(kit.box(1, 9.5, 1.6, STONE, x, FY, z + 0.8)) // pilasters
  const shield = crownedShield(kit, 3.2, RED, YELLOW, GOLD)
  shield.position.set(0, FY + 6, z + 1.2)
  g.add(shield)
  g.add(kit.pediment(9, 2.2, 1.6, STONE_D, FY + 9.5).translateZ(z + 0.8))
  g.add(kit.lightPanel(3.2, 5, 0, FY, z + 1.3)) // night: lit doorway
  g.add(kit.lightHalo(3, 0, FY + 2.5, z + 3, 0.8))
  return g
}

/** Two-storey arcade of the courtyard, facing +Z at z = -IN / 2 (rotate for the other sides). */
function courtyardSide(kit: Kit, width: number) {
  const g = new THREE.Group()
  const z = -IN / 2
  const n = 5
  const step = width / n
  const xs = Array.from({ length: n }, (_, i) => -width / 2 + step * (i + 0.5))
  g.add(kit.slab(width, 8.8, 0.2, DARK, 0, FY, z + 0.1)) // shade behind the arches
  const arcade = kit.facade(
    width,
    9.4,
    1,
    [
      ...xs.map((x) => ({ x, width: step * 0.62, height: 2.6 })),
      ...xs.map((x) => ({ x, width: step * 0.5, height: 1.8, bottom: 5.4 })),
    ].map((o) => ({ ...o, arch: true })),
    STONE,
  )
  arcade.position.set(0, FY, z + 0.7)
  g.add(arcade)
  g.add(kit.box(width, 0.5, 1.5, STONE_D, 0, FY + 4.7, z + 0.75)) // string course between storeys
  g.add(kit.box(width, 0.6, 1.6, STONE_D, 0, FY + 9.4, z + 0.8)) // gallery cornice
  for (const x of xs) g.add(kit.slab(1.3, 2, 0.2, DARK, x, 12, z + 0.02)) // top-floor windows on the wing wall
  g.add(kit.lightPanel(width * 0.8, 2.6, 0, FY + 0.4, z + 1.3, 0, 0.6)) // night: lamps in the gallery
  return g
}

/** Square corner tower with windows on its outer faces, cornice and slate pyramidal spire; base at y = 0. */
function cornerTower(kit: Kit, outX: number, outZ: number, seed: number) {
  const g = new THREE.Group()
  g.add(kit.box(TOWER + 0.8, FY, TOWER + 0.8, GRANITE))
  g.add(kit.box(TOWER, TOWER_H, TOWER, STONE))
  g.add(kit.box(TOWER + 0.6, 0.6, TOWER + 0.6, STONE_D, 0, H, 0)) // string course at the wing cornice
  g.add(kit.box(TOWER + 1.2, 1, TOWER + 1.2, STONE_D, 0, TOWER_H, 0)) // cornice
  // Windows on the two outer faces (rotY makes the face group's +Z point outwards)
  for (const rotY of [outZ > 0 ? 0 : Math.PI, outX > 0 ? Math.PI / 2 : -Math.PI / 2]) {
    const face = new THREE.Group()
    for (const x of [-2.2, 2.2]) {
      for (const y of [...WIN_YS, 17.6]) {
        face.add(kit.slab(1.3, 2.1, 0.2, DARK, x, y, TOWER / 2 + 0.02))
        face.add(kit.box(1.9, 0.3, 0.6, STONE_D, x, y - 0.3, TOWER / 2 + 0.15))
      }
    }
    face.add(kit.lightPanel(1.1, 1.8, outX * outZ > 0 ? 2.2 : -2.2, 17.8, TOWER / 2 + 0.2))
    face.rotation.y = rotY
    g.add(face)
  }
  // Slate spire: a four-sided pyramid with a dormer on each face, a needle and a gilded ball
  const spire = new THREE.Group()
  const side = TOWER + 0.4
  const pyramid = new THREE.ConeGeometry(side / Math.SQRT2, SPIRE_H, 4)
  pyramid.rotateY(Math.PI / 4) // faces aligned with the tower walls
  spire.add(kit.mesh(pyramid, SLATE, 0, SPIRE_H / 2, 0))
  for (let k = 0; k < 4; k++) {
    const dormer = new THREE.Group()
    dormer.add(kit.box(1.8, 2, 1.6, SLATE, 0, 0, 0))
    dormer.add(kit.slab(1, 1.2, 0.2, DARK, 0, 0.3, 0.75))
    dormer.add(kit.pediment(2.1, 1, 1.8, SLATE, 2))
    dormer.position.set(0, SPIRE_H * 0.2, side / 2 - 1.7) // its front meets the slope
    const holder = new THREE.Group()
    holder.add(dormer)
    holder.rotation.y = (k * Math.PI) / 2
    spire.add(holder)
  }
  spire.add(kit.mesh(new THREE.CylinderGeometry(0.15, 0.3, 3.4, 6), SLATE, 0, SPIRE_H + 1.4, 0))
  spire.add(kit.mesh(new THREE.IcosahedronGeometry(0.6, 1), GOLD, 0, SPIRE_H + 1.6, 0))
  spire.add(kit.box(0.15, 1.6, 1.2, SLATE, 0, SPIRE_H + 2.6, 0)) // weather vane
  spire.position.y = TOWER_H + 1
  g.add(wonk(spire, seed, 0.03))
  g.add(kit.lightHalo(4, outX * 6, TOWER_H + 1.5, outZ * 6, 0.5)) // night: glow on the outer corner of the cornice
  g.position.set(outX * CORNER, 0, outZ * CORNER)
  return g
}

export function buildAlcazarToledo(kit: Kit): THREE.Group {
  const g = new THREE.Group()

  // ---- Plinth and courtyard floor ----
  g.add(kit.box(OUT + 1.2, FY, OUT + 1.2, GRANITE))
  g.add(kit.box(IN, 0.15, IN, PAVE, 0, FY, 0))
  for (const k of [-1, 1]) g.add(kit.slab(IN - 4, 0.05, 1.2, STONE_D, 0, FY + 0.15, (k * IN) / 4))
  for (const k of [-1, 1]) g.add(kit.slab(1.2, 0.05, IN - 4, STONE_D, (k * IN) / 4, FY + 0.15, 0))

  // ---- The four wings, cornice and low slate roofs ----
  for (const z of [-(OUT - WING) / 2, (OUT - WING) / 2]) {
    g.add(kit.box(OUT, H, WING, STONE, 0, 0, z))
    g.add(kit.box(OUT + 1, 0.9, WING + 1, STONE_D, 0, H, z))
    const roof = kit.pediment(WING, 2.6, OUT - 2, SLATE, H + 0.9)
    roof.rotation.y = Math.PI / 2
    roof.position.z = z
    g.add(roof)
  }
  for (const x of [-(OUT - WING) / 2, (OUT - WING) / 2]) {
    g.add(kit.box(WING, H, IN, STONE, x, 0, 0))
    g.add(kit.box(WING + 1, 0.9, IN, STONE_D, x, H, 0))
    const roof = kit.pediment(WING, 2.6, IN, SLATE, H + 0.9)
    roof.position.x = x
    g.add(roof)
  }

  // ---- Façades: windows outside, arcades inside; the portal on the main (+Z) façade ----
  const litWindows = [[2, 7, 16], [4, 13], [1, 9, 20], [6, 14]]
  for (let k = 0; k < 4; k++) {
    const outer = outerFacade(kit, k === 0, litWindows[k])
    outer.rotation.y = (k * Math.PI) / 2
    g.add(outer)
    // Sides on ±X fit between the ±Z arcades (no overlapping faces at the corners)
    const inner = courtyardSide(kit, k % 2 === 0 ? IN : IN - 2.6)
    inner.rotation.y = (k * Math.PI) / 2
    g.add(inner)
  }
  g.add(portal(kit))

  // ---- Corner towers with slate spires ----
  let seed = 5
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cornerTower(kit, sx, sz, seed++))

  // ---- Statue of Charles V in the middle of the courtyard ----
  g.add(kit.box(3, 2, 3, STONE_D, 0, FY + 0.15, 0))
  const emperor = statue(kit, 4, BRONZE)
  emperor.position.y = FY + 2.15
  g.add(emperor)
  g.add(kit.lightHalo(4, 0, FY + 4, 0, 0.6))
  return g
}

/**
 * The hill of Toledo: a rocky mound with a dry-grass rim, crowned by a stone esplanade with
 * battered retaining walls where the Alcázar stands, and a few boulders on the slope.
 * w and d: size of the base (model units). Needs margin >= 4 so the esplanade holds the block.
 */
export function buildAlcazarToledoBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 4.6
  g.add(kit.taper(w, d, w - 3, d - 3, 2, ROCK)) // natural hill
  g.add(kit.box(w - 3.4, 0.4, d - 3.4, SCRUB, 0, 1.8, 0))
  g.add(kit.taper(w - 5, d - 5, w - 6.4, d - 6.4, 2.2, STONE_D, 0, 2, 0)) // battered esplanade walls
  g.add(kit.box(w - 6.4, 0.4, d - 6.4, PAVE, 0, top - 0.4, 0))
  // Steps up the front (+Z) side to the esplanade
  for (let i = 0; i < 3; i++) g.add(kit.box(7, top - 0.55 * (i + 1), 1, GRANITE, 0, 0, (d - 6.4) / 2 + 0.5 + i))
  for (let i = 0; i < 9; i++) {
    const a = i * 0.71 + 0.4
    if (Math.abs(Math.cos(a)) < 0.25 && Math.sin(a) > 0) continue // keep the steps clear
    const size = 1 + (i % 3) * 0.4
    g.add(kit.mesh(new THREE.IcosahedronGeometry(size, 0), ROCK_D, Math.cos(a) * (w / 2 - size - 0.3), 1.2, Math.sin(a) * (d / 2 - size - 0.3)))
  }
  return { group: g, top }
}
