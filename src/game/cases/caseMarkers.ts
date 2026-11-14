// Featured-case markers: a big comic "!" floating over each case that has a tutorial
// (TUTORIAL_CASE_IDS in src/shared/tutorial.ts). The list comes from data/cases_index.json,
// bundled with the game, so the markers work offline.
//
// Each marker is a yellow "!" in front of a red comic burst, with ink outlines (inverted hull),
// bobbing and wobbling while it turns towards the camera. When the car is close it pulses and grows.
import * as THREE from 'three'
import casesIndex from '../../../data/cases_index.json'
import { TUTORIAL_CASE_IDS, type CaseMarker } from '../../shared/tutorial'
import { lonLatToWorld, UNITS_PER_KM } from '../map/projection'
import { toonMaterial } from '../scene/toonGradient'
import { damp } from '../car/carPhysics'

/** The car is "near" a case inside this distance (km); it shows the hint and Enter opens it. */
export const CASE_NEAR_KM = 10
/** It stops being near a bit further out, so the hint does not flicker on the edge. */
const CASE_LEAVE_KM = CASE_NEAR_KM + 1
const NEAR_UNITS = CASE_NEAR_KM * UNITS_PER_KM
const LEAVE_UNITS = CASE_LEAVE_KM * UNITS_PER_KM

/** Height of the bottom of the marker above the ground under it (world units). */
const FLOAT_HEIGHT = 12 // low enough to stay in frame of the close chase camera
const BOB_AMPLITUDE = 2.5
const BOB_SPEED = 1.6 // rad/s
const WOBBLE = 0.3 // rad, swing around the vertical axis
/** Scale when the car is near (1 = normal). */
const NEAR_SCALE = 1.3
/** The marker grows when the camera is zoomed out so it stays readable on the overview. */
const ZOOM_SCALE_FROM = 60 // camera distance (units) where the extra scale starts

const YELLOW = 0xffd23f
const RED = 0xe63946
const INK = 0x1a1423
const OUTLINE = 1.1 // thickness of the ink hull (world units)

/** Featured cases with a tutorial, read from data/cases_index.json. */
export function loadCaseMarkers(): CaseMarker[] {
  const ids = new Set<string>(TUTORIAL_CASE_IDS)
  return (casesIndex as CaseMarker[])
    .filter((c) => ids.has(c.id))
    .map(({ id, title, place, lat, lon }) => ({ id, title, place, lat, lon }))
}

/** Spiky comic burst (flat star with a little thickness), centred at the origin, facing +Z. */
function burstGeometry(outer: number, inner: number, spikes: number, depth: number) {
  const shape = new THREE.Shape()
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + Math.PI / 2
    // Uneven spikes look hand-drawn
    const r = i % 2 === 0 ? outer * (i % 4 === 0 ? 1 : 0.86) : inner
    const x = Math.cos(a) * r, y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  geo.translate(0, 0, -depth / 2)
  return geo
}

/** How far (units, 5 km) the sign may move from the case point to find open ground. */
const SPOT_SEARCH = 40
/** Half width of the sign: the ground is checked this far around the chosen spot. */
const SIGN_HALF_WIDTH = 14

/** Highest ground (terrain, roofs, monuments) under the sign if it stands at (x, z). */
function groundUnderSign(x: number, z: number, heightAt: (x: number, z: number) => number) {
  let top = heightAt(x, z)
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2
    top = Math.max(top, heightAt(x + Math.cos(ang) * SIGN_HALF_WIDTH, z + Math.sin(ang) * SIGN_HALF_WIDTH))
  }
  return top
}

/**
 * Where the sign stands. A case point can fall inside a monument (Valencia is inside the Ciudad de
 * las Artes plaza): on its roof the sign would float out of view of the low chase camera. So it
 * looks for the lowest open ground near the point, preferring the closest (a few km away at most,
 * well inside one data pixel). Proximity is measured from the sign, where the player sees it.
 */
function findOpenSpot(x: number, z: number, heightAt: (x: number, z: number) => number) {
  let best = { sx: x, sz: z, baseY: groundUnderSign(x, z, heightAt) }
  let bestScore = best.baseY
  for (let r = 10; r <= SPOT_SEARCH; r += 10) {
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2
      const sx = x + Math.cos(ang) * r, sz = z + Math.sin(ang) * r
      const baseY = groundUnderSign(sx, sz, heightAt)
      const score = baseY + r * 0.3 // a little higher is fine if it is much closer
      if (score < bestScore) {
        best = { sx, sz, baseY }
        bestScore = score
      }
    }
  }
  return best
}

interface Built {
  data: CaseMarker
  /** Real case point */
  x: number
  z: number
  /** Where the sign stands (open ground near the case point); proximity is measured from here */
  sx: number
  sz: number
  baseY: number
  /** Turns towards the camera, bobs and scales */
  holder: THREE.Group
  /** Invisible sphere used for clicks */
  hit: THREE.Mesh
  ring: THREE.Mesh
  /** 0 = far, 1 = car near (smoothed) */
  glow: number
  phase: number
}

