// Ciudad de las Artes y las Ciencias (Valencia, Santiago Calatrava), cartoon toy style: chunky,
// vivid white shapes over turquoise pools in the old bed of the Turia river, with a cobalt accent.
// From west to east along X:
//   - Palau de les Arts: a tiled body wrapped by two big curved white crescent shells, with the long
//     tapered "feather" rising from the back over the top and cantilevering forward.
//   - Hemisfèric: an almond eye; a solid white eyelid lifted open over a big blue pupil.
//   - Museu de les Ciències: long and low, a row of white V "trees" on the south face, glass behind,
//     and a jagged white crest of fins along the top.
//   - Pont de l'Assut de l'Or: white bridge over the pool with a tall leaning pylon and cables.
//   - L'Àgora: a tall pointed leaf-shaped shell in cobalt-blue tiles.
//   - Umbracle (south, +Z): a walkway of fat white arches covered in green vines, palms in planters.
// Units are roughly metres; the south side (+Z) faces the game camera.
import * as THREE from 'three'
import { seeded, wonk, type Kit } from '../kit'
import { beam, bush } from '../ornaments'

const WHITE = 0xfbfcfd
const OFFWHITE = 0xdfe9f2
const TILE = 0xc4e5f8 // white broken-tile cladding (trencadís)
const TILE_BLUE = 0x6cc0f0
const POOL = 0x1ccfe6
const RIPPLE = 0x9af2fa
const GLASS = 0x7fd3ff
const PUPIL = 0x2f8fe8
const IRIS = 0x1857c4
const COBALT = 0x1f4fd8
const COBALT_LIGHT = 0x4f8dff
const VINE = 0x3fd04a
const VINE_DARK = 0x27b03c
const PAVE = 0xf1ebdc
const LAWN = 0x5fd34a
const TRUNK = 0x9a7048
const PALM_LEAF = 0x2fbf4a

const POOL_Y = 0.6 // height of the water surface

type Surf = (u: number, v: number) => THREE.Vector3

/**
 * Closed shell with thickness from a parametric surface f(u, v), u and v in [0, 1]: an outer and an
 * inner layer offset along the normal, plus rims along the four edges. Every triangle is turned to
 * face outward, so the shell is solid from both sides (materials are single-sided).
 * normal(u, v) is optional; by default it is found by finite differences.
 */
