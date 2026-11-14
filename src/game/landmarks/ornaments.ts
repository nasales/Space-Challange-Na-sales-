// Piezas decorativas reutilizables para los monumentos (columnas, arcos, estatuas, jardines...).
// Todas se construyen con el kit y devuelven un grupo con su base en y = 0.
import * as THREE from 'three'
import type { Kit } from './kit'

/** Columna jónica: basa, fuste que se estrecha un poco y capitel con dos volutas. */
export function ionicColumn(kit: Kit, height: number, radius: number, color: number, trim: number) {
  const g = new THREE.Group()
  const baseH = radius * 0.9, capH = radius * 0.8
  g.add(kit.box(radius * 2.6, baseH * 0.45, radius * 2.6, trim)) // plinto
  g.add(kit.mesh(new THREE.CylinderGeometry(radius * 1.2, radius * 1.3, baseH * 0.55, 16), trim, 0, baseH * 0.45 + baseH * 0.275, 0))
  const shaftH = height - baseH - capH
  g.add(kit.mesh(new THREE.CylinderGeometry(radius * 0.88, radius, shaftH, 16), color, 0, baseH + shaftH / 2, 0))
  // Capitel: equino + ábaco + volutas (rollos a los lados)
  const capY = baseH + shaftH
  g.add(kit.mesh(new THREE.CylinderGeometry(radius * 1.05, radius * 0.9, capH * 0.35, 16), trim, 0, capY + capH * 0.175, 0))
  g.add(kit.box(radius * 2.5, capH * 0.3, radius * 2.1, trim, 0, capY + capH * 0.7, 0))
  for (const side of [-1, 1]) {
    const volute = new THREE.CylinderGeometry(radius * 0.42, radius * 0.42, radius * 2.2, 12)
    volute.rotateX(Math.PI / 2)
    g.add(kit.mesh(volute, trim, side * radius * 1.15, capY + capH * 0.45, 0))
  }
  return g
}

/**
 * Rosca de un arco (archivolta) con su clave, para poner delante de un hueco en arco.
 * x, springY: centro del arco y altura donde empieza a curvarse; r: radio del hueco.
 */
export function archRing(kit: Kit, x: number, springY: number, r: number, band: number, depth: number, color: number, keyColor: number) {
  const g = new THREE.Group()
  const shape = new THREE.Shape()
  shape.absarc(0, 0, r + band, 0, Math.PI, false)
  shape.lineTo(-r, 0)
  shape.absarc(0, 0, r, Math.PI, 0, true)
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 })
  geo.translate(0, 0, -depth / 2)
  g.add(kit.mesh(geo, color))
  // Clave: la piedra central, un poco más grande y saliente
  const key = new THREE.Shape()
  key.moveTo(-band * 0.45, 0)
  key.lineTo(band * 0.45, 0)
  key.lineTo(band * 0.7, band * 1.5)
  key.lineTo(-band * 0.7, band * 1.5)
  key.closePath()
  const keyGeo = new THREE.ExtrudeGeometry(key, { depth: depth * 1.3, bevelEnabled: false })
  keyGeo.translate(0, r - band * 0.2, -depth * 0.65)
  g.add(kit.mesh(keyGeo, keyColor))
  g.position.set(x, springY, 0)
  return g
}

/** Fila de dentículos (dientecillos bajo una cornisa), a lo largo del eje X. */
export function dentils(kit: Kit, length: number, size: number, color: number, y: number, z: number) {
  const g = new THREE.Group()
  const n = Math.floor(length / (size * 2))
  for (let i = 0; i < n; i++) {
    const x = -length / 2 + size + i * size * 2
    g.add(kit.box(size, size, size, color, x, y, z))
  }
  return g
}

/** Figura humana sencilla tipo estatua (de pie o sentada), de altura h. */
export function statue(kit: Kit, h: number, color: number, pose: 'stand' | 'sit' = 'stand') {
  const g = new THREE.Group()
  const r = h * 0.14
  if (pose === 'stand') {
    g.add(kit.box(h * 0.36, h * 0.12, h * 0.3, color)) // peana
    g.add(kit.mesh(new THREE.CylinderGeometry(r * 0.9, r * 1.4, h * 0.62, 10), color, 0, h * 0.12 + h * 0.31, 0)) // túnica
    g.add(kit.mesh(new THREE.IcosahedronGeometry(r * 0.85, 1), color, 0, h * 0.74 + r * 0.6, 0)) // cabeza
    const arm = new THREE.CylinderGeometry(r * 0.3, r * 0.3, h * 0.42, 6)
    arm.rotateZ(-0.5)
    g.add(kit.mesh(arm, color, r * 1.2, h * 0.62, 0)) // brazo levantado
  } else {
    g.add(kit.box(h * 0.5, h * 0.3, h * 0.4, color)) // asiento
    g.add(kit.mesh(new THREE.CylinderGeometry(r * 0.9, r * 1.3, h * 0.45, 10), color, 0, h * 0.3 + h * 0.22, 0))
    g.add(kit.mesh(new THREE.IcosahedronGeometry(r * 0.85, 1), color, 0, h * 0.75 + r * 0.4, 0))
  }
  return g
}

