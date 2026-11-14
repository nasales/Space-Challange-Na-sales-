// "Caja de herramientas" para construir monumentos low-poly con piezas simples.
// Lleva la cuenta de geometrías y materiales para poder liberarlos después.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
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

  const box = (w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) =>
    mesh(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z) // y = altura de la base

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

  const dispose = () => {
    geometries.forEach((g) => g.dispose())
    materials.forEach((m) => m.dispose())
  }

  return { mat, mesh, box, facade, pediment, merge, dispose }
}

export type Kit = ReturnType<typeof createKit>