function thickSurface(kit: Kit, f: Surf, nu: number, nv: number, t: number, color: number, normal?: Surf) {
  const e = 1e-3
  const nrm = (u: number, v: number) => {
    if (normal) return normal(u, v).normalize()
    const du = f(Math.min(1, u + e), v).sub(f(Math.max(0, u - e), v))
    const dv = f(u, Math.min(1, v + e)).sub(f(u, Math.max(0, v - e)))
    const n = du.cross(dv)
    return n.lengthSq() > 1e-12 ? n.normalize() : new THREE.Vector3(0, 1, 0)
  }
  const pos: number[] = []
  const idx: number[] = []
  const P: THREE.Vector3[] = [] // positions, to orient the triangles
  const add = (p: THREE.Vector3) => {
    P.push(p)
    pos.push(p.x, p.y, p.z)
    return P.length - 1
  }
  /** Adds triangle a, b, c turned so that its normal points along `dir`. */
  const tri = (a: number, b: number, c: number, dir: THREE.Vector3) => {
    const n = new THREE.Vector3().subVectors(P[b], P[a]).cross(new THREE.Vector3().subVectors(P[c], P[a]))
    if (n.dot(dir) >= 0) idx.push(a, b, c)
    else idx.push(a, c, b)
  }
  const layer = (sign: number) => {
    const ids: number[][] = []
    for (let i = 0; i <= nu; i++) {
      ids.push([])
      for (let j = 0; j <= nv; j++) {
        const u = i / nu, v = j / nv
        ids[i].push(add(f(u, v).addScaledVector(nrm(u, v), (sign * t) / 2)))
      }
    }
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const d = nrm((i + 0.5) / nu, (j + 0.5) / nv).multiplyScalar(sign)
        tri(ids[i][j], ids[i + 1][j], ids[i + 1][j + 1], d)
        tri(ids[i][j], ids[i + 1][j + 1], ids[i][j + 1], d)
      }
    }
  }
  layer(1)
  layer(-1)
  // Rims: strips joining the two layers along each edge, facing away from the surface
  const rim = (pt: (s: number) => [number, number], n: number, inward: (s: number) => [number, number]) => {
    for (let k = 0; k < n; k++) {
      const [u0, v0] = pt(k / n), [u1, v1] = pt((k + 1) / n)
      const n0 = nrm(u0, v0), n1 = nrm(u1, v1)
      const a = add(f(u0, v0).addScaledVector(n0, t / 2)), b = add(f(u0, v0).addScaledVector(n0, -t / 2))
      const c = add(f(u1, v1).addScaledVector(n1, t / 2)), d = add(f(u1, v1).addScaledVector(n1, -t / 2))
      const [iu, iv] = inward((k + 0.5) / n)
      const [mu, mv] = pt((k + 0.5) / n)
      const out = f(mu, mv).sub(f(iu, iv))
      tri(a, b, d, out)
      tri(a, d, c, out)
    }
  }
  rim((s) => [s, 0], nu, (s) => [s, 0.05])
  rim((s) => [s, 1], nu, (s) => [s, 0.95])
  rim((s) => [0, s], nv, (s) => [0.05, s])
  rim((s) => [1, s], nv, (s) => [0.95, s])
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return kit.mesh(geo, color)
}

/**
 * Tube along a smooth curve through `points`, with an elliptical section that changes along it:
 * size(t) = [half width along `side`, half height across it]. `side` is a fixed axis
 * perpendicular to the curve's plane (no twisting). Closed with caps at both ends.
 */
function sweep(kit: Kit, points: THREE.Vector3[], size: (t: number) => [number, number], side: THREE.Vector3, color: number, segs = 36, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points)
  const pos: number[] = []
  const idx: number[] = []
  const centres: THREE.Vector3[] = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const p = curve.getPointAt(t)
    const T = curve.getTangentAt(t)
    const N = new THREE.Vector3().crossVectors(side, T).normalize()
    const S = new THREE.Vector3().crossVectors(T, N).normalize()
    const [w, h] = size(t)
    centres.push(p)
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2
      const q = p.clone().addScaledVector(S, Math.cos(a) * w).addScaledVector(N, Math.sin(a) * h)
      pos.push(q.x, q.y, q.z)
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * radial + k, b = i * radial + ((k + 1) % radial)
      const c = a + radial, d = b + radial
      idx.push(a, c, b, b, c, d)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  // Fix the winding: the side triangles must face away from the curve
  const v = (n: number) => new THREE.Vector3(pos[n * 3], pos[n * 3 + 1], pos[n * 3 + 2])
  const [a0, c0, b0] = [idx[0], idx[1], idx[2]]
  const fn = v(c0).sub(v(a0)).cross(v(b0).sub(v(a0)))
  if (fn.dot(v(a0).sub(centres[0])) < 0) for (let n = 0; n < idx.length; n += 3) [idx[n + 1], idx[n + 2]] = [idx[n + 2], idx[n + 1]]
  // Caps: a fan around the centre of each end, facing outward along the curve
  for (const [ring, dir] of [[0, -1], [segs, 1]] as const) {
    const ci = pos.length / 3
    const c = centres[ring]
    pos.push(c.x, c.y, c.z)
    const T = curve.getTangentAt(ring / segs).multiplyScalar(dir)
    for (let k = 0; k < radial; k++) {
      const a = ring * radial + k, b = ring * radial + ((k + 1) % radial)
      const n = v(a).sub(c).cross(v(b).sub(c))
      if (n.dot(T) >= 0) idx.push(ci, a, b)
      else idx.push(ci, b, a)
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return kit.mesh(geo, color)
}

/** Ellipsoid (or its top half) from a sphere with positive per-axis scale. */
function ellipsoid(kit: Kit, rx: number, ry: number, rz: number, color: number, topHalf = false) {
  const geo = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, topHalf ? Math.PI / 2 : Math.PI)
  geo.scale(rx, ry, rz)
  return kit.mesh(geo, color)
}

