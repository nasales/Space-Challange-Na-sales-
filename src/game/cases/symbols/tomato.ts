// Tomato (almeria_murcia): a big, slightly squashed red ball with a green star of leaves and a stem.
import * as THREE from 'three'
import type { SymbolKit } from './kit'

const RED = 0xe8322a
const LEAF = 0x3f9a34
const STEM = 0x2f7a28

/** Fruit: radius, vertical squash and low-poly segments (world units). */
const RADIUS = 66
const SQUASH = 0.84
const SEGMENTS = { w: 11, h: 8 }
/** Leaves: count, length, width, thickness and droop (rad). */
const LEAVES = 5
const LEAF_SIZE = { l: 40, w: 14, t: 4 }
const LEAF_DROOP = 0.18
/** Stem: radius, height above the top of the fruit, and lean (rad). */
const STEM_RADIUS = 5
const STEM_HEIGHT = 24
const STEM_LEAN = 0.25

export function buildTomato(kit: SymbolKit) {
  const root = new THREE.Group()
  const ry = RADIUS * SQUASH
  const fruitGeo = kit.geo('tomato.fruit', () => new THREE.SphereGeometry(RADIUS, SEGMENTS.w, SEGMENTS.h))
  const fruit = kit.part(fruitGeo, kit.mat(RED), 0, ry, 0)
  fruit.scale.y = SQUASH
  root.add(fruit)

  const top = ry * 2
  const leafGeo = kit.geo('tomato.leaf', () => new THREE.BoxGeometry(LEAF_SIZE.l, LEAF_SIZE.t, LEAF_SIZE.w).translate(LEAF_SIZE.l / 2, 0, 0))
  const leafMat = kit.mat(LEAF)
  for (let i = 0; i < LEAVES; i++) {
    const turn = new THREE.Group()
    turn.position.y = top + 1
    turn.rotation.y = (i / LEAVES) * Math.PI * 2
    const leaf = kit.part(leafGeo, leafMat)
    leaf.rotation.z = -LEAF_DROOP
    leaf.scale.z = 1 - 0.15 * (i % 2) // a little uneven
    turn.add(leaf)
    root.add(turn)
  }
  const stemGeo = kit.geo('tomato.stem', () => new THREE.CylinderGeometry(STEM_RADIUS * 0.7, STEM_RADIUS, STEM_HEIGHT, 5).translate(0, STEM_HEIGHT / 2, 0))
  const stem = kit.part(stemGeo, kit.mat(STEM), 0, top - 3, 0)
  stem.rotation.z = STEM_LEAN
  root.add(stem)
  return root
}
