// Road junctions: where two roads of roads.json cross, both decks meet at one flat height and a
// junction patch is laid on top of them. The patch is the crossing square of the two decks plus
// four rounded kerb corners (fillets), cut square across each road at its "opening", so:
// - the edge lines, kerbs and centre dashes of both ribbons are hidden inside the crossing;
// - the kerb and the white edge line turn the corner along each fillet (same shader as the road);
// - nothing is coplanar on top: the patch sits a hair above both decks with a stronger offset.
// This file only does the geometry (pure maths); layoutRoads.ts finds the crossings and levels the
// decks, createRoads.ts builds the meshes and the walking surface.
import type { XZ } from './layoutRoads'

/** Radius (world units) of the rounded kerb at each corner of a junction. */
const FILLET = 4.5
/** Longest straight run (world units) from a corner to its fillet tangent point (sharp angles). */
const MAX_TANGENT = 10
/** Points on each fillet arc. */
const ARC_STEPS = 8
/** Width (world units) of the kerb strip drawn along each corner (kerb + edge line + dots). */
export const KERB_STRIP = 2.2

export interface JunctionRoad {
  /** Unit direction of the road at the crossing. */
  tx: number
  tz: number
  /** Deck half width. */
  hw: number
}

export interface JunctionShape {
  /** Outer outline (closed polygon, no repeated point): the whole patch. */
  outline: XZ[]
  /** Inner outline: the plain asphalt in the middle (outline minus the kerb strips). */
  inner: XZ[]
  /** One kerb strip per corner: outer and inner polylines of the same length. */
  kerbs: { outer: XZ[]; inner: XZ[] }[]
  /** Distance from the centre to the opening along road a and road b (both directions). */
  extA: number
  extB: number
  /** Radius of a circle around the centre that holds the whole patch. */
  radius: number
}

const cross = (ax: number, az: number, bx: number, bz: number) => ax * bz - az * bx

/**
 * Shape of the junction of roads a and b crossing at (x, z). Returns null when they are too
 * close to parallel for a clean crossing.
 */
