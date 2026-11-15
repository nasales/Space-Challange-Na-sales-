// "Caja de herramientas" para construir monumentos low-poly con piezas simples.
// Lleva la cuenta de geometrías y materiales para poder liberarlos después.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js'
import { toonMaterial } from '../scene/toonGradient'

/** Hueco de una fachada: rectangular o en arco (medio punto). */
export interface Opening {
  /** centro horizontal del hueco */
  x: number
  width: number
  /** altura de la parte recta; si es arco, encima va un semicírculo de radio width/2 */
  height: number
  arch?: boolean
  /** altura a la que empieza el hueco (0 = suelo de la fachada) */
  bottom?: number
}

/** A night light placed in a model (see lightPanel / lightHalo): for a halo, w = h = radius. */
export interface LightMarker {
  panel: boolean
  w: number
  h: number
  intensity: number
}

/** Bevel of the chunky boxes, as a fraction of their smallest side (cartoon toy look). */
const BEVEL = 0.14
const MAX_BEVEL = 1.5

/**
 * Box with bevelled edges and corners (44 triangles instead of 12): soft, chunky "toy" edges
 * that catch the cel light and give the ink outline a rounder silhouette. Centred at the origin.
 */
const chamferCache = new Map<string, THREE.BufferGeometry>()
function chamferBox(w: number, h: number, d: number) {
  const r = Math.min(MAX_BEVEL, Math.min(w, h, d) * BEVEL)
  if (r < 0.03) return new THREE.BoxGeometry(w, h, d)
  const key = `${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)}`
  let geo = chamferCache.get(key)
  if (!geo) {
    const pts: THREE.Vector3[] = []
    const hw = w / 2, hh = h / 2, hd = d / 2
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          pts.push(
            new THREE.Vector3(sx * (hw - r), sy * hh, sz * (hd - r)),
            new THREE.Vector3(sx * hw, sy * (hh - r), sz * (hd - r)),
            new THREE.Vector3(sx * (hw - r), sy * (hh - r), sz * hd),
          )
        }
      }
    }
    geo = new ConvexGeometry(pts)
    chamferCache.set(key, geo)
  }
  return geo.clone()
}

/** Small deterministic pseudo-random numbers (same model every time). */
export function seeded(seed: number) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

/**
 * Hand-drawn wobble: a tiny tilt and squash so towers and spires are not ruler-straight,
 * like in a cartoon. Deterministic for a given seed.
 */
export function wonk<T extends THREE.Object3D>(obj: T, seed: number, amount = 0.025): T {
  const rand = seeded(seed)
  obj.rotation.x += (rand() - 0.5) * amount
  obj.rotation.z += (rand() - 0.5) * amount
  obj.scale.y *= 1 + (rand() - 0.5) * amount * 2
  return obj
}

