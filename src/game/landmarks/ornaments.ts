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

/**
 * Blind horseshoe arch (Islamic style): a flat arch-shaped plate facing +Z, base at y = 0.
 * w: width at the springing line; h: height of the straight part. The arc is a bit more than
 * half a circle, so it closes in at the bottom like a horseshoe. Total height = h + w * 0.93.
 */
export function horseshoeArch(kit: Kit, w: number, h: number, depth: number, color: number) {
  const R = (w / 2) * 1.15
  const t0 = Math.acos(w / 2 / R) // angle where the circle meets the jambs
  const cy = h + R * Math.sin(t0)
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(w / 2, h)
  s.absarc(0, cy, R, -t0, Math.PI + t0, false)
  s.lineTo(-w / 2, 0)
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 })
  geo.translate(0, 0, -depth / 2)
  return kit.mesh(geo, color)
}

/**
 * Sebka panel: lattice of diamonds in relief (Almohad brickwork), facing +Z, base at y = 0.
 * Diamonds touch at their tips, so their outlines form a continuous diagonal net.
 */
export function sebkaPanel(kit: Kit, w: number, h: number, cols: number, rows: number, bar: number, depth: number, color: number) {
  const cw = w / cols, ch = h / rows
  const shapes: THREE.Shape[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + cw * (c + 0.5), y = ch * (r + 0.5)
      const outer = new THREE.Shape()
      outer.moveTo(x, y - ch / 2)
      outer.lineTo(x + cw / 2, y)
      outer.lineTo(x, y + ch / 2)
      outer.lineTo(x - cw / 2, y)
      outer.closePath()
      // Inner hole: same diamond shrunk so the frame is roughly `bar` thick
      const k = Math.max(0.2, 1 - (bar * 2) / Math.min(cw, ch))
      const hole = new THREE.Path()
      hole.moveTo(x, y - (ch / 2) * k)
      hole.lineTo(x - (cw / 2) * k, y)
      hole.lineTo(x, y + (ch / 2) * k)
      hole.lineTo(x + (cw / 2) * k, y)
      hole.closePath()
      outer.holes.push(hole)
      shapes.push(outer)
    }
  }
  const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false })
  geo.translate(0, 0, -depth / 2)
  return kit.mesh(geo, color)
}

/** Stone balustrade around a w x d rectangle: base rail, small balusters and a top rail. */
export function balustrade(kit: Kit, w: number, d: number, h: number, color: number) {
  const g = new THREE.Group()
  const rail = h * 0.18, step = h * 0.55
  for (const z of [-d / 2, d / 2]) {
    g.add(kit.box(w, rail, rail * 1.6, color, 0, 0, z))
    g.add(kit.box(w + rail, rail, rail * 2, color, 0, h - rail, z))
  }
  for (const x of [-w / 2, w / 2]) {
    g.add(kit.box(rail * 1.6, rail, d, color, x, 0, 0))
    g.add(kit.box(rail * 2, rail, d + rail, color, x, h - rail, 0))
  }
  const baluster = (x: number, z: number) =>
    g.add(kit.mesh(new THREE.CylinderGeometry(rail * 0.4, rail * 0.65, h - rail * 2, 6), color, x, h / 2, z))
  for (let x = -w / 2 + step; x < w / 2 - step / 2; x += step) for (const z of [-d / 2, d / 2]) baluster(x, z)
  for (let z = -d / 2 + step; z < d / 2 - step / 2; z += step) for (const x of [-w / 2, w / 2]) baluster(x, z)
  return g
}

/** Pinnacle / urn for corners: small pedestal, body and ball on top. */
export function pinnacle(kit: Kit, h: number, color: number, ball = color) {
  const g = new THREE.Group()
  g.add(kit.box(h * 0.4, h * 0.3, h * 0.4, color))
  g.add(kit.mesh(new THREE.CylinderGeometry(h * 0.08, h * 0.16, h * 0.45, 8), color, 0, h * 0.3 + h * 0.225, 0))
  g.add(kit.mesh(new THREE.IcosahedronGeometry(h * 0.14, 1), ball, 0, h * 0.86, 0))
  return g
}

