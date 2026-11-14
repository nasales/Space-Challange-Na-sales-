// The witnesses of the featured cases (src/shared/witness.ts) standing on the map, inside the
// trigger zone of their case marker. The spot is searched once at load time: explored land,
// flat (no wall or step around him), on the ground or a monument plaza but never on a roof, away
// from houses, windmills and rivers, with free flat ground in front of him, towards the zone
// centre, where the detective stands to talk. Spots near a road, on bare ground, about 3/4 out
// to the rim win, and he needs open sky round him for the dialogue camera. (The zone centre itself
// may be a monument roof, as in Valencia.)
//
//   const witnesses = createWitnesses(WITNESSES, caseMarkers, site)
//   scene.add(witnesses.group)
//   witnesses.update(dt, detectiveX, detectiveZ, dialogue)   // every frame
//   witnesses.get(caseId)                                     // { witness, x, z, y } or undefined
import * as THREE from 'three'
import { createWitness } from './createWitness'
import type { Witness } from '../../shared/witness'

/** Distance from the zone centre, as fractions of the zone radius, tried in this order. */
const RING_FRACTIONS = [0.3, 0.45, 0.6, 0.75, 0.9, 1.1, 1.4]
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
/** The witness waves when the detective comes this close (world units), for WAVE_TIME seconds. */
const WAVE_DISTANCE = 75
const WAVE_TIME = 2.6
/** He turns to watch the detective within this distance (world units). */
const WATCH_DISTANCE = 110

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
}

type PlacedWitness = { witness: ReturnType<typeof createWitness>; caseId: string; x: number; z: number; y: number; rest: number; waveClock: number; wasNear: boolean }

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
  // In front of him, towards the zone centre, the detective needs room to stand: no water, house or wall
  const clearFront = (x: number, z: number) => {
    const d = Math.hypot(zone.x - x, zone.z - z) || 1
    const ux = (zone.x - x) / d, uz = (zone.z - z) / d
    let last = site.surfaceAt(x, z)
    for (let s = 2; s <= FRONT; s += 2) {
      const px = x + ux * s, pz = z + uz * s
      const h = site.surfaceAt(px, pz)
      if (!free(px, pz, 1) || Math.abs(h - last) > MAX_STEP) return false
      last = h
    }
    return true
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
      // Prefer: open all round, near a road, on bare ground rather than a plaza, about 3/4 of the way to the rim
      const score = (OPEN_DIRECTIONS - open) * 1.5 + (site.nearRoad(x, z, 25) ? 0 : 6) + (site.surfaceAt(x, z) - site.heightAt(x, z)) + Math.abs(f - 0.75) * 8
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
  for (const w of Object.values(list)) {
    if (!w) continue
    const zone = zones.positionOf(w.caseId)
    if (!zone) continue
    const spot = findWitnessSpot(zone, site)
    if (!spot) {
      console.warn(`No free spot for the witness of ${w.caseId}`)
      continue
    }
    const witness = createWitness(w.look)
    const y = site.surfaceAt(spot.x, spot.z)
    witness.root.position.set(spot.x, y, spot.z)
    witness.root.userData.caseId = w.caseId
    // At rest he faces the zone centre (where the detective comes from)
    const rest = Math.atan2(-(zone.x - spot.x), -(zone.z - spot.z))
    group.add(witness.root)
    placed.push({ witness, caseId: w.caseId, x: spot.x, z: spot.z, y, rest, waveClock: 0, wasNear: false })
  }

  return {
    group,
    get: (caseId: string) => placed.find((p) => p.caseId === caseId),

    update(dt: number, dx: number, dz: number, dialogue: WitnessDialogue) {
      for (const p of placed) {
        const inDialogue = dialogue.caseId === p.caseId
        const dist = Math.hypot(dx - p.x, dz - p.z)
        const near = dist < WAVE_DISTANCE
        if (near && !p.wasNear && !inDialogue) p.waveClock = WAVE_TIME // waves each time the detective arrives
        p.wasNear = near
        p.waveClock = Math.max(0, p.waveClock - dt)
        p.witness.update(dt, {
          lookAt: !inDialogue && dist < WATCH_DISTANCE ? { x: dx, z: dz } : null,
          restHeading: inDialogue ? dialogue.witnessHeading : p.rest,
          gazeAt: inDialogue ? { x: dx, z: dz } : null,
          wave: p.waveClock > 0 && !inDialogue,
          talking: inDialogue && dialogue.speaking === 'witness',
          listening: inDialogue && dialogue.speaking === 'detective',
        })
      }
    },

    dispose() {
      for (const p of placed) p.witness.dispose()
    },
  }
}