/** Trofeo militar: peana, coraza, casco y dos banderas cruzadas (rojigualdas). */
export function trophy(kit: Kit, h: number, stone: number, flagA: number, flagB: number, pole: number) {
  const g = new THREE.Group()
  g.add(kit.box(h * 0.5, h * 0.25, h * 0.5, stone)) // peana
  g.add(kit.mesh(new THREE.CylinderGeometry(h * 0.16, h * 0.2, h * 0.32, 10), stone, 0, h * 0.25 + h * 0.16, 0)) // coraza
  g.add(kit.mesh(new THREE.SphereGeometry(h * 0.13, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), stone, 0, h * 0.57, 0)) // casco
  for (const side of [-1, 1]) {
    const flag = new THREE.Group()
    const p = new THREE.CylinderGeometry(h * 0.02, h * 0.02, h * 0.9, 6)
    flag.add(kit.mesh(p, pole, 0, h * 0.45, 0))
    // Bandera a franjas: roja, amarilla (más ancha), roja
    const fw = h * 0.34, fh = h * 0.24
    flag.add(kit.box(fw, fh * 0.25, h * 0.015, flagA, fw / 2, h * 0.9 - fh * 0.25, 0))
    flag.add(kit.box(fw, fh * 0.5, h * 0.015, flagB, fw / 2, h * 0.9 - fh * 0.75, 0))
    flag.add(kit.box(fw, fh * 0.25, h * 0.015, flagA, fw / 2, h * 0.9 - fh, 0))
    flag.position.y = h * 0.2
    // La de la izquierda es la misma bandera girada media vuelta (no se usa escala negativa:
    // daría la vuelta a las caras al juntar las piezas en una sola malla)
    flag.rotation.set(0, side < 0 ? Math.PI : 0, -0.45)
    g.add(flag)
  }
  return g
}

/** Escudo con corona encima (para un frontón). Mira hacia +Z. */
export function crownedShield(kit: Kit, h: number, field: number, charge: number, gold: number) {
  const g = new THREE.Group()
  const w = h * 0.6
  const s = new THREE.Shape()
  s.moveTo(-w / 2, h * 0.7)
  s.lineTo(w / 2, h * 0.7)
  s.lineTo(w / 2, h * 0.3)
  s.quadraticCurveTo(w / 2, 0, 0, -h * 0.05)
  s.quadraticCurveTo(-w / 2, 0, -w / 2, h * 0.3)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth: h * 0.12, bevelEnabled: false, curveSegments: 8 })
  g.add(kit.mesh(geo, field))
  // Cuartelado: dos cuarteles de otro color
  g.add(kit.box(w * 0.42, h * 0.32, h * 0.04, charge, -w * 0.23, h * 0.36, h * 0.13))
  g.add(kit.box(w * 0.42, h * 0.26, h * 0.04, charge, w * 0.2, h * 0.06, h * 0.13))
  // Corona: aro, puntas con perlas y orbe
  g.add(kit.mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.38, h * 0.12, 12), gold, 0, h * 0.78, h * 0.06))
  for (let i = -2; i <= 2; i++) g.add(kit.mesh(new THREE.SphereGeometry(h * 0.04, 6, 4), gold, i * w * 0.17, h * 0.9, h * 0.06 + Math.abs(i) * 0.0))
  g.add(kit.mesh(new THREE.SphereGeometry(h * 0.07, 8, 6), gold, 0, h * 0.98, h * 0.06))
  return g
}

/** Verja de hierro alrededor de un rectángulo (w x d): barrotes negros con punta dorada. */
export function fence(kit: Kit, w: number, d: number, h: number, spacing: number, iron: number, tip: number) {
  const g = new THREE.Group()
  const post = (x: number, z: number) => {
    g.add(kit.box(h * 0.06, h, h * 0.06, iron, x, 0, z))
    g.add(kit.mesh(new THREE.ConeGeometry(h * 0.07, h * 0.16, 4), tip, x, h + h * 0.08, z))
  }
  for (const z of [-d / 2, d / 2]) {
    for (let x = -w / 2; x <= w / 2 + 1e-6; x += spacing) post(x, z)
    for (const y of [h * 0.15, h * 0.85]) g.add(kit.box(w, h * 0.05, h * 0.05, iron, 0, y, z))
  }
  for (const x of [-w / 2, w / 2]) {
    for (let z = -d / 2 + spacing; z < d / 2 - 1e-6; z += spacing) post(x, z)
    for (const y of [h * 0.15, h * 0.85]) g.add(kit.box(h * 0.05, h * 0.05, d, iron, x, y, 0))
  }
  return g
}

/** Parterre: fila de flores de colores alternos a lo largo del eje X. */
export function flowerBed(kit: Kit, length: number, width: number, soil: number, colors: number[]) {
  const g = new THREE.Group()
  g.add(kit.box(length, width * 0.12, width, soil))
  const step = width * 0.5
  let i = 0
  for (let x = -length / 2 + step / 2; x < length / 2; x += step) {
    for (const z of [-width * 0.22, width * 0.22]) {
      const c = colors[i++ % colors.length]
      g.add(kit.mesh(new THREE.IcosahedronGeometry(width * 0.2, 0), c, x, width * 0.22, z))
    }
  }
  return g
}

/** Seto redondo / arbolito de jardín (bola verde sobre tronquito). */
export function bush(kit: Kit, size: number, leaf: number, trunk: number) {
  const g = new THREE.Group()
  g.add(kit.box(size * 0.15, size * 0.4, size * 0.15, trunk))
  g.add(kit.mesh(new THREE.IcosahedronGeometry(size * 0.5, 1), leaf, 0, size * 0.75, 0))
  return g
}
