// Floating "talk" sign over a witness: a comic speech bubble with "..." in the same toon/ink style
// as the case "!" (white bubble, orange dots). It always faces the camera, bobs, and is drawn on top
// of buildings so the witness can be found from the "!" even behind a monument. Far from the camera
// it keeps a readable size on screen (it grows with the distance, like the big "!" stays visible),
// and it pulses when the detective is inside the case zone.
//
//   const sign = createTalkIndicator()
//   scene.add(sign.group)
//   sign.update(dt, headTopWorld, camera, { visible, inZone })   // every frame
import * as THREE from 'three'
import { toonMaterial } from '../scene/toonGradient'

/** Bubble width at the closest zoom (world units; the witness is ~10 tall). */
const SIZE = 5.5
/** Distance from the camera up to which the bubble has its base size; farther, it grows with it. */
const BASE_DISTANCE = 45
/** Largest growth far away (times SIZE). */
const MAX_GROWTH = 6
/** Gap between the head and the tip of the bubble's tail (fraction of the bubble width). */
const LIFT = 0.2
/** Bob: amplitude (fraction of the bubble width) and speed (rad/s). */
const BOB_AMPLITUDE = 0.1
const BOB_SPEED = 2.4
/** Bigger and pulsing while the detective is inside the case zone. */
const ZONE_SCALE = 1.3
const ZONE_PULSE = 0.08
const BUBBLE_COLOR = 0xffffff
const DOT_COLOR = 0xff7a1a
/** Drawn after (and over) the world, but its depth is written so the ink outline still draws it. */
const RENDER_ORDER = 950

export function createTalkIndicator() {
  const group = new THREE.Group()
  group.name = 'talk-indicator'
  const sign = new THREE.Group() // billboard, unit size: 1 = bubble width
  group.add(sign)
  const onTop = { depthTest: false }
  const bubbleMat = toonMaterial(BUBBLE_COLOR, onTop)
  const dotMat = toonMaterial(DOT_COLOR, onTop)
  const geometries: THREE.BufferGeometry[] = []
  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, order: number) => {
    geometries.push(geo)
    const o = new THREE.Mesh(geo, m)
    o.renderOrder = RENDER_ORDER + order
    o.frustumCulled = false
    sign.add(o)
    return o
  }
  // Rounded bubble (flattened ellipsoid) with a short tail pointing down at the head
  const body = mesh(new THREE.SphereGeometry(0.5, 24, 12), bubbleMat, 0)
  body.scale.set(1, 0.68, 0.32)
  body.position.y = 0.62
  const tail = mesh(new THREE.ConeGeometry(0.13, 0.36, 8), bubbleMat, 0)
  tail.rotation.z = Math.PI + 0.45 // tip down and a little to the side, like a comic bubble
  tail.position.set(-0.13, 0.22, 0)
  tail.scale.z = 0.5
  const dots = [-1, 0, 1].map((i) => {
    const d = mesh(new THREE.IcosahedronGeometry(0.075, 1), dotMat, 1)
    d.position.set(i * 0.22, 0.62, 0.17)
    return d
  })

  let time = Math.random() * 5
  let shown = 0 // 0..1, fades by scale (hidden in a dialogue)
  let zone = 0
  const camQuat = new THREE.Quaternion()
  const camPos = new THREE.Vector3()

  return {
    group,
    update(
      dt: number,
      headTop: THREE.Vector3,
      camera: THREE.Camera,
      state: { visible: boolean; inZone: boolean },
    ) {
      time += dt
      const ease = (v: number, t: number, rate: number) => v + (t - v) * (1 - Math.exp(-rate * dt))
      shown = ease(shown, state.visible ? 1 : 0, 8)
      zone = ease(zone, state.inZone ? 1 : 0, 4)
      group.visible = shown > 0.01
      if (!group.visible) return
      camera.getWorldPosition(camPos)
      const growth = Math.min(MAX_GROWTH, Math.max(1, camPos.distanceTo(headTop) / BASE_DISTANCE))
      const pulse = 1 + zone * (ZONE_SCALE - 1 + Math.sin(time * 5) * ZONE_PULSE)
      const size = SIZE * growth * pulse * (0.4 + 0.6 * shown)
      sign.scale.setScalar(size)
      // Billboard: same orientation as the camera, so it always reads as a flat comic bubble
      camera.getWorldQuaternion(camQuat)
      sign.quaternion.copy(camQuat)
      group.position.copy(headTop)
      group.position.y += size * (LIFT - 0.05) + Math.sin(time * BOB_SPEED) * BOB_AMPLITUDE * size
      // The "..." types: each dot hops in turn
      dots.forEach((d, i) => {
        const k = Math.max(0, Math.sin(time * 6 - i * 0.9))
        d.position.y = 0.62 + k * 0.06
        d.scale.setScalar(1 + k * 0.35)
      })
    },
    dispose() {
      geometries.forEach((g) => g.dispose())
      bubbleMat.dispose()
      dotMat.dispose()
    },
  }
}
