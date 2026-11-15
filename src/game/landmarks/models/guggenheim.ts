// Museo Guggenheim Bilbao (Frank Gehry, 1997), cartoon style. Signature features, exaggerated:
// a flowing horizontal "ship" of curved, twisted titanium volumes that rise toward the tall glass
// atrium "flower" in the middle, chunky warm limestone blocks on the city side, the long curved
// gallery running east along the river under the Puente de La Salve, and the tower joined to the
// bridge. Each titanium volume is a stack of horizontal slices in alternating silver shades (it
// reads as shiny metal panels); the outline of every slice is bent around a vertical axis and
// twisted with height, so nothing is a flat slab. Around it, a plaza by the Nervión estuary.
// Units are roughly metres; the city looks toward +Z and the river runs along -Z.
import * as THREE from 'three'
import { wonk, type Kit } from '../kit'
import { bush } from '../ornaments'

// Shiny cartoon titanium: two light silvers and a cool blue highlight, crisp contrast
const TI_BRIGHT = 0xf5f8fc
const TI_MID = 0xbac7d8
const TI_BLUE = 0x9cc4f5
const TITANIUM = [TI_BRIGHT, TI_MID, TI_BRIGHT, TI_BLUE]
const LIMESTONE = 0xf3c97a // warm ochre
const LIMESTONE_TOP = 0xffd98a
const SLOT = 0x31476e // deep window slots
const GLASS = 0x45c8ff
const GLASS_2 = 0x8fe2ff
const RIB = 0xffffff
const DECK = 0x3f8f9c // teal steel girder of the bridge
const ROAD = 0x6e7388
const CONCRETE = 0xd9d6cc
const WATER = 0x1f8cff
const POOL = 0x4fd0ff
const WALK = 0xe0b27a // riverside promenade
const QUAY = 0xb9b2a4
const PAVING = 0xeadfc9
const LAWN = 0x52d14a
const LEAF = 0x2fae4a
const TRUNK = 0x8a5a35

// Puente de La Salve: runs north-south (along Z) over the east end of the museum
const BRIDGE_X = 64
const BRIDGE_Z0 = -34 // end over the river
const BRIDGE_Z1 = 27 // end in the city
const DECK_Y = 16 // top of the flat part of the deck
const DECK_W = 10
// Museum footprint used by the base layout (model units)
const BACK_Z = -15 // the museum's river-side face
const WEST_X = -46.5 // west end of the model (the small limestone block)

interface VolumeOptions {
  w: number // length along X
  h: number // height
  d: number // thickness along Z
  tip?: number // X of the highest point, as a fraction of w (-0.5 .. 0.5)
  back?: number // curve of the -X edge: > 1 stays steep and curls in near the top
  front?: number // curve of the +X edge: < 1 is a long sweep that flattens at the ground
  bend?: number // radius of the bend around a vertical axis (0 = straight; negative bends the other way)
  twist?: number // turn (radians) of the top slice relative to the bottom one
  bulge?: number // fattening of the thickness at mid-height (0.2 = 20 %)
  band?: number // height of each slice
  colors?: number[] // slice colours, repeating from the bottom
  shift?: number // start the colour cycle at a different slice
  rib?: { h: number; color: number } // optional thin slice between bands (glass mullions)
}

/**
 * One slice of a volume: a 4-sided outline (bottom from xl0 to xr0 at y0, top from xl1 to xr1 at
 * y1) given thickness d, with the long edges split into columns so the bend stays smooth.
 * Returns an indexed geometry (smooth normals across each face) before deformation.
 */
