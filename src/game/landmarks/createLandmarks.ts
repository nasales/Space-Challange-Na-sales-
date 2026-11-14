// Country landmarks: each one is built, the terrain under it is flattened (like a plaza) and it
// sits on a stone slab or its own garden. They also tell which one is nearby.
// The detective can climb them like house roofs (see surfaceAt / bakeHeightMap).
//
// Orden de uso (el terreno se allana ANTES de crear su malla y su textura):
//   const landmarks = createLandmarks(list)
//   landmarks.flattenTerrain(zone, heights)   // por cada zona
//   landmarks.place(terrain.heightAt)          // cuando el terreno ya existe
import * as THREE from 'three'
import type { ZoneData } from '../map/mapData'
import { lonLatToWorld, UNITS_PER_KM } from '../map/projection'
import type { RiverClearing } from '../map/rivers'
import { createKit } from './kit'
import { makeLightBatch, makeLightMesh } from '../scene/nightLights'
import { LANDMARK_MODELS } from './models'

export interface LandmarkData {
  id: string
  name: string
  city: string
  lat: number
  lon: number
  /** giro del monumento en grados (0 = fachada mirando al sur) */
  heading: number
  /** tamaño relativo (1 = normal); para que quepa en su sitio */
  scale?: number
  /** Flat ground around the footprint (world units); default PLAZA. Small monuments want less. */
  plaza?: number
  /** Width of the band where the plaza blends into the terrain (world units); default BLEND. */
  blend?: number
  /**
   * How close houses may stand to the footprint (world units); default DEFAULT_CLEARANCE.
   * Scenery scales with it in the same proportion (see spacing()).
   */
  clearance?: number
  description: string
}

/** Carga landmarks.json del país (si no existe, no hay monumentos). */
export async function loadLandmarks(countryId: string): Promise<LandmarkData[]> {
  const res = await fetch(`/maps/countries/${countryId}/landmarks.json`)
  if (!res.ok) return []
  return (await res.json()).landmarks
}

/** Tamaño general de los monumentos respecto a sus modelos. */
const LANDMARK_SCALE = 6
const PLINTH_COLOR = 0x8e949c
const PLINTH_MARGIN = 6 // cuánto sobresale la losa del monumento
const PLINTH_HEIGHT = 1.2
/** Explanada totalmente llana alrededor de la losa (unidades): sitio para aparcar y mirarlo. */
const DEFAULT_PLAZA = 90
/** Ancho de la franja donde la explanada se funde con el terreno de alrededor (unidades). */
const DEFAULT_BLEND = 50
/** A menos de esta distancia (unidades) el panel muestra el monumento. */
const NEAR_DISTANCE = 250
/** Free ring that towns keep around a monument (same value as LANDMARK_CLEARANCE in placeTowns). */
const DEFAULT_CLEARANCE = 80
/** Night lights of a monument switch on within this first part of the dusk (0..1), one after another. */
const LIGHT_PHASE_SPREAD = 0.5

interface Placed {
  data: LandmarkData
  holder: THREE.Group
  /** Night lights of the monument (own group: they are drawn in the night-lights scene). */
  lightHolder: THREE.Group
  x: number
  z: number
  cos: number
  sin: number
  halfW: number
  halfD: number
  /** Height map of the monument's top surface (holder-local, see bakeHeightMap). */
  heights: HeightMap
}

/** Cell size of the height maps (world units). */
const HEIGHT_CELL = 1.5

interface HeightMap {
  cols: number
  rows: number
  /** Height above the holder origin of each cell (row-major from -halfD, -halfW); -Infinity = empty. */
  data: Float32Array
}

/**
 * Height of the highest surface of the monument (and its floor) over each cell of its footprint,
 * in the holder's own frame (unrotated, world units, origin at the holder). Every triangle is
 * rasterised onto the grid once at load time, so later lookups are a single array read.
 * The detective uses it as ground, so he climbs monuments the same way he climbs house roofs.
 */
