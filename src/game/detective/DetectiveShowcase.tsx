// Detective "showcase" for the main menu: the in-game detective on its own small transparent
// three.js canvas. It reuses createDetective() and drives it with a fake CarState, so the run
// cycle, scarf, hat spring, magnifier sweep and squash & stretch all come from the game model;
// the extra poses (wind-up, skid, crouch, head scratch, hat tip + wink) are layered on top after
// update(). Comic timing: snappy springs with overshoot, holds, and "on twos" (12 fps) posing
// during the fastest actions.
//
// mode 'investigate' (default)
//   Entrance, once when the menu opens (ENTRANCE s):
//     0.12 - 0.50  drops in from above the frame, stretched, arms up; his hat floats far behind
//     0.50         lands: big squash, "POOF!" and a ring of comic dust puffs, small camera shake
//     0.50 - 1.25  wobbles and windmills his arms while the hat drifts down like a leaf
//     1.25         the hat lands on his head and squashes him a little more
//     1.45 - 2.30  grabs his lapels and straightens his coat (two tugs), chin up
//   Loop of LOOP s (repeats forever after the entrance):
//     0.00 - 0.70  wind-up: snaps to profile, leans back, arms back, knee up, legs spin in place
//     0.70 - 2.90  dash: sprint with motion streaks and dust (on twos)
//     2.90 - 3.50  skid stop: heel digs in, leans back, "SKRRT!", dust spray, wobble
//     3.50 - 4.60  turns three-quarters and sweeps the magnifier; footprints pop up
//     4.60 - 6.20  crouches and sneaks along the prints
//     6.20 - 7.00  "?" bubble, scratches his head
//     7.00 - 7.45  "!" pop and a small hop
//     7.45 - 9.50  snaps to the camera, touches the brim of his hat and winks (sparkle "ding"),
//                  holds it while following the cursor, then lowers the hand
//     9.50 - LOOP  relaxed stand, then the wind-up again
// mode 'turntable' (Wardrobe): confident pose, slowly turning so every piece of clothing is
// visible; drag with the mouse (or a finger) to turn him by hand. He winks now and then.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createDetective } from './createDetective'
import type { CarState } from '../car/carPhysics'
import type { Outfit } from '../../shared/outfit'

// ---- Entrance (seconds since the menu opened) ----
const ENTRANCE = 2.6
const E_DROP = 0.08
const E_LAND = 0.55
const E_HAT = 1.25
const E_TUG = 1.45
const E_SETTLE = 2.3
const FALL_HEIGHT = 24
const HAT_FLOAT = 1.7 // hat height above its seat at the landing (model units, before scaling)

// ---- Loop (seconds since the end of the entrance, modulo LOOP) ----
const WINDUP_END = 0.7
const DASH_END = 2.9
const SKID_END = 3.5
const SWEEP_END = 4.6
const TRACK_END = 6.2
const PUZZLE_END = 7
const EUREKA_END = 7.45
const TIP_END = 9.5
const LOOP = 10.1

const CENTER_Y = 4.6 // roughly the detective's belly height (model is ~9 units tall)
const RUN_HEADING = 1.25 // three-quarter profile, running towards the right of the screen
const SEARCH_HEADING = 0.6 // three-quarter view, so the floor in front of him is visible
const DASH_SPEED = 110 // fake CarState speed while dashing (above maxSpeed: sprint legs)
const SNEAK_SPEED = 4.5 // slow, exaggerated steps while following the prints
const SLIDE = 2 // world units he slides forward during the skid
const HOP_HEIGHT = 1.4
const TWOS = 1 / 12 // "on twos": pose updates per second during the fastest actions
const PRINT_COUNT = 8
const PRINT_SPACING = 1.8
const PRINT_SCROLL = 1.6 // units/s the prints slide under him while he sneaks
const PUFF_COUNT = 24
const STREAK_COUNT = 10
const FIT_WIDTH = 17 // world units that must fit across the stage (keeps him inside on narrow screens)
const INK = '#2b2540'
const TAU = Math.PI * 2

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}
/** 0 outside [a, b], 1 inside, with smooth ramps of `ramp` seconds at both ends. */
const window01 = (t: number, a: number, b: number, ramp: number) =>
  smooth((t - a) / ramp) * (1 - smooth((t - (b - ramp)) / ramp))
/** Overshooting pop-in (0 -> ~1.1 -> 1). */
const backOut = (x: number) => {
  const t = clamp01(x) - 1
  return 1 + t * t * (2.7 * t + 1.7)
}
/** Damped wobble that starts at `amp` at time 0 and settles to 0. */
const wobble = (x: number, amp: number, freq: number, decay: number) =>
  x < 0 ? 0 : amp * Math.exp(-decay * x) * Math.cos(freq * x)
/** The angle equivalent to `target` (mod TAU) that is closest to `current`. */
const nearAngle = (target: number, current: number) => target + TAU * Math.round((current - target) / TAU)
/** Moves rotation `axis` of `obj` toward `value` by weight `w` (0 = untouched, 1 = exactly value). */
const pose = (obj: THREE.Object3D, axis: 'x' | 'y' | 'z', value: number, w: number) => {
  if (w > 0) obj.rotation[axis] += (value - obj.rotation[axis]) * Math.min(1, w)
}

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.lineJoin = 'round'
  draw(g)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Soft radial glow texture (gold center fading to transparent). */
