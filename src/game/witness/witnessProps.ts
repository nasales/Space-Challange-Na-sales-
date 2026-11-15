// Small game-side extras for some witnesses, keyed by case id (src/shared/witness.ts only has
// the look): how an apron is worn, and a little prop next to the witness that tells his trade.
//   - Pilar (Madrid, newspaper kiosk owner): a green newspaper kiosk at her side, and a shop apron.
//     (Behind her it left only high dialogue views on the narrow plaza by the Puerta de Alcala fence.)
//   - Rafael (Cordoba, olive farmer): crates of olives at his side.
// Props are simple toon boxes, like the rest of the map (no external assets). The detective cannot
// walk through them (see blocks), and the dialogue camera ray-casts them (see createWitnesses.props).
//
//   const prop = createWitnessProp('kiosk')
//   prop.group.position.set(x, y, z); prop.group.rotation.y = heading   // its front looks towards -Z
import * as THREE from 'three'
import { toonMaterial } from '../scene/toonGradient'
import type { WitnessStyle } from './createWitness'

export type WitnessPropKind = 'kiosk' | 'olive-crates'

export interface WitnessExtras {
  style?: WitnessStyle
  prop?: {
    kind: WitnessPropKind
    /** Where it stands, from the witness: 'behind' (his back) or 'side' (his right hand side) */
    place: 'behind' | 'side'
  }
}

export const WITNESS_EXTRAS: Partial<Record<string, WitnessExtras>> = {
  filomena_madrid: { style: { apron: 'bib' }, prop: { kind: 'kiosk', place: 'side' } },
  cordoba_heat: { prop: { kind: 'olive-crates', place: 'side' } },
}

/** Metres to world units for the props: a bit smaller than true scale, like the toy houses. */
const S = 4.5
const SHADOW = 0.55

/**
 * Footprint of each prop (world units): half width (x), half depth (z), and the gap kept between
 * the witness and the prop's nearest side.
 */
export const PROP_SIZE: Record<WitnessPropKind, { halfW: number; halfD: number; gap: number }> = {
  kiosk: { halfW: 1.25 * S, halfD: 0.95 * S, gap: 2.5 },
  'olive-crates': { halfW: 0.75 * S, halfD: 0.3 * S, gap: 2.5 },
}