function sliceGeometry(xl0: number, xr0: number, xl1: number, xr1: number, y0: number, y1: number, d: number) {
  const n = Math.max(2, Math.ceil(Math.max(xr0 - xl0, xr1 - xl1) / 2.2))
  const pos: number[] = []
  const idx: number[] = []
  const h = d / 2
  const add = (x: number, y: number, z: number) => (pos.push(x, y, z), pos.length / 3 - 1)
  const col = (i: number, top: boolean) => {
    const s = i / n
    return top ? xl1 + (xr1 - xl1) * s : xl0 + (xr0 - xl0) * s
  }
  // Front (+Z) and back (-Z) faces: strips of quads between the bottom and top edges
  for (const side of [1, -1]) {
    const b: number[] = [], t: number[] = []
    for (let i = 0; i <= n; i++) {
      b.push(add(col(i, false), y0, side * h))
      t.push(add(col(i, true), y1, side * h))
    }
    for (let i = 0; i < n; i++) {
      if (side > 0) idx.push(b[i], b[i + 1], t[i + 1], b[i], t[i + 1], t[i])
      else idx.push(b[i], t[i + 1], b[i + 1], b[i], t[i], t[i + 1])
    }
  }
  // Bottom (-Y) and top (+Y) faces
  for (const top of [false, true]) {
    const y = top ? y1 : y0
    const f: number[] = [], k: number[] = []
    for (let i = 0; i <= n; i++) {
      f.push(add(col(i, top), y, h))
      k.push(add(col(i, top), y, -h))
    }
    for (let i = 0; i < n; i++) {
      if (top) idx.push(f[i], k[i + 1], k[i], f[i], f[i + 1], k[i + 1])
      else idx.push(f[i], k[i], k[i + 1], f[i], k[i + 1], f[i + 1])
    }
  }
  // Left (-X) and right (+X) ends
  const fbl = add(xl0, y0, h), ftl = add(xl1, y1, h), btl = add(xl1, y1, -h), bbl = add(xl0, y0, -h)
  idx.push(fbl, ftl, btl, fbl, btl, bbl)
  const fbr = add(xr0, y0, h), bbr = add(xr0, y0, -h), btr = add(xr1, y1, -h), ftr = add(xr1, y1, h)
  idx.push(fbr, bbr, btr, fbr, btr, ftr)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  return geo
}

/**
 * Gehry volume: a leaf-like outline (rising from both ends to a tip), cut into horizontal slices
 * of alternating colours, then fattened at mid-height, bent around a vertical axis and twisted
 * with height. Base centred at the origin, y = 0.
 */
function volume(kit: Kit, o: VolumeOptions) {
  const { w, h, d } = o
  const tipX = (o.tip ?? 0) * w
  const back = o.back ?? 1.6, front = o.front ?? 0.7
  const bend = o.bend ?? 0, twist = o.twist ?? 0, bulge = o.bulge ?? 0
  const band = o.band ?? 2.2
  const colors = o.colors ?? TITANIUM
  // Each edge closes in on the tip like a quarter ellipse, so the crest is round, not a spike
  const xl = (y: number) => tipX - (tipX + w / 2) * Math.sqrt(Math.max(0, 1 - Math.pow(y / h, back)))
  const xr = (y: number) => tipX + (w / 2 - tipX) * Math.sqrt(Math.max(0, 1 - Math.pow(y / h, front)))
  const g = new THREE.Group()
  const v = new THREE.Vector3()
  let y = 0, k = o.shift ?? 0, rib = false
  while (y < h - 0.01) {
    const y1 = Math.min(h, y + (rib && o.rib ? o.rib.h : band))
    const geo = sliceGeometry(xl(y), xr(y), xl(y1), xr(y1), y, y1, d)
    const p = geo.attributes.position
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      const u = v.y / h
      v.z *= 1 + bulge * Math.sin(Math.PI * Math.min(1, u * 1.1))
      if (bend) {
        const a = v.x / bend, r = bend - v.z
        v.set(Math.sin(a) * r, v.y, bend - Math.cos(a) * r)
      }
      const t = u * twist
      p.setXYZ(i, v.x * Math.cos(t) - v.z * Math.sin(t), v.y, v.x * Math.sin(t) + v.z * Math.cos(t))
    }
    geo.computeVertexNormals()
    g.add(kit.mesh(geo, rib && o.rib ? o.rib.color : colors[k % colors.length]))
    if (!rib) k++
    if (o.rib) rib = !rib
    y = y1
  }
  return g
}

/** Places a volume at (x, y, z), turned by `turn` around Y, with a little hand-drawn wobble. */
function put(g: THREE.Group, vol: THREE.Group, x: number, y: number, z: number, turn: number, seed: number, lean = 0.05) {
  vol.position.set(x, y, z)
  vol.rotation.y = turn
  g.add(wonk(vol, seed, lean))
}