/** Small flat tile lying on a surface at p, facing along the normal n. */
function tile(kit: Kit, p: THREE.Vector3, n: THREE.Vector3, w: number, h: number, color: number, spin: number) {
  const m = kit.mesh(new THREE.BoxGeometry(w, h, 0.3), color)
  m.position.copy(p)
  m.lookAt(p.clone().add(n))
  m.rotateZ(spin)
  return m
}

/** Rectangular pool: turquoise water with chunky white rims and a few light ripples. */
function pool(kit: Kit, x0: number, x1: number, z0: number, z1: number, seed: number) {
  const g = new THREE.Group()
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2
  g.add(kit.box(w, POOL_Y, d, POOL, cx, 0, cz))
  const R = 1.6 // rim width
  g.add(kit.box(w + R * 2, 1.2, R, WHITE, cx, 0, z0 - R / 2))
  g.add(kit.box(w + R * 2, 1.2, R, WHITE, cx, 0, z1 + R / 2))
  g.add(kit.box(R, 1.2, d, WHITE, x0 - R / 2, 0, cz))
  g.add(kit.box(R, 1.2, d, WHITE, x1 + R / 2, 0, cz))
  const rand = seeded(seed)
  for (let i = 0; i < Math.round((w * d) / 90); i++) {
    const rw = 2 + rand() * 4
    g.add(kit.slab(rw, 0.06, 0.45, RIPPLE, x0 + rw / 2 + 1 + rand() * (w - rw - 2), POOL_Y, z0 + 1 + rand() * (d - 2)))
  }
  return g
}

/** Cartoon palm tree in a round white planter. */
function palm(kit: Kit, h: number, seed: number) {
  const g = new THREE.Group()
  const rand = seeded(seed)
  const planter = new THREE.CylinderGeometry(1.5, 1.3, 1.2, 10)
  g.add(kit.mesh(planter, WHITE, 0, 0.6, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.2, 10), VINE_DARK, 0, 1.2, 0))
  const lean = (rand() - 0.5) * 0.25
  const trunk = sweep(kit, [new THREE.Vector3(0, 1, 0), new THREE.Vector3(lean * h * 0.3, h * 0.5, 0), new THREE.Vector3(lean * h, h, 0)], (t) => [0.55 - t * 0.2, 0.55 - t * 0.2], new THREE.Vector3(0, 0, 1), TRUNK, 6, 6)
  g.add(trunk)
  const top = new THREE.Vector3(lean * h, h, 0)
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + rand()
    const leaf = kit.box(4.2, 0.35, 1.2, PALM_LEAF)
    leaf.position.set(top.x + Math.cos(a) * 1.8, top.y - 0.4, top.z - Math.sin(a) * 1.8)
    leaf.rotation.set(0, a, -0.45)
    g.add(leaf)
  }
  g.add(kit.box(1.1, 0.9, 1.1, 0x7a5a2e, top.x, top.y - 0.9, top.z)) // coconuts
  return wonk(g, seed, 0.04)
}

// ---------------------------------------------------------------- Palau de les Arts