export function junctionShape(x: number, z: number, a: JunctionRoad, b: JunctionRoad): JunctionShape | null {
  const sin = cross(a.tx, a.tz, b.tx, b.tz)
  if (Math.abs(sin) < 0.35) return null // under ~20 degrees: no patch
  const na: XZ = [-a.tz, a.tx], nb: XZ = [-b.tz, b.tx]
  const dotANb = a.tx * nb[0] + a.tz * nb[1]
  const dotBNa = b.tx * na[0] + b.tz * na[1]
  interface Corner {
    sA: number
    sB: number
    /** Direction (sign) along a and b in which the fillet leaves the corner. */
    gA: number
    gB: number
    outer: XZ[]
    inner: XZ[]
    /** Distances along a and b (signed, from the centre) of the two tangent points. */
    tA: number
    tB: number
  }
  const corners: Corner[] = []
  for (const sA of [1, -1]) {
    for (const sB of [1, -1]) {
      // Corner C: the A kerb line (offset sA*hwA) meets the B kerb line (offset sB*hwB)
      // x + na*sA*hwA + a*t = x + nb*sB*hwB + b*u  ->  solve for t
      const px = nb[0] * sB * b.hw - na[0] * sA * a.hw, pz = nb[1] * sB * b.hw - na[1] * sA * a.hw
      const t = cross(px, pz, b.tx, b.tz) / cross(a.tx, a.tz, b.tx, b.tz)
      const cx = x + na[0] * sA * a.hw + a.tx * t, cz = z + na[1] * sA * a.hw + a.tz * t
      // Along each kerb, the fillet goes the way that leaves the other road
      const gA = Math.sign(sB * dotANb) || 1
      const gB = Math.sign(sA * dotBNa) || 1
      const ux = a.tx * gA, uz = a.tz * gA, vx = b.tx * gB, vz = b.tz * gB
      const phi = Math.acos(Math.min(1, Math.max(-1, ux * vx + uz * vz))) // angle of the terrain corner
      const tanHalf = Math.tan(phi / 2)
      const rf = Math.min(FILLET, MAX_TANGENT * tanHalf)
      const L = rf / tanHalf
      const bx = ux + vx, bz = uz + vz
      const bl = Math.hypot(bx, bz) || 1
      const ox = cx + (bx / bl) * (rf / Math.sin(phi / 2)), oz = cz + (bz / bl) * (rf / Math.sin(phi / 2))
      const TA: XZ = [cx + ux * L, cz + uz * L], TB: XZ = [cx + vx * L, cz + vz * L]
      const a0 = Math.atan2(TA[1] - oz, TA[0] - ox)
      let a1 = Math.atan2(TB[1] - oz, TB[0] - ox)
      while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI
      while (a1 - a0 < -Math.PI) a1 += 2 * Math.PI
      const outer: XZ[] = [], inner: XZ[] = []
      for (let k = 0; k <= ARC_STEPS; k++) {
        const ang = a0 + ((a1 - a0) * k) / ARC_STEPS
        const ex = Math.cos(ang), ez = Math.sin(ang)
        outer.push([ox + ex * rf, oz + ez * rf])
        inner.push([ox + ex * (rf + KERB_STRIP), oz + ez * (rf + KERB_STRIP)])
      }
      // tA, tB: signed distances of the tangent points from the centre, along a and along b
      corners.push({ sA, sB, gA, gB, outer, inner, tA: t + gA * L, tB: (TB[0] - x) * b.tx + (TB[1] - z) * b.tz })
    }
  }
  // Openings: road a leaves on side g at the farthest tangent point of the two corners on that side
  const extAlong = (g: number, key: 'gA' | 'gB', tk: 'tA' | 'tB') =>
    Math.max(...corners.filter((c) => c[key] === g).map((c) => c[tk] * g))
  const extA = Math.max(extAlong(1, 'gA', 'tA'), extAlong(-1, 'gA', 'tA'))
  const extB = Math.max(extAlong(1, 'gB', 'tB'), extAlong(-1, 'gB', 'tB'))
  // Each corner piece: straight kerb from the opening of a to the arc, the arc, straight kerb to
  // the opening of b (the inner line runs KERB_STRIP inside, towards each road's centre)
  const kerbs = corners
  for (const c of kerbs) {
    const startA: XZ = [x + na[0] * c.sA * a.hw + a.tx * c.gA * extA, z + na[1] * c.sA * a.hw + a.tz * c.gA * extA]
    const startAin: XZ = [startA[0] - na[0] * c.sA * KERB_STRIP, startA[1] - na[1] * c.sA * KERB_STRIP]
    const endB: XZ = [x + nb[0] * c.sB * b.hw + b.tx * c.gB * extB, z + nb[1] * c.sB * b.hw + b.tz * c.gB * extB]
    const endBin: XZ = [endB[0] - nb[0] * c.sB * KERB_STRIP, endB[1] - nb[1] * c.sB * KERB_STRIP]
    c.outer = [startA, ...c.outer, endB]
    c.inner = [startAin, ...c.inner, endBin]
  }
  // Order the corners around the centre and orient every piece the same way (counter-clockwise)
  const ang = (p: XZ) => Math.atan2(p[1] - z, p[0] - x)
  for (const c of kerbs) {
    const f = c.outer[0], l = c.outer[c.outer.length - 1]
    if (cross(f[0] - x, f[1] - z, l[0] - x, l[1] - z) < 0) {
      c.outer.reverse()
      c.inner.reverse()
    }
  }
  const mid = (c: Corner) => c.outer[c.outer.length >> 1]
  kerbs.sort((p, q) => ang(mid(p)) - ang(mid(q)))
  const outline = kerbs.flatMap((c) => c.outer)
  const inner = kerbs.flatMap((c) => c.inner)
  const radius = Math.max(...outline.map((p) => Math.hypot(p[0] - x, p[1] - z)))
  return { outline, inner, kerbs: kerbs.map((c) => ({ outer: c.outer, inner: c.inner })), extA, extB, radius }
}

/** true if (x, z) is inside the polygon (even-odd rule). */
export function insidePolygon(poly: XZ[], x: number, z: number): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}
