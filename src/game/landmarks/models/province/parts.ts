// Shared pieces and palette for the small provincial-capital monuments (one per capital, visual
// only: they are not on the travel map). Few colours on purpose: the kit caches one material per
// colour, and every monument is merged into one mesh per colour, so a shared palette keeps the
// draw calls and shader programs low. All pieces are built with the kit, base at y = 0, front
// towards +Z. Units: model units (the JSON `scale` turns them into world units).
import * as THREE from 'three'
import type { Kit } from '../../kit'

export const C = {
  sandstone: 0xe6c98f, // golden stone (Castile, Andalusia)
  limestone: 0xebe0c6, // pale stone
  granite: 0xc4bcaa, // grey granite (Galicia, Ávila)
  schist: 0x8f8a80, // dark slate stone (Lugo)
  brick: 0xc8774a, // mudéjar brick
  trim: 0xcdb587, // cornices and mouldings
  white: 0xf3efe6, // whitewash
  roof: 0xc0563a, // terracotta tiles
  slate: 0x56607a, // slate roofs and spires
  tile: 0x3fae8a, // glazed green tiles
  blue: 0x4f87b5, // glazed blue tiles, stained glass
  gold: 0xf2c14e,
  dark: 0x2b2540, // doors and windows
  iron: 0x3a3f4a,
  rock: 0x9b8f80,
  grass: 0x7ed957,
  sand: 0xe8cf9a,
}

/** Arched or square windows in a row on the plane z (facing +Z), centred on x = 0. */
export function windowRow(kit: Kit, g: THREE.Group, n: number, w: number, h: number, y: number, z: number, span: number, arch = true, color = C.dark) {
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : -span / 2 + (span * i) / (n - 1)
    g.add(kit.slab(w, h, 0.3, color, x, y, z))
    if (arch) g.add(kit.mesh(new THREE.CircleGeometry(w / 2, 8, 0, Math.PI), color, x, y + h, z + 0.16))
  }
}

/** Four-sided pyramid roof (or spire, when tall), base w x d at y. */
export const pyramid = (kit: Kit, w: number, d: number, h: number, color: number, x = 0, y = 0, z = 0) => kit.taper(w, d, 0.05, 0.05, h, color, x, y, z)

/** Cylinder (or cone when rTop ~ 0), base at y. */
export const cyl = (kit: Kit, rTop: number, rBottom: number, h: number, color: number, x = 0, y = 0, z = 0, sides = 10) =>
  kit.mesh(new THREE.CylinderGeometry(rTop, rBottom, h, sides), color, x, y + h / 2, z)

/** Half sphere, base at y. */
export const dome = (kit: Kit, r: number, color: number, x = 0, y = 0, z = 0) =>
  kit.mesh(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), color, x, y, z)

/** Gable roof: ridge along Z, w wide, h high, len long, base at y. */
export function gable(kit: Kit, w: number, h: number, len: number, color: number, x = 0, y = 0, z = 0) {
  const m = kit.pediment(w, h, len, color, y)
  m.position.x = x
  m.position.z = z
  return m
}

/** Square merlons along the four edges of a w x d rectangle, sitting on y. */
export function battlements(kit: Kit, w: number, d: number, size: number, color: number, y = 0) {
  const g = new THREE.Group()
  const row = (len: number, fixed: number, alongX: boolean) => {
    const n = Math.max(2, Math.round(len / (size * 2)))
    for (let i = 0; i < n; i++) {
      const t = -len / 2 + (len * (i + 0.5)) / n
      g.add(alongX ? kit.box(size, size, size * 0.8, color, t, y, fixed) : kit.box(size * 0.8, size, size, color, fixed, y, t))
    }
  }
  for (const s of [-1, 1]) {
    row(w, (s * (d - size * 0.8)) / 2, true)
    row(d - size * 2, (s * (w - size * 0.8)) / 2, false)
  }
  return g
}

/** Round tower with a cap ring and merlons; base at y = 0. */
export function roundTower(kit: Kit, r: number, h: number, color: number, trim: number, merlons = 7) {
  const g = new THREE.Group()
  g.add(cyl(kit, r, r * 1.1, h, color))
  g.add(cyl(kit, r * 1.12, r * 1.12, 0.8, trim, 0, h))
  for (let k = 0; k < merlons; k++) {
    const a = (k * Math.PI * 2) / merlons
    const m = kit.box(r * 0.55, r * 0.5, r * 0.4, color, Math.sin(a) * r * 0.9, h + 0.8, Math.cos(a) * r * 0.9)
    m.rotation.y = a
    g.add(m)
  }
  return g
}

