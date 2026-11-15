// Small game-side extras for some witnesses, keyed by case id (src/shared/witness.ts only has
// the look): how an apron is worn, and a little prop next to the witness that tells his trade.
//   - Pilar (Madrid, newspaper kiosk owner): a green newspaper kiosk at her side, and a shop apron.
//     (Behind her it left only high dialogue views on the narrow plaza by the Puerta de Alcala fence.)
//   - Rafael (Cordoba, olive farmer): crates of olives at his side.
//   - Jordi (Aneto, mountain hut keeper): a wooden trail signpost and a rucksack with an ice axe
//     leaning on a rock.
//   - Carmen (Donana, birdwatching guide): a spotting telescope on a tripod and a little wooden
//     board with a flamingo painted on it.
// Props are simple toon boxes, like the rest of the map (no external assets). The detective cannot
// walk through them (see blocks), and the dialogue camera ray-casts them (see createWitnesses.props).
//
//   const prop = createWitnessProp('kiosk')
//   prop.group.position.set(x, y, z); prop.group.rotation.y = heading   // its front looks towards -Z
import * as THREE from 'three'
import { toonMaterial } from '../scene/toonGradient'
import type { WitnessStyle } from './createWitness'

export type WitnessPropKind = 'kiosk' | 'olive-crates' | 'trail-sign' | 'bird-scope'

export interface WitnessExtras {
  style?: WitnessStyle
  prop?: {
    kind: WitnessPropKind
    /** Where it stands, from the witness: 'behind' (his back) or 'side' (his right hand side) */
    place: 'behind' | 'side'
    /**
     * Show it in the dialogue: the detective stands across from it, so the camera frames it beside
     * the witness (low props only, under ~1.5 m: it stands in the room kept for the bubbles)
     */
    frame?: boolean
  }
}

