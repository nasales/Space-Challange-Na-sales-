// Canary Islands portal (PROTOTYPE). The islands sit in a box in the south-west corner of the map
// (map/canaryInset.ts); this draws that box as a glowing portal frame and adds two gates:
// one on the mainland coast (Cádiz) and one in the islands (Tenerife: aimed at La Laguna, it lands on the nearest free, flat ground, today the Teide caldera). Walking into
// a gate takes the detective to the other one.
//
//   const portal = createCanaryPortal()
//   portal.place({ heightAt, isFree })   // once terrain, towns and scenery exist
//   scene.add(portal.group)
//   portal.update(carState, dt)          // every frame: returns true on the frame it teleports
//
// To restyle: change the constants below. To move a gate: change GATES (real lon/lat; the gate
// goes to the nearest free land within SEARCH_KM).
import * as THREE from 'three'
import { CANARY_DISPLAY } from '../map/canaryInset'
import { lonLatToWorld, SEA_Y, UNITS_PER_DEG_LAT, UNITS_PER_DEG_LON, UNITS_PER_KM } from '../map/projection'
import type { CarState } from '../car/carPhysics'

// ---- Frame around the box ----
/** Gap between the island zone and the frame (degrees). */
const FRAME_PAD = 0.12
/** Height of the glowing curtain (world units; detective ~9, Teide ~240). */
const CURTAIN_HEIGHT = 140
/** Width of the bright band on the sea at the foot of the curtain (world units). */
const RIM_WIDTH = 30
const PORTAL_COLOR = new THREE.Color(0x7a5cff)
const PORTAL_GLOW = new THREE.Color(0x45e0ff)

// ---- Gates ----
/** Where the gates go (real lon/lat). */
const GATES = [
  { id: 'mainland', name: 'Cádiz', lon: -6.25, lat: 36.55 },
  { id: 'canaries', name: 'Tenerife', lon: -16.34, lat: 28.485 },
] as const
/** Ring radius and tube (world units). */
const GATE_RADIUS = 16
const GATE_TUBE = 2.2
/** The detective goes through when he is this close to the gate centre (world units). */
const TRIGGER_RADIUS = 9
/** He lands this far in front of the other gate (world units), outside its trigger. */
const EXIT_DISTANCE = 55
/** Search for a free, flat spot up to this far from the wanted point (km). */
const SEARCH_KM = 40

const curtainMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: PORTAL_COLOR }, uGlow: { value: PORTAL_GLOW } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; uniform vec3 uGlow; varying vec2 vUv;
      void main() {
        float fade = pow(1.0 - vUv.y, 1.6);
        float stripes = 0.55 + 0.45 * sin(vUv.x * 900.0 - uTime * 2.0 + sin(vUv.y * 8.0 + uTime) * 2.0);
        float rise = 0.6 + 0.4 * sin(vUv.y * 30.0 - uTime * 4.0);
        vec3 col = mix(uColor, uGlow, rise * stripes);
        gl_FragColor = vec4(col, fade * (0.35 + 0.35 * stripes));
      }`,
  })

const swirlMaterial = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: PORTAL_COLOR }, uGlow: { value: PORTAL_GLOW } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; uniform vec3 uGlow; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p), a = atan(p.y, p.x);
        float swirl = 0.5 + 0.5 * sin(a * 5.0 + r * 14.0 - uTime * 3.0);
        vec3 col = mix(uColor, uGlow, swirl * (1.0 - r));
        gl_FragColor = vec4(col, (0.55 + 0.4 * swirl) * smoothstep(1.0, 0.85, r));
      }`,
  })

/** One wall of the frame, from (x0, z0) to (x1, z1). */
function curtain(x0: number, z0: number, x1: number, z1: number, material: THREE.Material) {
  const length = Math.hypot(x1 - x0, z1 - z0)
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(length, CURTAIN_HEIGHT), material)
  wall.position.set((x0 + x1) / 2, SEA_Y + CURTAIN_HEIGHT / 2, (z0 + z1) / 2)
  wall.rotation.y = -Math.atan2(z1 - z0, x1 - x0)
  return wall
}

/** Bright band on the sea at the foot of one wall. */
function rim(x0: number, z0: number, x1: number, z1: number, material: THREE.Material) {
  const length = Math.hypot(x1 - x0, z1 - z0) + RIM_WIDTH
  const band = new THREE.Mesh(new THREE.PlaneGeometry(length, RIM_WIDTH), material)
  band.rotation.x = -Math.PI / 2
  band.rotation.z = Math.atan2(-(z1 - z0), x1 - x0)
  band.position.set((x0 + x1) / 2, SEA_Y + 0.5, (z0 + z1) / 2)
  return band
}

export interface PortalWorld {
  heightAt: (x: number, z: number) => number
  /** Explored land with nothing standing on it (no house, tree or monument). */
  isFree: (x: number, z: number) => boolean
}

