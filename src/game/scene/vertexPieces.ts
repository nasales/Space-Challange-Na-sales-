// Piezas para montar modelos con el color guardado en cada vértice (casas, árboles, molinos...).
// Todas las piezas de un modelo se juntan luego en UNA geometría (mergeGeometries) y se dibujan
// con un solo material toon con vertexColors: muchas piezas de colores, una sola llamada de dibujo.
import * as THREE from 'three'

/** Una pieza: geometría colocada en su sitio, sin índices ni UV y con su color en cada vértice. */
export function piece(geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, rotY = 0) {
  if (rotY) geo.rotateY(rotY)
  geo.translate(x, y, z)
  const g = geo.index ? geo.toNonIndexed() : geo
  if (g !== geo) geo.dispose()
  g.deleteAttribute('uv')
  const c = new THREE.Color(color)
  const colors = new Float32Array(g.attributes.position.count * 3)
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i)
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

/** Caja con la base en y0 (no en su centro). */
export const box = (w: number, h: number, d: number, color: number, x = 0, y0 = 0, z = 0) =>
  piece(new THREE.BoxGeometry(w, h, d), color, x, y0 + h / 2, z)

/**
 * Placa plana (ventana, puerta) pegada a una fachada: 2 triángulos en vez de los 12 de una caja.
 * Mira hacia +Z; con rotY = ±π/2 mira hacia ±X (fachadas laterales). Base en y0.
 */
export const plate = (w: number, h: number, color: number, x: number, y0: number, z: number, rotY = 0) =>
  piece(new THREE.PlaneGeometry(w, h), color, x, y0 + h / 2, z, rotY)

/** Cilindro (o cono truncado) con la base en y0. */
export const cylinder = (rTop: number, rBottom: number, h: number, color: number, x = 0, y0 = 0, z = 0, segments = 6) =>
  piece(new THREE.CylinderGeometry(rTop, rBottom, h, segments), color, x, y0 + h / 2, z)

/** Cono con la base en y0. */
export const cone = (r: number, h: number, color: number, x = 0, y0 = 0, z = 0, segments = 6) =>
  piece(new THREE.ConeGeometry(r, h, segments), color, x, y0 + h / 2, z)

/** Bola facetada (copa de árbol) de radio r, centrada en (x, y, z), achatada en altura con sy. */
export function blob(r: number, color: number, x = 0, y = 0, z = 0, sy = 1, detail = 0) {
  const geo = new THREE.IcosahedronGeometry(r, detail)
  geo.scale(1, sy, 1)
  return piece(geo, color, x, y, z)
}
