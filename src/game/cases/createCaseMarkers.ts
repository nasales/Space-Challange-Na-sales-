// Floating "!" markers over the featured case locations (PROTOTYPE, no interaction yet).
// Coordinates come from data/cases_index.json (via src/levels/data.ts); nothing is duplicated here.
// To restyle: change the constants below. To use another symbol ("?", a magnifier...): replace
// buildMarkerMesh() only. Each marker keeps userData.caseId for later clicks / proximity checks.
//
//   const markers = createCaseMarkers(CASES)
//   markers.place(terrain.heightAt)   // once the terrain exists
//   scene.add(markers.group)
//   markers.update(dt)                // every frame
import * as THREE from 'three'
import { lonLatToWorld } from '../map/projection'
import { toonMaterial } from '../scene/toonGradient'

/** Total height of the "!" in world units (detective ~9, landmarks up to ~100; 8 units = 1 km). */
const MARKER_HEIGHT = 160
/** Gap between the ground and the bottom of the "!" (world units); clears the landmarks. */
const HOVER_OFFSET = 80
/** Bar of the "!". */
const MARKER_COLOR = 0xffc21a
/** Dot of the "!". */
const ACCENT_COLOR = 0xff7a1a
/** Bob up and down: amplitude (world units) and speed (rad/s). */
const BOB_AMPLITUDE = 10
const BOB_SPEED = 1.6
/** Slow spin around the vertical axis (rad/s). */
const SPIN_SPEED = 0.6

/** Minimal case info the markers need (a CaseIndexEntry fits). */
export interface CaseMarkerData {
  id: string
  title: string
  lat: number
  lon: number
}

// Shared pieces: one geometry/material set for every marker
const BAR_HEIGHT = MARKER_HEIGHT * 0.68
const DOT_RADIUS = MARKER_HEIGHT * 0.1
const GAP = MARKER_HEIGHT * 0.08
const barGeometry = () => new THREE.CylinderGeometry(MARKER_HEIGHT * 0.12, MARKER_HEIGHT * 0.07, BAR_HEIGHT, 6)
const dotGeometry = () => new THREE.IcosahedronGeometry(DOT_RADIUS, 1)

/**
 * The marker symbol, standing on y = 0 (its bottom), centred on x = z = 0.
 * Swap this function to change the symbol; the rest of the file does not care about the shape.
 */
function buildMarkerMesh(parts: { bar: THREE.BufferGeometry; dot: THREE.BufferGeometry; barMat: THREE.Material; dotMat: THREE.Material }) {
  const symbol = new THREE.Group()
  const dot = new THREE.Mesh(parts.dot, parts.dotMat)
  dot.position.y = DOT_RADIUS
  const bar = new THREE.Mesh(parts.bar, parts.barMat)
  bar.position.y = DOT_RADIUS * 2 + GAP + BAR_HEIGHT / 2
  for (const m of [dot, bar]) {
    m.castShadow = true
    symbol.add(m)
  }
  return symbol
}

interface Marker {
  holder: THREE.Group
  baseY: number
  phase: number
}

export function createCaseMarkers(cases: CaseMarkerData[]) {
  const parts = {
    bar: barGeometry(),
    dot: dotGeometry(),
    barMat: toonMaterial(MARKER_COLOR),
    dotMat: toonMaterial(ACCENT_COLOR),
  }
  const group = new THREE.Group()
  group.name = 'case-markers'
  const markers: Marker[] = cases.map((c, i) => {
    const holder = new THREE.Group()
    holder.name = c.title
    holder.userData.caseId = c.id
    const { x, z } = lonLatToWorld(c.lon, c.lat)
    holder.position.set(x, HOVER_OFFSET, z)
    holder.add(buildMarkerMesh(parts))
    group.add(holder)
    return { holder, baseY: HOVER_OFFSET, phase: i * 1.7 } // own phase: they do not move in lockstep
  })
  let clock = 0

  return {
    group,

    /** Puts each marker HOVER_OFFSET above the terrain under it. */
    place(heightAt: (x: number, z: number) => number) {
      for (const m of markers) {
        m.baseY = heightAt(m.holder.position.x, m.holder.position.z) + HOVER_OFFSET
        m.holder.position.y = m.baseY
      }
    },

    /** Slow bob and spin. */
    update(dt: number) {
      clock += dt
      for (const m of markers) {
        m.holder.position.y = m.baseY + Math.sin(clock * BOB_SPEED + m.phase) * BOB_AMPLITUDE
        m.holder.rotation.y += SPIN_SPEED * dt
      }
    },

    dispose() {
      parts.bar.dispose()
      parts.dot.dispose()
      parts.barMat.dispose()
      parts.dotMat.dispose()
    },
  }
}