export function createCaseMarkers(list: CaseMarker[], heightAt: (x: number, z: number) => number) {
  const group = new THREE.Group()
  group.name = 'case-markers'
  const disposables: { dispose(): void }[] = []
  const keep = <T extends { dispose(): void }>(d: T) => (disposables.push(d), d)

  // Shared geometries and materials. fog: false keeps them bright and visible from far away.
  const yellow = keep(toonMaterial(YELLOW, { emissive: YELLOW, emissiveIntensity: 0.35, fog: false }))
  const red = keep(toonMaterial(RED, { emissive: RED, emissiveIntensity: 0.2, fog: false }))
  const ink = keep(new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, fog: false }))
  const ringMat = keep(new THREE.MeshBasicMaterial({ color: YELLOW, transparent: true, opacity: 0.6, depthWrite: false, fog: false }))
  const hitMat = keep(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }))

  // "!" with low-poly pieces: a tapered bar and a chunky dot
  const barGeo = keep(new THREE.CylinderGeometry(4.6, 2.6, 22, 6))
  const barInkGeo = keep(new THREE.CylinderGeometry(4.6 + OUTLINE, 2.6 + OUTLINE, 22 + OUTLINE * 2, 6))
  const dotGeo = keep(new THREE.DodecahedronGeometry(3.6))
  const dotInkGeo = keep(new THREE.DodecahedronGeometry(3.6 + OUTLINE))
  const burstGeo = keep(burstGeometry(21, 14, 9, 2))
  const burstInkGeo = keep(burstGeometry(21 + OUTLINE * 1.5, 14 + OUTLINE * 1.5, 9, 2 + OUTLINE))
  const ringGeo = keep(new THREE.TorusGeometry(16, 1.4, 6, 32))
  const hitGeo = keep(new THREE.SphereGeometry(26, 12, 8))

  const piece = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number, z = 0) => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(0, y, z)
    return m
  }

  const built: Built[] = list.map((data, i) => {
    const { x, z } = lonLatToWorld(data.lon, data.lat)
    const { sx, sz, baseY } = findOpenSpot(x, z, heightAt)
    const holder = new THREE.Group()
    holder.name = `case-marker-${data.id}`
    // Local frame: y = 0 is the bottom of the dot, the burst is behind the "!" (towards -Z)
    const sign = new THREE.Group()
    sign.add(
      piece(barGeo, yellow, 18), piece(barInkGeo, ink, 18),
      piece(dotGeo, yellow, 3.6), piece(dotInkGeo, ink, 3.6),
      piece(burstGeo, red, 15, -5), piece(burstInkGeo, ink, 15, -5),
    )
    holder.add(sign)
    holder.position.set(sx, baseY + FLOAT_HEIGHT, sz)
    const hit = piece(hitGeo, hitMat, 15)
    hit.userData.caseId = data.id
    holder.add(hit)
    group.add(holder)

    // Ring on the ground under the marker: shows where the case is
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(sx, baseY + 1, sz)
    group.add(ring)

    return { data, x, z, sx, sz, baseY, holder, hit, ring, glow: 0, phase: i * 1.7 }
  })

  let near: string | null = null
  let time = 0
  const raycaster = new THREE.Raycaster()

  return {
    group,
    markers: list,

    /**
     * Animates the markers and works out which one the car is close to.
     * Returns the id of the near case, or null.
     */
    update(dt: number, carX: number, carZ: number, camera: THREE.Camera, cameraDistance: number): string | null {
      time += dt
      // Nearest case inside the radius (with a wider radius to leave the current one)
      let best: string | null = null, bestD = Infinity
      for (const b of built) {
        const d = Math.hypot(carX - b.sx, carZ - b.sz)
        const limit = b.data.id === near ? LEAVE_UNITS : NEAR_UNITS
        if (d < limit && d < bestD) {
          bestD = d
          best = b.data.id
        }
      }
      near = best

      const zoomScale = Math.max(1, cameraDistance / ZOOM_SCALE_FROM)
      for (const b of built) {
        b.glow = damp(b.glow, b.data.id === near ? 1 : 0, 5, dt)
        const t = time + b.phase
        // Faster, stronger pulse when near
        const pulse = 1 + b.glow * 0.08 * Math.sin(t * 6)
        const scale = (1 + (NEAR_SCALE - 1) * b.glow) * pulse * zoomScale
        b.holder.scale.setScalar(scale)
        b.holder.position.y = b.baseY + FLOAT_HEIGHT * zoomScale + Math.sin(t * BOB_SPEED) * BOB_AMPLITUDE * zoomScale
        // Face the camera (around the vertical axis) with a gentle swing
        const yaw = Math.atan2(camera.position.x - b.sx, camera.position.z - b.sz)
        b.holder.rotation.y = yaw + Math.sin(t * 0.9) * WOBBLE
        b.ring.scale.setScalar((1 + b.glow * (0.25 + 0.15 * Math.sin(t * 4))) * zoomScale)
      }
      ringMat.opacity = 0.45 + 0.45 * Math.max(0, ...built.map((b) => b.glow))
      yellow.emissiveIntensity = 0.35 + 0.45 * Math.max(0, ...built.map((b) => b.glow)) * (0.6 + 0.4 * Math.sin(time * 6))
      return near
    },

    /** Id of the case marker under the pointer (normalised device coordinates), or null. */
    pick(ndcX: number, ndcY: number, camera: THREE.Camera): string | null {
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
      const hits = raycaster.intersectObjects(built.map((b) => b.hit), false)
      return hits.length ? (hits[0].object.userData.caseId as string) : null
    },

    dispose() {
      for (const d of disposables) d.dispose()
    },
  }
}