function bakeHeightMap(holder: THREE.Object3D, halfW: number, halfD: number): HeightMap {
  const cols = Math.max(1, Math.ceil((halfW * 2) / HEIGHT_CELL))
  const rows = Math.max(1, Math.ceil((halfD * 2) / HEIGHT_CELL))
  const data = new Float32Array(cols * rows).fill(-Infinity)
  holder.updateMatrixWorld(true)
  const toHolder = new THREE.Matrix4().copy(holder.matrixWorld).invert()
  const rel = new THREE.Matrix4()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  /** Writes y into the cell under (x, z) if it is higher than what is there. */
  const splat = (x: number, z: number, y: number) => {
    const col = Math.floor((x + halfW) / HEIGHT_CELL), row = Math.floor((z + halfD) / HEIGHT_CELL)
    if (col < 0 || col >= cols || row < 0 || row >= rows) return
    const i = row * cols + col
    if (y > data[i]) data[i] = y
  }
  /**
   * Walks an edge in half-cell steps. Thin pieces (columns, trunks, posts, ribs) and wall tops
   * narrower than a cell never cover a cell centre, so without this the detective walks through them.
   */
  const edge = (p: THREE.Vector3, q: THREE.Vector3) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / (HEIGHT_CELL * 0.5)))
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      splat(p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t, p.y + (q.y - p.y) * t)
    }
  }
  holder.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    rel.multiplyMatrices(toHolder, m.matrixWorld)
    const pos = m.geometry.getAttribute('position')
    const index = m.geometry.index
    const count = index ? index.count : pos.count
    for (let t = 0; t + 2 < count; t += 3) {
      const ia = index ? index.getX(t) : t, ib = index ? index.getX(t + 1) : t + 1, ic = index ? index.getX(t + 2) : t + 2
      a.fromBufferAttribute(pos, ia).applyMatrix4(rel)
      b.fromBufferAttribute(pos, ib).applyMatrix4(rel)
      c.fromBufferAttribute(pos, ic).applyMatrix4(rel)
      edge(a, b)
      edge(b, c)
      edge(c, a)
      // Barycentric fill in XZ; vertical triangles (walls) have no area: their edges did the job
      const det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z)
      if (Math.abs(det) < 1e-6) continue
      const c0 = Math.max(0, Math.floor((Math.min(a.x, b.x, c.x) + halfW) / HEIGHT_CELL))
      const c1 = Math.min(cols - 1, Math.floor((Math.max(a.x, b.x, c.x) + halfW) / HEIGHT_CELL))
      const r0 = Math.max(0, Math.floor((Math.min(a.z, b.z, c.z) + halfD) / HEIGHT_CELL))
      const r1 = Math.min(rows - 1, Math.floor((Math.max(a.z, b.z, c.z) + halfD) / HEIGHT_CELL))
      for (let r = r0; r <= r1; r++) {
        const pz = -halfD + (r + 0.5) * HEIGHT_CELL
        for (let col = c0; col <= c1; col++) {
          const px = -halfW + (col + 0.5) * HEIGHT_CELL
          const wa = ((b.z - c.z) * (px - c.x) + (c.x - b.x) * (pz - c.z)) / det
          const wb = ((c.z - a.z) * (px - c.x) + (a.x - c.x) * (pz - c.z)) / det
          const wc = 1 - wa - wb
          if (wa < -1e-4 || wb < -1e-4 || wc < -1e-4) continue // cell centre outside the triangle
          const y = wa * a.y + wb * b.y + wc * c.y
          const i = r * cols + col
          if (y > data[i]) data[i] = y
        }
      }
    }
  })
  return { cols, rows, data: closeGaps(data, cols, rows) }
}

/**
 * Morphological closing (3x3 max filter, then 3x3 min filter): fills gaps up to about two cells
 * wide between merlons, balusters or ribs, so their tops form one walkable surface instead of a
 * comb of spikes that makes the detective hop up and down. Larger shapes keep their outline.
 */
function closeGaps(src: Float32Array, cols: number, rows: number) {
  const pass = (from: Float32Array, pick: (a: number, b: number) => number, start: number, outside: number) => {
    const out = new Float32Array(from.length)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let v = start
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr, cc = c + dc
            // Outside the grid is ignored (it neither spreads nor eats the footprint edge)
            const n = rr < 0 || rr >= rows || cc < 0 || cc >= cols ? outside : from[rr * cols + cc]
            v = pick(v, n)
          }
        }
        out[r * cols + c] = v
      }
    }
    return out
  }
  return pass(pass(src, Math.max, -Infinity, -Infinity), Math.min, Infinity, Infinity)
}

