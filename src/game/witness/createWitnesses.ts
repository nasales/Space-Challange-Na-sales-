// The witnesses of the featured cases (src/shared/witness.ts) standing on the map, inside the
// trigger zone of their case marker. The spot is searched once at load time: explored land,
// flat (no wall or step around him), on the ground or a monument plaza but never on a roof, away
// from houses, windmills and rivers, with free flat ground in front of him, towards the zone
// centre or to one side, where the detective stands to talk. Spots inside the ring (near its rim),
// near a road, on bare ground win, and he needs open sky round him for the dialogue camera. (The
// zone centre itself may be a monument roof, as in Valencia.)
//
// So the player finds him: a "..." speech bubble floats over his head (seen from far, drawn over
// buildings), a glowing trail of chevrons runs from near the "!" to his feet, he turns to watch the
// detective from far away, waves when he comes close and again now and then, and glows warmly
// while the detective is in the case zone. All of it hides during the dialogue.
//
// Some witnesses have a small trade prop (witnessProps.ts: Pilar's newspaper kiosk, Rafael's olive
// crates, Jordi's trail signpost and rucksack, Carmen's telescope) at their side, on flat free ground; the detective walks round it and the dialogue camera
// ray-casts it like a monument.
//
// Where they stand (checked with Playwright screenshots, 2026-11-15): Vicent (Valencia) on the
// lawn of the Ciudad de las Artes; Pilar (Madrid) on the plaza on the north side of the Puerta de
// Alcala garden fence, her kiosk on her right; Rafael (Cordoba) in the Patio de los Naranjos of the
// Mezquita (open courtyard ground, never its roofs: the zone centre is on the prayer hall roof),
// his crates on his right. Jordi (Aneto) on a snowy plateau in the pine forest, Carmen (Donana) on
// dry grass in an olive grove by the coast: the game clears the trees round each witness
// (scenery.clear) and their props are on the side away from the plateau edge / free ground, so the
// detective stands across from them and the camera shows the prop. All inside their ring
// (0.85-0.93 of the radius).
//
//   const witnesses = createWitnesses(WITNESSES, caseMarkers, site)
//   scene.add(witnesses.group)
//   witnesses.update(dt, detectiveX, detectiveZ, dialogue, { camera, distance })   // every frame
//   witnesses.get(caseId)                                     // { witness, x, z, y } or undefined
//   witnesses.props / witnesses.blocks(x, z, margin)          // trade props (witnessProps.ts): camera occluders, not walkable
import * as THREE from 'three'
import { createWitness } from './createWitness'
import { createTalkIndicator } from './createTalkIndicator'
import { createWitnessTrail } from './createWitnessTrail'
import { createWitnessProp, PROP_SIZE, WITNESS_EXTRAS } from './witnessProps'
import type { Witness } from '../../shared/witness'
import type { LineMood } from '../../shared/tutorial'

/** Distance from the zone centre, as fractions of the zone radius, tried in this order. */
const RING_FRACTIONS = [0.3, 0.45, 0.6, 0.75, 0.85, 0.93, 1.1, 1.4]
/** Best distance from the zone centre (fraction of the radius): inside the ring, near its rim. */
const BEST_FRACTION = 0.85
/** Extra score (worse) for a spot outside the ring. */
const OUTSIDE_PENALTY = 12
/** Directions tried for the free ground in front of him: towards the zone centre, then to the sides (rad). */
const FRONT_TURNS = [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5]
/** Angles tried on each ring. */
const ANGLE_STEPS = 24
/** Clearance around the witness (world units): houses, walls, rivers. */
const CLEARANCE = 6
/** Largest height difference across the spot (world units): the ground must be flat. */
const MAX_SLOPE = 1.5
/** He may stand on a monument plaza up to this high above the terrain, never on a roof (like the zone ring). */
const MAX_CLIMB = 6
/** Largest step between the witness and the ground in front of him (world units). */
const MAX_STEP = 2.5
/** How far in front of him (towards the zone centre) the ground must be free: where the detective stands. */
const FRONT = 12
/**
 * Open view for the dialogue camera: of OPEN_DIRECTIONS directions round him, at least MIN_OPEN
 * must have nothing taller than OPEN_HEIGHT above his feet within OPEN_RADIUS (world units).
 */