function palauDeLesArts(kit: Kit) {
  const g = new THREE.Group()
  const cy = 5 // centre height of the body
  // Tiled body: an elongated ellipsoid with scattered light-blue tiles (trencadís)
  const CA = 19.5, CB = 15.5, CC = 9.5
  const core = ellipsoid(kit, CA, CB, CC, TILE)
  core.position.y = cy
  g.add(core)
  const rand = seeded(41)
  for (let i = 0; i < 320; i++) {
    const a = (rand() - 0.5) * 2.6, b = rand() * Math.PI * 2
    const p = new THREE.Vector3(CA * Math.sin(a), cy + CB * Math.cos(a) * Math.cos(b), CC * Math.cos(a) * Math.sin(b))
    if (p.y < 1.5) continue
    const n = new THREE.Vector3(p.x / CA ** 2, (p.y - cy) / CB ** 2, p.z / CC ** 2).normalize()
    g.add(tile(kit, p, n, 1.2 + rand(), 0.9 + rand() * 0.8, rand() < 0.6 ? TILE_BLUE : rand() < 0.5 ? WHITE : COBALT_LIGHT, rand() * 3))
  }
  // Glass entrance band at the east end (under the visor of the shells)
  g.add(kit.box(4, 6, 12, GLASS, 17.5, 0, 0))
  // Two curved white shells: crescents cut from an ellipsoid around the body, tips lifted
  const A = 23, B = 16.5, C = 13.5
  for (const side of [-1, 1]) {
    const surf: Surf = (u, v) => {
      const a = (u * 2 - 1) * 1.22
      const k = 1 - (a / 1.22) ** 2
      const bt = 0.95 - 0.25 * k, bb = 0.95 + 0.6 * k
      const b = bt + (bb - bt) * v
      return new THREE.Vector3(A * Math.sin(a), cy + B * Math.cos(a) * Math.cos(b), side * C * Math.cos(a) * Math.sin(b))
    }
    const normal: Surf = (u, v) => {
      const p = surf(u, v)
      return new THREE.Vector3(p.x / A ** 2, (p.y - cy) / B ** 2, p.z / C ** 2)
    }
    const shell = thickSurface(kit, surf, 40, 10, 1.4, WHITE, normal)
    g.add(wonk(shell, side > 0 ? 3 : 4, 0.02))
  }
  // The feather: a long tapered blade from the back over the top, cantilevering east
  const feather = sweep(
    kit,
    [new THREE.Vector3(-23, 2, 0), new THREE.Vector3(-17, 13, 0), new THREE.Vector3(-6, 19.6, 0), new THREE.Vector3(10, 21.5, 0), new THREE.Vector3(26, 22.5, 0), new THREE.Vector3(36, 21.5, 0)],
    (t) => [2.6 * (1 - 0.8 * t) + 0.25, 1.5 * (1 - 0.6 * t) + 0.3],
    new THREE.Vector3(0, 0, 1),
    WHITE,
    48,
    10,
  )
  g.add(feather)
  // White podium under the body
  const podium = new THREE.CylinderGeometry(1, 1.08, 1.4, 28)
  podium.scale(21, 1, 12.5)
  g.add(kit.mesh(podium, WHITE, 0, POOL_Y + 0.1, 0))
  return g
}

// ---------------------------------------------------------------- Hemisfèric