/** Seville orange tree: trunk, round crown and a few oranges on its surface. */
export function orangeTree(kit: Kit, size: number) {
  const g = bush(kit, size, 0x2f9a45, 0x6b4426)
  const cy = size * 0.75, r = size * 0.5
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, y = 0.55 - (i % 3) * 0.35 // spread around and up/down the crown
    const ring = Math.sqrt(1 - y * y)
    g.add(kit.mesh(new THREE.IcosahedronGeometry(size * 0.07, 0), 0xff8a1e, Math.cos(a) * ring * r, cy + y * r, Math.sin(a) * ring * r))
  }
  return g
}

/**
 * One open storey of a tower: four walls with an arched opening each, trim pilasters at the
 * corners and beside each opening, and a dark core so the openings read as deep. Base at y = 0.
 */
export function openStorey(kit: Kit, w: number, h: number, holeW: number, holeH: number, holeBottom: number, wall: number, trim: number, core: number) {
  const g = new THREE.Group()
  const t = 0.8
  const opening = [{ x: 0, width: holeW, height: holeH, arch: true, bottom: holeBottom }]
  for (let k = 0; k < 4; k++) {
    // Walls on ±Z are full width; walls on ±X fit between them (no overlapping faces)
    const f = kit.facade(k % 2 === 0 ? w : w - t * 2, h, t, opening, wall)
    f.position.z = w / 2 - t / 2
    const face = new THREE.Group()
    face.add(f)
    for (const px of [-(holeW / 2 + 0.6), holeW / 2 + 0.6]) face.add(kit.box(0.5, h, 0.3, trim, px, 0, w / 2 + 0.1))
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  for (const x of [-w / 2, w / 2]) for (const z of [-w / 2, w / 2]) g.add(kit.box(0.9, h, 0.9, trim, x, 0, z))
  g.add(kit.box(w * 0.45, h, w * 0.45, core))
  return g
}

/** Row of stepped Islamic merlons along X (centred), sitting on y = 0. */
export function merlons(kit: Kit, length: number, size: number, color: number) {
  const g = new THREE.Group()
  const n = Math.max(1, Math.floor(length / (size * 1.7)))
  const step = length / n
  for (let i = 0; i < n; i++) {
    const x = -length / 2 + step * (i + 0.5)
    g.add(kit.box(size, size * 0.8, size * 0.6, color, x, 0, 0))
    g.add(kit.box(size * 0.5, size * 0.45, size * 0.6, color, x, size * 0.8, 0)) // stepped top
  }
  return g
}

/** Merlons along the four edges of a w x d rectangle (centred), sitting on y = 0. */
export function merlonRing(kit: Kit, w: number, d: number, size: number, color: number) {
  const g = new THREE.Group()
  for (const z of [-d / 2, d / 2]) {
    const row = merlons(kit, w, size, color)
    row.position.z = z
    g.add(row)
  }
  for (const x of [-w / 2, w / 2]) {
    const row = merlons(kit, d - size * 2, size, color)
    row.rotation.y = Math.PI / 2
    row.position.x = x
    g.add(row)
  }
  return g
}

/** Cartoon cypress: short trunk and a plump teardrop of dark green (round belly, pointy tip). */
export function cypress(kit: Kit, h: number, color = 0x2f8a46) {
  const g = new THREE.Group()
  g.add(kit.box(h * 0.08, h * 0.14, h * 0.08, 0x7a4a2c))
  const r = h * 0.2
  const profile = [
    new THREE.Vector2(0, 0), new THREE.Vector2(r * 0.7, h * 0.04), new THREE.Vector2(r, h * 0.22),
    new THREE.Vector2(r * 0.92, h * 0.45), new THREE.Vector2(r * 0.6, h * 0.68), new THREE.Vector2(r * 0.25, h * 0.82), new THREE.Vector2(0, h * 0.88),
  ]
  g.add(kit.mesh(new THREE.LatheGeometry(profile, 8), color, 0, h * 0.1, 0))
  return g
}

/** Fat bulbous dome (onion-like, cartoon Baroque), radius r at its widest; base at y = 0. */
export function onionDome(kit: Kit, r: number, color: number, tip = color) {
  const g = new THREE.Group()
  const profile = [
    new THREE.Vector2(r * 0.8, 0), new THREE.Vector2(r, r * 0.35), new THREE.Vector2(r * 0.95, r * 0.75),
    new THREE.Vector2(r * 0.65, r * 1.1), new THREE.Vector2(r * 0.25, r * 1.35), new THREE.Vector2(0.001, r * 1.5),
  ]
  g.add(kit.mesh(new THREE.LatheGeometry(profile, 10), color))
  g.add(kit.mesh(new THREE.IcosahedronGeometry(r * 0.22, 1), tip, 0, r * 1.6, 0))
  return g
}

/**
 * Scallop shell (symbol of the Way of St. James), facing +Z: a fan of rounded ribs over a
 * small hinge. size = overall width. Centre of the hinge at (0, 0).
 */
export function scallopShell(kit: Kit, size: number, color: number, rib = color) {
  const g = new THREE.Group()
  const fan = new THREE.Shape()
  fan.moveTo(0, 0)
  fan.absarc(0, 0, size / 2, Math.PI * 0.08, Math.PI * 0.92, false)
  fan.closePath()
  const geo = new THREE.ExtrudeGeometry(fan, { depth: size * 0.08, bevelEnabled: true, bevelSize: size * 0.03, bevelThickness: size * 0.03, bevelSegments: 2, curveSegments: 14 })
  g.add(kit.mesh(geo, color))
  for (let k = 0; k < 7; k++) {
    const a = Math.PI * (0.16 + (0.68 * k) / 6)
    const ribGeo = new THREE.CylinderGeometry(size * 0.03, size * 0.05, size * 0.46, 5)
    ribGeo.translate(0, size * 0.23, 0)
    const m = kit.mesh(ribGeo, rib, 0, 0, size * 0.13)
    m.rotation.z = a - Math.PI / 2
    g.add(m)
  }
  g.add(kit.box(size * 0.3, size * 0.12, size * 0.12, color, 0, -size * 0.1, size * 0.04)) // hinge
  return g
}

/** Chunky beam from point p to point q (square section t), e.g. a ramp wrapping a tower. */
export function beam(kit: Kit, p: THREE.Vector3, q: THREE.Vector3, t: number, color: number) {
  const dir = new THREE.Vector3().subVectors(q, p)
  const m = kit.box(dir.length() + t, t, t, color)
  m.position.copy(p).add(q).multiplyScalar(0.5)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize())
  return m
}

