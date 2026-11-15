// Rowing boat for the shallow sea (map/shallowSea.ts): when the detective steps onto the
// water he sits in a small wooden boat and rows; back on land the boat goes away.
// Original low-poly model, built here from simple shapes (no external assets). Faces -Z like him.
//
// Hierarchy:  root (position and heading) -> hull group (scale, bobbing) -> hull, bench, oars
import * as THREE from 'three'
import type { CarState } from '../car/carPhysics'
import { toonMaterial } from '../scene/toonGradient'
import { DETECTIVE_SCALE } from '../detective/detectiveSize'

const HULL = 0xf6f1e4 // white painted wood
const RIM = 0x2f6fd6 // blue gunwale stripe
const WOOD = 0xc98f52
const WOOD_DARK = 0x9a6a3c
const BLADE = 0xe2503c

/** Hull: stern at +Z, pointed bow at -Z (model units, before scaling). */
const STERN_Z = 1.25
const LENGTH = 3.3
const HALF_BEAM = 0.78
const HULL_BOTTOM = -0.2 // below the water line
const HULL_HEIGHT = 0.62
const WALL = 0.1
/** Size of the boat next to the detective (1 = same model scale as him). */
const BOAT_SCALE = 1.25
/** How far the detective's body drops to sit on the bench (model units). */
const SIT_DROP = 0.5
const SIT_LEGS = 1.35 // legs stretched forward (rad)
/** Oars: resting dip towards the water, sweep and lift of a stroke (rad). */
const OAR_DIP = 0.34
const OAR_SWEEP = 0.55
const OAR_LIFT = 0.3

/** The detective parts the boat poses (createDetective().parts) and his magnifier state. */
export interface Rower {
  parts: { body: THREE.Object3D; arms: THREE.Object3D[]; legs: THREE.Object3D[] }
  /** 0..1: he is holding the magnifier out (his arms are busy, the oars rest). */
  inspect: number
}

/** Top-view outline of the hull as a shape (x, -z), `inset` units smaller all around. */
function hullShape(inset: number) {
  const halfWidth = (u: number) => HALF_BEAM * Math.sin(Math.PI * (0.25 + 0.75 * u)) ** 0.8 - inset
  const u0 = inset > 0 ? 0.035 : 0, u1 = inset > 0 ? 0.88 : 1
  const right: THREE.Vector2[] = []
  const N = 14
  for (let k = 0; k <= N; k++) {
    const u = u0 + ((u1 - u0) * k) / N
    right.push(new THREE.Vector2(Math.max(0.02, halfWidth(u)), -(STERN_Z - u * LENGTH)))
  }
  const left = right.map((p) => new THREE.Vector2(-p.x, p.y)).reverse()
  return new THREE.Shape([...right, ...left])
}