const OPEN_DIRECTIONS = 16
const MIN_OPEN = 6
const OPEN_RADIUS = 45
const OPEN_HEIGHT = 8
/** Stand spots with a good dialogue view that count as fully good (see WitnessSite.framing). */
const GOOD_FRAMING = 3
/** The witness waves when the detective comes this close (world units), for WAVE_TIME seconds. */
const WAVE_DISTANCE = 140
const WAVE_TIME = 2.6
/** While the detective is near (and not talking to him), he waves again every this many seconds. */
const WAVE_AGAIN = 6
/** He turns to watch the detective within this distance (world units). */
const WATCH_DISTANCE = 240
/** The trail to him shows while the detective is within this many zone radii of the zone centre. */
const TRAIL_RANGE = 3.5
/** Where the trail starts: this fraction of the way from the zone centre to him. */
const TRAIL_START = 0.25
/** The talk bubble hides when the camera is this far (world units): only the big "!" shows then. */
const BUBBLE_MAX_CAMERA = 2500
/** The pointer at the detective's feet hides when he is this close to the witness (world units). */
const POINTER_HIDE = 20
/** Same climb limit as the zone ring: the trail lies on plazas, never on roofs. */
const TRAIL_MAX_CLIMB = 6
/** A prop's footprint may differ from the witness's ground by at most this much (world units). */
const PROP_MAX_STEP = 1
/** Turns tried round the witness for his prop, from its preferred place (rad). */
const PROP_TURNS = [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]
/** A prop shown in the dialogue needs flat free ground this far on the witness's other side (world units). */
const FRAME_STAND = 14

/** What the placement needs to know about the map (all in world units). */
export interface WitnessSite {
  /** Ground the detective walks on (terrain, roofs, monuments, roads) */
  surfaceAt: (x: number, z: number) => number
  /** Bare terrain height */
  heightAt: (x: number, z: number) => number
  isLand: (x: number, z: number) => boolean
  /** Houses, windmills... (extra: margin added to their radius) */
  blocked: (x: number, z: number, extra: number) => boolean
  nearRiver: (x: number, z: number, margin: number) => boolean
  nearRoad: (x: number, z: number, margin: number) => boolean
  /**
   * Optional: how well the dialogue camera can frame a talk with him standing at (x, y, z), as the
   * number of good stand spots round him (0 = none: the spot is skipped). See dialogue.framingScore.
   */
  framing?: (x: number, y: number, z: number) => number
}

interface CaseZones {
  positionOf: (caseId: string) => { x: number; z: number; radius: number } | null
}

/** Dialogue state the witnesses react to. */
export interface WitnessDialogue {
  caseId: string | null
  speaking: 'detective' | 'witness' | null
  /** Heading the case's witness keeps in the dialogue (facing the detective, open to the camera) */
  witnessHeading: number
  /** Mood of the line being spoken (pose and face of the speaker; the listener reacts) */
  mood?: LineMood | null
}

/** Camera the talk bubble faces, and its distance to the player (bubble size grows with it). */
export interface WitnessView {
  camera: THREE.Camera
  distance: number
}

type PlacedWitness = {
  witness: ReturnType<typeof createWitness>
  bubble: ReturnType<typeof createTalkIndicator>
  trail: ReturnType<typeof createWitnessTrail>
  caseId: string
  zone: { x: number; z: number; radius: number }
  x: number; z: number; y: number; rest: number
  waveClock: number; againClock: number; wasNear: boolean; glow: number
  /** His trade prop, if any: centre and radius of its footprint (world units) */
  prop: { x: number; z: number; radius: number; kind: string; frame: boolean; dispose: () => void } | null
}