/** Chunky limestone block with a lighter cap and a few deep window slots facing +Z. */
function limestoneBlock(kit: Kit, w: number, h: number, d: number, slots: number) {
  const g = new THREE.Group()
  g.add(kit.box(w, h, d, LIMESTONE))
  g.add(kit.box(w + 0.8, 0.9, d + 0.8, LIMESTONE_TOP, 0, h, 0))
  for (let i = 0; i < slots; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / slots
    g.add(kit.slab(1.2, h * 0.5, 0.4, SLOT, x, h * 0.3, d / 2))
    if (i % 2 === 0) g.add(kit.lightPanel(0.8, h * 0.42, x, h * 0.34, d / 2 + 0.3)) // lit at night
  }
  return g
}

/** Glass atrium "flower": a ringed glass core wrapped by twisting glass petals with white ribs. */
function atrium(kit: Kit) {
  const g = new THREE.Group()
  // Core: stacked glass rings and white mullion rings, slimmer toward the top
  let y = 0
  for (let k = 0; y < 36; k++) {
    const h = k % 2 ? 0.6 : 3
    const r0 = 7.5 - y * 0.11, r1 = 7.5 - (y + h) * 0.11
    g.add(kit.mesh(new THREE.CylinderGeometry(r1, r0, h, 12), k % 2 ? RIB : k % 4 ? GLASS : GLASS_2, 0, y + h / 2, 0))
    y += h
  }
  // Petals, each a thin twisted glass volume with white horizontal ribs
  const petals = [
    [46, 0.0, 0.7], [40, 1.3, -0.6], [44, 2.5, 0.6], [38, 3.7, -0.7], [42, 5.0, 0.5],
  ]
  petals.forEach(([h, a, tw], i) => {
    const p = volume(kit, { w: 13, h, d: 1.4, tip: 0.05, back: 3.2, front: 2, bend: -10, twist: tw, band: 3, colors: [GLASS, GLASS_2], shift: i, rib: { h: 0.5, color: RIB } })
    p.rotation.order = 'YXZ'
    p.rotation.x = 0.13 // lean outward, like an opening flower
    put(g, p, Math.sin(a) * 6.5, 0, Math.cos(a) * 6.5, a, 40 + i, 0.06)
  })
  // Titanium curls crowning the flower
  const curls = [[0.6, 37, 10], [2.6, 34, 9], [4.4, 35, 8]]
  curls.forEach(([a, cy, h], i) => {
    const c = volume(kit, { w: 13, h, d: 3, tip: 0.3, back: 2, front: 0.6, bend: 6, twist: 1, band: 1.6, shift: i })
    put(g, c, Math.sin(a) * 4, cy, Math.cos(a) * 4, a, 50 + i, 0.1)
  })
  return g
}

/** Puente de La Salve, built along local +X (rotated to run along Z): deck, piers, railings, cars. */
function bridge(kit: Kit) {
  const g = new THREE.Group()
  g.rotation.y = -Math.PI / 2 // local +X -> world +Z
  const flatEnd = -2 // the deck is flat over the river and the gallery, then ramps down into the city
  const prof = (u: number) => (u <= flatEnd ? DECK_Y : DECK_Y * Math.max(0, 1 - ((u - flatEnd) / (BRIDGE_Z1 - flatEnd)) ** 1.3))
  const seg = (u0: number, u1: number) => {
    const y0 = prof(u0), y1 = prof(u1)
    const len = Math.hypot(u1 - u0, y1 - y0)
    const a = Math.atan2(y1 - y0, u1 - u0)
    const s = new THREE.Group()
    s.position.set((u0 + u1) / 2, (y0 + y1) / 2, 0)
    s.rotation.z = a
    s.add(kit.box(len + 0.3, 2.6, DECK_W, DECK, 0, -2.6, 0)) // girder
    s.add(kit.slab(len + 0.3, 0.3, DECK_W - 1.6, ROAD, 0, 0, 0)) // road
    s.add(kit.slab(len + 0.3, 0.05, 0.35, RIB, 0, 0.3, 0)) // centre line
    for (const z of [-DECK_W / 2 + 0.4, DECK_W / 2 - 0.4]) s.add(kit.box(len + 0.3, 1.1, 0.5, RIB, 0, 0, z)) // railings
    g.add(s)
  }
  const cuts = [BRIDGE_Z0, -20, -2, 6, 13, 19, 24, BRIDGE_Z1]
  for (let i = 0; i < cuts.length - 1; i++) seg(cuts[i], cuts[i + 1])
  // Piers: chunky concrete columns under the flat part
  for (const u of [-31, -18, -6]) {
    for (const z of [-3, 3]) g.add(kit.taper(3.2, 3.2, 2.4, 2.4, DECK_Y - 2.6, CONCRETE, u, 0, z))
    g.add(kit.box(3.4, 1.4, DECK_W - 1, CONCRETE, u, DECK_Y - 4, 0))
  }
  // Two toy cars on the deck
  for (const [u, z, c] of [[-24, -2, 0xffcf3a], [-10, 2, 0xff5a4e]] as const) {
    g.add(kit.box(4, 1.3, 2.2, c, u, DECK_Y + 0.3, z))
    g.add(kit.box(2.2, 1, 1.9, 0xdff3ff, u - 0.2, DECK_Y + 1.6, z))
  }
  // Lamp posts
  for (const u of [-30, -18, -6]) {
    for (const z of [-DECK_W / 2 + 0.4, DECK_W / 2 - 0.4]) {
      g.add(kit.box(0.35, 4, 0.35, DECK, u, DECK_Y, z))
      g.add(kit.box(1.2, 0.5, 0.6, 0xfff2b0, u, DECK_Y + 4, z))
    }
  }
  return g
}

