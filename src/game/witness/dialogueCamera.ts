// Dialogue with a witness, on the game side:
// - the detective walks up to the witness (autopilot) and both turn to face each other, a little
//   open towards the camera, like actors on a stage. He stands on the side of the witness from
//   which the camera has a free view of both (no monument or roof in the way);
// - the camera flies (eased, ~1 s) from the chase view to a side 3/4 framing of both, detective on
//   the left and witness on the right, high on the screen (the lower third is for the dialogue box);
// - once framed, the screen points just above both heads are given to the UI for speech bubbles.
// When the dialogue ends, the camera flies back onto the live chase view and control comes back.
//
//   const dialogue = createDialogue(camera, world)
//   dialogue.step(wanted, dt)                         // every frame, first
//   input = dialogue.drive(car, scene, dt)             // while dialogue.busy, instead of the keyboard
//   ... chase.update(...)
//   dialogue.applyCamera(scene)                        // after the chase camera, while dialogue.busy
//   dialogue.anchors(scene, canvas)                    // after camera.updateProjectionMatrix()
import * as THREE from 'three'
import type { CarState } from '../car/carPhysics'
import type { DriveInput } from '../input/keyboard'
import type { DialogueAnchors } from '../../shared/events'

/** Flight in and out (s). */
const IN_TIME = 1.0
const OUT_TIME = 0.8
/** Where the detective stops, from the witness (world units; both are ~10 tall). */
const STAND_DISTANCE = 11
/** The detective gives up walking after this long (blocked by something), and talks from there. */
const WALK_TIMEOUT = 5
/** Each character turns this much from facing the other towards the camera (rad). */
const CHEAT = 0.6
/** Vertical field of view of the dialogue camera (deg). */
const FOV = 44
/** Share of the screen height the characters fill, and the NDC height of their middle (0 = centre). */
const FILL_V = 0.38
const CENTER_NDC = 0.2
/** Share of the screen width the pair (plus margins) may fill. */
const FILL_H = 0.75
/** Room beside each character (world units), so the bubbles fit. */
const SIDE_MARGIN = 9
/** Camera pose candidates: yaw (positive: round towards the witness's front) and elevation (rad). First free one wins. */
const CANDIDATES: [number, number][] = [
  [0.1, 0.22], [-0.1, 0.22], [0.25, 0.25], [-0.25, 0.25], [0.1, 0.45], [-0.2, 0.45], [0.4, 0.5], [0, 0.75],
]
/** The first LOW_VIEWS candidates are the good, low 3/4 views (the rest look down from higher up). */
const LOW_VIEWS = 4
/** Directions tried around the witness for where the detective stands (steps of 30 deg from his own side). */
const STAND_TRIES = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6]
/** Largest height difference between the detective's stand spot and the witness (world units). */
const STAND_MAX_STEP = 3
/**
 * The ground between the witness and the stand spot (and a little beyond it, and round it, for the
 * detective's body) is sampled every PATH_STEP units: no sample may differ from the witness's feet
 * by more than STAND_MAX_STEP. This keeps a fence, a wall, an arcade or a tree (all in the monument
 * height maps) from standing between the two, and the detective off a roof edge (Madrid: the
 * Puerta de Alcala garden fence; Cordoba: the Mezquita arcade round the Patio de los Naranjos).
 */
const PATH_STEP = 0.75
const BODY_RADIUS = 2.5
/** Distances beside each character (outwards along the pair) that must be visible too (world units). */
const SIDE_CHECK = [5, 11]
/** Share of each side ray (from the camera) that must be clear. */
const SIDE_NEAR = 0.75
/**
 * Once arrived, the camera keeps framing the planned pair (detective on his stand spot) while he
 * stands within this distance of it (world units): the view checked when choosing the spot stays the
 * one shown (a metre of braking drift moved the camera enough to put a tree in the shot).
 */