function hemisferic(kit: Kit) {
  const g = new THREE.Group()
  const RX = 17, RZ = 8.5
  // Light "reflection" halo around the eye on the water
  const halo = new THREE.CylinderGeometry(1, 1, 0.1, 32)
  halo.scale(RX + 3.5, 1, RZ + 3)
  g.add(kit.mesh(halo, RIPPLE, 0, 0, 0))
  // Lower lid: a low white almond
  g.add(ellipsoid(kit, RX, 3.2, RZ, WHITE, true))
  // Pupil: big blue sphere with a darker iris ring and a cartoon highlight
  const pupil = ellipsoid(kit, 6.8, 6.8, 6.8, PUPIL)
  pupil.position.y = 3.6
  g.add(pupil)
  const iris = new THREE.TorusGeometry(6.7, 0.7, 8, 28)
  g.add(kit.mesh(iris, IRIS, 0, 3.6, 0.6))
  for (const [r, x, y, z] of [[1.6, -2.4, 7.4, 3.6], [0.7, -0.4, 8.6, 3.2]]) {
    const shine = ellipsoid(kit, r, r, r, WHITE)
    shine.position.set(x, y, z)
    g.add(shine)
  }
  // Upper lid: a solid white half-almond dome hinged at the back, lifted open at the front
  const RY = 7.5
  const lidSurf: Surf = (u, v) => {
    const a = (u * 2 - 1) * 1.5
    const b = (v * 2 - 1) * (Math.PI / 2)
    return new THREE.Vector3(RX * Math.sin(a), RY * Math.cos(a) * Math.cos(b), RZ + RZ * Math.cos(a) * Math.sin(b))
  }
  const lidNormal: Surf = (u, v) => {
    const p = lidSurf(u, v)
    return new THREE.Vector3(p.x / RX ** 2, p.y / RY ** 2, (p.z - RZ) / RZ ** 2)
  }
  const hinge = new THREE.Group()
  hinge.position.set(0, 1.2, -RZ)
  hinge.rotation.x = -0.72
  hinge.add(thickSurface(kit, lidSurf, 36, 16, 1.2, WHITE, lidNormal))
  // Off-white ribs running along the lid (its louvres)
  for (const b of [-0.9, -0.45, 0, 0.45, 0.9]) {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8 - 0.5) * 2 * 1.35
      const n = new THREE.Vector3(Math.sin(a) / RX, (Math.cos(a) * Math.cos(b)) / RY, (Math.cos(a) * Math.sin(b)) / RZ).normalize()
      pts.push(new THREE.Vector3(RX * Math.sin(a), RY * Math.cos(a) * Math.cos(b), RZ + RZ * Math.cos(a) * Math.sin(b)).addScaledVector(n, 0.7))
    }
    hinge.add(sweep(kit, pts, () => [0.45, 0.45], new THREE.Vector3(0, -Math.sin(b), Math.cos(b)), OFFWHITE, 20, 6))
  }
  g.add(hinge)
  // Chunky hinge ridge at the back
  g.add(kit.box(26, 1.6, 2, WHITE, 0, 0.4, -RZ + 0.6))
  return g
}

// ---------------------------------------------------------------- Museu de les Ciències

function museuCiencies(kit: Kit) {
  const g = new THREE.Group()
  const L = 58, D = 16, H = 16
  g.add(kit.box(L + 4, 1.4, D + 4, WHITE, 0, 0, 0)) // plinth
  g.add(kit.box(L, H, D, GLASS, 0, 1.4, 0))
  // White roof with blue skylight strips
  g.add(kit.box(L + 1, 1, D + 1, OFFWHITE, 0, H + 1.2, 0))
  for (let x = -L / 2 + 4; x < L / 2 - 2; x += 5.8) g.add(kit.slab(2.4, 0.2, D - 4, GLASS, x + 0.4, H + 2.2, 1))
  // Floors seen through the glass
  for (const y of [6, 11]) g.add(kit.slab(L - 0.4, 0.6, D + 0.2, OFFWHITE, 0, y, 0))
  // South face: a row of white V "trees" meeting at the top beam
  const n = 10, s = L / n, zf = D / 2 + 1.4
  for (let i = 0; i <= n; i++) {
    const x = -L / 2 + i * s
    const fork = new THREE.Vector3(x, 6, zf)
    g.add(beam(kit, new THREE.Vector3(x, 1.4, zf), fork, 1.6, WHITE))
    if (i > 0) g.add(beam(kit, fork, new THREE.Vector3(x - s / 2, H + 1.4, zf), 1.3, WHITE))
    if (i < n) g.add(beam(kit, fork, new THREE.Vector3(x + s / 2, H + 1.4, zf), 1.3, WHITE))
  }
  g.add(kit.box(L + 3, 1.8, 2.6, WHITE, 0, H + 0.6, zf))
  // Top: a jagged white skeleton crest of fins, peaking on the north side
  for (let i = 0; i <= n; i++) {
    const x = -L / 2 + i * s
    const peak = i % 2 ? 6 : 9
    const sh = new THREE.Shape() // drawn in (-z, y)
    sh.moveTo(-(D / 2 + 2), 0)
    sh.lineTo(-(-D / 2 + 1), 0)
    sh.lineTo(-(-D / 2 - 2.5), peak)
    sh.lineTo(-(-D / 2 - 3.5), peak - 1.5)
    sh.lineTo(-(-D / 2 - 1.5), 0)
    sh.closePath()
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 2, bevelEnabled: true, bevelSize: 0.3, bevelThickness: 0.3, bevelSegments: 1 })
    geo.translate(0, 0, -1)
    geo.rotateY(Math.PI / 2)
    const fin = kit.mesh(geo, WHITE, x, H + 1.4, 0)
    g.add(wonk(fin, 70 + i, 0.06))
  }
  g.add(kit.box(L + 2, 1.4, 2, WHITE, 0, H + 1.4, -D / 2 + 1)) // spine joining the fins
  // Stepped white ends
  for (const side of [-1, 1]) {
    const x = side * (L / 2 + 1.5)
    g.add(kit.box(3, H + 3, D + 2, WHITE, x, 0, 0))
    g.add(kit.box(3, H + 7, 6, WHITE, x + side * 0.5, 0, -D / 2 + 3))
  }
  return g
}