export function buildGuggenheim(kit: Kit): THREE.Group {
  const g = new THREE.Group()

  // ---- Chunky limestone blocks on the city side ----
  for (const [w, h, d, x, z, slots] of [
    [16, 11, 13, -33, 9, 4], [11, 15, 10, -22, 14, 3], [9, 8, 8, -3, 17, 2], [14, 9, 11, 19, 15, 4], [9, 7, 10, -42, -2, 2],
  ]) {
    const b = limestoneBlock(kit, w, h, d, slots)
    b.position.set(x, 0, z)
    g.add(wonk(b, x * 7 + z, 0.02))
  }

  // ---- Glass atrium flower, the tallest point ----
  g.add(atrium(kit))
  // Night: the glass flower glows, and soft floodlights wash the titanium on both sides
  g.add(kit.lightHalo(8, 0, 10, 3, 0.55), kit.lightHalo(6, 0, 24, 0, 0.45))
  for (const [x, z, r] of [[-26, -17, 8], [10, -18, 8], [44, -15, 8], [12, 14, 7]]) g.add(kit.lightHalo(r, x, 5, z, 0.32))

  // ---- The titanium "ship": long layered curves rising toward the atrium ----
  // [x, y, z, w, h, d, tip, back, front, bend, twist, bulge, turn]
  const ship: number[][] = [
    [-30, 0, -9, 26, 13, 11, 0.32, 0.8, 2.2, 30, 0.12, 0.25, 0.1], // low west tail
    [-19, 0, -6, 28, 21, 11, 0.36, 0.7, 2.2, 24, 0.2, 0.3, 0.15], // rises toward the atrium
    [-13, 0, 6, 24, 27, 11, 0.34, 0.8, 2.5, -20, -0.25, 0.25, -0.2], // over the limestone, city side
    [-10, 12, -10, 20, 14, 8, 0.3, 0.9, 2, 16, 0.35, 0.2, 0.35], // upper layer, river side
    [9, 0, -10, 26, 24, 11, -0.36, 2.4, 0.8, -22, -0.2, 0.3, -0.1], // east of the atrium, river side
    [11, 0, 7, 20, 20, 10, -0.34, 2.4, 0.8, 18, 0.25, 0.25, 0.25], // east of the atrium, city side
    [5, 14, -3, 14, 18, 6, -0.2, 2.2, 0.9, 10, 0.5, 0.2, 1.3], // tall twisted sail beside the flower
    [-6, 15, 2, 12, 15, 6, 0.25, 0.9, 2.2, -9, -0.6, 0.2, -1.1], // and another on the other side
  ]
  ship.forEach(([x, y, z, w, h, d, tip, back, front, bend, twist, bulge, turn], i) => {
    put(g, volume(kit, { w, h, d, tip, back, front, bend, twist, bulge, shift: i }), x, y, z, turn, 20 + i)
  })

  // ---- Long gallery running east along the river, under the bridge ----
  put(g, volume(kit, { w: 62, h: 13, d: 15, tip: 0.05, back: 2.2, front: 2.6, bend: 90, twist: 0.04, bulge: 0.15, band: 1.8, shift: 1 }), 44, 0, -6, 0.04, 30, 0.01)
  put(g, volume(kit, { w: 30, h: 19, d: 9, tip: -0.32, back: 2.6, front: 0.75, bend: -26, twist: -0.15, bulge: 0.25, shift: 2 }), 27, 0, -8, -0.05, 31)

  // ---- Puente de La Salve and the tower joined to it ----
  const br = bridge(kit)
  br.position.set(BRIDGE_X, 0, 0)
  g.add(br)
  const TX = BRIDGE_X + DECK_W / 2 + 5.5
  g.add(wonk(kit.taper(10, 10, 7.5, 7.5, 32, LIMESTONE, TX, 0, -4), 61, 0.03))
  g.add(kit.slab(1.4, 18, 0.4, SLOT, TX, 8, 0.6)) // tall window slot
  g.add(kit.lightPanel(1, 17, TX, 8.5, 0.95, 0, 0.8)) // lit at night
  g.add(kit.box(6, 2.4, 6, DECK, TX - 5, DECK_Y - 2.6, -4)) // collar tying the tower to the deck
  put(g, volume(kit, { w: 12, h: 11, d: 5, tip: 0.2, back: 1.8, front: 0.7, bend: 6, twist: 0.9, band: 1.6 }), TX, 31, -4, 0.6, 62, 0.08)
  return g
}