const glowTexture = () =>
  canvasTexture(128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255, 236, 160, 1)')
    grad.addColorStop(0.35, 'rgba(242, 193, 78, 0.55)')
    grad.addColorStop(1, 'rgba(242, 193, 78, 0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
  })

/** Spiky comic burst path centered in a 256 canvas. */
function burstPath(g: CanvasRenderingContext2D, spikes: number, inner: number, outer: number) {
  g.beginPath()
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * TAU - Math.PI / 2
    const r = i % 2 ? inner : outer
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r
    if (i) g.lineTo(x, y)
    else g.moveTo(x, y)
  }
  g.closePath()
}

/** Comic "!" pop: red spiky burst with an ink outline and a gold exclamation mark. */
const exclaimTexture = () =>
  canvasTexture(256, (g) => {
    burstPath(g, 12, 78, 118)
    g.fillStyle = '#e5322d'
    g.fill()
    g.lineWidth = 10
    g.strokeStyle = INK
    g.stroke()
    g.font = '900 150px system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineWidth = 14
    g.strokeText('!', 128, 136)
    g.fillStyle = '#f2c14e'
    g.fillText('!', 128, 136)
  })

/** Thought bubble with a "?": white cloud with an ink outline and two small trailing puffs. */
const questionTexture = () =>
  canvasTexture(256, (g) => {
    const puff = (x: number, y: number, r: number) => {
      g.beginPath()
      g.arc(x, y, r, 0, TAU)
      g.fill()
      g.stroke()
    }
    g.fillStyle = '#ffffff'
    g.strokeStyle = INK
    g.lineWidth = 9
    puff(52, 226, 13)
    puff(80, 196, 20)
    puff(140, 108, 86)
    g.font = '900 120px system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = INK
    g.fillText('?', 142, 114)
  })