export function createWitnessProp(kind: WitnessPropKind) {
  const group = new THREE.Group()
  group.name = `witness-prop-${kind}`
  const materials = new Map<number, THREE.Material>()
  const geometries: THREE.BufferGeometry[] = []
  const mat = (color: number) => {
    if (!materials.has(color)) materials.set(color, toonMaterial(color, {}, SHADOW))
    return materials.get(color)!
  }
  /** Box in metres (size and centre), in the prop's own frame (front towards -Z). */
  const box = (w: number, h: number, d: number, color: number, x: number, y: number, z: number, parent: THREE.Object3D = group) => {
    const g = new THREE.BoxGeometry(w * S, h * S, d * S)
    geometries.push(g)
    const m = new THREE.Mesh(g, mat(color))
    m.position.set(x * S, y * S, z * S)
    m.castShadow = true
    m.receiveShadow = true
    parent.add(m)
    return m
  }

  if (kind === 'kiosk') {
    // Madrid newspaper kiosk: green metal box, open front with a counter of newspapers, magazines
    // in the window and all round the outside (it reads from any side the dialogue camera picks),
    // a yellow sign band on all four sides and a wide flat roof
    const GREEN = 0x3d8a5a, DARK_GREEN = 0x2c6a45, INSIDE = 0x3a3350, WOOD = 0x9a6a3c, SIGN = 0xf2c230
    box(2.5, 0.12, 1.9, DARK_GREEN, 0, 0.06, 0) // plinth
    box(2.4, 1.05, 1.8, GREEN, 0, 0.6, 0) // lower body
    box(2.2, 1.05, 0.06, INSIDE, 0, 1.65, -0.68) // dark inside, seen through the window
    for (const side of [-1, 1]) box(0.14, 1.1, 1.8, GREEN, side * 1.13, 1.65, 0) // window posts
    box(2.4, 1.1, 0.14, GREEN, 0, 1.65, 0.83) // back wall
    box(2.6, 0.08, 0.5, WOOD, 0, 1.12, -0.98) // counter
    box(2.4, 0.4, 1.8, GREEN, 0, 2.4, 0) // sign band
    for (const side of [-1, 1]) {
      box(1.9, 0.26, 0.03, SIGN, 0, 2.4, side * 0.915) // signs, front and back
      box(0.03, 0.26, 1.4, SIGN, side * 1.215, 2.4, 0) // and on the sides
    }
    box(2.9, 0.12, 2.3, DARK_GREEN, 0, 2.66, 0) // roof
    box(1.6, 0.1, 1.2, DARK_GREEN, 0, 2.77, 0)
    // Newspapers on the counter: folded stacks, light paper with a coloured masthead
    const papers = [0xf4efe2, 0xe9e4d4, 0xf7f2e6, 0xece6d6]
    const heads = [0xc8402f, 0x2f5fa8, 0x2b2540, 0xd98a2b]
    for (let i = 0; i < 4; i++) {
      const x = -0.9 + i * 0.6
      box(0.44, 0.08 + (i % 2) * 0.04, 0.32, papers[i], x, 1.2 + (i % 2) * 0.02, -1.0)
      box(0.44, 0.012, 0.1, heads[i], x, 1.25 + (i % 2) * 0.04, -1.11)
    }
    // Magazines in the window and on both sides
    const covers = [0xe5484d, 0x3fa7d6, 0xf2c230, 0x7bc96f, 0xb76fd6, 0xff8c42]
    for (let i = 0; i < 6; i++) box(0.28, 0.36, 0.02, covers[i], -0.85 + i * 0.34, 1.9, -0.72)
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const m = box(0.02, 0.34, 0.26, covers[(i + (side > 0 ? 3 : 0)) % covers.length], side * 1.21, 1.85 - (i % 2) * 0.4, -0.6 + i * 0.4)
        m.castShadow = false
      }
    }
    for (let i = 0; i < 6; i++) {
      const m = box(0.28, 0.36, 0.02, covers[(i + 2) % covers.length], -0.85 + i * 0.34, 1.75 + (i % 2) * 0.12, 0.91) // back
      m.castShadow = false
    }
  } else {
    // Olive harvest crates: two stacked wooden crates and one on the ground, full of green and
    // black olives (small balls on top)
    const WOOD = 0xb0773f, SLAT = 0x8a5a2e
    const OLIVES = [0x5f7a2a, 0x6f8c34, 0x3b2f3f, 0x4a3a4a]
    const olive = new THREE.IcosahedronGeometry(0.045 * S, 0)
    geometries.push(olive)
    const crate = (x: number, y: number, z: number, turn: number, fill: number) => {
      const c = new THREE.Group()
      c.position.set(x * S, y * S, z * S)
      c.rotation.y = turn
      group.add(c)
      box(0.56, 0.04, 0.38, SLAT, 0, 0.02, 0, c) // bottom
      for (const side of [-1, 1]) {
        box(0.56, 0.1, 0.03, WOOD, 0, 0.08, side * 0.175, c)
        box(0.56, 0.1, 0.03, WOOD, 0, 0.22, side * 0.175, c)
        box(0.03, 0.3, 0.38, SLAT, side * 0.265, 0.15, 0, c)
      }
      box(0.5, 0.06, 0.32, OLIVES[fill], 0, 0.24, 0, c) // the pile under the top olives
      for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(olive, mat(OLIVES[(i + fill) % OLIVES.length]))
        m.position.set(((i % 5) - 2) * 0.1 * S, 0.285 * S, ((Math.floor(i / 5) - 0.5) * 0.14 + ((i * 7) % 3 - 1) * 0.02) * S)
        c.add(m)
      }
    }
    crate(-0.38, 0, 0, 0.05, 0)
    crate(-0.36, 0.3, 0.01, -0.08, 2)
    crate(0.36, 0, 0.02, -0.12, 1)
  }

  return {
    group,
    dispose() {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
    },
  }
}
