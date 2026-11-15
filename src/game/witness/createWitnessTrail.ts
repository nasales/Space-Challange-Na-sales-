// A glowing trail of chevrons ("> > >") on the ground, from near the case "!" to its witness, so the
// player standing in the case zone sees where to go. Same additive glow as the zone ring; a wave of
// light runs along it towards the witness. A soft glowing disc under the witness's feet goes with it.
// Monuments can hide the fixed trail, so a short pointer of three chevrons also lies on the ground in
// front of the detective, aimed at the witness, while he is in the zone.
//
//   const trail = createWitnessTrail(from, to, groundAt, surfaceAt)
//   scene.add(trail.group)
//   trail.update(dt, strength, pointerFrom)   // strength 0..1; pointerFrom: detective {x, z} or null
import * as THREE from 'three'

/** Distance between chevrons and their size (world units). */
const SPACING = 6
const CHEVRON_WIDTH = 4.2
const CHEVRON_LENGTH = 2.2
const STROKE = 0.7
/** No chevron closer than this to the witness (he stands on the glow disc). */
const END_GAP = 6
/** Radius of the glow under the witness (world units). */
const HALO_RADIUS = 5.5
/** Height above the ground (avoids flicker), like the zone ring. */
const LIFT = 0.7
/** Normal (not additive) blending: an additive glow vanishes on white plazas. */
const COLOR = 0xffb400
const HALO_COLOR = 0xffc21a
/** Speed of the light wave along the trail (chevrons per second). */
const WAVE_SPEED = 2.2
/** Pointer in front of the detective: distances of its chevrons from him and their size (world units / times). */
const POINTER_STEPS = [8, 13, 18, 23]
const POINTER_SCALE = 1.7
/** A pointer chevron hides where the surface is this much above or below the detective's. */
const POINTER_MAX_STEP = 3

/** Flat chevron pointing to +Z in the XZ plane, centred on (0, 0). */
function chevronGeometry() {
  const s = new THREE.Shape()
  const w = CHEVRON_WIDTH / 2, l = CHEVRON_LENGTH / 2, t = STROKE
  s.moveTo(-w, -l)
  s.lineTo(0, l)
  s.lineTo(w, -l)
  s.lineTo(w - t, -l)
  s.lineTo(0, l - t * 1.4)
  s.lineTo(-w + t, -l)
  s.closePath()
  return new THREE.ShapeGeometry(s).rotateX(Math.PI / 2) // shape +Y -> ground +Z
}

function glow(opacity: number) {
  return new THREE.MeshBasicMaterial({
    color: COLOR,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

/** Soft radial falloff texture for the halo (no image file). */
function haloTexture() {
  const size = 64
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2)
      const a = Math.max(0, 1 - r) ** 1.6
      const i = (y * size + x) * 4
      data.set([255, 255, 255, Math.round(a * 255)], i)
    }
  }
  const tex = new THREE.DataTexture(data, size, size)
  tex.needsUpdate = true
  return tex
}

export function createWitnessTrail(
  from: { x: number; z: number },
  to: { x: number; z: number },
  /** Ground height at (x, z), or null where no chevron may lie (e.g. a roof) */
  groundAt: (x: number, z: number) => number | null,
  /** Top of whatever the detective walks on (the pointer lies on it, roofs and plazas included) */
  surfaceAt: (x: number, z: number) => number,
) {
  const group = new THREE.Group()
  group.name = 'witness-trail'
  const geo = chevronGeometry()
  const dx = to.x - from.x, dz = to.z - from.z
  const length = Math.hypot(dx, dz)
  const yaw = Math.atan2(dx, dz) // chevron +Z points along the trail
  const count = Math.max(0, Math.floor((length - END_GAP) / SPACING) + 1)
  const chevrons: THREE.Mesh[] = []
  for (let i = 0; i < count; i++) {
    const d = i * SPACING
    const x = from.x + (dx / length) * d, z = from.z + (dz / length) * d
    const y = groundAt(x, z)
    if (y === null) continue
    const m = new THREE.Mesh(geo, glow(0))
    m.position.set(x, y + LIFT, z)
    m.rotation.y = yaw
    m.renderOrder = 2
    m.userData.step = i
    group.add(m)
    chevrons.push(m)
  }
  const tex = haloTexture()
  const haloMat = new THREE.MeshBasicMaterial({ color: HALO_COLOR, map: tex, transparent: true, opacity: 0, depthWrite: false })
  const haloGeo = new THREE.CircleGeometry(HALO_RADIUS, 32).rotateX(-Math.PI / 2)
  const halo = new THREE.Mesh(haloGeo, haloMat)
  halo.position.set(to.x, (groundAt(to.x, to.z) ?? 0) + LIFT, to.z)
  halo.renderOrder = 2
  group.add(halo)

  // Pointer: its own group (it follows the detective, and hides on its own)
  const pointer = new THREE.Group()
  pointer.name = 'witness-pointer'
  const pointerMats = POINTER_STEPS.map(() => glow(0))
  const pointerMeshes = pointerMats.map((m) => {
    const c = new THREE.Mesh(geo, m)
    c.scale.setScalar(POINTER_SCALE)
    c.renderOrder = 2
    pointer.add(c)
    return c
  })
  group.add(pointer)

  let time = 0
  let shown = 0
  let pointerShown = 0
  return {
    group,
    update(dt: number, strength: number, pointerFrom: { x: number; z: number } | null = null) {
      time += dt
      const k = 1 - Math.exp(-4 * dt)
      shown += (strength - shown) * k
      pointerShown += ((pointerFrom ? 1 : 0) - pointerShown) * k
      group.visible = shown > 0.01 || pointerShown > 0.01
      if (!group.visible) return
      pointer.visible = pointerShown > 0.01
      if (pointerFrom) {
        const px = to.x - pointerFrom.x, pz = to.z - pointerFrom.z
        const d = Math.hypot(px, pz) || 1
        const here = surfaceAt(pointerFrom.x, pointerFrom.z)
        pointerMeshes.forEach((c, i) => {
          const s = Math.min(POINTER_STEPS[i], d - END_GAP)
          const x = pointerFrom.x + (px / d) * s, z = pointerFrom.z + (pz / d) * s
          const y = surfaceAt(x, z)
          c.visible = Math.abs(y - here) < POINTER_MAX_STEP // not up on a monument shell or roof
          c.position.set(x, y + LIFT, z)
          c.rotation.y = Math.atan2(px, pz)
        })
      }
      pointerMats.forEach((m, i) => {
        const wave = Math.max(0, Math.cos((time * 2.5 - i * 0.7) * 1.6)) ** 2
        m.opacity = pointerShown * (0.55 + 0.4 * wave)
      })
      chevrons.forEach((c) => {
        // A bright wave runs towards the witness over a soft base glow
        const phase = (time * WAVE_SPEED - c.userData.step) / Math.max(4, count)
        const wave = Math.max(0, Math.cos((phase - Math.floor(phase)) * Math.PI * 2)) ** 3
        ;(c.material as THREE.MeshBasicMaterial).opacity = shown * (0.5 + 0.45 * wave)
      })
      haloMat.opacity = shown * (0.55 + 0.25 * Math.sin(time * 3))
      halo.scale.setScalar(1 + 0.08 * Math.sin(time * 3))
    },
    dispose() {
      geo.dispose()
      chevrons.forEach((c) => (c.material as THREE.Material).dispose())
      pointerMats.forEach((m) => m.dispose())
      haloGeo.dispose()
      haloMat.dispose()
      tex.dispose()
    },
  }
}