// ---------------------------------------------------------------- Pont de l'Assut de l'Or

function assutBridge(kit: Kit) {
  const g = new THREE.Group()
  const z0 = -16, z1 = 18, Y = 3.2
  g.add(kit.box(6, 1.2, z1 - z0, WHITE, 0, Y, (z0 + z1) / 2)) // deck
  for (const x of [-2.7, 2.7]) g.add(kit.slab(0.4, 1.1, z1 - z0, OFFWHITE, x, Y + 1.2, (z0 + z1) / 2)) // railings
  // Ramps down to the ground at both ends
  g.add(beam(kit, new THREE.Vector3(0, Y + 0.6, z1), new THREE.Vector3(0, 0.4, z1 + 8), 1.2, WHITE))
  for (const x of [-2, 0, 2]) g.add(beam(kit, new THREE.Vector3(x, Y + 0.6, z1), new THREE.Vector3(x, 0.4, z1 + 8), 1.2, WHITE))
  for (const x of [-2, 0, 2]) g.add(beam(kit, new THREE.Vector3(x, Y + 0.6, z0), new THREE.Vector3(x, 0.4, z0 - 6), 1.2, WHITE))
  for (const z of [-2, 9]) g.add(kit.taper(3, 2.5, 2, 1.5, Y, WHITE, 0, 0, z)) // piers
  // Tall leaning pylon at the north end
  const pyl = [new THREE.Vector3(0, 0, z0 - 1), new THREE.Vector3(0, 14, z0 - 4.5), new THREE.Vector3(0, 28, z0 - 9.5), new THREE.Vector3(0, 40, z0 - 14)]
  g.add(sweep(kit, pyl, (t) => [1.4 * (1 - 0.7 * t) + 0.3, 2.4 * (1 - 0.75 * t) + 0.3], new THREE.Vector3(1, 0, 0), WHITE, 24, 10))
  g.add(kit.taper(5, 6, 3, 3, 2.5, WHITE, 0, 0, z0 - 1)) // pylon foot
  // Cables fanning from the pylon down to the middle of the deck
  const curve = new THREE.CatmullRomCurve3(pyl)
  const N = 9
  for (let i = 0; i < N; i++) {
    const p = curve.getPointAt(0.35 + (0.6 * i) / (N - 1))
    const q = new THREE.Vector3(0, Y + 1.2, z0 + 3 + ((z1 - z0 - 5) * i) / (N - 1))
    g.add(beam(kit, p, q, 0.35, OFFWHITE))
  }
  return g
}

// ---------------------------------------------------------------- L'Àgora