/** Square tower: tapered body, cornice and dark windows on every face; base at y = 0. Returns the top height too. */
export function squareTower(kit: Kit, w: number, h: number, color: number, trim: number, windows = 2) {
  const g = new THREE.Group()
  g.add(kit.taper(w, w, w * 0.94, w * 0.94, h, color))
  g.add(kit.box(w + 0.8, 0.8, w + 0.8, trim, 0, h, 0))
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Group()
    for (let i = 0; i < windows; i++) face.add(kit.slab(w * 0.22, w * 0.4, 0.3, C.dark, 0, h * (0.35 + (0.45 * i) / Math.max(1, windows - 1)) - w * 0.2, w * 0.48))
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  return { group: g, top: h + 0.8 }
}

/** Open belfry: a square storey with an arched opening on each side (dark core inside); base at y = 0. */
export function belfry(kit: Kit, w: number, h: number, color: number, trim: number) {
  const g = new THREE.Group()
  const t = 0.7
  const hole = [{ x: 0, width: w * 0.45, height: h * 0.5, arch: true, bottom: h * 0.15 }]
  for (let k = 0; k < 4; k++) {
    const f = kit.facade(k % 2 === 0 ? w : w - t * 2, h, t, hole, color)
    f.position.z = w / 2 - t / 2
    const face = new THREE.Group()
    face.add(f)
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  g.add(kit.box(w * 0.4, h, w * 0.4, C.dark))
  g.add(kit.box(w + 0.6, 0.7, w + 0.6, trim, 0, h, 0))
  return g
}

/** Rose window facing +Z: a dark disc in a stone ring, centred at (x, y, z). */
export function rose(kit: Kit, r: number, ring: number, glass: number, x = 0, y = 0, z = 0) {
  const g = new THREE.Group()
  g.add(kit.mesh(new THREE.CylinderGeometry(r * 1.2, r * 1.2, 0.5, 14).rotateX(Math.PI / 2), ring, x, y, z))
  g.add(kit.mesh(new THREE.CylinderGeometry(r, r, 0.4, 14).rotateX(Math.PI / 2), glass, x, y, z + 0.2))
  return g
}

/** Flight of steps rising towards -Z: `steps` boxes of stepH, from z0 back by `run` each. */
export function stairs(kit: Kit, w: number, steps: number, stepH: number, run: number, color: number, z0: number) {
  const g = new THREE.Group()
  for (let i = 0; i < steps; i++) g.add(kit.box(w, stepH * (i + 1), run, color, 0, 0, z0 - run * (i + 0.5)))
  return g
}

/** Pointed (Gothic) portal: dark doorway with stepped archivolts, on the plane z; base at y = 0. */
export function portal(kit: Kit, w: number, h: number, color: number, z: number, x = 0) {
  const g = new THREE.Group()
  for (let i = 0; i < 3; i++) {
    const s = 1 - i * 0.22
    g.add(kit.taper(w * s, 0.6, w * s * 0.2, 0.6, h * s * 0.45, i === 2 ? C.dark : color, x, h * s * 0.55, z + 0.3 * i))
    g.add(kit.box(w * s, h * s * 0.55, 0.6, i === 2 ? C.dark : color, x, 0, z + 0.3 * i))
  }
  return g
}

/**
 * A rocky hill with a grass top (an ellipse inside the w x d footprint, all walkable), for the
 * monuments that stand on a height. Returns a `base` function for the model registry.
 */
export function hillBase(top: number) {
  return (kit: Kit, w: number, d: number) => {
    const g = new THREE.Group()
    const mound = (rTop: number, rBottom: number, h: number, color: number, y: number) => {
      const geo = new THREE.CylinderGeometry(rTop, rBottom, h, 16)
      geo.scale(w / 2, 1, d / 2)
      g.add(kit.mesh(geo, color, 0, y + h / 2, 0))
    }
    mound(0.93, 1, top - 0.5, C.rock, 0)
    mound(0.92, 0.93, 0.5, C.grass, top - 0.5)
    return { group: g, top }
  }
}

/** Plain paved square with a grass rim, the floor of most of these monuments. */
export function pavedBase(color = C.trim) {
  return (kit: Kit, w: number, d: number) => {
    const g = new THREE.Group()
    g.add(kit.box(w, 0.6, d, C.grass))
    g.add(kit.box(w - 1.6, 1, d - 1.6, color))
    return { group: g, top: 1 }
  }
}