export function createKit() {
  const geometries: THREE.BufferGeometry[] = []
  const materials = new Map<number, THREE.Material>()

  /** Material de un color (se reutiliza si ya existe). */
  const mat = (color: number) => {
    if (!materials.has(color)) materials.set(color, toonMaterial(color)) // estilo cartoon, como el terreno
    return materials.get(color)!
  }

  /** Crea una malla con sombras y la coloca en (x, y, z). */
  const mesh = (geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0) => {
    geometries.push(geo)
    const m = new THREE.Mesh(geo, mat(color))
    m.position.set(x, y, z)
    m.castShadow = m.receiveShadow = true
    return m
  }

  /** Chunky bevelled box; y = height of its base. */
  const box = (w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) =>
    mesh(chamferBox(w, h, d), color, x, y + h / 2, z)

  /** Sharp flat box for thin panels laid on a façade (windows, glass, plaques); y = base. */
  const slab = (w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) =>
    mesh(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z)

  /**
   * Tapered block (wider at the feet than at the top), base at y. Cartoon towers and walls stand
   * on wide feet. wb x db: bottom size; wt x dt: top size.
   */
  const taper = (wb: number, db: number, wt: number, dt: number, h: number, color: number, x = 0, y = 0, z = 0) => {
    const pts: THREE.Vector3[] = []
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        pts.push(new THREE.Vector3((sx * wb) / 2, 0, (sz * db) / 2), new THREE.Vector3((sx * wt) / 2, h, (sz * dt) / 2))
      }
    }
    return mesh(new ConvexGeometry(pts), color, x, y, z)
  }

  /**
   * Fachada con huecos de verdad: se dibuja la silueta (con agujeros en arco o rectangulares)
   * y se le da grosor. La fachada mira hacia ±Z y su base está en y = 0.
   */
  const facade = (width: number, height: number, depth: number, openings: Opening[], color: number) => {
    const shape = new THREE.Shape()
    shape.moveTo(-width / 2, 0)
    shape.lineTo(width / 2, 0)
    shape.lineTo(width / 2, height)
    shape.lineTo(-width / 2, height)
    shape.closePath()
    for (const o of openings) {
      const b = o.bottom ?? 0, l = o.x - o.width / 2, r = o.x + o.width / 2
      const hole = new THREE.Path()
      hole.moveTo(l, b)
      hole.lineTo(r, b)
      hole.lineTo(r, b + o.height)
      if (o.arch) hole.absarc(o.x, b + o.height, o.width / 2, 0, Math.PI, false)
      else hole.lineTo(l, b + o.height)
      hole.closePath()
      shape.holes.push(hole)
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 })
    geo.translate(0, 0, -depth / 2)
    return mesh(geo, color)
  }

  /** Prisma triangular (frontón): base `width`, altura `height`, fondo `depth`; base en y = 0. */
  const pediment = (width: number, height: number, depth: number, color: number, y = 0) => {
    const shape = new THREE.Shape()
    shape.moveTo(-width / 2, 0)
    shape.lineTo(width / 2, 0)
    shape.lineTo(0, height)
    shape.closePath()
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
    geo.translate(0, 0, -depth / 2)
    return mesh(geo, color, 0, y, 0)
  }

  /**
   * Junta todas las piezas del mismo color de un grupo en una sola malla.
   * Un monumento puede tener cientos de piezas; así se dibuja con una llamada por color
   * en vez de una por pieza (mucho más rápido). Devuelve un grupo nuevo con las mallas unidas.
   */
  const merge = (root: THREE.Object3D) => {
    root.updateMatrixWorld(true)
    const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>()
    const used = new Set<THREE.BufferGeometry>()
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
      g.deleteAttribute('uv') // no usamos texturas; así todas las piezas tienen los mismos datos
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld))
      const mat = m.material as THREE.Material
      if (!buckets.has(mat)) buckets.set(mat, [])
      buckets.get(mat)!.push(g)
      used.add(m.geometry)
    })
    const out = new THREE.Group()
    for (const [mat, list] of buckets) {
      const merged = mergeGeometries(list)!
      list.forEach((g) => g.dispose())
      geometries.push(merged)
      const m = new THREE.Mesh(merged, mat)
      m.castShadow = m.receiveShadow = true
      out.add(m)
    }
    // Las piezas sueltas ya no hacen falta
    for (const g of used) {
      g.dispose()
      const i = geometries.indexOf(g)
      if (i >= 0) geometries.splice(i, 1)
    }
    return out
  }

  /**
   * Night light on a wall (lit window, arch, door): a w x h rectangle facing +Z of its parent,
   * base at y like slab(). It is only a marker, placed like any other piece (so it follows the
   * rotations of its group); createLandmarks turns the markers into the night-light mesh.
   * Put it just in front of the wall or window it lights.
   */
  const lightPanel = (w: number, h: number, x = 0, y = 0, z = 0, rotY = 0, intensity = 1) => {
    const o = new THREE.Object3D()
    o.position.set(x, y + h / 2, z)
    o.rotation.y = rotY
    o.userData.nightLight = { panel: true, w, h, intensity } satisfies LightMarker
    return o
  }

  /** Round night glow centred at (x, y, z): lantern, tower top or soft floodlight. Marker, like lightPanel. */
  const lightHalo = (radius: number, x = 0, y = 0, z = 0, intensity = 1) => {
    const o = new THREE.Object3D()
    o.position.set(x, y, z)
    o.userData.nightLight = { panel: false, w: radius, h: radius, intensity } satisfies LightMarker
    return o
  }

  /** The night-light markers under `root`, each with its matrix relative to `root`. Call before merge(). */
  const lights = (root: THREE.Object3D) => {
    root.updateMatrixWorld(true)
    const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert()
    const out: (LightMarker & { matrix: THREE.Matrix4 })[] = []
    root.traverse((o) => {
      const marker = o.userData.nightLight as LightMarker | undefined
      if (marker) out.push({ ...marker, matrix: new THREE.Matrix4().multiplyMatrices(toRoot, o.matrixWorld) })
    })
    return out
  }

  const dispose = () => {
    geometries.forEach((g) => g.dispose())
    materials.forEach((m) => m.dispose())
  }

  return { mat, mesh, box, slab, taper, facade, pediment, lightPanel, lightHalo, lights, merge, dispose }
}

export type Kit = ReturnType<typeof createKit>