const PLANNED_HOLD = 3
/** Fine check of the camera line near the pair (strict poses): step and reach (world units). */
const FINE_STEP = 0.6
const FINE_REACH = 30
/** Anchors are sent again only when one moves more than this (CSS px). */
const ANCHOR_EPSILON = 1

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const headingTo = (fx: number, fz: number, tx: number, tz: number) => Math.atan2(-(tx - fx), -(tz - fz))

export interface DialogueScene {
  /** Feet of the detective and of the witness (world) */
  detective: THREE.Vector3
  witness: THREE.Vector3
  /** Points just above their heads (world) */
  detectiveTop: THREE.Vector3
  witnessTop: THREE.Vector3
  /**
   * Optional: direction (atan2(dx, dz), from the witness) where the detective tries to stand first,
   * instead of his own side. Used to stand across from a witness's prop, so the camera shows it
   * beside the witness (Jordi's signpost, Carmen's telescope) instead of hidden behind him.
   */
  standFrom?: number | null
}

/** What the dialogue needs to know about the map. */
export interface DialogueWorld {
  /** Highest thing at (x, z): ground, roofs, monuments (the camera must stay above it) */
  obstacleAt: (x: number, z: number) => number
  /** Ground the detective stands on */
  surfaceAt: (x: number, z: number) => number
  /** Can the detective stand at (x, z)? (land, no house or windmill) */
  canStand: (x: number, z: number) => boolean
  /**
   * Meshes the camera must see past (monuments: their curved shells and overhangs are not in
   * obstacleAt). Ray-cast only when a camera pose is chosen, not every frame.
   */
  occluders: THREE.Object3D[]
}

