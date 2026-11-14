// Modelos cartoon del paisaje: cada uno es UNA geometría con el color en los vértices.
// Medidas en unidades del mundo (el detective mide unas 9 de alto). Base en y = 0; los troncos
// se hunden un poco bajo el suelo para que no floten en las cuestas.
//
// Trees are drawn as comic shapes (Spider-Verse look, see createScenery.ts): each crown is a few
// chunky low-poly clumps in a light / mid / dark green, so the flat cel bands and the halftone
// shade break into graphic shapes. Every tree also carries an `aSway` attribute (0 at the trunk,
// up to its flexibility at the top) that drives the stepped wind in the shader.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { piece, box, cylinder, cone, blob } from '../scene/vertexPieces'
import type { SceneryKind } from './placeScenery'

const SINK = 2
const BARK = 0x8a5a3a
const DARK_BARK = 0x5e3d28

const merge = (parts: THREE.BufferGeometry[]) => {
  const g = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  return g
}

/**
 * Wind weight per vertex: 0 below `from` (trunk), rising smoothly to `flex` at `to` (crown top).
 * The shader moves each vertex sideways by this much (world units) at the peak of a gust.
 */
function withSway(geo: THREE.BufferGeometry, from: number, to: number, flex: number) {
  const pos = geo.attributes.position
  const sway = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - from) / (to - from)))
    sway[i] = flex * t * t * (3 - 2 * t)
  }
  geo.setAttribute('aSway', new THREE.BufferAttribute(sway, 1))
  return geo
}

/** One crown clump: a faceted ball, squashed and turned so no two clumps look the same. */
function clump(r: number, color: number, x: number, y: number, z: number, sy = 0.8, turn = 0) {
  const g = blob(r, color, 0, 0, 0, sy)
  g.rotateY(turn)
  g.translate(x, y, z)
  return g
}

/** Olivo: bajito, tronco retorcido en dos tramos y copa gris verdosa en cuatro matas sueltas. */
function olive() {
  return withSway(
    merge([
      cylinder(0.5, 0.85, 3 + SINK, BARK, 0, -SINK),
      cylinder(0.32, 0.5, 2.2, DARK_BARK, 0.55, 2.6),
      cylinder(0.25, 0.4, 1.8, BARK, -0.6, 2.4),
      clump(2.4, 0x8fae55, 0, 5.1, 0, 0.7, 0.4),
      clump(1.9, 0xb9d374, 1.7, 5.9, 0.5, 0.72, 1.1),
      clump(1.7, 0x7a9a48, -1.6, 5.5, -0.8, 0.75, 2.2),
      clump(1.3, 0xc8dc86, 0.3, 6.6, -1.2, 0.7, 0.8),
    ]),
    3.2,
    7.5,
    0.35,
  )
}

/** Fila de viña: caballón de tierra rojiza y cepas verdes encima, a lo largo de X. */
function vine() {
  const parts = [box(12, 0.6 + SINK, 2.2, 0xc0703f, 0, -SINK)]
  for (let i = -5; i <= 5; i += 2) {
    parts.push(cylinder(0.15, 0.2, 1.2, DARK_BARK, i, 0.6))
    parts.push(clump(1.1, i % 4 === 1 ? 0x6ad63c : 0x4fc23a, i, 2.2, 0, 0.8, i))
    parts.push(clump(0.7, 0x8be35a, i + 0.4, 2.9, 0.3, 0.75, i * 2))
  }
  return withSway(merge(parts), 1.5, 3.4, 0.25)
}

/** Pino: tronco oscuro y pisos de cono escalonados y algo girados, con la punta clara. */
function pine() {
  const tier = (r: number, h: number, color: number, y: number, dx: number, turn: number) => {
    const g = cone(r, h, color, 0, 0, 0, 7)
    g.rotateY(turn)
    g.translate(dx, y, 0)
    return g
  }
  return withSway(
    merge([
      cylinder(0.45, 0.7, 5 + SINK, DARK_BARK, 0, -SINK),
      tier(4.5, 5.6, 0x177f4a, 4, 0, 0),
      tier(3.7, 5.2, 0x1f9a58, 7, 0.15, 0.45),
      tier(2.8, 4.6, 0x26ad62, 10, -0.1, 0.9),
      tier(1.7, 3.6, 0x4cc878, 13, 0.1, 1.3),
    ]),
    4,
    16.5,
    0.9,
  )
}

/** Árbol de hoja (roble, castaño): copa grande en cinco matas de tres verdes. */
function broadleaf() {
  return withSway(
    merge([
      cylinder(0.6, 0.95, 6 + SINK, BARK, 0, -SINK),
      cylinder(0.3, 0.45, 2.4, BARK, 0.9, 5.4),
      clump(3.9, 0x2fb84c, 0, 9, 0, 0.85, 0),
      clump(2.8, 0x5ee060, 2.2, 10.6, 1, 0.8, 0.7),
      clump(2.6, 0x239c43, -2.3, 9.6, -0.9, 0.85, 1.6),
      clump(2.2, 0x46d058, 0.4, 11.8, -1.6, 0.8, 2.4),
      clump(1.6, 0x86ec74, 1.2, 12.6, 0.9, 0.75, 3.1),
    ]),
    5.5,
    14,
    0.55,
  )
}

