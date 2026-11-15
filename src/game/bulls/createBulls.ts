// Roadside bulls: a big, flat, black bull silhouette (original low-poly outline, no text) held up
// by a wooden post frame behind it, standing on a hill next to a main road (spots in bullSpots.ts).
// - One merged geometry (silhouette + frame, colour per vertex) shared by all bulls.
// - They cast shadows, block the detective (like windmills and houses) and keep houses and
//   scenery off their footprint through spacing(), the same mechanism landmarks use.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonMaterial } from '../scene/toonGradient'
import { piece, box } from '../scene/vertexPieces'
import { lonLatToWorld } from '../map/projection'
import type { BullSpot } from './bullSpots'

/** Model units -> world units: the bull is about 31 units tall and 48 long (a big billboard). */
const BULL_SCALE = 4.5
/** Thickness of the cut-out silhouette (model units). */
const DEPTH = 0.55
/** Silhouette colour: almost black, a touch blue so the toon shading still reads. */
const BLACK = 0x17161d
/** Weathered wood of the post frame. */
const WOOD = 0x7d7366
/** How far the struts reach back from the silhouette (model units). */
const STRUT_BACK = 2.3
/** Posts and struts go this far below the ground (model units), so slopes show no gaps. */
const SINK = 0.8
/**
 * How close houses may stand to a bull footprint (world units). Same scale trick as landmark
 * spacing(): callers keep houses 80 units from a monument and scenery 70, so the distance is
 * returned stretched by 80 / BULL_CLEARANCE.
 */
const BULL_CLEARANCE = 12
const HOUSE_LANDMARK_CLEARANCE = 80

/**
 * Side outline of the bull (model units), facing +X, hooves on y = 0. Original shape: heavy neck
 * hump, forward-curving horns, four legs and a hanging tail with a tuft.
 */
const OUTLINE: [number, number][] = [
  // rump, tail and its tuft
  [-4.0, 4.7], [-4.35, 4.45], [-4.75, 3.4], [-4.95, 1.9], [-5.2, 1.3], [-4.75, 1.25], [-4.62, 2.0], [-4.42, 3.3], [-4.25, 3.6],
  // haunch and the two hind legs
  [-4.15, 2.9], [-3.85, 1.8], [-3.65, 1.0], [-3.6, 0], [-3.0, 0], [-3.0, 1.1], [-2.9, 2.0],
  [-2.7, 2.0], [-2.6, 1.0], [-2.45, 0], [-1.85, 0], [-1.9, 1.0], [-1.95, 2.1],
  // belly
  [-0.6, 2.0], [0.6, 1.9], [1.45, 2.0],
  // the two front legs
  [1.55, 1.1], [1.5, 0], [2.1, 0], [2.1, 1.0], [2.3, 1.9],
  [2.5, 1.0], [2.55, 0], [3.15, 0], [3.1, 0.7], [3.05, 1.5], [3.05, 2.2],
  // chest, dewlap, jaw, chin and muzzle
  [3.3, 2.7], [3.8, 3.3], [4.3, 3.5], [4.9, 3.35], [5.35, 3.45], [5.6, 3.75], [5.5, 4.2],
  // forehead, near horn, far horn (a little behind), poll
  [4.65, 5.25], [4.45, 5.45], [4.6, 6.1], [5.15, 6.75], [4.4, 6.35], [4.15, 5.75], [4.0, 5.6],
  [3.85, 5.7], [3.9, 6.3], [4.35, 6.95], [3.65, 6.45], [3.55, 5.85],
  // neck hump and back
  [2.7, 6.1], [1.7, 5.8], [-1.0, 4.95],
]
/** Posts of the frame: x (model units) and height, kept below the back line so none shows above it. */
const POSTS: [number, number][] = [[-3.4, 4.1], [-1.0, 4.5], [1.5, 5.1], [3.6, 4.9]]

/** Footprint in model units: x from tail to muzzle, z from the face to the strut feet. */
const MIN_X = -5.3, MAX_X = 5.7, FRONT_Z = DEPTH / 2, BACK_Z = -DEPTH / 2 - STRUT_BACK - 0.2

