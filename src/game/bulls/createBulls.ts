// Roadside bulls: a big, flat, black bull silhouette in strict side profile (original low-poly
// outline, no text, no brand) held up by a thin grey steel lattice behind it, standing on a hill
// next to a main road (spots in bullSpots.ts). Shape after the classic Spanish roadside bull
// billboard: heavy hump over the shoulders and thick neck, small lowered head, long horns curving
// forward and up, deep chest, slim belly and hindquarters, thin legs, tail hanging down.
// - One merged geometry (silhouette + lattice, colour per vertex) and one material shared by all bulls.
// - They cast shadows and are solid for the detective: blocks() is read by ground.isDrivable in
//   GameView, the same check that stops him at windmills and witness props (the car stops head-on
//   or slides along it). Houses and scenery keep off their footprint through spacing(), the same
//   mechanism landmarks use.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonMaterial } from '../scene/toonGradient'
import { piece, box } from '../scene/vertexPieces'
import { lonLatToWorld } from '../map/projection'
import type { BullSpot } from './bullSpots'

/** Model units -> world units: the bull is about 30 units tall and 49 long (a big billboard). */
const BULL_SCALE = 4.5
/** Thickness of the cut-out silhouette (model units): a flat sheet. */
const DEPTH = 0.4
/** Silhouette colour: almost black, a touch blue so the toon shading still reads. */
const BLACK = 0x15141b
/** Galvanised steel of the lattice behind. */
const STEEL = 0x8b9097
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
 * Side outline of the bull (model units), facing +X, hooves on y = 0, traced counter-clockwise
 * from the root of the tail. Original shape, not traced from any logo.
 */
const OUTLINE: [number, number][] = [
  // root of the tail, tail hanging down to the hock, tuft, back up its inner edge
  [-4.3, 5.05], [-4.62, 4.75], [-4.78, 4.0], [-4.82, 2.6], [-4.95, 2.0], [-5.1, 1.45], [-4.8, 1.3],
  [-4.62, 1.55], [-4.62, 2.6], [-4.55, 3.9], [-4.4, 4.45],
  // buttock, gaskin, the hock pointing back, near hind leg
  [-4.3, 4.0], [-4.3, 3.3], [-4.1, 2.6], [-3.85, 1.95], [-3.95, 1.75], [-3.85, 1.4], [-3.78, 0.35],
  [-3.85, 0], [-3.3, 0], [-3.38, 0.4], [-3.4, 1.6], [-3.2, 2.3],
  // far hind leg, a little ahead
  [-3.05, 2.1], [-2.95, 1.5], [-2.9, 0.35], [-2.95, 0], [-2.42, 0], [-2.48, 0.4], [-2.55, 1.6], [-2.35, 2.4],
  // slim belly tucked up at the flank, deeper towards the chest
  [-1.6, 2.55], [-0.4, 2.35], [0.6, 2.15], [1.4, 2.0],
  // far front leg, then the near front leg
  [1.55, 1.6], [1.62, 0.35], [1.55, 0], [2.08, 0], [2.05, 0.35], [2.05, 1.5], [2.25, 1.85],
  [2.45, 1.4], [2.55, 0.35], [2.5, 0], [3.05, 0], [3.0, 0.4], [2.98, 1.4], [3.1, 2.1],
  // deep chest and brisket, dewlap, small lowered head: jaw, chin, muzzle, face
  [3.4, 2.6], [3.75, 3.1], [4.05, 3.45], [4.45, 3.55], [4.95, 3.45], [5.35, 3.55], [5.55, 3.85],
  [5.5, 4.25], [5.15, 4.75], [4.85, 5.15],
  // near horn: long, curving forward and up
  [4.95, 5.45], [5.25, 5.95], [5.55, 6.4], [5.85, 6.65], [5.55, 6.6], [5.15, 6.3], [4.8, 5.85], [4.6, 5.55],
  // poll, far horn (a little behind and smaller)
  [4.45, 5.55], [4.4, 5.8], [4.65, 6.3], [4.95, 6.7], [4.65, 6.65], [4.3, 6.25], [4.1, 5.8],
  // thick neck rising to the big hump over the shoulders, then the back down to the rump
  [3.8, 5.62], [3.55, 5.6], [3.05, 6.1], [2.4, 6.45], [1.6, 6.4], [0.8, 6.0],
  [-0.6, 5.35], [-2.2, 5.05], [-3.4, 5.15], [-4.0, 5.15],
]
/** Hooves (x from, x to): a black plinth under each leg so they sink into sloping ground. */
const HOOVES: [number, number][] = [[-3.85, -3.3], [-2.95, -2.42], [1.55, 2.08], [2.5, 3.05]]
/** Lattice posts: x (model units) and height, kept below the back line so none shows above it. */
const POSTS: [number, number][] = [[-3.8, 4.6], [-1.7, 4.6], [0.5, 5.2], [2.6, 5.6], [4.3, 4.4]]
/** Heights of the lattice rails; the bays between them get one diagonal each, zig-zagging. */
const RAILS = [0.45, 2.15, 3.85]
/** Thickness of the lattice bars (model units). */
const BAR = 0.09

