// Featured case markers: a floating "!" over each case and a glowing trigger zone on the ground
// under it (where the player must stand to open the case). Solved cases turn green.
// Coordinates come from data/cases_index.json (via src/levels/data.ts); nothing is duplicated here.
// To restyle: change the constants below. To use another symbol ("?", a magnifier...): replace
// buildMarkerMesh(); for another zone shape, buildZoneMesh(). Each marker keeps userData.caseId.
//
//   const markers = createCaseMarkers(CASES)
//   markers.place(terrain.heightAt, landmarks.surfaceAt)   // once terrain and landmarks exist
//   scene.add(markers.group)
//   markers.update(dt)                // every frame
//   markers.zoneAt(x, z)              // caseId of the zone at (x, z), or null
//   markers.setCompleted(id, true)    // green "!" and ring
import * as THREE from 'three'
import { lonLatToWorld } from '../map/projection'
import { toonMaterial } from '../scene/toonGradient'

// ---- "!" symbol ----
/** Total height of the "!" in world units (detective ~9, landmarks up to ~100; 8 units = 1 km). */
const MARKER_HEIGHT = 160
/** Gap between the ground and the bottom of the "!" (world units); clears most landmarks. */
const HOVER_OFFSET = 80
/**
 * Extra height per case (world units), where buildings or monuments stand right under the "!".
 * Tuned so the "!" clears the tallest roof/monument within 40 units by at least ~30 units.
 */
const EXTRA_OFFSET: Record<string, number> = {
  filomena_madrid: 100, // Madrid buildings (~150 units above the ground)
  cordoba_heat: 50, // Mezquita
  dana_valencia: 25, // Ciudad de las Artes y las Ciencias
  almeria_murcia: 10,
}
/** Bar and dot of an open case. */
const MARKER_COLOR = 0xffc21a
const ACCENT_COLOR = 0xff7a1a
/** Bar and dot of a solved case. */
const DONE_COLOR = 0x3ddc5a
const DONE_ACCENT_COLOR = 0x1e9e3e
/** Bob up and down: amplitude (world units) and speed (rad/s). */
const BOB_AMPLITUDE = 10
const BOB_SPEED = 1.6
/** Slow spin around the vertical axis (rad/s). */
const SPIN_SPEED = 0.6

/**
 * Where to draw a case's marker and zone when its data point is hard to reach in the game
 * (sea edge, map edge). Only the marker, ring and zoneAt move: the case data and its statistics
 * stay on the real point in data/cases_index.json.
 */
const POSITION_OVERRIDE: Record<string, { lat: number; lon: number }> = {
  // North bank of the Ebro, ~9 km from Deltebre: around Deltebre itself the river, the delta and the
  // sea leave no dry land wide enough for a ring (data point: 40.70, 0.75, at the shore)
  ebro_delta: { lat: 40.78, lon: 0.645 },
  aneto_glacier: { lat: 42.58, lon: 0.66 }, // a few km south of the peak, away from the map edge
}

// ---- Trigger zone on the ground ----
/** Radius of the zone (world units): the detective must stop inside it to open the case. */
const ZONE_RADIUS = 60
/** Smaller zone for cases whose dry land is narrow (so the whole ring is drivable). */
const ZONE_RADIUS_OVERRIDE: Record<string, number> = {
  ebro_delta: 35,
}
/** Width of the bright rim, as a fraction of the radius. */
const ZONE_RIM = 0.12
/** Glow colours of an open and of a solved case. */
const ZONE_COLOR = 0xffc21a
const ZONE_DONE_COLOR = 0x3ddc5a
/** Opacity of the inner glow and of the rim; both pulse between MIN and MAX. */
const ZONE_FILL_MIN = 0.12
const ZONE_FILL_MAX = 0.28
const ZONE_RIM_MIN = 0.55
const ZONE_RIM_MAX = 0.95
/** Pulse speed (rad/s). */
const ZONE_PULSE_SPEED = 2.2
/** Height of the zone above the ground (world units), so it does not flicker with it. */
const ZONE_LIFT = 0.6
/**
 * The zone lies on monument plazas and gardens too (cases in Valencia, Madrid, Córdoba), but never
 * climbs more than this above the terrain, so it does not wrap over buildings (world units).
 */
const ZONE_MAX_CLIMB = 6

