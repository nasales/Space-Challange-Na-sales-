// Museo Guggenheim Bilbao (Frank Gehry, 1997), cartoon style. Signature features, exaggerated:
// a bouquet of shiny, curved and twisted titanium "sails" bursting around a tall glass atrium,
// chunky limestone blocks between them, the long curved gallery stretching east along the river
// and the tower at its end. Each sail is a curved outline extruded and then bent and twisted
// (by moving its vertices), so nothing is a flat slab. Around it, a plaza by the estuary.
// Units are roughly metres; the city entrance looks toward +Z and the river is at -Z.
import * as THREE from 'three'
import { wonk, type Kit } from '../kit'

const TITANIUM = [0xdfe5ec, 0xc3ccd8, 0xa9b6c6] // three shades so neighbouring sails read apart
const LIMESTONE = 0xf0d79c
const GLASS = 0x7fd3ff
const WATER = 0x2f9be0
const WALK = 0xc89a63 // riverside promenade

/**
 * Curved titanium sail: a leaf-like outline (steep back, sharp tip, long sweep down), extruded,
 * then bent around a vertical axis (radius bend; 0 = straight) and twisted with height.
 * Width w along X, height h, thickness d; base centred at y = 0.
 */
function sail(kit: Kit, w: number, h: number, d: number, color: number, bend: number, twist: number) {
  const s = new THREE.Shape()
  const n = 8 // points along the bottom so the bend stays smooth there too
  s.moveTo(-w / 2, 0)
  s.lineTo(-w / 2, h * 0.35)
  s.bezierCurveTo(-w / 2, h * 0.85, -w * 0.3, h * 1.05, -w * 0.1, h) // round back up to the tip
  s.bezierCurveTo(w * 0.2, h * 0.92, w * 0.45, h * 0.55, w / 2, h * 0.1) // long sweep down
  for (let i = 0; i <= n; i++) s.lineTo(w / 2 - (w * i) / n, 0)
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: d * 0.2, bevelThickness: d * 0.2, bevelSegments: 2, curveSegments: 14 })
  geo.translate(0, 0, -d / 2)
  const p = geo.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    if (bend) {
      // Bend: the sail's X runs along a circle of radius `bend`
      const a = v.x / bend
      const r = bend - v.z
      v.set(Math.sin(a) * r, v.y, bend - Math.cos(a) * r)
    }
    // Twist: turn each height slice a bit more than the one below
    const t = (v.y / h) * twist
    const x = v.x * Math.cos(t) - v.z * Math.sin(t)
    const z = v.x * Math.sin(t) + v.z * Math.cos(t)
    p.setXYZ(i, x, v.y, z)
  }
  geo.computeVertexNormals()
  return kit.mesh(geo, color)
}

export function buildGuggenheim(kit: Kit): THREE.Group {
  const g = new THREE.Group()

  // ---- Chunky limestone blocks ----
  for (const [w, h, d, x, z] of [
    [18, 11, 14, -30, 6], [14, 16, 12, -22, -10], [12, 9, 18, 24, 10], [10, 13, 10, -7, 15],
  ]) g.add(kit.box(w, h, d, LIMESTONE, x, 0, z))

  // ---- Glass atrium: a tall "flower" of four glass sails twisting around the centre ----
  for (let k = 0; k < 4; k++) {
    const petal = sail(kit, 9, 32 - k * 2, 2, GLASS, 10, 0.5)
    petal.rotation.y = (k * Math.PI) / 2
    petal.position.set(Math.sin((k * Math.PI) / 2) * 2.5, 0, Math.cos((k * Math.PI) / 2) * 2.5)
    g.add(petal)
  }
  const crown = sail(kit, 10, 6, 3, TITANIUM[0], 6, 0.8)
  crown.position.y = 28
  g.add(crown)

  // ---- Titanium sails bursting around it: [x, z, width, height, thickness, turn, bend, twist] ----
  const sails: number[][] = [
    [-10, 6, 18, 20, 3, 0.4, 12, 0.5],
    [10, 8, 20, 16, 3, -0.6, -14, -0.4],
    [-15, -6, 16, 24, 3, 1.4, 10, 0.6],
    [13, -8, 18, 26, 3, -1.2, -11, -0.5],
    [1, -14, 22, 18, 3, 0.1, 16, 0.3],
    [-26, 13, 15, 13, 3, -0.3, 9, 0.7],
    [21, 2, 14, 20, 3, 0.9, -9, -0.6],
    [-3, 11, 12, 14, 3, -0.9, 8, 0.4],
    [6, 0, 14, 22, 3, 2.2, 10, -0.5],
  ]
  sails.forEach(([x, z, w, h, d, turn, bend, twist], i) => {
    const s = sail(kit, w, h, d, TITANIUM[i % 3], bend, twist)
    s.position.set(x, 0, z)
    s.rotation.y = turn
    g.add(wonk(s, 20 + i, 0.15)) // each sail leans its own way
  })

  // ---- Long curved gallery stretching east along the river ----
  const gallery = sail(kit, 46, 12, 12, TITANIUM[1], 40, 0.15)
  gallery.position.set(44, 0, -4)
  g.add(gallery)
  g.add(kit.box(30, 5, 11, LIMESTONE, 42, 0, -4))

  // ---- Tower at the east end, capped by a twisted sail ----
  g.add(kit.taper(8, 8, 6, 6, 26, LIMESTONE, 68, 0, -8))
  const cap = sail(kit, 9, 10, 3, TITANIUM[0], 5, 1)
  cap.position.set(68, 22, -8)
  g.add(cap)
  return g
}

/**
 * Plaza by the estuary: paving, lawn strips, a riverside promenade and the river along the back.
 * w and d: size of the plaza (model units). Returns the group and the height of its surface.
 */
export function buildGuggenheimBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 0.3
  g.add(kit.box(w + 4, 0.03, d + 4, 0xe6e1d6))
  g.add(kit.box(w, top, d, 0xd9d4c9))
  g.add(kit.slab(w, 0.1, 4, WALK, 0, top, -d / 2 + 6)) // promenade
  g.add(kit.slab(w, 0.12, 4.5, WATER, 0, top, -d / 2 + 2.3)) // river (Nervión), inside the plaza
  g.add(kit.slab(w * 0.45, 0.12, 5, 0x5fc0f0, -w * 0.12, top, -d / 2 + 11)) // the museum's pool
  for (const x of [-w / 3, 0, w / 3]) g.add(kit.box(w / 4, 0.4, 4, 0x6fd85a, x, top, d / 2 - 3))
  return { group: g, top }
}
