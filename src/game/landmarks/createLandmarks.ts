// Monumentos del país: se construyen, se allana el terreno debajo de cada uno (como una explanada)
// y se colocan sobre una losa de piedra. También dicen cuál tienes cerca y bloquean el paso del coche.
//
// Orden de uso (el terreno se allana ANTES de crear su malla y su textura):
//   const landmarks = createLandmarks(list)
//   landmarks.flattenTerrain(zone, heights)   // por cada zona
//   landmarks.place(terrain.heightAt)          // cuando el terreno ya existe
import * as THREE from 'three'
import type { ZoneData } from '../map/mapData'
import { lonLatToWorld } from '../map/projection'
import { createKit } from './kit'
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
const PLAZA = 90
/** Ancho de la franja donde la explanada se funde con el terreno de alrededor (unidades). */
const BLEND = 50
/** A menos de esta distancia (unidades) el panel muestra el monumento. */
const NEAR_DISTANCE = 250

interface Placed {
  data: LandmarkData
  holder: THREE.Group
  x: number
  z: number
  cos: number
  sin: number
  halfW: number
  halfD: number
}

export function createLandmarks(list: LandmarkData[]) {
  const kit = createKit()
  const group = new THREE.Group()
  const placed: Placed[] = []

  // 1) Construir los modelos y medir su planta
  for (const data of list) {
    const def = LANDMARK_MODELS[data.id]
    if (!def) continue // todavía sin modelo
    const s = LANDMARK_SCALE * (data.scale ?? 1)
    const model = kit.merge(def.build(kit)) // cientos de piezas → una malla por color
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
    const { x, z } = lonLatToWorld(data.lon, data.lat)
    placed.push({ data, holder, x, z, cos: Math.cos(angle), sin: Math.sin(angle), halfW, halfD })
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

    /** 2) Allana las alturas (m) de una zona debajo de cada monumento que caiga en ella. */
    flattenTerrain(zone: ZoneData, heights: Float32Array) {
      const { bounds: b, heightWidth: gw, heightHeight: gh } = zone
      const nw = lonLatToWorld(b.west, b.north), se = lonLatToWorld(b.east, b.south)
      const cellX = (se.x - nw.x) / (gw - 1), cellZ = (se.z - nw.z) / (gh - 1)
      for (const p of placed) {
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
        if (inside.length === 0) continue
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
      for (const p of placed) p.holder.position.set(p.x, heightAt(p.x, p.z), p.z)
    },

    /** ¿Este punto choca con algún monumento? */
    blocks(x: number, z: number) {
      return placed.some((p) => outside(p, x, z) === 0)
    },

    /** Distancia desde (x, z) hasta el monumento más cercano (0 si está dentro de su planta). */
    distance(x: number, z: number) {
      let best = Infinity
      for (const p of placed) best = Math.min(best, outside(p, x, z))
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

    /** Posición en el mundo de un monumento (para colocar el coche delante, p. ej.). */
    positionOf(id: string) {
      const p = placed.find((q) => q.data.id === id)
      return p ? { x: p.x, z: p.z } : null
    },

    dispose: kit.dispose,
  }
}