export function createCanaryPortal() {
  const group = new THREE.Group()
  group.name = 'canary-portal'
  const materials: THREE.ShaderMaterial[] = []

  // Frame: four walls of light around the box, and a bright rim on the water
  const b = CANARY_DISPLAY
  const nw = { x: (b.west - FRAME_PAD) * UNITS_PER_DEG_LON, z: -(b.north + FRAME_PAD) * UNITS_PER_DEG_LAT }
  const se = { x: (b.east + FRAME_PAD) * UNITS_PER_DEG_LON, z: -(b.south - FRAME_PAD) * UNITS_PER_DEG_LAT }
  const wallMat = curtainMaterial()
  const rimMat = new THREE.MeshBasicMaterial({ color: PORTAL_GLOW, transparent: true, opacity: 0.85, depthWrite: false })
  materials.push(wallMat)
  const corners: [number, number][] = [[nw.x, nw.z], [se.x, nw.z], [se.x, se.z], [nw.x, se.z]]
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = corners[i], [x1, z1] = corners[(i + 1) % 4]
    group.add(curtain(x0, z0, x1, z1, wallMat), rim(x0, z0, x1, z1, rimMat))
  }

  // Gates: a standing ring with a swirl inside, and a glowing pad on the ground
  const ringMat = new THREE.MeshBasicMaterial({ color: PORTAL_GLOW })
  const padMat = new THREE.MeshBasicMaterial({ color: PORTAL_COLOR, transparent: true, opacity: 0.5, depthWrite: false })
  const gates = GATES.map((g) => {
    const root = new THREE.Group()
    root.name = `portal-gate-${g.id}`
    const ring = new THREE.Mesh(new THREE.TorusGeometry(GATE_RADIUS, GATE_TUBE, 12, 48), ringMat)
    ring.position.y = GATE_RADIUS + GATE_TUBE
    const swirl = new THREE.Mesh(new THREE.CircleGeometry(GATE_RADIUS, 48), swirlMaterial())
    swirl.position.y = ring.position.y
    materials.push(swirl.material as THREE.ShaderMaterial)
    const pad = new THREE.Mesh(new THREE.RingGeometry(TRIGGER_RADIUS * 0.6, TRIGGER_RADIUS * 1.6, 40), padMat)
    pad.rotation.x = -Math.PI / 2
    pad.position.y = 0.6
    root.add(ring, swirl, pad)
    group.add(root)
    return { ...g, root, x: 0, z: 0, heading: 0 }
  })

  /** Nearest free, fairly flat spot to (x, z), searched in rings outwards. */
  const findSpot = (x: number, z: number, world: PortalWorld) => {
    const step = 0.5 * UNITS_PER_KM
    const CHECKS = 36
    // How many points around the gate (and its landing point) are free ground at about the same height
    const score = (px: number, pz: number) => {
      if (!world.isFree(px, pz)) return -1
      const h = world.heightAt(px, pz)
      let good = 0
      for (const d of [GATE_RADIUS, EXIT_DISTANCE * 0.6, EXIT_DISTANCE])
        for (let a = 0; a < 12; a++) {
          const qx = px + Math.cos((a * Math.PI) / 6) * d, qz = pz + Math.sin((a * Math.PI) / 6) * d
          if (world.isFree(qx, qz) && Math.abs(world.heightAt(qx, qz) - h) <= 16) good++
        }
      return good
    }
    // Nearest spot where (almost) every check passes; otherwise the best one found
    let best = { x, z, s: -2 }
    for (let r = 0; r <= SEARCH_KM * UNITS_PER_KM; r += step) {
      const n = Math.max(1, Math.round((2 * Math.PI * r) / step))
      for (let k = 0; k < n; k++) {
        const px = x + Math.cos((k / n) * 2 * Math.PI) * r, pz = z + Math.sin((k / n) * 2 * Math.PI) * r
        const s = score(px, pz)
        if (s >= CHECKS - 4) return { x: px, z: pz }
        if (s > best.s) best = { x: px, z: pz, s }
      }
    }
    return best
  }

  const place = (world: PortalWorld) => {
    for (const g of gates) {
      const wanted = lonLatToWorld(g.lon, g.lat)
      const spot = findSpot(wanted.x, wanted.z, world)
      g.x = spot.x
      g.z = spot.z
      g.root.position.set(spot.x, world.heightAt(spot.x, spot.z), spot.z)
      // Face the gate along the side with the flattest, free ground in front
      let best = 0, bestScore = -Infinity
      for (let a = 0; a < 16; a++) {
        const h = (a / 16) * 2 * Math.PI
        const fx = spot.x - Math.sin(h) * EXIT_DISTANCE, fz = spot.z - Math.cos(h) * EXIT_DISTANCE
        const score = (world.isFree(fx, fz) ? 0 : -100) - Math.abs(world.heightAt(fx, fz) - world.heightAt(spot.x, spot.z))
        if (score > bestScore) { bestScore = score; best = h }
      }
      g.heading = best
      g.root.rotation.y = best
    }
  }

  // He must step out of a gate's trigger before it can take him again (no ping-pong on arrival)
  let armed = true
  let time = 0

  /** Every frame. Moves the detective to the other gate when he walks into one; true on that frame. */
  const update = (car: CarState, dt: number) => {
    time += dt
    for (const m of materials) m.uniforms.uTime.value = time
    for (const g of gates) g.root.children[1].rotation.z = time * 0.8
    const inside = gates.findIndex((g) => Math.hypot(car.x - g.x, car.z - g.z) < TRIGGER_RADIUS)
    if (inside < 0) {
      armed = true
      return false
    }
    if (!armed) return false
    const to = gates[1 - inside]
    car.x = to.x - Math.sin(to.heading) * EXIT_DISTANCE
    car.z = to.z - Math.cos(to.heading) * EXIT_DISTANCE
    car.heading = to.heading
    car.speed = Math.min(car.speed, 20)
    armed = false
    return true
  }

  /** Gate positions (world units), for debugging and tests. */
  const gatePositions = () => gates.map((g) => ({ id: g.id, name: g.name, x: g.x, z: g.z, heading: g.heading }))

  const dispose = () => {
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose()
    })
    for (const m of materials) m.dispose()
    rimMat.dispose()
    ringMat.dispose()
    padMat.dispose()
  }

  return { group, place, update, gatePositions, dispose }
}