export function createRowBoat() {
  const geometries: THREE.BufferGeometry[] = []
  const materials = new Map<number, THREE.Material>()
  const mat = (color: number) => {
    if (!materials.has(color)) materials.set(color, toonMaterial(color, {}, 0.55))
    return materials.get(color)!
  }
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0) => {
    geometries.push(geo)
    const m = new THREE.Mesh(geo, mat(color))
    m.position.set(x, y, z)
    m.castShadow = true
    parent.add(m)
    return m
  }
  /** A flat shape extruded upwards from y to y + height. */
  const slab = (shape: THREE.Shape, y: number, height: number, color: number) =>
    add(hull, new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }).rotateX(-Math.PI / 2), color, 0, y, 0)

  const root = new THREE.Group()
  const hull = new THREE.Group()
  root.add(hull)
  root.visible = false

  // ---- Hull: hollow walls, a floor and a blue stripe along the top edge ----
  const outer = hullShape(0)
  const walls = hullShape(0)
  walls.holes.push(hullShape(WALL))
  slab(walls, HULL_BOTTOM, HULL_HEIGHT, HULL)
  slab(outer, HULL_BOTTOM, 0.08, WOOD_DARK) // floor
  const rim = hullShape(-0.03)
  rim.holes.push(hullShape(WALL))
  slab(rim, HULL_BOTTOM + HULL_HEIGHT, 0.07, RIM)
  // Benches: the one he sits on and a small one at the bow
  add(hull, new THREE.BoxGeometry(HALF_BEAM * 2 - 0.2, 0.07, 0.34), WOOD, 0, 0.26, 0.12)
  add(hull, new THREE.BoxGeometry(0.8, 0.07, 0.26), WOOD, 0, 0.26, -1.2)

  // ---- Oars: each one pivots on the edge of the hull; the shaft points outwards (local +X) ----
  const oars = [-1, 1].map((side) => {
    const lock = new THREE.Group() // turned so local +X points away from the boat
    lock.position.set(side * (HALF_BEAM - 0.04), HULL_BOTTOM + HULL_HEIGHT + 0.08, -0.25)
    lock.rotation.y = side < 0 ? Math.PI : 0
    hull.add(lock)
    add(lock, new THREE.BoxGeometry(0.1, 0.12, 0.1), WOOD_DARK, 0, -0.04, 0) // oarlock
    const oar = new THREE.Group()
    lock.add(oar)
    add(oar, new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6).rotateZ(Math.PI / 2), WOOD, 0.65, 0, 0) // handle inside, shaft outside
    add(oar, new THREE.BoxGeometry(0.7, 0.07, 0.34), BLADE, 2.0, 0, 0)
    return oar
  })

  let afloat = 0 // 0 on land, 1 sitting in the boat
  let stroke = 0 // phase of the rowing stroke (rad)
  let time = 0

  /**
   * Places the boat under the detective and, while he is on the water, sits him down and makes
   * him row. Call it after detective.update(): it overrides his running pose.
   * @returns 0..1, how much he is in the boat (above 0.5: he is rowing, not walking)
   */
  const update = (s: CarState, onWater: boolean, rower: Rower, dt: number) => {
    afloat += ((onWater ? 1 : 0) - afloat) * (1 - Math.exp(-9 * dt))
    if (afloat < 0.005 && !onWater) afloat = 0
    root.visible = afloat > 0
    if (!root.visible) return 0
    time += dt

    const speed = Math.abs(s.speed)
    const row = Math.min(1, speed / 10) // 0 drifting, 1 rowing
    stroke += dt * row * (2.6 + speed * 0.03) * Math.sign(s.speed || 1)
    const pull = Math.cos(stroke) // +1 blades forward, -1 blades back
    const lift = Math.max(0, -Math.sin(stroke)) // blades out of the water on the way forward
    const bob = Math.sin(time * 1.9) * 0.035 + Math.sin(stroke) * 0.03 * row

    root.position.set(s.x, s.y, s.z)
    root.rotation.y = s.heading
    const grow = afloat * afloat * (3 - 2 * afloat)
    hull.scale.setScalar(DETECTIVE_SCALE * BOAT_SCALE * grow)
    hull.position.y = bob * DETECTIVE_SCALE
    hull.rotation.z = Math.sin(time * 1.3) * 0.03 + Math.max(-0.2, Math.min(0.2, -s.yawRate * 0.12))
    hull.rotation.x = Math.sin(time * 1.1 + 1) * 0.015 - Math.sin(stroke) * 0.03 * row

    for (const [i, oar] of oars.entries()) {
      const side = i ? 1 : -1
      oar.rotation.y = side * OAR_SWEEP * pull * row
      oar.rotation.z = -OAR_DIP + OAR_LIFT * lift * row
    }

    // ---- The detective: sitting, legs forward, pulling the oars (unless he holds the magnifier) ----
    const { body, arms, legs } = rower.parts
    const mix = (a: number, b: number, t: number) => a + (b - a) * t
    const hands = afloat * (1 - rower.inspect)
    body.position.y = mix(body.position.y, -SIT_DROP + bob, afloat)
    body.rotation.x = mix(body.rotation.x, 0.14 * pull * row, hands)
    body.rotation.z = mix(body.rotation.z, hull.rotation.z, afloat)
    for (const leg of legs) leg.rotation.x = mix(leg.rotation.x, SIT_LEGS, afloat)
    for (const [i, arm] of arms.entries()) {
      arm.rotation.x = mix(arm.rotation.x, 1.0 - 0.4 * pull * row, hands) // hands follow the oar handles
      arm.rotation.z = mix(arm.rotation.z, (i ? 1 : -1) * 0.28, hands)
    }
    return afloat
  }

  return {
    root,
    update,
    dispose: () => {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
    },
  }
}
