// Stylised flame (galicia_fires): three nested flame silhouettes (red, orange, yellow),
// extruded so each inner layer stands a little out of the one behind it, front and back.
import * as THREE from 'three'
import { extrudeCentred, type SymbolKit } from './kit'

const OUTER = 0xf0401f
const MIDDLE = 0xff8c1a
const INNER = 0xffe04a

/** Layers: half width, height, extrusion depth and base height (world units). */
const LAYERS = [
  { color: OUTER, w: 52, h: 160, depth: 22, y: 0 },
  { color: MIDDLE, w: 36, h: 112, depth: 32, y: 4 },
  { color: INNER, w: 20, h: 66, depth: 42, y: 8 },
]
/** Curve smoothness of the outline (low = more faceted). */
const CURVE_SEGMENTS = 5

/** Flame outline, bottom at (0, 0), tip at (0, h); a side lick on the left. */
function flameShape(w: number, h: number) {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.quadraticCurveTo(w, 0, w, h * 0.32)
  s.quadraticCurveTo(w, h * 0.56, w * 0.45, h * 0.76)
  s.quadraticCurveTo(w * 0.1, h * 0.9, w * 0.05, h) // tip
  s.quadraticCurveTo(-w * 0.35, h * 0.78, -w * 0.4, h * 0.6)
  s.quadraticCurveTo(-w * 0.62, h * 0.72, -w * 0.72, h * 0.66) // side lick
  s.quadraticCurveTo(-w * 1.05, h * 0.42, -w * 0.92, h * 0.22)
  s.quadraticCurveTo(-w * 0.75, 0, 0, 0)
  return s
}

export function buildFlame(kit: SymbolKit) {
  const root = new THREE.Group()
  LAYERS.forEach((l, i) => {
    const g = kit.geo(`flame.layer${i}`, () => extrudeCentred(flameShape(l.w, l.h), l.depth, CURVE_SEGMENTS))
    root.add(kit.part(g, kit.mat(l.color), 0, l.y, 0))
  })
  return root
}