/**
 * Horseshoe arch ring of alternating voussoirs (red and cream wedges, as in Córdoba), facing +Z.
 * Centre of the arc at (0, 0); r: inner radius; band: thickness of the ring.
 */
export function voussoirArch(kit: Kit, r: number, band: number, depth: number, colors: number[], count = 11) {
  const g = new THREE.Group()
  const from = -0.3, to = Math.PI + 0.3 // a bit past half a circle: horseshoe
  for (let i = 0; i < count; i++) {
    const a0 = from + ((to - from) * i) / count, a1 = from + ((to - from) * (i + 1)) / count
    const s = new THREE.Shape()
    s.absarc(0, 0, r + band, a0, a1, false)
    s.lineTo(Math.cos(a1) * r, Math.sin(a1) * r)
    s.absarc(0, 0, r, a1, a0, true)
    s.closePath()
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 3 })
    geo.translate(0, 0, -depth / 2)
    g.add(kit.mesh(geo, colors[i % colors.length]))
  }
  return g
}

/** Straight wall between two points (x, z) on the ground, height h and thickness t. */
export function wallBetween(kit: Kit, ax: number, az: number, bx: number, bz: number, h: number, t: number, color: number) {
  const len = Math.hypot(bx - ax, bz - az)
  const m = kit.box(len + t, h, t, color, (ax + bx) / 2, 0, (az + bz) / 2)
  m.rotation.y = Math.atan2(-(bz - az), bx - ax) // align the box's X axis with the wall
  return m
}