/** Minimal case info the markers need (a CaseIndexEntry fits). */
export interface CaseMarkerData {
  id: string
  title: string
  lat: number
  lon: number
}

// Derived sizes of the "!"
const BAR_HEIGHT = MARKER_HEIGHT * 0.68
const DOT_RADIUS = MARKER_HEIGHT * 0.1
const GAP = MARKER_HEIGHT * 0.08

interface MarkerLook {
  bar: THREE.BufferGeometry
  dot: THREE.BufferGeometry
  barMat: THREE.Material
  dotMat: THREE.Material
}

/**
 * The "!" symbol, standing on y = 0 (its bottom), centred on x = z = 0. It receives shared
 * geometries and materials (one set for all markers). Swap this function to change the symbol;
 * the rest of the file only needs the meshes tagged with userData.part ('bar' | 'dot').
 */
function buildMarkerMesh(look: MarkerLook) {
  const symbol = new THREE.Group()
  const dot = new THREE.Mesh(look.dot, look.dotMat)
  dot.position.y = DOT_RADIUS
  dot.userData.part = 'dot'
  const bar = new THREE.Mesh(look.bar, look.barMat)
  bar.position.y = DOT_RADIUS * 2 + GAP + BAR_HEIGHT / 2
  bar.userData.part = 'bar'
  for (const m of [dot, bar]) {
    m.castShadow = true
    symbol.add(m)
  }
  return symbol
}

/** Additive glow material for the zone. */
function glowMaterial(color: number) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false, // no ink lines and no z-fighting with the ground
    side: THREE.DoubleSide,
  })
}

interface ZoneLook {
  fill: THREE.Material
  rim: THREE.Material
}

/**
 * The trigger zone: an inner glow disc and a bright rim, flat on y = 0 around (0, 0).
 * Geometries are per zone (they are bent to the terrain in place()), materials are shared.
 */
function buildZoneMesh(look: ZoneLook, radius: number) {
  const zone = new THREE.Group()
  const flat = (g: THREE.BufferGeometry) => g.rotateX(-Math.PI / 2) // XY plane -> ground (XZ)
  const fill = new THREE.Mesh(flat(new THREE.RingGeometry(0.01, radius * (1 - ZONE_RIM), 48, 6)), look.fill)
  fill.userData.part = 'fill'
  const rim = new THREE.Mesh(flat(new THREE.RingGeometry(radius * (1 - ZONE_RIM), radius, 64, 1)), look.rim)
  rim.userData.part = 'rim'
  zone.add(fill, rim)
  return zone
}

interface Marker {
  id: string
  x: number
  z: number
  holder: THREE.Group
  zone: THREE.Group
  radius: number
  baseY: number
  phase: number
  done: boolean
}