function agora(kit: Kit) {
  const g = new THREE.Group()
  const H = 27, RX = 9, RZ = 6.5
  const r = (t: number) => Math.pow(1 - t, 0.75) * (1 + 0.25 * Math.sin(Math.PI * t))
  const prof: THREE.Vector2[] = []
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    prof.push(new THREE.Vector2(Math.max(0.001, r(t)), t * H))
  }
  const geo = new THREE.LatheGeometry(prof, 32)
  geo.scale(RX, 1, RZ)
  g.add(kit.mesh(geo, COBALT, 0, 0.8, 0))
  // Blue and white trencadís tiles
  const rand = seeded(17)
  for (let i = 0; i < 120; i++) {
    const t = rand() * 0.88, a = rand() * Math.PI * 2
    const rr = r(t)
    const p = new THREE.Vector3(Math.sin(a) * RX * rr, 0.8 + t * H, Math.cos(a) * RZ * rr)
    const dr = (r(t + 0.01) - rr) / 0.01 / H // slope of the profile
    const n = new THREE.Vector3(Math.sin(a) / RX, -dr, Math.cos(a) / RZ).normalize()
    g.add(tile(kit, p, n, 1 + rand() * 0.9, 0.8 + rand() * 0.7, rand() < 0.7 ? COBALT_LIGHT : WHITE, rand() * 3))
  }
  // White leaf ribs: along the outline on each side and at the front
  for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 10; i++) {
      const t = (i / 10) * 0.97
      const rr = r(t)
      pts.push(new THREE.Vector3(ax * (RX * rr + 0.5), 0.8 + t * H, az * (RZ * rr + 0.5)))
    }
    const side = ax ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
    g.add(sweep(kit, pts, (t) => [0.9 * (1 - 0.6 * t), 0.7 * (1 - 0.5 * t) + 0.2], side, WHITE, 24, 8))
  }
  const ring = new THREE.CylinderGeometry(1, 1.08, 1.2, 32)
  ring.scale(RX + 1.5, 1, RZ + 1.5)
  g.add(kit.mesh(ring, WHITE, 0, 0.6, 0))
  return g
}

// ---------------------------------------------------------------- Umbracle

function umbracle(kit: Kit, length: number) {
  const g = new THREE.Group()
  const n = 7, R = 5.5, SY = 1.4
  for (let i = 0; i <= n; i++) {
    const x = -length / 2 + (length * i) / n
    const arch = new THREE.TorusGeometry(R, 1.1, 8, 14, Math.PI)
    arch.scale(1, SY, 1)
    arch.rotateY(Math.PI / 2)
    g.add(wonk(kit.mesh(arch, WHITE, x, 0, 0), 90 + i, 0.03))
    g.add(kit.box(3, 1, 2.6, WHITE, x, 0, -R)) // feet
    g.add(kit.box(3, 1, 2.6, WHITE, x, 0, R))
  }
  // Long ribs over the arches, covered in vines
  const rand = seeded(23)
  for (const z of [-3.2, 0, 3.2]) {
    const y = SY * Math.sqrt(R * R - z * z)
    g.add(kit.box(length + 2, 0.8, 0.8, WHITE, 0, y, z))
    for (let x = -length / 2 + 1; x < length / 2 - 1; x += 4.5 + rand() * 2.5) {
      const r = 1 + rand() * 0.7
      g.add(kit.mesh(new THREE.IcosahedronGeometry(r, 1), rand() < 0.55 ? VINE : VINE_DARK, x, y + 0.3, z))
    }
  }
  // Walkway, and a row of palms in planters on the south side
  g.add(kit.box(length + 4, 0.5, 2 * R - 2, PAVE, 0, 0, 0))
  for (let i = 0; i < 5; i++) {
    const x = -length / 2 + (length * (i + 0.5)) / 5
    const p = palm(kit, 7.5 + rand() * 2, 200 + i * 3)
    p.position.set(x, 0, R + 3)
    g.add(p)
  }
  return g
}