/** Finds a free, flat spot for a witness in the zone (best score); null if there is none. */
export function findWitnessSpot(zone: { x: number; z: number; radius: number }, site: WitnessSite) {
  // Flat ground (no wall or step around him), at most a plaza above the terrain (not a roof)
  const flat = (x: number, z: number) => {
    const h = site.surfaceAt(x, z)
    if (h - site.heightAt(x, z) > MAX_CLIMB) return false
    for (const r of [3, CLEARANCE]) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        if (Math.abs(site.surfaceAt(x + Math.sin(a) * r, z + Math.cos(a) * r) - h) > MAX_SLOPE) return false
      }
    }
    return true
  }
  const free = (x: number, z: number, margin: number) =>
    site.isLand(x, z) && !site.blocked(x, z, margin) && !site.nearRiver(x, z, margin)
  // In front of him (towards the zone centre, or else to one side) the detective needs room to
  // stand: no water, house or wall
  const clearFront = (x: number, z: number) => {
    const toCentre = Math.atan2(zone.x - x, zone.z - z)
    return FRONT_TURNS.some((turn) => {
      const ux = Math.sin(toCentre + turn), uz = Math.cos(toCentre + turn)
      let last = site.surfaceAt(x, z)
      for (let s = 2; s <= FRONT; s += 2) {
        const px = x + ux * s, pz = z + uz * s
        const h = site.surfaceAt(px, pz)
        if (!free(px, pz, 1) || Math.abs(h - last) > MAX_STEP) return false
        last = h
      }
      return true
    })
  }
  // Open sky around him: the dialogue camera stands OPEN_RADIUS away, so count the directions with
  // nothing tall (monument, roof, hill) up to there
  const openness = (x: number, z: number) => {
    const h = site.surfaceAt(x, z)
    let open = 0
    for (let k = 0; k < OPEN_DIRECTIONS; k++) {
      const a = (k / OPEN_DIRECTIONS) * Math.PI * 2
      let ok = true
      for (let r = 10; r <= OPEN_RADIUS && ok; r += 7) ok = site.surfaceAt(x + Math.sin(a) * r, z + Math.cos(a) * r) < h + OPEN_HEIGHT
      if (ok) open++
    }
    return open
  }
  let best: { x: number; z: number } | null = null
  let bestScore = Infinity
  for (const f of RING_FRACTIONS) {
    for (let i = 0; i < ANGLE_STEPS; i++) {
      const a = (i / ANGLE_STEPS) * Math.PI * 2
      const x = zone.x + Math.sin(a) * zone.radius * f, z = zone.z + Math.cos(a) * zone.radius * f
      if (!free(x, z, CLEARANCE) || !flat(x, z) || !clearFront(x, z)) continue
      const open = openness(x, z)
      if (open < MIN_OPEN) continue
      // Prefer: inside the ring near its rim, open all round, near a road, on bare ground rather than a plaza
      const base = (OPEN_DIRECTIONS - open) * 1.5 + (site.nearRoad(x, z, 25) ? 0 : 6) + (site.surfaceAt(x, z) - site.heightAt(x, z)) +
        Math.abs(f - BEST_FRACTION) * 8 + (f > 1 ? OUTSIDE_PENALTY : 0)
      // The framing term only adds to the score, so the costly test (ray casts) is skipped for
      // spots that cannot win anyway
      if (base >= bestScore) continue
      // The dialogue camera must see both characters from a low 3/4 view (monument shells, arches)
      const framing = site.framing ? site.framing(x, site.surfaceAt(x, z), z) : GOOD_FRAMING
      if (framing === 0) continue
      const score = base + (GOOD_FRAMING - Math.min(GOOD_FRAMING, framing)) * 4
      if (score < bestScore) {
        bestScore = score
        best = { x, z }
      }
    }
  }
  return best
}