export function createLandmarks(list: LandmarkData[]) {
  const kit = createKit()
  const group = new THREE.Group()
  /** Night lights of all the monuments (goes in the night-lights scene, not in the main one). */
  const lights = new THREE.Group()
  const lightGeometries: THREE.BufferGeometry[] = []
  const placed: Placed[] = []

  // 1) Construir los modelos y medir su planta
  for (const data of list) {
    const def = LANDMARK_MODELS[data.id]
    if (!def) continue // todavía sin modelo
    const s = LANDMARK_SCALE * (data.scale ?? 1)
    const built = def.build(kit)
    const markers = kit.lights(built) // night lights placed in the model (before merging drops them)
    const model = kit.merge(built) // cientos de piezas → una malla por color
    model.scale.setScalar(s)
    const box = new THREE.Box3().setFromObject(model)
    const margin = def.margin !== undefined ? def.margin * s : PLINTH_MARGIN
    const halfW = (box.max.x - box.min.x) / 2 + margin
    const halfD = (box.max.z - box.min.z) / 2 + margin

    // Suelo: el jardín propio del monumento o, si no tiene, una losa de piedra
    const holder = new THREE.Group()
    let floorTop = PLINTH_HEIGHT
    if (def.base) {
      const base = def.base(kit, (halfW * 2) / s, (halfD * 2) / s)
      const floor = kit.merge(base.group)
      floor.scale.setScalar(s)
      holder.add(floor)
      floorTop = base.top * s
    } else {
      holder.add(kit.box(halfW * 2, PLINTH_HEIGHT, halfD * 2, PLINTH_COLOR))
    }
    model.position.set(-(box.max.x + box.min.x) / 2, floorTop, -(box.max.z + box.min.z) / 2)

    const angle = (data.heading * Math.PI) / 180
    holder.rotation.y = angle
    holder.add(model)
    group.add(holder)
    // Night lights: one mesh per monument, in the holder's frame (model scale and offset baked in)
    const lightHolder = new THREE.Group()
    lightHolder.rotation.y = angle
    lights.add(lightHolder)
    if (markers.length > 0) {
      const toHolder = new THREE.Matrix4().makeScale(s, s, s).setPosition(model.position)
      const matrix = new THREE.Matrix4()
      const centre = new THREE.Vector3()
      const batch = makeLightBatch()
      markers.forEach((marker, i) => {
        matrix.multiplyMatrices(toHolder, marker.matrix)
        const phase = ((i * 0.618) % 1) * LIGHT_PHASE_SPREAD // they come on one after another, early in the dusk
        if (marker.panel) batch.addPanel(matrix, marker.w, marker.h, phase, marker.intensity)
        else {
          centre.setFromMatrixPosition(matrix)
          batch.addHalo(centre.x, centre.y, centre.z, marker.w * s, phase, marker.intensity)
        }
      })
      const mesh = makeLightMesh(batch)!
      lightGeometries.push(mesh.geometry)
      lightHolder.add(mesh)
    }
    const { x, z } = lonLatToWorld(data.lon, data.lat)
    const heights = bakeHeightMap(holder, halfW, halfD)
    placed.push({ data, holder, lightHolder, x, z, cos: Math.cos(angle), sin: Math.sin(angle), halfW, halfD, heights })
  }

  /** Coordenadas de (x, z) en el sistema del monumento (sin giro, centrado). */
  const local = (p: Placed, x: number, z: number) => {
    const dx = x - p.x, dz = z - p.z
    return { lx: dx * p.cos - dz * p.sin, lz: dx * p.sin + dz * p.cos }
  }
  /** Distancia desde (x, z) hasta el borde de la planta (0 si está dentro). */
  const outside = (p: Placed, x: number, z: number) => {
    const { lx, lz } = local(p, x, z)
    return Math.hypot(Math.max(0, Math.abs(lx) - p.halfW), Math.max(0, Math.abs(lz) - p.halfD))
  }

  return {
    group,
    lights,

    /** 2) Allana las alturas (m) de una zona debajo de cada monumento que caiga en ella. */
    flattenTerrain(zone: ZoneData, heights: Float32Array) {
      const { bounds: b, heightWidth: gw, heightHeight: gh } = zone
      const nw = lonLatToWorld(b.west, b.north), se = lonLatToWorld(b.east, b.south)
      const cellX = (se.x - nw.x) / (gw - 1), cellZ = (se.z - nw.z) / (gh - 1)
      for (const p of placed) {
        const PLAZA = p.data.plaza ?? DEFAULT_PLAZA, BLEND = p.data.blend ?? DEFAULT_BLEND
        const reach = Math.hypot(p.halfW, p.halfD) + PLAZA + BLEND
        const c0 = Math.max(0, Math.floor((p.x - reach - nw.x) / cellX))
        const c1 = Math.min(gw - 1, Math.ceil((p.x + reach - nw.x) / cellX))
        const r0 = Math.max(0, Math.floor((p.z - reach - nw.z) / cellZ))
        const r1 = Math.min(gh - 1, Math.ceil((p.z + reach - nw.z) / cellZ))
        if (c0 > c1 || r0 > r1) continue // este monumento no está en esta zona

        // Altura de la explanada: la mediana del terreno bajo el monumento (y siempre en tierra)
        const inside: number[] = []
        for (let r = r0; r <= r1; r++)
          for (let c = c0; c <= c1; c++)
            if (outside(p, nw.x + c * cellX, nw.z + r * cellZ) === 0) inside.push(heights[r * gw + c])
        if (inside.length === 0) {
          // Footprint smaller than a terrain cell: use the cell nearest to its centre
          const c = Math.round((p.x - nw.x) / cellX), r = Math.round((p.z - nw.z) / cellZ)
          if (c < 0 || c >= gw || r < 0 || r >= gh) continue
          inside.push(heights[r * gw + c])
        }
        inside.sort((a, b) => a - b)
        const target = Math.max(inside[Math.floor(inside.length / 2)], 60)

        for (let r = r0; r <= r1; r++) {
          for (let c = c0; c <= c1; c++) {
            const d = outside(p, nw.x + c * cellX, nw.z + r * cellZ)
            if (d >= PLAZA + BLEND) continue
            const t = Math.max(0, d - PLAZA) / BLEND // 0 en la explanada, 1 en el borde de la franja
            const k = t * t * (3 - 2 * t)
            const i = r * gw + c
            if (heights[i] <= 0) continue // el mar se queda como está
            heights[i] = target + (heights[i] - target) * k
          }
        }
      }
    },

    /** 3) Coloca cada monumento sobre su explanada. */
    place(heightAt: (x: number, z: number) => number) {
      for (const p of placed) {
        p.holder.position.set(p.x, heightAt(p.x, p.z), p.z)
        p.lightHolder.position.copy(p.holder.position)
      }
    },

    /**
     * Height of the monuments' surface at (x, z), or -Infinity if there is none. It is part of the
     * detective's ground (he climbs monuments like house roofs) and keeps the camera above them.
     */
    surfaceAt(x: number, z: number) {
      let top = -Infinity
      for (const p of placed) {
        if (outside(p, x, z) > 0) continue
        const { lx, lz } = local(p, x, z)
        const { cols, rows, data } = p.heights
        const col = Math.min(cols - 1, Math.max(0, Math.floor((lx + p.halfW) / HEIGHT_CELL)))
        const row = Math.min(rows - 1, Math.max(0, Math.floor((lz + p.halfD) / HEIGHT_CELL)))
        const h = data[row * cols + col]
        if (h > -Infinity) top = Math.max(top, p.holder.position.y + h)
      }
      return top
    },

    /** Distancia desde (x, z) hasta el monumento más cercano (0 si está dentro de su planta). */
    distance(x: number, z: number) {
      let best = Infinity
      for (const p of placed) best = Math.min(best, outside(p, x, z))
      return best
    },

    /**
     * Like distance(), for keeping houses and scenery away: a monument with its own `clearance`
     * counts as proportionally farther, so the callers' fixed clearances (80 for houses, 70 for
     * scenery) shrink to `clearance` (and 7/8 of it). Without `clearance` it equals distance().
     */
    spacing(x: number, z: number) {
      let best = Infinity
      for (const p of placed) best = Math.min(best, (outside(p, x, z) * DEFAULT_CLEARANCE) / (p.data.clearance ?? DEFAULT_CLEARANCE))
      return best
    },

    /** El monumento más cercano si está a menos de NEAR_DISTANCE. */
    nearest(x: number, z: number): LandmarkData | null {
      let best: Placed | null = null, bestD = NEAR_DISTANCE
      for (const p of placed) {
        const d = outside(p, x, z)
        if (d < bestD) {
          bestD = d
          best = p
        }
      }
      return best?.data ?? null
    },

    /** Circles around each monument footprint that rivers bend around (keeps plazas dry). */
    riverClearings(marginUnits: number): RiverClearing[] {
      return placed.map((p) => ({
        lon: p.data.lon,
        lat: p.data.lat,
        radiusKm: (Math.hypot(p.halfW, p.halfD) + marginUnits) / UNITS_PER_KM,
        innerKm: Math.hypot(p.halfW, p.halfD) / UNITS_PER_KM,
      }))
    },

    /** Posición en el mundo de un monumento (para colocar el coche delante, p. ej.). */
    positionOf(id: string) {
      const p = placed.find((q) => q.data.id === id)
      return p ? { x: p.x, z: p.z } : null
    },

    dispose: () => {
      kit.dispose()
      lightGeometries.forEach((g) => g.dispose())
    },
  }
}