/** Comic sound effect: slanted heavy letters with a thick ink outline and a drop shadow. */
const wordTexture = (word: string, fill: string, px: number) =>
  canvasTexture(256, (g) => {
    g.translate(128, 128)
    g.rotate(-0.12)
    g.font = `italic 900 ${px}px system-ui, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.lineWidth = 16
    g.strokeStyle = INK
    g.fillStyle = INK
    g.strokeText(word, 7, 7)
    g.fillText(word, 7, 7) // offset ink shadow
    g.strokeText(word, 0, 0)
    g.fillStyle = fill
    g.fillText(word, 0, 0)
  })

/** Flat comic dust puff: cream disc with an ink outline and a shaded crescent. */
const puffTexture = () =>
  canvasTexture(128, (g) => {
    g.beginPath()
    g.arc(64, 64, 54, 0, TAU)
    g.fillStyle = '#fff6e3'
    g.fill()
    g.save()
    g.clip()
    g.beginPath()
    g.arc(78, 80, 50, 0, TAU)
    g.fillStyle = '#ecd6ae'
    g.fill()
    g.restore()
    g.lineWidth = 8
    g.strokeStyle = INK
    g.beginPath()
    g.arc(64, 64, 54, 0, TAU)
    g.stroke()
  })

/** Four-point gold sparkle ("ding") with an ink outline and a white core. */
const sparkleTexture = () =>
  canvasTexture(256, (g) => {
    const star = (outer: number, inner: number) => {
      g.beginPath()
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU - Math.PI / 2
        const r = i % 2 ? inner : outer
        if (i) g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r)
        else g.moveTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r)
      }
      g.closePath()
    }
    star(118, 30)
    g.fillStyle = '#f2c14e'
    g.fill()
    g.lineWidth = 10
    g.strokeStyle = INK
    g.stroke()
    star(58, 14)
    g.fillStyle = '#fffbe8'
    g.fill()
  })

/** Flat shoe print (sole + heel), lying on the floor, toe toward -Z. */
function printGeometry() {
  const sole = new THREE.Shape()
  sole.absellipse(0, -0.25, 0.36, 0.5, 0, TAU, false, 0)
  const heel = new THREE.Shape()
  heel.absellipse(0, 0.55, 0.28, 0.24, 0, TAU, false, 0)
  // Shape y becomes -Z after lying flat, so the toe (sole) points forward
  return new THREE.ShapeGeometry([sole, heel], 12).rotateX(-Math.PI / 2)
}

export type DetectiveShowcaseProps = {
  /** Clothes colors; changing it recolors the model live, without rebuilding the scene. */
  outfit?: Outfit
  /** 'investigate' = menu loop (default); 'turntable' = Wardrobe pose that slowly turns. */
  mode?: 'investigate' | 'turntable'
}

export default function DetectiveShowcase({ outfit, mode = 'investigate' }: DetectiveShowcaseProps = {}) {
  const ref = useRef<HTMLDivElement>(null)
  const detectiveRef = useRef<ReturnType<typeof createDetective> | null>(null)
  const outfitRef = useRef(outfit) // latest outfit, used when the scene is (re)built

  // Recolor live when the outfit changes (the scene is not recreated)
  useEffect(() => {
    outfitRef.current = outfit
    if (outfit) detectiveRef.current?.setOutfit(outfit)
  }, [outfit])

  useEffect(() => {
    const container = ref.current
    if (!container) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const turntable = mode === 'turntable'
    const story = !turntable && !reduced // the animated entrance + loop

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 500)
    let fit = 1 // camera distance multiplier so FIT_WIDTH always fits across the stage
    const resize = () => {
      const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight)
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      fit = Math.max(1, FIT_WIDTH / 2 / (halfTan * camera.aspect) / 30)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)

    // Lights: same sky/ground mood as the game, plus a warm key light and a cool rim light
    scene.add(new THREE.HemisphereLight(0xb8d4ff, 0xffd9a8, 1.9))
    const key = new THREE.DirectionalLight(0xffefcc, 2.2)
    key.position.set(-10, 20, -16)
    const rim = new THREE.DirectionalLight(0x9fd8ff, 1.6)
    rim.position.set(12, 8, 18)
    scene.add(key, rim)

    const disposables: { dispose: () => void }[] = []
    const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x)
    const spriteOf = (tex: THREE.Texture) => {
      const m = keep(new THREE.SpriteMaterial({ map: keep(tex), transparent: true, depthWrite: false }))
      const s = new THREE.Sprite(m)
      s.visible = false
      scene.add(s)
      return s
    }

    // Detective inside a "rig" with its pivot at the feet: the rig turns him (heading) and adds
    // the whole-body lean, slide and squash; update() still animates everything inside the root.
    const detective = createDetective(outfitRef.current)
    detectiveRef.current = detective
    const { body, head, arms, legs, hat } = detective.parts
    const rig = new THREE.Group()
    rig.rotation.order = 'YXZ' // turn first, then lean forward in his own frame
    scene.add(rig)
    rig.add(detective.root)

    // Golden glow behind him (always there, flashes on the clue and on the wink)
    const glowMat = keep(new THREE.SpriteMaterial({ map: keep(glowTexture()), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
    const glow = new THREE.Sprite(glowMat)
    glow.position.set(0, CENTER_Y, 6)
    scene.add(glow)

    // Soft shadow on the floor (shrinks while he is in the air)
    const shadowMat = keep(new THREE.MeshBasicMaterial({ color: 0x1c1a23, transparent: true, opacity: 0.28, depthWrite: false }))
    const shadow = new THREE.Mesh(keep(new THREE.CircleGeometry(3.2, 32).rotateX(-Math.PI / 2)), shadowMat)
    shadow.position.y = 0.02
    scene.add(shadow)

    // Footprint trail: lies on the floor in front of him, turned to his search heading
    const trail = new THREE.Group()
    trail.position.y = 0.03
    trail.rotation.y = SEARCH_HEADING
    trail.visible = false
    scene.add(trail)
    const printGeo = keep(printGeometry())
    const printMat = keep(new THREE.MeshBasicMaterial({ color: 0x2b2540, transparent: true, opacity: 0.6, depthWrite: false }))
    const prints = Array.from({ length: PRINT_COUNT }, (_, k) => {
      const m = new THREE.Mesh(printGeo, printMat)
      m.rotation.y = (k % 2 ? -1 : 1) * 0.12 // feet point slightly outwards
      m.visible = false
      trail.add(m)
      return m
    })

    // Comic pops
    const exclaim = spriteOf(exclaimTexture())
    const question = spriteOf(questionTexture())
    const poof = spriteOf(wordTexture('POOF!', '#fff6e3', 74))
    const skrrt = spriteOf(wordTexture('SKRRT!', '#f2c14e', 64))
    const sparkle = spriteOf(sparkleTexture())

    // Flat comic dust puffs (one pool for the landing, the run and the skid)
    const puffMat = keep(new THREE.SpriteMaterial({ map: keep(puffTexture()), transparent: true, depthWrite: false }))
    const puffs = Array.from({ length: PUFF_COUNT }, () => {
      const s = new THREE.Sprite(puffMat)
      s.visible = false
      scene.add(s)
      return { sprite: s, vel: new THREE.Vector3(), life: 0, rate: 1, size: 1 }
    })
    let puffNext = 0
    const spawnPuff = (x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, rate: number) => {
      const p = puffs[puffNext]
      puffNext = (puffNext + 1) % PUFF_COUNT
      p.sprite.position.set(x, y, z)
      p.vel.set(vx, vy, vz)
      p.life = 1
      p.rate = rate
      p.size = size
      p.sprite.visible = true
    }

    // Speed streaks behind him while he dashes (thin white planes facing the camera)
    const streakGeo = keep(new THREE.PlaneGeometry(1, 0.14))
    const streakMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }))
    const streaks = Array.from({ length: STREAK_COUNT }, () => {
      const m = new THREE.Mesh(streakGeo, streakMat)
      m.visible = false
      scene.add(m)
      return { mesh: m, life: 0, len: 1 }
    })
    let streakNext = 0

    // Mouse: he turns to look at the cursor while he winks (and at the end of the entrance)
    let mouseX = 0
    const onPointer = (e: PointerEvent) => {
      const r = container.getBoundingClientRect()
      mouseX = Math.max(-1, Math.min(1, ((e.clientX - (r.left + r.width / 2)) / window.innerWidth) * 2.5))
    }
    window.addEventListener('pointermove', onPointer)

    // Turntable mode: drag to turn him by hand; he keeps slowly turning on his own otherwise
    let dragX: number | null = null
    let dragYaw = 0
    let dragIdle = 10 // seconds since the last drag
    const canvas = renderer.domElement
    const onDown = (e: PointerEvent) => {
      dragX = e.clientX
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (dragX === null) return
      dragYaw += (e.clientX - dragX) * 0.012
      dragX = e.clientX
      dragIdle = 0
    }
    const onUp = () => {
      dragX = null
    }
    if (turntable) {
      canvas.style.cursor = 'grab'
      canvas.style.touchAction = 'pan-y'
      canvas.addEventListener('pointerdown', onDown)
      canvas.addEventListener('pointermove', onMove)
      canvas.addEventListener('pointerup', onUp)
      canvas.addEventListener('pointercancel', onUp)
    }

    const state: CarState = { x: 0, y: 0, z: 0, heading: 0, speed: 0, steer: 0, yawRate: 0, accel: 0, pitch: 0, roll: 0 }
    let lastTime = performance.now()
    let elapsed = 0
    let stepAcc = 0 // time accumulated since the last pose update (for "on twos")
    let heading = 0, headingV = 0 // springy heading (snappy turns with a little overshoot)
    let lean = 0, leanV = 0 // springy whole-body lean (wobbles after the skid)
    let prevSpeed = 0
    let prevT = -1 // loop time of the previous frame (to fire one-shot effects)
    let shake = 0
    const camPos = new THREE.Vector3(0, 9, -30)
    const camTarget = new THREE.Vector3(0, CENTER_Y + 1.6, 0)
    const tmp = new THREE.Vector3()
    const fwd = new THREE.Vector3() // run direction (world), from RUN_HEADING
    fwd.set(-Math.sin(RUN_HEADING), 0, -Math.cos(RUN_HEADING))
    const slidePos = new THREE.Vector3() // rig offset on the floor

    const animate = () => {
      const now = performance.now()
      const dt = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now
      elapsed += dt
      const ease = (rate: number) => 1 - Math.exp(-rate * dt)
      const inEntrance = story && elapsed < ENTRANCE
      const e = elapsed // entrance time
      const t = story && !inEntrance ? (elapsed - ENTRANCE) % LOOP : -1 // loop time
      const crossed = (at: number) => t >= at && (prevT < at || prevT > t)

      // ---------------- Character (posed on twos during the fastest actions) ----------------
      const twos = (inEntrance && e < E_HAT) || (t >= WINDUP_END - 0.25 && t < DASH_END)
      stepAcc += dt
      if (!twos || stepAcc >= TWOS) {
        const cdt = Math.min(stepAcc, 0.1)
        stepAcc = 0
        let speed = 0, lift = 0, crouch = 0
        let leanTarget = 0, roll = 0
        let headingTarget: number
        let sx = 1, sy = 1, sz = 1 // extra rig squash & stretch
        let hatY = 0, hatX = 0, hatSpinY = 0, hatRollZ = 0, hatPitch = 0 // offsets on top of update()
        let reach = 0 // hat-tip arm stretch
        let winkK = 0

        if (turntable) {
          dragIdle += cdt
          // Auto-turn pauses while dragging and resumes gently afterwards
          if (!reduced) heading += 0.45 * cdt * smooth(dragIdle - 0.6)
          heading += dragYaw
          dragYaw = 0
          headingTarget = heading
          if (!reduced) winkK = window01(elapsed % 6.5, 4.6, 5.05, 0.08)
        } else if (reduced) {
          heading = headingTarget = Math.sin(elapsed * 0.4) * 0.6
        } else if (inEntrance) {
          headingTarget = e < E_SETTLE ? 0 : mouseX * 0.4
          if (e < E_LAND) {
            const u = clamp01((e - E_DROP) / (E_LAND - E_DROP))
            lift = FALL_HEIGHT * (1 - u * u)
            sy = 1.28
            sx = sz = 0.82
            hatY = HAT_FLOAT + (1 - u) * 1.5
          } else {
            const u = e - E_LAND
            // Big squash on landing that springs back with overshoot, then the hat "bonk"
            sy = (u < 0.09 ? 0.55 : 1 - wobble(u - 0.09, 0.45, 14, 5)) - wobble(e - E_HAT, 0.16, 22, 9)
            sx = sz = 1 / Math.sqrt(Math.max(0.3, sy))
            roll = Math.sin(u * 9) * 0.28 * Math.exp(-2.6 * u) * (e < E_TUG ? 1 : 0.4)
            leanTarget = 0.05
            // The hat falls like a leaf: swings side to side, then drops onto his head
            const h = clamp01(u / (E_HAT - E_LAND))
            hatY = e < E_HAT ? HAT_FLOAT * (1 - h * h) : wobble(e - E_HAT, -0.1, 25, 10)
            hatX = e < E_HAT ? Math.sin(h * 7) * 0.45 * (1 - h) : 0
            hatRollZ = e < E_HAT ? Math.sin(h * 7 + 1.2) * 0.5 * (1 - h) : 0
            hatSpinY = e < E_HAT ? h * 5 : 0
          }
        } else {
          if (t < WINDUP_END) {
            headingTarget = nearAngle(RUN_HEADING, heading)
            leanTarget = 0.3
            crouch = smooth(t / 0.25) * 0.8
            if (t > 0.45) speed = DASH_SPEED * 1.3 // legs spin in place before he takes off
          } else if (t < DASH_END) {
            const u = t - WINDUP_END
            speed = DASH_SPEED
            headingTarget = nearAngle(RUN_HEADING, heading)
            leanTarget = -0.18
            // Launch stretch along the run direction
            const st = wobble(u, 0.35, 14, 7)
            sz = 1 + st
            sy = sx = 1 / Math.sqrt(1 + st)
          } else if (t < SKID_END) {
            const u = t - DASH_END
            headingTarget = nearAngle(RUN_HEADING, heading)
            leanTarget = u < 0.35 ? 0.55 : 0
            crouch = window01(t, DASH_END, SKID_END, 0.08) * 0.7
          } else if (t < SWEEP_END) {
            headingTarget = nearAngle(SEARCH_HEADING, heading)
            leanTarget = -0.12
          } else if (t < TRACK_END) {
            speed = SNEAK_SPEED * smooth((t - SWEEP_END) / 0.4) * (1 - smooth((t - (TRACK_END - 0.35)) / 0.35))
            headingTarget = nearAngle(SEARCH_HEADING, heading)
            leanTarget = -0.1
            crouch = window01(t, SWEEP_END, TRACK_END, 0.4)
          } else if (t < PUZZLE_END) {
            headingTarget = nearAngle(SEARCH_HEADING, heading)
          } else if (t < EUREKA_END) {
            const u = (t - PUZZLE_END) / (EUREKA_END - PUZZLE_END)
            lift = 4 * HOP_HEIGHT * u * (1 - u)
            headingTarget = nearAngle(0.25, heading)
          } else {
            // Hat tip + wink, facing the camera and then following the cursor
            const g = t - EUREKA_END
            headingTarget = nearAngle(g < 0.6 ? 0 : mouseX * 0.55, heading)
            reach = backOut((g - 0.1) / 0.25) * (1 - smooth((g - (TIP_END - EUREKA_END - 0.3)) / 0.3))
            winkK = smooth((g - 0.42) / 0.07) * (1 - smooth((g - 1.6) / 0.09))
            roll = 0.07 * reach
            const tip = window01(g, 0.3, 0.75, 0.15)
            hatPitch = -0.12 * reach - 0.22 * tip
            hatRollZ = 0.16 * reach
            hatY = 0.12 * tip
          }
          // Slide forward in the skid; drift back to the center while he searches
          if (t >= DASH_END && t < SKID_END) {
            const u = clamp01((t - DASH_END) / 0.4)
            slidePos.copy(fwd).multiplyScalar(SLIDE * (1 - (1 - u) * (1 - u)))
          } else if (t >= SKID_END && t < TRACK_END) {
            slidePos.multiplyScalar(Math.exp(-2.5 * cdt))
          } else if (t < DASH_END) {
            // Wind-up: rock back a little against the run direction, snap to center on the launch
            slidePos.copy(fwd).multiplyScalar(t < WINDUP_END ? -0.6 * smooth(t / 0.3) : 0)
          } else {
            slidePos.multiplyScalar(Math.exp(-4 * cdt))
          }
        }

        // Springs: heading snaps with a little overshoot, lean wobbles
        // Fixed sub-steps keep the springs (ours and the model's) stable when posing on twos
        const steps = Math.max(1, Math.ceil(cdt * 60))
        const h = cdt / steps
        state.speed = speed
        state.accel = (speed - prevSpeed) / Math.max(cdt, 1e-3)
        prevSpeed = speed
        state.y = lift
        for (let i = 0; i < steps; i++) {
          headingV += ((headingTarget - heading) * 170 - headingV * 15) * h
          heading += headingV * h
          leanV += ((leanTarget - lean) * 150 - leanV * 11) * h
          lean += leanV * h
          // Feed the game model (heading goes to the rig, so the lean happens in his own frame)
          detective.update(state, h)
        }
        detective.setWink(winkK)
        rig.position.set(slidePos.x, 0, slidePos.z)
        rig.rotation.set(lean - crouch * 0.12, heading, roll)
        rig.scale.set(sx * (1 + crouch * 0.05), sy * (1 - crouch * 0.12), sz * (1 + crouch * 0.05))
        arms[0].scale.y = 1 + reach * 0.3
        hat.position.x = hatX
        hat.position.y += hatY
        hat.rotation.set(hat.rotation.x + hatPitch, hatSpinY, hatRollZ)

        // ---- Poses layered on top of the game animation ----
        const time = elapsed
        if (turntable) {
          // Confident pose: hand on the hip, magnifier raised beside the hat, chin up
          body.rotation.x = 0.03
          pose(head, 'x', 0.06, 1)
          pose(head, 'y', Math.sin(time * 0.7) * 0.15, 1)
          pose(arms[0], 'x', -0.2, 1)
          pose(arms[0], 'z', -0.6, 1)
          pose(arms[1], 'x', 2.5, 1)
          pose(arms[1], 'z', 0.45, 1)
        } else if (inEntrance) {
          if (e < E_LAND) {
            // Falling: arms up and flailing, legs apart, looking down in alarm
            pose(arms[0], 'x', 2.9 + Math.sin(time * 30) * 0.25, 1)
            pose(arms[0], 'z', -0.5, 1)
            pose(arms[1], 'x', 2.9 + Math.sin(time * 30 + 2) * 0.25, 1)
            pose(arms[1], 'z', 0.5, 1)
            pose(legs[0], 'x', 0.35, 1)
            pose(legs[1], 'x', -0.25, 1)
            pose(head, 'x', -0.3, 1)
          } else if (e < E_TUG) {
            // Wobbling: windmilling arms, dizzy head
            const u = e - E_LAND
            const k = Math.exp(-1.8 * u)
            pose(arms[0], 'x', Math.sin(time * 16) * 1.6 * k, 1)
            pose(arms[0], 'z', -1.1 * k - 0.15, 1)
            pose(arms[1], 'x', Math.sin(time * 16 + Math.PI) * 1.6 * k, 1)
            pose(arms[1], 'z', 1.1 * k + 0.15, 1)
            pose(legs[0], 'x', Math.sin(u * 9) * 0.3 * k, 1)
            pose(legs[1], 'x', -Math.sin(u * 9) * 0.3 * k, 1)
            pose(head, 'z', Math.sin(time * 11) * 0.25 * k, 1)
            pose(head, 'x', 0, 1)
            pose(head, 'y', 0, 1)
          } else {
            // Straightens his coat: grabs the lapels and tugs twice, chin up, then hands down
            const grab = window01(e, E_TUG, E_SETTLE + 0.2, 0.15)
            const tug = Math.max(0, Math.sin(((e - E_TUG - 0.2) / 0.5) * TAU)) * (e > E_TUG + 0.2 && e < E_TUG + 1.2 ? 1 : 0)
            pose(arms[0], 'x', 1.05 - tug * 0.45, grab)
            pose(arms[0], 'z', 0.55, grab)
            pose(arms[1], 'x', 1.05 - tug * 0.45, grab)
            pose(arms[1], 'z', -0.55, grab)
            body.position.y -= tug * 0.1
            body.scale.y *= 1 + tug * 0.12
            pose(body, 'x', 0.04, 1)
            const proud = window01(e, E_TUG + 0.8, ENTRANCE + 0.3, 0.2)
            pose(head, 'x', -0.12 * tug + 0.14 * proud, 1)
            pose(head, 'y', 0, 1)
            pose(head, 'z', 0, 1)
            pose(arms[0], 'x', 0, 1 - grab)
            pose(arms[0], 'z', -0.15, 1 - grab)
            pose(arms[1], 'x', 0.2, 1 - grab)
            pose(arms[1], 'z', 0.15, 1 - grab)
          }
        } else if (!reduced) {
          // Wind-up: arms swung back, front knee up, leaning back (released as the dash starts)
          const wind = window01(t, 0, WINDUP_END + 0.05, 0.12)
          pose(arms[0], 'x', -1.4, wind)
          pose(arms[1], 'x', -1.2, wind)
          pose(arms[0], 'z', -0.4, wind)
          pose(arms[1], 'z', 0.4, wind)
          if (t < 0.45) {
            pose(legs[0], 'x', 1.1, wind)
            pose(legs[1], 'x', -0.2, wind)
          }
          pose(head, 'x', 0.1, wind)
          // Dash: magnifier arm tucked a bit less so both arms pump
          // Skid: front heel digs in, back leg folds, arms thrown forward for balance, hat jumps
          const skid = window01(t, DASH_END, SKID_END, 0.06)
          pose(legs[0], 'x', 0.95, skid)
          pose(legs[1], 'x', -0.45, skid)
          pose(arms[0], 'x', 1.7, skid)
          pose(arms[0], 'z', -0.7, skid)
          pose(arms[1], 'x', 1.5, skid)
          pose(arms[1], 'z', 0.7, skid)
          pose(head, 'x', 0.2, skid)
          if (skid > 0) {
            hat.position.y += 0.25 * window01(t, DASH_END, DASH_END + 0.35, 0.08)
            hat.rotation.x -= 0.3 * window01(t, DASH_END, DASH_END + 0.4, 0.1)
          }
          // Sneaking along the prints: magnifier low and forward, small sweeps, deep stoop
          const sneak = window01(t, SWEEP_END, TRACK_END + 0.2, 0.35)
          pose(arms[1], 'x', 1.15 + Math.sin(time * 2.3) * 0.06, sneak)
          pose(arms[1], 'z', -0.1 + Math.sin(time * 2.6) * 0.2, sneak)
          pose(arms[0], 'x', -0.35, sneak)
          pose(arms[0], 'z', 0.25, sneak)
          pose(body, 'x', -0.22, sneak)
          pose(head, 'x', -0.12, sneak)
          pose(head, 'y', Math.sin(time * 2.6) * 0.25, sneak)
          // Puzzled: scratches his head with the free hand, head tilted
          const scratch = window01(t, TRACK_END, PUZZLE_END + 0.1, 0.15)
          pose(arms[0], 'x', 2.7 + Math.sin(time * 22) * 0.12, scratch)
          pose(arms[0], 'z', -0.55, scratch)
          pose(arms[1], 'x', 0.5, scratch)
          pose(arms[1], 'z', 0.15, scratch)
          pose(head, 'z', 0.22, scratch)
          pose(head, 'x', 0.05, scratch)
          pose(head, 'y', 0, scratch)
          pose(body, 'x', 0, scratch)
          // Eureka: magnifier up in the air, other arm out
          const eureka = window01(t, PUZZLE_END, EUREKA_END + 0.15, 0.1)
          pose(arms[1], 'x', 2.6, eureka)
          pose(arms[1], 'z', 0.3, eureka)
          pose(arms[0], 'x', 0.3, eureka)
          pose(arms[0], 'z', -0.7, eureka)
          pose(head, 'x', 0.12, eureka)
          pose(head, 'y', 0, eureka)
          pose(head, 'z', 0, eureka)
          pose(body, 'x', 0.06, eureka)
          // Hat tip: free hand on the brim, magnifier hand on the hip, head cocked, chin up
          const tipPose = window01(t, EUREKA_END, TIP_END + 0.15, 0.12)
          pose(arms[0], 'x', 2.75, Math.min(1, reach))
          pose(arms[0], 'z', -0.3, Math.min(1, reach))
          pose(arms[1], 'x', -0.25, tipPose)
          pose(arms[1], 'z', 0.65, tipPose)
          pose(head, 'z', 0.16 * reach, tipPose)
          pose(head, 'x', 0.08 - 0.08 * window01(t, EUREKA_END + 0.3, EUREKA_END + 0.75, 0.15), tipPose)
          pose(head, 'y', (mouseX * 0.3) * smooth((t - EUREKA_END - 0.6) / 0.4), tipPose)
          pose(body, 'x', 0.05, tipPose)
          // Relaxed stand before the next run
          const rest = window01(t, TIP_END, LOOP + 0.2, 0.2)
          pose(arms[0], 'x', 0, rest)
          pose(arms[0], 'z', -0.15, rest)
          pose(arms[1], 'x', 0.2, rest)
          pose(arms[1], 'z', 0.15, rest)
          pose(head, 'x', 0.05, rest)
          pose(body, 'x', 0, rest)
        }
      }

      // ---------------- Effects (every frame) ----------------
      const rx = rig.position.x, rz = rig.position.z
      // Landing: "POOF!" and a ring of puffs, plus a small camera shake
      if (inEntrance && e >= E_LAND && e - dt < E_LAND) {
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU
          spawnPuff(Math.cos(a) * 1.6, 0.6, Math.sin(a) * 1.2, Math.cos(a) * 9, 1 + Math.random() * 2, Math.sin(a) * 4, 2.6 + Math.random() * 0.8, 1.5)
        }
        shake = 1
      }
      // Hat bonk: two tiny puffs from the brim
      if (inEntrance && e >= E_HAT && e - dt < E_HAT) {
        head.getWorldPosition(tmp)
        spawnPuff(tmp.x + 2.6, tmp.y + 2.4, tmp.z - 1, 8, 2, 0, 1.6, 2.4)
        spawnPuff(tmp.x - 2.6, tmp.y + 2.4, tmp.z - 1, -8, 2, 0, 1.6, 2.4)
      }
      const poofK = inEntrance ? window01(e, E_LAND, E_LAND + 0.75, 0.08) : 0
      poof.visible = poofK > 0.01
      if (poof.visible) {
        const s = 6 * backOut((e - E_LAND) / 0.18) * (0.6 + 0.4 * poofK)
        poof.scale.set(s, s, 1)
        poof.position.set(-5.2, 3 + (e - E_LAND) * 1.5, -2)
        poof.material.rotation = 0.12
      }

      if (t >= 0) {
        // Dust kicked back from the feet: wheel-spin, dash
        const running = (t > 0.45 && t < DASH_END)
        if (running && Math.floor(t / 0.06) !== Math.floor(prevT / 0.06)) {
          spawnPuff(rx + -fwd.x * 1.2 + (Math.random() - 0.5), 0.5, rz + -fwd.z * 1.2 + (Math.random() - 0.5),
            -fwd.x * (7 + Math.random() * 4), 1.5 + Math.random() * 2, -fwd.z * 4, 1 + Math.random() * 0.7, 2.4)
        }
        // Speed streaks
        if (t > WINDUP_END && t < DASH_END - 0.05 && Math.floor(t / 0.045) !== Math.floor(prevT / 0.045)) {
          const st = streaks[streakNext]
          streakNext = (streakNext + 1) % STREAK_COUNT
          st.life = 1
          st.len = 3 + Math.random() * 4
          st.mesh.position.set(rx - fwd.x * (2.6 + Math.random() * 2), 1 + Math.random() * 8.5, rz + 1.5)
          st.mesh.visible = true
        }
        // Skid: "SKRRT!" and a spray of dust from the heel, thrown forward
        if (crossed(DASH_END)) {
          for (let i = 0; i < 7; i++) {
            spawnPuff(rx + fwd.x * 1.5, 0.4, rz + fwd.z * 1.5 - 0.5,
              fwd.x * (6 + Math.random() * 7), 1 + Math.random() * 3.5, fwd.z * 3 - Math.random() * 2, 1.3 + Math.random() * 0.9, 1.6)
          }
        }
        if (t > DASH_END && t < DASH_END + 0.4 && Math.floor(t / 0.07) !== Math.floor(prevT / 0.07)) {
          spawnPuff(rx + fwd.x * 1.4, 0.3, rz + fwd.z * 1.4 - 0.5, fwd.x * 4, 1.5, 0, 1 + Math.random() * 0.6, 2)
        }
      }
      const skrrtK = t >= 0 ? window01(t, DASH_END, DASH_END + 0.75, 0.08) : 0
      skrrt.visible = skrrtK > 0.01
      if (skrrt.visible) {
        const s = 6 * backOut((t - DASH_END) / 0.15) * (0.7 + 0.3 * skrrtK)
        skrrt.scale.set(s, s, 1)
        skrrt.position.set(rx * 0.5 - 2.4, 3.8 + Math.sin(elapsed * 40) * 0.08, -2)
        skrrt.material.rotation = -0.08 + Math.sin(elapsed * 33) * 0.04
      }

      for (const st of streaks) {
        if (st.life <= 0) continue
        st.life -= dt * 4.5
        st.mesh.position.addScaledVector(fwd, -45 * dt)
        const s = Math.max(0, st.life)
        st.mesh.scale.set(st.len * s, 1, 1)
        if (st.life <= 0) st.mesh.visible = false
      }
      for (const p of puffs) {
        if (p.life <= 0) continue
        p.life -= dt * p.rate
        p.sprite.position.addScaledVector(p.vel, dt)
        p.vel.multiplyScalar(1 - 4 * dt)
        const s = Math.max(0, p.life)
        p.sprite.scale.setScalar(p.size * Math.sqrt(s) * (1.6 - 0.6 * s))
        if (p.life <= 0) p.sprite.visible = false
      }

      // Footprints: pop up one by one ahead, slide under him, shrink away behind
      const showPrints = t >= 0 && t > SWEEP_END - 0.8 && t < PUZZLE_END
      trail.visible = showPrints
      if (showPrints) {
        trail.position.x = rx
        trail.position.z = rz
        const scroll = Math.max(0, t - SWEEP_END) * PRINT_SCROLL
        const fadeAll = 1 - smooth((t - TRACK_END) / 0.6)
        for (const [k, m] of prints.entries()) {
          const z = -2.6 - k * PRINT_SPACING + scroll // local -Z is in front of him
          const born = backOut((t - (SWEEP_END - 0.8 + k * 0.12)) / 0.2)
          const behind = 1 - smooth((z - 0.5) / 1.2)
          const s = Math.max(0, born * behind * fadeAll)
          m.visible = s > 0.01
          m.position.set((k % 2 ? 1 : -1) * 0.6, 0, z)
          m.scale.setScalar(s * 1.25)
        }
      }

      // Clue pops above his head
      head.getWorldPosition(tmp)
      const questionK = t >= 0 ? window01(t, TRACK_END + 0.05, PUZZLE_END + 0.05, 0.1) : 0
      const exclaimK = t >= 0 ? window01(t, PUZZLE_END, EUREKA_END + 0.25, 0.1) : 0
      question.visible = questionK > 0.01
      if (question.visible) {
        const s = 3.8 * backOut(questionK)
        question.scale.set(s, s, 1)
        question.position.set(tmp.x - 2.2, tmp.y + 5 + Math.sin(elapsed * 5) * 0.15, tmp.z)
      }
      exclaim.visible = exclaimK > 0.01
      if (exclaim.visible) {
        const s = 3.6 * backOut(exclaimK) * (1 + Math.sin(elapsed * 14) * 0.04)
        exclaim.scale.set(s, s, 1)
        exclaim.position.set(tmp.x + 2.2, tmp.y + 5, tmp.z)
        exclaim.material.rotation = Math.sin(elapsed * 9) * 0.08
      }
      // Wink "ding": sparkle next to the winking eye (his right eye, screen left)
      const ding = t >= 0 ? t - (EUREKA_END + 0.47) : -1
      sparkle.visible = ding > 0 && ding < 0.75
      if (sparkle.visible) {
        head.localToWorld(tmp.set(0.2, 0.62, -0.5))
        const s = 2.2 * backOut(ding / 0.15) * (1 - smooth((ding - 0.45) / 0.3))
        sparkle.scale.set(s, s, 1)
        sparkle.position.set(tmp.x + 1.5, tmp.y + 1.1, tmp.z - 1.5)
        sparkle.material.rotation = ding * 2.5
      }

      // Floor shadow: follows him, small while he is high in the air
      const air = clamp01(state.y / 10)
      shadow.position.x = rx
      shadow.position.z = rz
      shadow.scale.setScalar(0.35 + 0.65 * (1 - air) - Math.min(0.25, state.y / HOP_HEIGHT * 0.1))
      shadowMat.opacity = 0.28 * (1 - air * 0.6) * (inEntrance && e < E_DROP ? smooth(e / E_DROP) : 1)

      // Glow: gentle pulse, a flash on the clue and on the wink
      const flashAt = (at: number) => {
        const d = t - at
        return d >= 0 && d < 0.6 ? 1 - d / 0.6 : 0
      }
      const flash = t >= 0 ? Math.max(flashAt(PUZZLE_END), flashAt(EUREKA_END + 0.47) * 0.7) : 0
      const glowSize = 15 + Math.sin(elapsed * 3) * 0.8 + flash * 6
      glow.position.x = rx * 0.5
      glow.scale.set(glowSize, glowSize, 1)
      glowMat.opacity = 0.55 + flash * 0.35

      // Camera: higher while he studies the floor (so the prints read), push-in for the wink,
      // slow sway the rest of the time, small shake on the landing
      const study = t >= 0 ? window01(t, SKID_END, PUZZLE_END, 0.8) : 0
      const close = t >= 0 ? window01(t, EUREKA_END + 0.05, TIP_END - 0.1, 0.45) : 0
      const sway = story ? Math.sin(elapsed * 0.5) * 3 * (1 - close) : 0
      shake = Math.max(0, shake - dt * 4)
      const wantPos = tmp.set(sway, 9 + study * 1.2 - close * 1.2, (-30 + close * 10) * fit)
      camPos.lerp(wantPos, ease(3))
      camTarget.y += (CENTER_Y + 1.6 - study * 0.8 + close * 1.6 - camTarget.y) * ease(3)
      camera.position.copy(camPos)
      if (shake > 0) camera.position.y += Math.sin(elapsed * 70) * shake * shake * 0.6
      camera.lookAt(camTarget)

      prevT = t
      renderer.render(scene, camera)
    }
    renderer.setAnimationLoop(animate)

    return () => {
      renderer.setAnimationLoop(null)
      window.removeEventListener('pointermove', onPointer)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      observer.disconnect()
      detective.dispose()
      detectiveRef.current = null
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
      canvas.remove()
    }
  }, [mode])

  return <div ref={ref} className="detective-showcase" style={{ width: '100%', height: '100%' }} />
}
