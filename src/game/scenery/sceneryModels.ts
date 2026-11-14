// Modelos cartoon del paisaje: cada uno es UNA geometría con el color en los vértices.
// Medidas en unidades del mundo (el detective mide unas 9 de alto). Base en y = 0; los troncos
// se hunden un poco bajo el suelo para que no floten en las cuestas.
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

/** Olivo: bajito, tronco retorcido (dos tramos) y copa gris verdosa en varias bolas. */
function olive() {
  return merge([
    cylinder(0.5, 0.8, 3 + SINK, BARK, 0, -SINK),
    cylinder(0.35, 0.5, 2, BARK, 0.5, 2.6),
    blob(2.6, 0x9dbb5c, 0, 5.2, 0, 0.7),
    blob(1.9, 0xb3cc6e, 1.6, 5.8, 0.6, 0.75),
    blob(1.8, 0x86a84e, -1.5, 5.6, -0.7, 0.75),
  ])
}

/** Fila de viña: caballón de tierra rojiza y cepas verdes encima, a lo largo de X. */
function vine() {
  const parts = [box(12, 0.6 + SINK, 2.2, 0xc0703f, 0, -SINK)]
  for (let i = -5; i <= 5; i += 2) {
    parts.push(cylinder(0.15, 0.2, 1.2, DARK_BARK, i, 0.6))
    parts.push(blob(1.1, i % 4 === 1 ? 0x6ad63c : 0x4fc23a, i, 2.2, 0, 0.8))
  }
  return merge(parts)
}

/** Pino: tronco y tres pisos de cono verde oscuro. */
function pine() {
  return merge([
    cylinder(0.5, 0.7, 5 + SINK, DARK_BARK, 0, -SINK),
    cone(4.4, 6, 0x1f9a58, 0, 4),
    cone(3.5, 5.5, 0x26ad62, 0, 7.5),
    cone(2.4, 5, 0x34c06c, 0, 11),
  ])
}

/** Árbol de hoja (roble, castaño): copa redonda verde brillante. */
function broadleaf() {
  return merge([
    cylinder(0.6, 0.9, 6 + SINK, BARK, 0, -SINK),
    blob(4.2, 0x3fcf55, 0, 9, 0, 0.9, 1),
    blob(2.8, 0x5ee060, 1.8, 11, 1, 0.85),
  ])
}

/** Encina de dehesa: tronco corto y copa ancha y aplastada, verde oscuro. */
function holmoak() {
  return merge([
    cylinder(0.7, 1, 3.5 + SINK, DARK_BARK, 0, -SINK),
    blob(5.5, 0x3b8f45, 0, 6.5, 0, 0.55, 1),
    blob(3, 0x4ea656, 2.2, 7.8, -1, 0.6),
  ])
}

/** Palmera: tronco alto con anillos y un penacho de hojas que caen. */
function palm() {
  const parts = [cylinder(0.55, 0.8, 4 + SINK, 0xc9925a, 0, -SINK)]
  for (let i = 0; i < 4; i++) parts.push(cylinder(0.5, 0.6, 3.2, i % 2 ? 0xc9925a : 0xb37d4b, i * 0.25, 4 + i * 3))
  const top = 16.5
  for (let k = 0; k < 8; k++) {
    const leaf = new THREE.BoxGeometry(2.6, 0.35, 6.5)
    leaf.translate(0, 0, 3.2)
    leaf.rotateX(k % 2 ? 0.35 : 0.7) // la punta cae hacia abajo (unas más que otras)
    leaf.rotateY((k / 8) * Math.PI * 2)
    leaf.translate(1, top, 0)
    parts.push(piece(leaf, k % 2 ? 0x5ad65e : 0x3cc455))
  }
  parts.push(blob(1, 0x8a5a3a, 1, top, 0))
  return merge(parts)
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
