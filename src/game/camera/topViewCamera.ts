// Development-only top view (open the game with ?topview): a camera straight above the detective,
// north up, to judge how roads, towns and scenery read from above.
// - Mouse wheel: height (zoom), from street level to the whole country.
// - WASD / arrows: pan (speed grows with the height; Shift = 3x faster). R: back over the detective.
// The detective does not move while the top view is on (the keys pan the camera instead).
import * as THREE from 'three'

const MIN_HEIGHT = 25
const MAX_HEIGHT = 9000
/** Narrow-ish field of view: less perspective stretch towards the screen edges. */
const FOV = 40
/** Pan speed in screen heights per second. */
const PAN_SPEED = 0.6

const PAN_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'])

/** true when the URL asks for the top view (development builds only). */
export function wantsTopView() {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).has('topview')
}

export function createTopViewCamera(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
  let height = 260
  let targetHeight = height
  const pan = { x: 0, z: 0 }
  const down = new Set<string>()
  /** Point on the ground straight below the camera (shadows and scenery follow it). */
  const center = new THREE.Vector3()

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    targetHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, targetHeight * Math.exp(e.deltaY * 0.0015)))
  }
  const onDown = (e: KeyboardEvent) => {
    if (!PAN_KEYS.has(e.code)) return
    e.preventDefault()
    down.add(e.code)
    if (e.code === 'KeyR') pan.x = pan.z = 0
  }
  const onUp = (e: KeyboardEvent) => down.delete(e.code)
  const onBlur = () => down.clear()
  dom.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  window.addEventListener('blur', onBlur)
  const is = (...codes: string[]) => codes.some((c) => down.has(c))

  /** Places the camera over (x, z) + pan, `height` units above the ground there. */
  const update = (x: number, z: number, groundAt: (x: number, z: number) => number, dt: number) => {
    height += (targetHeight - height) * (1 - Math.exp(-8 * dt))
    const visible = 2 * height * Math.tan(THREE.MathUtils.degToRad(FOV) / 2) // ground height of the screen
    const speed = visible * PAN_SPEED * (is('ShiftLeft', 'ShiftRight') ? 3 : 1) * dt
    pan.x += ((is('KeyD', 'ArrowRight') ? 1 : 0) - (is('KeyA', 'ArrowLeft') ? 1 : 0)) * speed
    pan.z += ((is('KeyS', 'ArrowDown') ? 1 : 0) - (is('KeyW', 'ArrowUp') ? 1 : 0)) * speed // north = -Z = up
    const cx = x + pan.x, cz = z + pan.z
    const g = groundAt(cx, cz)
    center.set(cx, g, cz)
    camera.fov = FOV
    camera.up.set(0, 0, -1) // north at the top of the screen
    camera.position.set(cx, g + height, cz)
    camera.lookAt(cx, g, cz)
  }

  return {
    update,
    center,
    /** Camera height over the ground below it (plays the role of the chase distance). */
    get distance() {
      return height
    },
    dispose: () => {
      dom.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
      camera.up.set(0, 1, 0)
    },
  }
}