export function createCaseMarkers(cases: CaseMarkerData[]) {
  const geometries = {
    bar: new THREE.CylinderGeometry(MARKER_HEIGHT * 0.12, MARKER_HEIGHT * 0.07, BAR_HEIGHT, 6),
    dot: new THREE.IcosahedronGeometry(DOT_RADIUS, 1),
  }
  const open = { marker: { ...geometries, barMat: toonMaterial(MARKER_COLOR), dotMat: toonMaterial(ACCENT_COLOR) }, zone: { fill: glowMaterial(ZONE_COLOR), rim: glowMaterial(ZONE_COLOR) } }
  const done = { marker: { ...geometries, barMat: toonMaterial(DONE_COLOR), dotMat: toonMaterial(DONE_ACCENT_COLOR) }, zone: { fill: glowMaterial(ZONE_DONE_COLOR), rim: glowMaterial(ZONE_DONE_COLOR) } }
  const fills = [open.zone.fill, done.zone.fill] as THREE.MeshBasicMaterial[]
  const rims = [open.zone.rim, done.zone.rim] as THREE.MeshBasicMaterial[]

  const group = new THREE.Group()
  group.name = 'case-markers'
  const markers: Marker[] = cases.map((c, i) => {
    const at = POSITION_OVERRIDE[c.id] ?? c
    const { x, z } = lonLatToWorld(at.lon, at.lat)
    const baseY = HOVER_OFFSET + (EXTRA_OFFSET[c.id] ?? 0)
    const holder = new THREE.Group()
    holder.name = c.title
    holder.userData.caseId = c.id
    holder.position.set(x, baseY, z)
    holder.add(buildMarkerMesh(open.marker))
    const radius = ZONE_RADIUS_OVERRIDE[c.id] ?? ZONE_RADIUS
    const zone = buildZoneMesh(open.zone, radius)
    zone.userData.caseId = c.id
    zone.position.set(x, 0, z)
    group.add(holder, zone)
    return { id: c.id, x, z, holder, zone, radius, baseY, phase: i * 1.7, done: false } // own phase: no lockstep
  })
  let clock = 0

  /** Applies the open or solved look to one marker and its zone. */
  const applyLook = (m: Marker) => {
    const look = m.done ? done : open
    m.holder.traverse((o) => {
      if (o.userData.part === 'bar') (o as THREE.Mesh).material = look.marker.barMat
      if (o.userData.part === 'dot') (o as THREE.Mesh).material = look.marker.dotMat
    })
    m.zone.traverse((o) => {
      if (o.userData.part === 'fill') (o as THREE.Mesh).material = look.zone.fill
      if (o.userData.part === 'rim') (o as THREE.Mesh).material = look.zone.rim
    })
  }

  return {
    group,

    /**
     * Puts each "!" above the terrain under it and bends each zone to the ground.
     * surfaceAt (optional): top of monuments/plazas, so the zone is not hidden under their floors.
     */
    place(heightAt: (x: number, z: number) => number, surfaceAt?: (x: number, z: number) => number) {
      const groundAt = (x: number, z: number) => {
        const h = heightAt(x, z)
        return surfaceAt ? Math.max(h, Math.min(surfaceAt(x, z), h + ZONE_MAX_CLIMB)) : h
      }
      for (const m of markers) {
        m.baseY = heightAt(m.x, m.z) + HOVER_OFFSET + (EXTRA_OFFSET[m.id] ?? 0)
        m.holder.position.y = m.baseY
        m.zone.traverse((o) => {
          const mesh = o as THREE.Mesh
          if (!mesh.isMesh) return
          const pos = mesh.geometry.getAttribute('position')
          for (let i = 0; i < pos.count; i++) pos.setY(i, groundAt(m.x + pos.getX(i), m.z + pos.getZ(i)) + ZONE_LIFT)
          pos.needsUpdate = true
          mesh.geometry.computeBoundingSphere()
        })
      }
    },

    /** Slow bob and spin of the "!", pulse of the zones. */
    update(dt: number) {
      clock += dt
      for (const m of markers) {
        m.holder.position.y = m.baseY + Math.sin(clock * BOB_SPEED + m.phase) * BOB_AMPLITUDE
        m.holder.rotation.y += SPIN_SPEED * dt
      }
      const pulse = 0.5 + 0.5 * Math.sin(clock * ZONE_PULSE_SPEED)
      for (const f of fills) f.opacity = ZONE_FILL_MIN + (ZONE_FILL_MAX - ZONE_FILL_MIN) * pulse
      for (const r of rims) r.opacity = ZONE_RIM_MIN + (ZONE_RIM_MAX - ZONE_RIM_MIN) * pulse
    },

    /** caseId of the zone that contains (x, z), or null. */
    zoneAt(x: number, z: number): string | null {
      for (const m of markers) if (Math.hypot(x - m.x, z - m.z) <= m.radius) return m.id
      return null
    },

    /** Centre and radius of a case's trigger zone (world units), or null if the case has no marker. */
    positionOf(caseId: string): { x: number; z: number; radius: number } | null {
      const m = markers.find((q) => q.id === caseId)
      return m ? { x: m.x, z: m.z, radius: m.radius } : null
    },

    /** Shows a case as solved (green) or open (yellow). */
    setCompleted(caseId: string, isDone: boolean) {
      const m = markers.find((q) => q.id === caseId)
      if (!m || m.done === isDone) return
      m.done = isDone
      applyLook(m)
    },

    dispose() {
      geometries.bar.dispose()
      geometries.dot.dispose()
      for (const look of [open, done]) {
        look.marker.barMat.dispose()
        look.marker.dotMat.dispose()
        look.zone.fill.dispose()
        look.zone.rim.dispose()
      }
      for (const m of markers) m.zone.traverse((o) => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.dispose())
    },
  }
}