export function createWitnesses(list: Partial<Record<string, Witness>>, zones: CaseZones, site: WitnessSite) {
  const group = new THREE.Group()
  group.name = 'witnesses'
  const placed: PlacedWitness[] = []
  const props = new THREE.Group()
  props.name = 'witness-props'
  group.add(props)
  for (const w of Object.values(list)) {
    if (!w) continue
    const zone = zones.positionOf(w.caseId)
    if (!zone) continue
    const spot = findWitnessSpot(zone, site)
    if (!spot) {
      console.warn(`No free spot for the witness of ${w.caseId}`)
      continue
    }
    const extras = WITNESS_EXTRAS[w.caseId]
    const witness = createWitness(w.look, extras?.style)
    const y = site.surfaceAt(spot.x, spot.z)
    witness.root.position.set(spot.x, y, spot.z)
    witness.root.userData.caseId = w.caseId
    // At rest he faces the zone centre (where the detective comes from)
    const rest = Math.atan2(-(zone.x - spot.x), -(zone.z - spot.z))
    // His trade prop (kiosk, crates) on free flat ground behind him or at his side; none if no room
    let prop: PlacedWitness['prop'] = null
    if (extras?.prop) {
      const { kind, place } = extras.prop
      const size = PROP_SIZE[kind]
      // A prop shown in the dialogue (frame): the detective stands across from it, so that side
      // must be flat free ground too (Aneto: on the plateau, not over its edge); his right, else his left
      const across = (at: { x: number; z: number }) => {
        const dx = spot.x - at.x, dz = spot.z - at.z
        const len = Math.hypot(dx, dz) || 1
        for (let t = 2; t <= FRAME_STAND; t += 1) {
          const px = spot.x + (dx / len) * t, pz = spot.z + (dz / len) * t
          if (!site.isLand(px, pz) || site.blocked(px, pz, 2) || site.nearRiver(px, pz, 2) || Math.abs(site.surfaceAt(px, pz) - y) > MAX_STEP) return false
        }
        return true
      }
      const sides = place === 'behind' ? [Math.PI] : extras.prop.frame ? [-Math.PI / 2, Math.PI / 2] : [-Math.PI / 2]
      let at: ReturnType<typeof placeProp> = null
      for (const side of sides) {
        const p = placeProp(spot.x, y, spot.z, rest, side, size, site)
        if (p && (!extras.prop.frame || across(p))) {
          at = p
          break
        }
        at ??= p
      }
      if (at) {
        const p = createWitnessProp(kind)
        p.group.position.set(at.x, y, at.z)
        p.group.rotation.y = at.heading
        props.add(p.group)
        prop = { x: at.x, z: at.z, radius: Math.hypot(size.halfW, size.halfD), kind, frame: !!extras.prop.frame, dispose: p.dispose }
      } else console.warn(`No room for the ${kind} of the witness of ${w.caseId}`)
    }
    const bubble = createTalkIndicator()
    // Trail from near the "!" to him (on the ground or a plaza, never over a roof)
    const trailGround = (x: number, z: number) => {
      const h = site.surfaceAt(x, z)
      return h - site.heightAt(x, z) > TRAIL_MAX_CLIMB ? null : h
    }
    const from = { x: zone.x + (spot.x - zone.x) * TRAIL_START, z: zone.z + (spot.z - zone.z) * TRAIL_START }
    const trail = createWitnessTrail(from, spot, trailGround, site.surfaceAt)
    group.add(witness.root, bubble.group, trail.group)
    placed.push({ witness, bubble, trail, caseId: w.caseId, zone, x: spot.x, z: spot.z, y, rest, waveClock: 0, againClock: 0, wasNear: false, glow: 0, prop })
  }
  const headTop = new THREE.Vector3()
  const pointerAt = { x: 0, z: 0 }

  return {
    group,
    /** The witnesses' trade props: the dialogue camera must see past them (ray-cast, like monuments) */
    props,
    get: (caseId: string) => placed.find((p) => p.caseId === caseId),
    /** True if (x, z) is on a witness's prop (plus margin): the detective walks round them. */
    blocks(x: number, z: number, margin = 0) {
      for (const p of placed) if (p.prop && Math.hypot(x - p.prop.x, z - p.prop.z) < p.prop.radius + margin) return true
      return false
    },

    update(dt: number, dx: number, dz: number, dialogue: WitnessDialogue, view?: WitnessView) {
      for (const p of placed) {
        const inDialogue = dialogue.caseId === p.caseId
        const dist = Math.hypot(dx - p.x, dz - p.z)
        const fromZone = Math.hypot(dx - p.zone.x, dz - p.zone.z)
        const inZone = fromZone <= p.zone.radius && !inDialogue
        const near = dist < WAVE_DISTANCE || inZone
        if (near && !p.wasNear && !inDialogue) p.waveClock = WAVE_TIME // waves each time the detective arrives
        p.wasNear = near
        // ...and again every few seconds while the detective is around but not talking to him
        p.againClock = near && !inDialogue ? p.againClock + dt : 0
        if (p.againClock > WAVE_AGAIN) {
          p.againClock = 0
          p.waveClock = WAVE_TIME
        }
        p.waveClock = Math.max(0, p.waveClock - dt)
        p.witness.update(dt, {
          lookAt: !inDialogue && dist < WATCH_DISTANCE ? { x: dx, z: dz } : null,
          restHeading: inDialogue ? dialogue.witnessHeading : p.rest,
          gazeAt: inDialogue ? { x: dx, z: dz } : null,
          wave: p.waveClock > 0 && !inDialogue,
          talking: inDialogue && dialogue.speaking === 'witness',
          listening: inDialogue && dialogue.speaking === 'detective',
          mood: inDialogue ? dialogue.mood : null,
        })
        // Warm glow while the detective is in his case zone
        p.glow += ((inZone ? 1 : 0) - p.glow) * (1 - Math.exp(-4 * dt))
        p.witness.setGlow(p.glow * (0.6 + 0.4 * Math.sin(performance.now() / 300)))
        // Fixed trail near the case; pointer at the detective's feet while he is in the zone, until close
        pointerAt.x = dx
        pointerAt.z = dz
        p.trail.update(dt, !inDialogue && fromZone < p.zone.radius * TRAIL_RANGE ? 1 : 0, inZone && dist > POINTER_HIDE ? pointerAt : null)
        if (view) {
          p.witness.headTop(headTop)
          p.bubble.update(dt, headTop, view.camera, {
            visible: !inDialogue && view.distance < BUBBLE_MAX_CAMERA,
            inZone,
          })
        }
      }
    },

    dispose() {
      for (const p of placed) {
        p.witness.dispose()
        p.bubble.dispose()
        p.trail.dispose()
        p.prop?.dispose()
      }
    },
  }
}