/**
 * Plaza by the estuary: the Nervión along the back with a quay and a riverside promenade, the
 * museum's pool beside it, lawns and trees on the city side. Everything stays inside w x d.
 * w and d: size of the plaza (model units). Returns the group and the height of its surface.
 */
export function buildGuggenheimBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 0.3
  const back = -d / 2
  g.add(kit.box(w, top, d, PAVING))
  // The model is centred on its bounding box: the bridge sets the back edge (8 units of margin),
  // so the museum's river face sits this far from the back of the plaza
  const museumBack = back + 8 + (BACK_Z - BRIDGE_Z0)
  const riverD = museumBack - back - 12
  g.add(kit.slab(w, 0.14, riverD, WATER, 0, top, back + riverD / 2)) // the Nervión
  g.add(kit.box(w, 0.9, 1.2, QUAY, 0, top, back + riverD + 0.6)) // quay wall
  g.add(kit.slab(w, 0.12, 3.4, WALK, 0, top, back + riverD + 2.9)) // promenade
  // The museum's pool, between the promenade and the west part of the ship
  g.add(kit.box(w * 0.4 + 1, 0.35, 5.2, QUAY, -w * 0.2, top, back + riverD + 7.4))
  g.add(kit.slab(w * 0.4, 0.13, 4.2, POOL, -w * 0.2, top + 0.3, back + riverD + 7.4))
  // The bridge road comes down into the city and carries on as a street to the front edge
  const bx = BRIDGE_X - (WEST_X + (w - 16) / 2) // bridge axis in plaza coordinates
  const rampFoot = d / 2 - 8 - 0.5 // the model's front is the foot of the ramp
  g.add(kit.slab(DECK_W - 1.6, 0.12, d / 2 - rampFoot + 0.5, ROAD, bx, top, (rampFoot + d / 2) / 2))
  // City side: lawns with trees along the front edge, and a strip on the west end
  const s0 = bx - DECK_W / 2 - 1.5, s1 = bx + DECK_W / 2 + 1.5 // street edges, kept clear
  for (const x of [-w * 0.36, -w * 0.12, w * 0.12, w * 0.36]) {
    const a = x - w * 0.1, b = x + w * 0.1
    const parts = b < s0 || a > s1 ? [[a, b]] : [[a, s0], [s1, b]]
    for (const [p0, p1] of parts) {
      if (p1 - p0 < 5) continue
      const cx = (p0 + p1) / 2, z = d / 2 - 3.2
      g.add(kit.box(p1 - p0, 0.5, 4.5, LAWN, cx, top, z))
      const trees = p1 - p0 > w * 0.15 ? [cx - w * 0.06, cx + w * 0.06] : [cx]
      for (const tx of trees) {
        const t = bush(kit, 4, LEAF, TRUNK)
        t.position.set(tx, top + 0.5, z)
        g.add(t)
      }
    }
  }
  g.add(kit.box(5, 0.5, d * 0.3, LAWN, -w / 2 + 3.2, top, d * 0.12))
  return { group: g, top }
}
