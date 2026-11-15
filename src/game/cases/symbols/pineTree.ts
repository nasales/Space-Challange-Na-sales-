// Pine tree (sierra_culebra): brown trunk and three stacked low-poly green cones.
import * as THREE from 'three'
import type { SymbolKit } from './kit'

const TRUNK = 0x8a5a34
const NEEDLES = [0x2e8b46, 0x37a052, 0x45b45e] // bottom to top, a bit lighter going up

/** Trunk radius and visible height (world units). */
const TRUNK_RADIUS = 10
const TRUNK_HEIGHT = 34
/** Cone tiers from the bottom: radius, height and base height. Top tip at 160. */
const TIERS = [
  { r: 56, h: 64, y: 22 },
  { r: 45, h: 58, y: 62 },
  { r: 32, h: 52, y: 108 },
]
const SEGMENTS = 7
/** Turn of each tier around the trunk, so the facets do not line up (rad). */
const TIER_TWIST = 0.45

export function buildPineTree(kit: SymbolKit) {
  const root = new THREE.Group()
  const trunkGeo = kit.geo('pine.trunk', () => new THREE.CylinderGeometry(TRUNK_RADIUS * 0.8, TRUNK_RADIUS, TRUNK_HEIGHT, 6))
  root.add(kit.part(trunkGeo, kit.mat(TRUNK), 0, TRUNK_HEIGHT / 2, 0))
  TIERS.forEach((t, i) => {
    const g = kit.geo(`pine.tier${i}`, () => new THREE.ConeGeometry(t.r, t.h, SEGMENTS))
    const cone = kit.part(g, kit.mat(NEEDLES[i]), 0, t.y + t.h / 2, 0)
    cone.rotation.y = i * TIER_TWIST
    root.add(cone)
  })
  return root
}