export const WITNESS_EXTRAS: Partial<Record<string, WitnessExtras>> = {
  filomena_madrid: { style: { apron: 'bib' }, prop: { kind: 'kiosk', place: 'side' } },
  cordoba_heat: { prop: { kind: 'olive-crates', place: 'side' } },
  aneto_glacier: { prop: { kind: 'trail-sign', place: 'side', frame: true } },
  donana: { prop: { kind: 'bird-scope', place: 'side', frame: true } },
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
  'trail-sign': { halfW: 0.95 * S, halfD: 0.45 * S, gap: 2 },
  'bird-scope': { halfW: 0.85 * S, halfD: 0.45 * S, gap: 2 },
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
  /** Any geometry in metres (built at metre scale, scaled here), placed and turned (rad). */
  const part = (g: THREE.BufferGeometry, color: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    g.scale(S, S, S)
    geometries.push(g)
    const m = new THREE.Mesh(g, mat(color))
    m.position.set(x * S, y * S, z * S)
    m.rotation.set(rx, ry, rz)
    m.castShadow = true
    m.receiveShadow = true
    group.add(m)
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
  } else if (kind === 'trail-sign') {
    // Pyrenees trail junction: a wooden post with two yellow arrow boards and a red-white trail
    // blaze, and beside it a grey rock with a rucksack (rolled mat on top) and an ice axe leaning on it
    const WOOD = 0x8a5a2e, BOARD = 0xf2c230, INK = 0x3a2a1a, ROCK = 0x8e8a94, ROCK_DARK = 0x6e6a78
    const PACK = 0x2f7f86, PACK_DARK = 0x225e64, MAT = 0x7a9a3c, METAL = 0xb8c0c8
    // Signpost (left), arrows pointing either way
    box(0.12, 2.1, 0.12, WOOD, -0.55, 1.05, 0)
    box(0.13, 0.08, 0.13, 0xf4f1ea, -0.55, 1.95, 0) // trail blaze: white over red
    box(0.13, 0.08, 0.13, 0xc8402f, -0.55, 1.87, 0)
    for (const [dir, y] of [[1, 1.62], [-1, 1.36]] as const) {
      box(0.62, 0.17, 0.04, BOARD, -0.55 + dir * 0.34, y, -0.08)
      part(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 3), BOARD, -0.55 + dir * 0.7, y, -0.08, Math.PI / 2, 0, -dir * Math.PI / 2) // arrow tip
      box(0.36, 0.03, 0.01, INK, -0.55 + dir * 0.32, y + 0.02, -0.105) // lettering line
      box(0.24, 0.03, 0.01, INK, -0.55 + dir * 0.28, y - 0.04, -0.105)
    }
    // Rock (right) with the rucksack and the ice axe leaning on it
    part(new THREE.DodecahedronGeometry(0.42, 0), ROCK, 0.45, 0.22, 0.05, 0, 0.4, 0).scale.set(1.3, 0.62, 1)
    part(new THREE.DodecahedronGeometry(0.22, 0), ROCK_DARK, 0.9, 0.12, -0.1, 0.3, 0, 0)
    const pack = new THREE.Group()
    pack.position.set(0.35 * S, 0.02 * S, -0.3 * S)
    pack.rotation.x = 0.28 // leaning back on the rock
    group.add(pack)
    box(0.42, 0.56, 0.26, PACK, 0, 0.3, 0, pack) // body
    box(0.44, 0.12, 0.28, PACK_DARK, 0, 0.6, 0.01, pack) // top flap
    box(0.3, 0.2, 0.06, PACK_DARK, 0, 0.22, -0.16, pack) // front pocket
    const mat2 = part(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), MAT, 0, 0, 0, 0, 0, Math.PI / 2) // rolled mat
    group.remove(mat2)
    mat2.position.set(0, 0.74 * S, 0.02 * S)
    pack.add(mat2)
    const axe = new THREE.Group()
    axe.position.set(0.82 * S, 0, -0.22 * S)
    axe.rotation.z = 0.32 // leaning on the rock
    group.add(axe)
    box(0.05, 0.75, 0.05, 0x4a4a52, 0, 0.38, 0, axe) // shaft
    box(0.32, 0.05, 0.04, METAL, -0.04, 0.76, 0, axe) // head
    box(0.06, 0.12, 0.04, METAL, 0.1, 0.72, 0, axe) // adze
  } else if (kind === 'bird-scope') {
    // Birdwatching: a spotting telescope on a tripod (looking out over the marsh) and a small
    // wooden board on a post with a pink flamingo painted on it
    const LEG = 0x3a3a42, SCOPE = 0x5e6b3a, EYE = 0x222228, GLASS = 0x9fd4ec
    const WOOD = 0x9a6a3c, BOARD = 0xf2e8d0, PINK = 0xef8fa6, BLACK = 0x2a2228
    // Tripod (right): three legs from the head down to a 0.35 m circle
    const head = new THREE.Vector3(0.45, 1.22, 0)
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.3
      const foot = new THREE.Vector3(0.45 + Math.sin(a) * 0.36, 0, Math.cos(a) * 0.36)
      const len = head.distanceTo(foot)
      const leg = part(new THREE.CylinderGeometry(0.025, 0.03, len, 5), LEG, (head.x + foot.x) / 2, (head.y + foot.y) / 2, (head.z + foot.z) / 2)
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), head.clone().sub(foot).normalize())
    }
    box(0.12, 0.08, 0.12, LEG, head.x, head.y + 0.02, head.z)
    // Telescope: tube tilted up a little, pointing out to the side (+x), eyepiece on the near end
    const scope = new THREE.Group()
    scope.position.set(head.x * S, (head.y + 0.12) * S, head.z * S)
    scope.rotation.z = 0.18
    group.add(scope)
    const tube = part(new THREE.CylinderGeometry(0.07, 0.06, 0.55, 10), SCOPE, 0, 0, 0, 0, 0, -Math.PI / 2)
    const lens = part(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 10), GLASS, 0, 0, 0, 0, 0, -Math.PI / 2)
    const eye = part(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 8), EYE, 0, 0, 0, 0, 0, -Math.PI / 2)
    for (const [m, x] of [[tube, 0.08], [lens, 0.36], [eye, -0.25]] as const) {
      group.remove(m)
      m.position.set(x * S, 0, 0)
      scope.add(m)
    }
    // Board (left) on a post: a flamingo standing on one leg, painted on both faces (the dialogue
    // camera may see either)
    box(0.09, 1.2, 0.09, WOOD, -0.5, 0.6, 0.05)
    box(0.62, 0.48, 0.06, WOOD, -0.5, 1.2, 0.0) // frame
    box(0.54, 0.4, 0.09, BOARD, -0.5, 1.2, 0.0)
    const f = (w: number, h: number, x: number, y: number, c: number) => {
      box(w, h, 0.01, c, -0.5 + x, 1.2 + y, -0.05)
      box(w, h, 0.01, c, -0.5 - x, 1.2 + y, 0.05) // back face: mirrored, so it reads the same way round
    }
    f(0.16, 0.08, 0.04, 0.0, PINK) // body
    f(0.03, 0.14, -0.04, 0.1, PINK) // neck
    f(0.07, 0.04, -0.03, 0.17, PINK) // head
    f(0.03, 0.025, -0.08, 0.155, BLACK) // beak tip
    f(0.015, 0.14, 0.05, -0.1, PINK) // leg
    f(0.4, 0.03, 0, -0.18, 0x6f8c34) // reeds line
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