/** Encina de dehesa: tronco corto y copa ancha y aplastada, en matas de verde oscuro. */
function holmoak() {
  return withSway(
    merge([
      cylinder(0.7, 1.05, 3.5 + SINK, DARK_BARK, 0, -SINK),
      cylinder(0.4, 0.55, 2.2, DARK_BARK, -1, 3.1),
      clump(4.6, 0x357f3f, 0, 6.4, 0, 0.5, 0.3),
      clump(3.2, 0x4ea656, 2.6, 7.4, -0.8, 0.55, 1.2),
      clump(3, 0x2b6e36, -2.8, 6.9, 1, 0.55, 2),
      clump(2.2, 0x67bb63, 0.6, 8.3, 1.4, 0.5, 2.7),
    ]),
    4,
    9.5,
    0.2,
  )
}

/**
 * Palm leaf: a tapered blade (wide at the base, a point at the tip) bent down in two segments,
 * pointing along +Z from the crown.
 */
function palmLeaf(color: number, droop: number) {
  const base = 1.5, len = 3.6
  const seg1 = new THREE.CylinderGeometry(base * 0.55, base, len, 4, 1)
  seg1.rotateX(Math.PI / 2)
  seg1.scale(1, 0.18, 1)
  seg1.translate(0, 0, len / 2)
  seg1.rotateX(droop * 0.5)
  const seg2 = new THREE.ConeGeometry(base * 0.55, len, 4, 1)
  seg2.rotateX(Math.PI / 2)
  seg2.scale(1, 0.18, 1)
  seg2.translate(0, 0, len / 2)
  seg2.rotateX(droop)
  const tip = Math.cos(droop * 0.5) * len
  seg2.translate(0, -Math.sin(droop * 0.5) * len, tip)
  return merge([piece(seg1, color), piece(seg2, color)])
}

/** Palmera: tronco alto con anillos y un penacho de hojas en punta que caen. */
function palm() {
  const parts = [cylinder(0.55, 0.8, 4 + SINK, 0xc9925a, 0, -SINK)]
  for (let i = 0; i < 4; i++) parts.push(cylinder(0.5, 0.6, 3.2, i % 2 ? 0xc9925a : 0xb37d4b, i * 0.25, 4 + i * 3))
  const top = 16.5
  for (let k = 0; k < 9; k++) {
    const leaf = palmLeaf(k % 3 === 0 ? 0x7ae06a : k % 3 === 1 ? 0x3cc455 : 0x2ea84a, k % 2 ? 0.45 : 0.8)
    leaf.rotateY((k / 9) * Math.PI * 2 + (k % 2) * 0.2)
    leaf.translate(1, top, 0)
    parts.push(leaf)
  }
  parts.push(blob(1, 0x8a5a3a, 1, top, 0))
  return withSway(merge(parts), 5, 22, 1.1)
}

/** Altura del eje de las aspas del molino y lo que sobresale hacia delante (+Z). */
export const WINDMILL_HUB = { y: 14.5, z: 4 }

/** Cuerpo del molino manchego: torre blanca encalada con zócalo azul, puerta y tejado negro. */
function windmill() {
  return merge([
    cylinder(3.1, 3.6, 13 + SINK, 0xfbf7ef, 0, -SINK, 0, 12),
    cylinder(3.65, 3.7, 1.2 + SINK, 0x2f6fb5, 0, -SINK, 0, 12),
    cone(3.9, 4.5, 0x2a2833, 0, 13, 0, 12),
    box(1.8, 3.2, 0.4, 0x7a4a2c, 0, 0, 3.5), // puerta
    box(1.1, 1.3, 0.4, 0x2f6fb5, 0, 8, 3.25), // ventanuco
    cylinder(0.45, 0.45, 1.6, DARK_BARK, 0, 0, 0, 6).rotateX(Math.PI / 2).translate(0, WINDMILL_HUB.y, 2.8), // eje
  ])
}

/** Aspas del molino, en el plano XY y centradas en el eje (giran sobre Z). */
export function windmillSails() {
  const parts: THREE.BufferGeometry[] = [blob(0.7, DARK_BARK)]
  for (let k = 0; k < 4; k++) {
    const arm = merge([
      box(0.4, 11, 0.35, 0x7a4a2c, 0, 0, 0), // palo
      box(2.1, 8, 0.2, 0xf3eee6, 1.3, 2.8, 0.1), // tela / enrejado
      box(2.1, 0.25, 0.3, 0x7a4a2c, 1.3, 6.8, 0.2),
      box(2.1, 0.25, 0.3, 0x7a4a2c, 1.3, 4.8, 0.2),
    ])
    arm.rotateZ((k * Math.PI) / 2)
    parts.push(arm)
  }
  return merge(parts)
}

export const SCENERY_MODELS: Record<SceneryKind, () => THREE.BufferGeometry> = {
  olive, vine, pine, broadleaf, holmoak, palm, windmill,
}