/**
 * Where a witness's prop stands: `side` rad from his facing (PI: behind him, -PI/2: his right),
 * turned a little if needed, on flat free ground (no house, water, wall or fence: the monument
 * height maps are in surfaceAt) and with its nearest side `gap` from him. Behind him it turns with
 * the placement (its front towards his back); at his side its front looks the way he does (the
 * kiosk counter faces the zone centre, where the detective comes from). Null if there is no room.
 */
function placeProp(
  x: number, y: number, z: number, facing: number, side: number,
  size: { halfW: number; halfD: number; gap: number }, site: WitnessSite,
) {
  // Facing convention: heading h looks towards (-sin h, -cos h)
  for (const turn of PROP_TURNS) {
    const a = facing + side + turn
    const ux = -Math.sin(a), uz = -Math.cos(a)
    const behind = side === Math.PI
    const dist = (behind ? size.halfD : size.halfW) + size.gap
    const cx = x + ux * dist, cz = z + uz * dist
    // A kiosk faces the way he faces (he stands at its counter); crates line up beside him
    const heading = behind ? facing + turn : facing
    const cos = Math.cos(heading), sin = Math.sin(heading)
    let ok = true
    for (let i = -2; i <= 2 && ok; i++) {
      for (let j = -2; j <= 2 && ok; j++) {
        const lx = (i / 2) * (size.halfW + 0.5), lz = (j / 2) * (size.halfD + 0.5)
        // Local to world (rotation about Y by heading)
        const px = cx + lx * cos + lz * sin, pz = cz - lx * sin + lz * cos
        ok = site.isLand(px, pz) && !site.blocked(px, pz, 1) && !site.nearRiver(px, pz, 1) &&
          Math.abs(site.surfaceAt(px, pz) - y) <= PROP_MAX_STEP
      }
    }
    if (ok) return { x: cx, z: cz, heading }
  }
  return null
}