/** Footprint in model units: x from tail to horn tip, z from the face to the strut feet. */
const MIN_X = -5.2, MAX_X = 5.9, FRONT_Z = DEPTH / 2, BACK_Z = -DEPTH / 2 - STRUT_BACK - 0.2

/** Thin steel bar between two points of the lattice plane z (model units). */
function bar(x0: number, y0: number, x1: number, y1: number, z: number, t = BAR) {
  const len = Math.hypot(x1 - x0, y1 - y0)
  const g = new THREE.BoxGeometry(len, t, t)
  g.rotateZ(Math.atan2(y1 - y0, x1 - x0))
  return piece(g, STEEL, (x0 + x1) / 2, (y0 + y1) / 2, z)
}

function buildBull() {
  const parts: THREE.BufferGeometry[] = []
  // Silhouette: the outline extruded, front face at z = +DEPTH / 2
  const shape = new THREE.Shape(OUTLINE.map(([x, y]) => new THREE.Vector2(x, y)))
  const body = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false })
  body.translate(0, 0, -DEPTH / 2)
  parts.push(piece(body, BLACK))
  for (const [x0, x1] of HOOVES) parts.push(box(x1 - x0, SINK, DEPTH, BLACK, (x0 + x1) / 2, -SINK, 0))

  // Lattice right behind the sheet: posts, rails, zig-zag diagonals, then a strut from each post
  // top back to the ground and a foot beam joining the strut feet
  const zPost = -DEPTH / 2 - 0.1
  const zFoot = -DEPTH / 2 - STRUT_BACK
  const x0 = POSTS[0][0], x1 = POSTS[POSTS.length - 1][0]
  for (const [x, h] of POSTS) {
    parts.push(box(0.16, h + SINK, 0.16, STEEL, x, -SINK, zPost))
    const run = zPost - zFoot, len = Math.hypot(run, h + SINK)
    const strut = new THREE.BoxGeometry(0.12, len, 0.12)
    strut.rotateX(Math.atan2(run, h + SINK)) // top leans forward onto the post
    parts.push(piece(strut, STEEL, x, (h - SINK) / 2, (zPost + zFoot) / 2))
  }
  const zBar = zPost - 0.12
  for (const y of RAILS) parts.push(bar(x0, y, x1, y, zBar))
  for (let i = 0; i + 1 < POSTS.length; i++) {
    const [xa] = POSTS[i], [xb] = POSTS[i + 1]
    for (let r = 0; r + 1 < RAILS.length; r++) {
      const up = (i + r) % 2 === 0
      parts.push(bar(xa, up ? RAILS[r] : RAILS[r + 1], xb, up ? RAILS[r + 1] : RAILS[r], zBar - 0.06, BAR * 0.8))
    }
  }
  parts.push(box(x1 - x0 + 0.3, 0.14, 0.16, STEEL, (x0 + x1) / 2, -0.05, zFoot))
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