export function buildCiudadArtes(kit: Kit): THREE.Group {
  const g = new THREE.Group()
  // Pools: one around the Palau, one around the Hemisfèric, a long one in front of the Museu
  g.add(pool(kit, -95, -46, -15, 15, 1))
  g.add(pool(kit, -43, -1, -14, 13, 2))
  g.add(pool(kit, 2, 74, 1, 14, 3))
  // White walkways between the pools
  g.add(kit.box(3, 0.9, 32, WHITE, -44.5, 0, 0))
  g.add(kit.box(3, 0.9, 30, WHITE, 0.5, 0, 0))

  const palau = palauDeLesArts(kit)
  palau.position.set(-70, POOL_Y, 0)
  g.add(palau)
  const eye = hemisferic(kit)
  eye.position.set(-22, POOL_Y, -0.5)
  g.add(eye)
  const museu = museuCiencies(kit)
  museu.position.set(31, 0, -10)
  g.add(museu)
  const bridge = assutBridge(kit)
  bridge.position.set(68, 0, 0)
  g.add(bridge)
  const ag = agora(kit)
  ag.position.set(84, 0, 0)
  g.add(ag)
  const walk = umbracle(kit, 66)
  walk.position.set(28, 0, 24)
  g.add(walk)
  // Garden south of the Palau and the Hemisfèric: flower lawns and palms
  for (const [x0, x1] of [[-94, -48], [-42, -12]]) {
    g.add(kit.box(x1 - x0, 0.5, 9, LAWN, (x0 + x1) / 2, 0, 24))
    g.add(kit.box(x1 - x0 - 4, 0.6, 2, 0xff7aa8, (x0 + x1) / 2, 0.3, 24)) // flower strip
  }
  for (let i = 0; i < 7; i++) {
    const x = -90 + i * 12.5
    const p = palm(kit, 8 + (i % 3), 300 + i)
    p.position.set(x, 0, 19.5)
    g.add(p)
  }

  // ---- Night lights: the glass museum glows from inside, the eye of the Hemisfèric is lit,
  // and soft floodlights wash the white shells and the garden walk ----
  for (const dx of [-21, -7, 7, 21]) g.add(kit.lightHalo(7, 31 + dx, 8, -1, 0.45))
  g.add(kit.lightHalo(9, -22, POOL_Y + 4, 2, 0.7))
  for (const z of [-11, 11]) g.add(kit.lightHalo(9, -70, 6, z, 0.4), kit.lightHalo(7, 84, 7, z * 0.7, 0.4))
  for (const x of [6, 28, 50]) g.add(kit.lightHalo(5, x, 4, 24, 0.3))
  return g
}

/**
 * Park of the old riverbed: vivid green lawn, light paved promenades and round trees, all inside
 * the w x d footprint (model units). Returns the group and the height of its surface.
 */
export function buildCiudadArtesBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 0.3
  g.add(kit.box(w, top, d, LAWN))
  // Promenades along the north and south edges, and a few cross paths
  for (const z of [-d / 2 + 3.5, d / 2 - 3.5]) g.add(kit.slab(w - 4, 0.08, 4, PAVE, 0, top, z))
  for (const x of [-w * 0.36, -w * 0.12, w * 0.3]) g.add(kit.slab(4, 0.08, d - 4, PAVE, x, top, 0))
  // Round trees along the lawn edges
  const rand = seeded(5)
  for (let x = -w / 2 + 5; x < w / 2 - 5; x += 9 + rand() * 4) {
    for (const z of [-d / 2 + 1.8, d / 2 - 1.8]) {
      if (rand() < 0.35) continue
      g.add(bush(kit, 2.2 + rand() * 1.2, rand() < 0.5 ? 0x3fbf4a : 0x2fa844, TRUNK).translateX(x).translateY(top).translateZ(z))
    }
  }
  return { group: g, top }
}
