// Shallow sea: lighter water where the detective rows his boat (boat/createRowBoat.ts). It is a
// band along the whole coast of the country, plus every sea "enclosed" between its lands (the sea
// between the mainland and the Balearic Islands), so the islands can be reached. The rest of the
// sea stays closed.
// The explored region (exploredRegion.ts), the painted map and the "can he go here?" test use it.
import type { Bounds } from './mapData'
import { UNITS_PER_DEG_LAT, UNITS_PER_DEG_LON, UNITS_PER_KM } from './projection'

/** Width (km) of the band of shallow water along the whole coast (mainland and islands). */
export const COAST_SHALLOWS_KM = 16

/**
 * Enclosed seas. Inside `bounds`, the sea is filled wherever a circle of `radiusKm` cannot enter
 * without touching the land of the country: the bays and the gaps between islands and mainland
 * close up, and the outer edge is a set of wide arcs that leave the coast smoothly (no corners).
 * A bigger radius gives a flatter, fuller edge.
 */
export const ENCLOSED_SEAS: { bounds: Bounds; radiusKm: number }[] = [
  // Balearic Sea: Cabo de Palos .. Cap de Creus on the mainland, out to Formentera, Mallorca and Menorca
  { bounds: { west: -1.5, east: 4.7, south: 37.5, north: 42.6 }, radiusKm: 220 },
]

/** Cell size (km) of the coarse grid the enclosed seas are worked out on. */
const CELL_KM = 1.5

const KM_PER_DEG_LON = UNITS_PER_DEG_LON / UNITS_PER_KM
const KM_PER_DEG_LAT = UNITS_PER_DEG_LAT / UNITS_PER_KM

/** Exact squared distance (in cells) from every cell to the nearest target cell (Felzenszwalb and Huttenlocher). */
function squaredDistance(isTarget: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e20
  const d = new Float32Array(w * h)
  for (let i = 0; i < d.length; i++) d[i] = isTarget[i] ? 0 : INF
  const n = Math.max(w, h)
  const f = new Float64Array(n), z = new Float64Array(n + 1), v = new Int32Array(n)
  // One line of the grid (a column, then a row): lower envelope of the parabolas of its cells
  const pass = (start: number, step: number, len: number) => {
    for (let q = 0; q < len; q++) f[q] = d[start + q * step]
    let k = 0
    v[0] = 0
    z[0] = -INF
    z[1] = INF
    for (let q = 1; q < len; q++) {
      let s = 0
      while (k >= 0) {
        const p = v[k]
        s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p)
        if (s > z[k]) break
        k--
      }
      k++
      v[k] = q
      z[k] = k === 0 ? -INF : s
      z[k + 1] = INF
    }
    k = 0
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++
      const p = v[k]
      d[start + q * step] = (q - p) * (q - p) + f[p]
    }
  }
  for (let x = 0; x < w; x++) pass(x, w, h)
  for (let y = 0; y < h; y++) pass(y * w, 1, w)
  return d
}

/**
 * Cells of the grid that lie in an enclosed sea (1) or not (0); land cells may be marked too.
 * Returns null if no enclosed sea touches the zone (e.g. the Canary Islands).
 * @param land 1 = land of the country, on the same grid
 */
export function enclosedSea(land: Uint8Array, bounds: Bounds, width: number, height: number): Uint8Array | null {
  let out: Uint8Array | null = null
  for (const { bounds: box, radiusKm } of ENCLOSED_SEAS) {
    if (box.east < bounds.west || box.west > bounds.east || box.north < bounds.south || box.south > bounds.north) continue
    // Coarse grid in km (x to the east, y to the south): the box plus room for the circle all around
    const pad = radiusKm + 4 * CELL_KM
    const x0 = box.west * KM_PER_DEG_LON - pad, y0 = -box.north * KM_PER_DEG_LAT - pad
    const nx = Math.ceil(((box.east - box.west) * KM_PER_DEG_LON + 2 * pad) / CELL_KM)
    const ny = Math.ceil(((box.north - box.south) * KM_PER_DEG_LAT + 2 * pad) / CELL_KM)

    // 1) The land of the country inside the box
    const seed = new Uint8Array(nx * ny)
    for (let cy = 0; cy < ny; cy++) {
      const lat = -(y0 + (cy + 0.5) * CELL_KM) / KM_PER_DEG_LAT
      const r = Math.round(((bounds.north - lat) / (bounds.north - bounds.south)) * (height - 1))
      if (lat < box.south || lat > box.north || r < 0 || r >= height) continue
      for (let cx = 0; cx < nx; cx++) {
        const lon = (x0 + (cx + 0.5) * CELL_KM) / KM_PER_DEG_LON
        const c = Math.round(((lon - bounds.west) / (bounds.east - bounds.west)) * (width - 1))
        if (lon < box.west || lon > box.east || c < 0 || c >= width) continue
        seed[cy * nx + cx] = land[r * width + c]
      }
    }
    // 2) Everything within the radius of that land; 3) of it, what is at least the radius away
    //    from the outside. What is left is the land plus the sea a circle of that radius cannot reach
    const R = radiusKm / CELL_KM
    const near = squaredDistance(seed, nx, ny)
    const outside = new Uint8Array(nx * ny)
    for (let i = 0; i < outside.length; i++) outside[i] = near[i] > R * R ? 1 : 0
    const depth = squaredDistance(outside, nx, ny)
    for (let i = 0; i < depth.length; i++) depth[i] = Math.sqrt(depth[i]) - R // >= 0: enclosed

    // 4) Back to the fine grid (bilinear, so the edge stays smooth)
    out ??= new Uint8Array(width * height)
    for (let r = 0; r < height; r++) {
      const lat = bounds.north - (r / (height - 1)) * (bounds.north - bounds.south)
      const fy = (-lat * KM_PER_DEG_LAT - y0) / CELL_KM - 0.5
      if (fy < 0 || fy >= ny - 1) continue
      const cy = Math.floor(fy), ty = fy - cy
      for (let c = 0; c < width; c++) {
        const lon = bounds.west + (c / (width - 1)) * (bounds.east - bounds.west)
        const fx = (lon * KM_PER_DEG_LON - x0) / CELL_KM - 0.5
        if (fx < 0 || fx >= nx - 1) continue
        const cx = Math.floor(fx), tx = fx - cx
        const i = cy * nx + cx
        const v = depth[i] * (1 - tx) * (1 - ty) + depth[i + 1] * tx * (1 - ty) + depth[i + nx] * (1 - tx) * ty + depth[i + nx + 1] * tx * ty
        if (v >= 0) out[r * width + c] = 1
      }
    }
  }
  return out
}