function buildBull() {
  const parts: THREE.BufferGeometry[] = []
  // Silhouette: the outline extruded, front face at z = +DEPTH / 2
  const shape = new THREE.Shape(OUTLINE.map(([x, y]) => new THREE.Vector2(x, y)))
  const body = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false })
  body.translate(0, 0, -DEPTH / 2)
  parts.push(piece(body, BLACK))
  // Hooves sink a little into the ground (slopes): a black plinth strip under each leg pair
  for (const [x0, x1] of [[-3.6, -3.0], [-2.45, -1.85], [1.5, 2.1], [2.55, 3.15]])
    parts.push(box(x1 - x0, SINK, DEPTH, BLACK, (x0 + x1) / 2, -SINK, 0))

  // Frame behind: posts, two rails, a strut from each post top back to the ground, a foot beam
  const zPost = -DEPTH / 2 - 0.12
  const zFoot = -DEPTH / 2 - STRUT_BACK
  for (const [x, h] of POSTS) {
    parts.push(box(0.2, h + SINK, 0.2, WOOD, x, -SINK, zPost))
    const run = zPost - zFoot, len = Math.hypot(run, h + SINK)
    const strut = new THREE.BoxGeometry(0.16, len, 0.16)
    strut.rotateX(Math.atan2(run, h + SINK)) // top leans forward onto the post
    parts.push(piece(strut, WOOD, x, (h - SINK) / 2, (zPost + zFoot) / 2))
  }
  for (const y of [1.6, 3.5]) parts.push(box(MAX_X - MIN_X - 3.4, 0.16, 0.14, WOOD, 0, y, zPost - 0.17))
  parts.push(box(POSTS[3][0] - POSTS[0][0] + 0.4, 0.18, 0.2, WOOD, (POSTS[0][0] + POSTS[3][0]) / 2, -0.05, zFoot))
  const merged = mergeGeometries(parts)!
  parts.forEach((p) => p.dispose())
  merged.computeVertexNormals()
  return merged
}

interface Placed {
  spot: BullSpot
  x: number
  z: number
  y: number
  cos: number
  sin: number
  /** world scale */
  s: number
}

export function createBulls(spots: BullSpot[], heightAt: (x: number, z: number) => number) {
  const group = new THREE.Group()
  const geometry = buildBull()
  const material = toonMaterial(0xffffff, { vertexColors: true }, 0.1) // almost no violet shade: it stays black
  const placed: Placed[] = []

  /** (x, z) in the bull's own frame (model units). */
  const local = (p: Placed, x: number, z: number) => {
    const dx = x - p.x, dz = z - p.z
    return { lx: (dx * p.cos - dz * p.sin) / p.s, lz: (dx * p.sin + dz * p.cos) / p.s }
  }
  /** Distance (world units) from (x, z) to the edge of a bull footprint, 0 inside. */
  const outside = (p: Placed, x: number, z: number) => {
    const { lx, lz } = local(p, x, z)
    const ox = Math.max(0, MIN_X - lx, lx - MAX_X), oz = Math.max(0, BACK_Z - lz, lz - FRONT_Z)
    return Math.hypot(ox, oz) * p.s
  }
  /** Ground points under the footprint (world): hooves and strut feet. */
  const footprintPoints = (p: Placed) => {
    const pts: [number, number][] = []
    for (const lx of [MIN_X + 1.5, -2, 0, 2, MAX_X - 2.5])
      for (const lz of [FRONT_Z, BACK_Z]) {
        const wx = lx * p.s, wz = lz * p.s
        // Holder rotation of a local point around Y by the heading
        pts.push([p.x + wx * p.cos + wz * p.sin, p.z - wx * p.sin + wz * p.cos])
      }
    return pts
  }

  for (const spot of spots) {
    const { x, z } = lonLatToWorld(spot.lon, spot.lat)
    const angle = (spot.heading * Math.PI) / 180
    const p: Placed = { spot, x, z, y: 0, cos: Math.cos(angle), sin: Math.sin(angle), s: BULL_SCALE * (spot.scale ?? 1) }
    // Stand on the lowest point of the footprint: on a gentle slope the uphill hooves sink a little
    p.y = Math.min(...footprintPoints(p).map(([px, pz]) => heightAt(px, pz)))
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, p.y, z)
    mesh.rotation.y = angle
    mesh.scale.setScalar(p.s)
    mesh.castShadow = mesh.receiveShadow = true
    mesh.name = `bull-${spot.id}`
    group.add(mesh)
    placed.push(p)
  }

  return {
    group,
    placed,
    /** Distance to the nearest bull footprint (world units, 0 inside). */
    distance(x: number, z: number) {
      let best = Infinity
      for (const p of placed) best = Math.min(best, outside(p, x, z))
      return best
    },
    /** Like landmarks.spacing(): stretched so the callers' 80 (houses) / 70 (scenery) become BULL_CLEARANCE. */
    spacing(x: number, z: number) {
      let best = Infinity
      for (const p of placed) best = Math.min(best, (outside(p, x, z) * HOUSE_LANDMARK_CLEARANCE) / BULL_CLEARANCE)
      return best
    },
    /** True if (x, z) is on a bull footprint (the detective walks around it). */
    blocks(x: number, z: number) {
      return placed.some((p) => outside(p, x, z) < 1)
    },
    /** Ground points under each bull (for checking the spots, see bullSpots.ts). */
    footprints: () => placed.map((p) => ({ id: p.spot.id, x: p.x, z: p.z, y: p.y, points: footprintPoints(p) })),
    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  }
}
