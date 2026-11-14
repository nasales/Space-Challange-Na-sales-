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

/**
 * Orange tree (Valencia / Murcia orchards): short trunk, a dense round dark-green crown and a few
 * bright oranges on its surface. Planted in tight rows.
 */
function orange() {
  const parts = [
    cylinder(0.35, 0.55, 2 + SINK, BARK, 0, -SINK),
    clump(2.6, 0x1f8a3e, 0, 3.9, 0, 0.85, 0.3),
    clump(1.9, 0x34a84a, 0.9, 4.9, 0.6, 0.8, 1.2),
    clump(1.7, 0x16702f, -1, 4.3, -0.7, 0.85, 2.1),
  ]
  const fruit: [number, number, number][] = [[2.2, 3.6, 0.9], [-1.6, 3.4, 1.7], [0.4, 5.6, 1.9], [-2.1, 4.6, -0.8], [1.2, 3.1, -2], [0.9, 6.1, -0.6]]
  for (const [x, y, z] of fruit) parts.push(blob(0.45, 0xff8a1c, x, y, z))
  return withSway(merge(parts), 2, 6.5, 0.18)
}

/**
 * Eucalyptus (Galicia): tall, slim, pale peeling trunk and narrow hanging crowns in a blue-grey
 * green, clearly different from the warm greens of the oaks.
 */
function eucalyptus() {
  return withSway(
    merge([
      cylinder(0.35, 0.6, 11 + SINK, 0xe3d8c4, 0, -SINK),
      cylinder(0.22, 0.3, 4, 0xcbbd9f, 0.4, 10.6),
      cylinder(0.18, 0.25, 3, 0xe3d8c4, -0.9, 9.4).rotateZ(0.35),
      clump(2.1, 0x5e9c84, 0, 13.4, 0, 1.5, 0.2),
      clump(1.6, 0x86bea2, 0.9, 15.6, 0.5, 1.6, 1.3),
      clump(1.5, 0x4a7f6c, -1.4, 11.8, -0.3, 1.5, 2.4),
      clump(1.1, 0x9fd0b4, 0.2, 17.4, -0.4, 1.4, 0.9),
    ]),
    8,
    19,
    0.8,
  )
}

/**
 * Fir (Pyrenees and high Cantabrian mountains): a narrow, dark blue-green conifer with many short
 * tiers and a dusting of snow on each tier, so the high mountains read as alpine.
 */
function fir() {
  const parts = [cylinder(0.4, 0.6, 3 + SINK, DARK_BARK, 0, -SINK)]
  const tiers: [number, number, number, number][] = [
    // radius, height, base y, colour
    [3.2, 4.2, 2.4, 0x0f5a45],
    [2.7, 3.8, 5, 0x146a50],
    [2.2, 3.4, 7.4, 0x1a7a5a],
    [1.6, 3, 9.6, 0x228c66],
    [1, 2.6, 11.6, 0x2c9c72],
  ]
  tiers.forEach(([r, h, y, color], i) => {
    const g = cone(r, h, color, 0, 0, 0, 6)
    g.rotateY(i * 0.5)
    g.translate(0, y, 0)
    parts.push(g)
    // snow cap: a thin white cone sitting on the upper part of the tier
    const snow = cone(r * 0.55, h * 0.45, 0xf4f6ff, 0, 0, 0, 6)
    snow.rotateY(i * 0.5)
    snow.translate(0, y + h * 0.56, 0)
    parts.push(snow)
  })
  return withSway(merge(parts), 3, 14.2, 0.5)
}

/**
 * Stone pine (Mediterranean coast, Doñana): a tall bare trunk with a slight lean and a wide, flat
 * umbrella crown on top. The silhouette alone says "Mediterranean".
 */
function stonepine() {
  const trunk = cylinder(0.45, 0.75, 10 + SINK, 0xa0623a, 0, -SINK)
  trunk.rotateZ(0.08)
  return withSway(
    merge([
      trunk,
      cylinder(0.25, 0.4, 3.2, 0xa0623a, 1.4, 8.6).rotateZ(-0.5),
      clump(5.2, 0x2e8a4a, 0.8, 12.2, 0, 0.32, 0.2),
      clump(3.8, 0x47a858, 2.8, 12.9, 1.4, 0.34, 1.1),
      clump(3.6, 0x24743d, -2, 12.5, -1.2, 0.33, 2),
      clump(2.6, 0x6cc46a, 1.2, 13.8, -1.6, 0.32, 2.8),
    ]),
    8,
    14,
    0.45,
  )
}

/**
 * Wheat field (Castilla): a flat golden plot with raised furrows in two golds, sitting just above
 * the ground. Fields are big tiles laid out in a loose patchwork; the furrows sway gently in the
 * wind like a wheat sea.
 */
function wheat() {
  const size = 24
  const parts = [box(size, 0.4 + SINK, size, 0xdcae48, 0, -SINK)]
  for (let i = 0; i < 6; i++) {
    const z = -size / 2 + 2 + i * ((size - 4) / 5)
    parts.push(box(size - 1.5, 1.1, 2.2, i % 2 ? 0xf6d05a : 0xeabf4c, 0, 0.4, z))
  }
  // a few red poppies on one edge (classic in Spanish cereal fields)
  for (const [x, z] of [[-9, 10.8], [-5.5, 11.2], [6, 10.6], [9.5, 11]]) parts.push(blob(0.55, 0xe5372f, x, 1.4, z, 0.7))
  return withSway(merge(parts), 0.6, 1.5, 0.35)
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
  olive, vine, pine, broadleaf, holmoak, palm, windmill, orange, eucalyptus, fir, stonepine, wheat,
}
