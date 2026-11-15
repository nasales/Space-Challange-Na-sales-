// Snowy mountain peak (aneto_glacier): a big faceted rock cone with a white snow cap and a
// smaller peak beside it, also snow-capped.
import * as THREE from 'three'
import type { SymbolKit } from './kit'

const ROCK = 0x7d8597
const ROCK_DARK = 0x646b7c
const SNOW = 0xf4f7ff

/** Peaks: base radius, height, centre (x, z), facets, and how much of the top is snow (0..1). */
const PEAKS = [
  { r: 70, h: 160, x: 8, z: 0, facets: 5, snow: 0.42, rock: ROCK, turn: 0 },
  { r: 46, h: 96, x: -46, z: 14, facets: 5, snow: 0.38, rock: ROCK_DARK, turn: 0.6 },
]
/** The snow cap is this much wider than the rock under it, so it covers it cleanly. */
const CAP_GROW = 1.06

export function buildMountain(kit: SymbolKit) {
  const root = new THREE.Group()
  PEAKS.forEach((p, i) => {
    const rockGeo = kit.geo(`mountain.rock${i}`, () => new THREE.ConeGeometry(p.r, p.h, p.facets))
    const rock = kit.part(rockGeo, kit.mat(p.rock), p.x, p.h / 2, p.z)
    rock.rotation.y = p.turn
    root.add(rock)
    const capH = p.h * p.snow
    const capGeo = kit.geo(`mountain.cap${i}`, () => new THREE.ConeGeometry(p.r * p.snow * CAP_GROW, capH * CAP_GROW, p.facets))
    const cap = kit.part(capGeo, kit.mat(SNOW), p.x, p.h - (capH * CAP_GROW) / 2 + 0.5, p.z)
    cap.rotation.y = p.turn
    root.add(cap)
  })
  return root
}