export function createDialogue(camera: THREE.PerspectiveCamera, world: DialogueWorld) {
  const reducedMotion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  let wanted = false
  let progress = 0
  let eased = 0
  let walkTime = 0
  let arrived = false
  let liveChecked = false
  let spot: { x: number; z: number } | null = null
  let candidate = 0
  // Facing headings for this dialogue (from the camera side chosen)
  let detectiveHeading = 0
  let witnessHeading = 0
  const chasePos = new THREE.Vector3()
  const chaseQuat = new THREE.Quaternion()
  const pos = new THREE.Vector3()
  const look = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const lookMatrix = new THREE.Matrix4()
  const axis = new THREE.Vector3()
  const f = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const center = new THREE.Vector3()
  const projected = new THREE.Vector3()
  let lastAnchors: DialogueAnchors | null = null
  // A hypothetical pair, to test stand spots before the detective walks there
  const trial: DialogueScene = { detective: new THREE.Vector3(), witness: new THREE.Vector3(), detectiveTop: new THREE.Vector3(), witnessTop: new THREE.Vector3() }
  // The pair as it will stand once the detective reaches his spot (framed during the walk)
  const planned: DialogueScene = { detective: new THREE.Vector3(), witness: new THREE.Vector3(), detectiveTop: new THREE.Vector3(), witnessTop: new THREE.Vector3() }
  const raycaster = new THREE.Raycaster()
  const rayDir = new THREE.Vector3()
  const rayTarget = new THREE.Vector3()
  const hits: THREE.Intersection[] = []
  /** True if a monument mesh cuts the segment a-b (tested both ways: rays only hit front faces). */
  const meshBetween = (a: THREE.Vector3, b: THREE.Vector3) => {
    const len = a.distanceTo(b)
    for (const [from, to] of [[a, b], [b, a]]) {
      raycaster.set(from, rayDir.subVectors(to, from).normalize())
      raycaster.far = len
      hits.length = 0
      if (raycaster.intersectObjects(world.occluders, true, hits).length) return true
    }
    return false
  }
  /** Can the detective stand at (x, z) to talk to a witness whose feet are at w? (see PATH_STEP) */
  const standOk = (x: number, z: number, w: THREE.Vector3) => {
    const y = world.surfaceAt(x, z)
    if (!world.canStand(x, z) || Math.abs(y - w.y) > STAND_MAX_STEP) return false
    const dx = x - w.x, dz = z - w.z
    const len = Math.hypot(dx, dz) || 1
    for (let t = PATH_STEP; t <= len + BODY_RADIUS; t += PATH_STEP) {
      if (Math.abs(world.surfaceAt(w.x + (dx / len) * t, w.z + (dz / len) * t) - w.y) > STAND_MAX_STEP) return false
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      const px = x + Math.sin(a) * BODY_RADIUS, pz = z + Math.cos(a) * BODY_RADIUS
      if (!world.canStand(px, pz) || Math.abs(world.surfaceAt(px, pz) - w.y) > STAND_MAX_STEP) return false
    }
    return true
  }
  const feet = new THREE.Vector3()
  /** Ray checks from the camera to the heads, the middle and the feet of both characters. */
  const viewBlocked = (s: DialogueScene, eye: THREE.Vector3) => {
    if ([s.detectiveTop, s.witnessTop, center].some((p) => meshBetween(eye, p)) ||
      [s.detective, s.witness].some((p) => meshBetween(eye, rayTarget.copy(p).setY(p.y + 2)))) return true
    // The room beside each one (where the speech bubbles go) must be free too: a tree or a pillar
    // there would fill a third of the frame (Cordoba: the orange trees of the Patio de los Naranjos)
    const ax = s.witness.x - s.detective.x, az = s.witness.z - s.detective.z
    const len = Math.hypot(ax, az) || 1
    // Only the near part of each ray counts: a fence or a wall just behind the pair is background
    const mid = (s.detectiveTop.y - s.detective.y) * 0.6
    const near = (p: THREE.Vector3) => meshBetween(eye, p.lerpVectors(eye, p, SIDE_NEAR))
    return SIDE_CHECK.some((d) => {
      const k = d / len
      return near(rayTarget.set(s.detective.x - ax * k, s.detective.y + mid, s.detective.z - az * k)) ||
        near(rayTarget.set(s.witness.x + ax * k, s.witness.y + mid, s.witness.z + az * k))
    })
  }

  /**
   * Camera pose for one candidate; false if a roof, a monument or the ground is in the way.
   * strict: also ray-cast against the monument meshes (when choosing a pose).
   */
  const pose = (s: DialogueScene, k: number, out: THREE.Vector3, strict = false) => {
    const [yaw, elev] = CANDIDATES[k]
    const ax = s.witness.x - s.detective.x, az = s.witness.z - s.detective.z
    const sep = Math.hypot(ax, az) || 1
    const ux = ax / sep, uz = az / sep
    // Horizontal view direction: perpendicular to the pair (so the detective is on the left), then
    // turned round towards the witness's front by `yaw` (3/4 view)
    f.set(uz * Math.cos(yaw) + ux * Math.sin(yaw), 0, -ux * Math.cos(yaw) + uz * Math.sin(yaw)).normalize()
    const feet = Math.min(s.detective.y, s.witness.y)
    const top = Math.max(s.detectiveTop.y, s.witnessTop.y)
    const h = top - feet
    center.set((s.detective.x + s.witness.x) / 2, feet + h / 2, (s.detective.z + s.witness.z) / 2)
    const halfTan = Math.tan(THREE.MathUtils.degToRad(FOV) / 2)
    const dV = h / (2 * FILL_V * halfTan)
    const dH = (sep * Math.cos(yaw) + 2 * SIDE_MARGIN) / (2 * FILL_H * halfTan * camera.aspect)
    const d = Math.max(dV, dH)
    dir.set(f.x * Math.cos(elev), -Math.sin(elev), f.z * Math.cos(elev))
    out.copy(center).addScaledVector(dir, -d)
    if (out.y < world.obstacleAt(out.x, out.z) + 2) return false
    for (let t = 0.1; t < 0.85; t += 0.075) {
      const x = out.x + (center.x - out.x) * t, z = out.z + (center.z - out.z) * t
      if (out.y + (center.y - out.y) * t < world.obstacleAt(x, z) + 0.5) return false
    }
    // When choosing a pose, also sample finely near the pair: a thin fence or railing between the
    // camera and their legs (Puerta de Alcala garden) falls between the coarse samples above
    if (strict) {
      const step = FINE_STEP / d
      for (let t = 1 - FINE_REACH / d; t < 0.97; t += step) {
        if (t < 0.1) continue
        const x = out.x + (center.x - out.x) * t, z = out.z + (center.z - out.z) * t
        if (out.y + (center.y - out.y) * t < world.obstacleAt(x, z)) return false
      }
    }
    return !strict || !viewBlocked(s, out)
  }

  return {
    /** Ask for the dialogue camera (true) or for the chase camera back (false). Call first, every frame. */
    step(on: boolean, dt: number) {
      if (on && !wanted) {
        walkTime = 0
        arrived = false
        liveChecked = false
        spot = null
        candidate = 0
      }
      wanted = on
      if (reducedMotion?.matches) progress = on ? 1 : 0
      else if (on) progress = Math.min(1, progress + dt / IN_TIME)
      else progress = Math.max(0, progress - dt / OUT_TIME)
      eased = easeInOutCubic(progress)
    },
    /** 0..1: eased blend from the chase camera (0) to the dialogue framing (1). */
    get progress() {
      return eased
    },
    /** True from the request until the camera is back on the chase view: the keyboard is ignored. */
    get busy() {
      return wanted || progress > 0
    },
    get wanted() {
      return wanted
    },
    /** True once the camera has arrived and the detective stands in place (anchors are sent). */
    get framed() {
      return wanted && progress >= 1 && arrived
    },
    /** Heading the witness keeps during the dialogue. */
    get witnessHeading() {
      return witnessHeading
    },

    /**
     * How well a talk with a witness standing at (x, y, z) could be framed: the number of stand
     * spots round him (up to `enough`) from which one of the low 3/4 camera views sees both clearly.
     * Used once at load time to place the witnesses (monument meshes must have their world matrices).
     * tall: height of a character's head top above his feet (world units).
     */
    framingScore(x: number, y: number, z: number, tall: number, enough = 3) {
      let n = 0
      for (const k of STAND_TRIES) {
        const a = (k * Math.PI) / 6
        const sx = x + Math.sin(a) * STAND_DISTANCE, sz = z + Math.cos(a) * STAND_DISTANCE
        const sy = world.surfaceAt(sx, sz)
        if (!standOk(sx, sz, feet.set(x, y, z))) continue
        trial.detective.set(sx, sy, sz)
        trial.detectiveTop.set(sx, sy + tall, sz)
        trial.witness.set(x, y, z)
        trial.witnessTop.set(x, y + tall, z)
        for (let c = 0; c < LOW_VIEWS; c++) {
          if (!pose(trial, c, pos, true)) continue
          n++
          break
        }
        if (n >= enough) break
      }
      return n
    },

    /**
     * Drive input for the detective while busy: walk up to the witness, then stand still.
     * Also turns him (sets car.heading directly, like turning on the spot).
     * s: the pair as last posed (witness feet and both head tops are used for the stand spot).
     */
    drive(car: CarState, s: DialogueScene, dt: number): DriveInput {
      const idle = { throttle: 0, steer: 0, turbo: false }
      if (!wanted) return idle
      const w = s.witness
      if (!spot) {
        // Stand spot: STAND_DISTANCE from the witness, first on the detective's side, then round
        // the witness, until one is standable and the camera sees both from there. First pass: only
        // the low 3/4 views, on a spot he can walk to in a straight line (no prop or house in the
        // way); second pass: low views, any spot; third pass: any view (higher, looking down)
        const base = s.standFrom ?? Math.atan2(car.x - w.x, car.z - w.z)
        const tall = Math.max(4, s.detectiveTop.y - car.y)
        const reachable = (x: number, z: number) => {
          const len = Math.hypot(x - car.x, z - car.z) || 1
          for (let t = 2; t < len; t += 1.5) {
            if (!world.canStand(car.x + ((x - car.x) / len) * t, car.z + ((z - car.z) / len) * t)) return false
          }
          return true
        }
        for (const [views, direct] of [[LOW_VIEWS, true], [LOW_VIEWS, false], [CANDIDATES.length, false]] as const) {
          for (const k of STAND_TRIES) {
            const a = base + (k * Math.PI) / 6
            const x = w.x + Math.sin(a) * STAND_DISTANCE, z = w.z + Math.cos(a) * STAND_DISTANCE
            const y = world.surfaceAt(x, z)
            if (!standOk(x, z, w) || (direct && !reachable(x, z))) continue
            trial.detective.set(x, y, z)
            trial.detectiveTop.set(x, y + tall, z)
            trial.witness.copy(w)
            trial.witnessTop.copy(s.witnessTop)
            const free = CANDIDATES.findIndex((_, c) => c < views && pose(trial, c, pos, true))
            if (free < 0) continue
            spot = { x, z }
            candidate = free
            break
          }
          if (spot) break
        }
        // No view is free: still stand on the witness's own ground if possible (not on a roof edge
        // or behind a fence), else on the detective's side
        if (!spot) {
          const k = STAND_TRIES.find((k) => {
            const a = base + (k * Math.PI) / 6
            return standOk(w.x + Math.sin(a) * STAND_DISTANCE, w.z + Math.cos(a) * STAND_DISTANCE, w)
          }) ?? 0
          const a = base + (k * Math.PI) / 6
          spot = { x: w.x + Math.sin(a) * STAND_DISTANCE, z: w.z + Math.cos(a) * STAND_DISTANCE }
          // Its view: none is fully free, so take the highest one (it looks over most things)
          candidate = CANDIDATES.length - 1
        }
        detectiveHeading = headingTo(spot.x, spot.z, w.x, w.z)
      }
      walkTime += dt
      const toSpot = Math.hypot(spot.x - car.x, spot.z - car.z)
      if (!arrived && (toSpot < 1.5 || walkTime > WALK_TIMEOUT)) arrived = true
      if (!arrived) {
        const want = headingTo(car.x, car.z, spot.x, spot.z)
        car.heading += wrap(want - car.heading) * (1 - Math.exp(-10 * dt))
        // Lets go of the throttle in time to coast to a stop on the spot
        return { throttle: toSpot > 2 + Math.max(0, car.speed) / 3 ? 1 : 0, steer: 0, turbo: false }
      }
      car.heading += wrap(detectiveHeading - car.heading) * (1 - Math.exp(-6 * dt))
      car.yawRate = 0
      // Brakes the last of the walk so he stands still (no drifting under the bubbles)
      return { throttle: car.speed > 0.3 ? -1 : 0, steer: 0, turbo: false }
    },

    /**
     * Blends the camera from the chase pose (already set this frame) to the dialogue framing.
     * Also works out where each character faces (used by drive() and witnessHeading).
     */
    applyCamera(scene: DialogueScene) {
      // While the detective still walks up, frame the pair as it will stand (detective on his stand
      // spot): the view chosen for the stand spot stays valid, and he walks into the shot. (Framing
      // the live pair let a building on his way push the camera to a high fallback view for good.)
      let s = scene
      if (spot && (!arrived || Math.hypot(scene.detective.x - spot.x, scene.detective.z - spot.z) < PLANNED_HOLD)) {
        const y = world.surfaceAt(spot.x, spot.z)
        planned.detective.set(spot.x, y, spot.z)
        planned.detectiveTop.set(spot.x, y + (scene.detectiveTop.y - scene.detective.y), spot.z)
        planned.witness.copy(scene.witness)
        planned.witnessTop.copy(scene.witnessTop)
        s = planned
      }
      // Framing the live pair (he stopped away from his spot): check the view against the monuments
      // and props once, when he stops
      const recheck = arrived && s === scene && !liveChecked
      if (recheck) liveChecked = true
      // Keep the current candidate while it is free; otherwise take the first free one
      if (!pose(s, candidate, pos, recheck)) {
        candidate = 0
        while (candidate < CANDIDATES.length - 1 && !pose(s, candidate, pos, true)) candidate++
        pose(s, candidate, pos)
      }
      // Facing: towards the other one, opened towards the camera side (-f)
      const toW = headingTo(s.detective.x, s.detective.z, s.witness.x, s.witness.z)
      const toD = headingTo(s.witness.x, s.witness.z, s.detective.x, s.detective.z)
      const camSide = headingTo(0, 0, -f.x, -f.z)
      detectiveHeading = toW + Math.sign(wrap(camSide - toW)) * CHEAT
      witnessHeading = toD + Math.sign(wrap(camSide - toD)) * CHEAT
      if (eased <= 0) return
      // Look direction: at the pair's middle, tilted down so they sit at CENTER_NDC (upper part)
      look.copy(center).sub(pos).normalize()
      axis.crossVectors(look, THREE.Object3D.DEFAULT_UP).normalize()
      look.applyAxisAngle(axis, -Math.atan(CENTER_NDC * Math.tan(THREE.MathUtils.degToRad(FOV) / 2)))
      // Camera convention (looks down its -Z), unlike Object3D.lookAt on a plain object
      lookMatrix.lookAt(pos, look.add(pos), THREE.Object3D.DEFAULT_UP)
      quat.setFromRotationMatrix(lookMatrix)
      if (eased >= 1) {
        camera.position.copy(pos)
        camera.quaternion.copy(quat)
      } else {
        chasePos.copy(camera.position)
        chaseQuat.copy(camera.quaternion)
        camera.position.lerpVectors(chasePos, pos, eased)
        camera.quaternion.slerpQuaternions(chaseQuat, quat, eased)
        // The straight path may graze a roof or a hill mid-flight: lift it there only
        const p = camera.position
        const lift = world.obstacleAt(p.x, p.z) + 1 - p.y
        if (lift > 0) p.y += lift
      }
      camera.fov += (FOV - camera.fov) * eased
    },

    /**
     * Screen points (CSS px, viewport) above the heads once framed, else null. Returns undefined
     * when nothing changed (by more than ANCHOR_EPSILON), so the caller only sends real changes.
     */
    anchors(s: DialogueScene | null, canvas: HTMLCanvasElement): DialogueAnchors | null | undefined {
      let next: DialogueAnchors | null = null
      if (s && wanted && progress >= 1 && arrived) {
        camera.updateMatrixWorld()
        const rect = canvas.getBoundingClientRect()
        const toCss = (p: THREE.Vector3) => {
          projected.copy(p).project(camera)
          return { x: rect.left + ((projected.x + 1) / 2) * rect.width, y: rect.top + ((1 - projected.y) / 2) * rect.height }
        }
        next = { detective: toCss(s.detectiveTop), witness: toCss(s.witnessTop) }
      }
      const prev = lastAnchors
      const same =
        prev === next ||
        (prev && next &&
          Math.abs(prev.detective.x - next.detective.x) <= ANCHOR_EPSILON && Math.abs(prev.detective.y - next.detective.y) <= ANCHOR_EPSILON &&
          Math.abs(prev.witness.x - next.witness.x) <= ANCHOR_EPSILON && Math.abs(prev.witness.y - next.witness.y) <= ANCHOR_EPSILON)
      if (same) return undefined
      lastAnchors = next
      return next
    },
  }
}

