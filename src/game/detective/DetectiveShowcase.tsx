// Detective "showcase" for the main menu: the in-game detective on its own small transparent
// three.js canvas, looping a flashy "hero" choreography so it is the first thing you notice.
// It reuses createDetective() unchanged and drives it with a fake CarState, so the run cycle,
// scarf, hat spring, magnifier sweep and squash & stretch all come from the game model itself.
//
// Loop (LOOP seconds):
//   1. Turbo sprint on a turntable, with speed lines and dust puffs
//   2. Twisting backflip jump, star burst at the top, elastic landing + shockwave
//   3. Hero pose facing the camera: magnifier sweep, golden glow, orbiting clue stars,
//      and he turns to follow the mouse cursor
//   4. Back into the sprint
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createDetective } from './createDetective'
import { TUNING, type CarState } from '../car/carPhysics'

const LOOP = 9 // s
const SPRINT_END = 3
const JUMP_END = 4.3
const POSE_END = 8.3
const JUMP_HEIGHT = 9
const CENTER_Y = 4.6 // roughly the detective's belly height (model is ~9 units tall)
const TURNTABLE_SPEED = 1.5 // rad/s while sprinting
const GOLD = 0xf2c14e
const STAR_COUNT = 16
const ORBIT_COUNT = 6
const STREAK_COUNT = 14
const DUST_COUNT = 14

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}
const TAU = Math.PI * 2

/** Flat five-point star, used for sparkles. */
function starGeometry(r: number) {
  const shape = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr
    if (i) shape.lineTo(x, y)
    else shape.moveTo(x, y)
  }
  return new THREE.ShapeGeometry(shape)
}

/** Soft radial glow texture (gold center fading to transparent). */
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255, 236, 160, 1)')
  grad.addColorStop(0.35, 'rgba(242, 193, 78, 0.55)')
  grad.addColorStop(1, 'rgba(242, 193, 78, 0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function DetectiveShowcase() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 500)
    const resize = () => {
      const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight)
      renderer.setSize(w, h)
      camera.aspect = w / h
      // Keep the whole jump in frame on tall/narrow containers
      camera.fov = w / h < 0.8 ? 48 : 35
      camera.updateProjectionMatrix()
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

    // Detective inside a "flip" pivot at belly height, so the backflip turns around its center
    const detective = createDetective()
    const flip = new THREE.Group()
    flip.position.y = CENTER_Y
    scene.add(flip)
    flip.add(detective.root)

    // Golden glow behind him (always there, flashes on landing)
    const glowTex = keep(glowTexture())
    const glowMat = keep(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
    const glow = new THREE.Sprite(glowMat)
    glow.position.set(0, CENTER_Y, 6)
    scene.add(glow)

    // Soft shadow on the floor that shrinks while he is in the air
    const shadowMat = keep(new THREE.MeshBasicMaterial({ color: 0x1c1a23, transparent: true, opacity: 0.28, depthWrite: false }))
    const shadow = new THREE.Mesh(keep(new THREE.CircleGeometry(3.2, 32).rotateX(-Math.PI / 2)), shadowMat)
    shadow.position.y = 0.02
    scene.add(shadow)

    // Landing shockwave ring
    const ringMat = keep(new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, depthWrite: false, side: THREE.DoubleSide }))
    const ring = new THREE.Mesh(keep(new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2)), ringMat)
    ring.position.y = 0.05
    scene.add(ring)

    // Star burst at the top of the jump
    const starGeo = keep(starGeometry(0.7))
    const starMat = keep(new THREE.MeshBasicMaterial({ color: GOLD, side: THREE.DoubleSide }))
    const stars = Array.from({ length: STAR_COUNT }, () => {
      const m = new THREE.Mesh(starGeo, starMat)
      m.visible = false
      scene.add(m)
      return { mesh: m, vel: new THREE.Vector3(), life: 0, spin: 0 }
    })
    const burst = (at: THREE.Vector3) => {
      for (const [i, s] of stars.entries()) {
        const a = (i / STAR_COUNT) * TAU
        const up = 0.4 + Math.random() * 0.8
        s.vel.set(Math.cos(a) * 14, up * 10, Math.sin(a) * 14)
        s.mesh.position.copy(at)
        s.life = 1
        s.spin = (Math.random() - 0.5) * 12
        s.mesh.visible = true
      }
    }

    // Clue stars orbiting during the hero pose
    const orbitGeo = keep(starGeometry(0.5))
    const orbitMat = keep(new THREE.MeshBasicMaterial({ color: 0xfff1c2, side: THREE.DoubleSide }))
    const orbiters = Array.from({ length: ORBIT_COUNT }, () => {
      const m = new THREE.Mesh(orbitGeo, orbitMat)
      scene.add(m)
      return m
    })

    // Speed lines rushing backwards while he sprints (group turns with him)
    const streakGroup = new THREE.Group()
    scene.add(streakGroup)
    const streakMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }))
    const streakGeo = keep(new THREE.BoxGeometry(0.09, 0.09, 7))
    const streaks = Array.from({ length: STREAK_COUNT }, () => {
      const m = new THREE.Mesh(streakGeo, streakMat)
      const side = Math.random() < 0.5 ? -1 : 1
      m.position.set(side * (2.2 + Math.random() * 3.5), 0.8 + Math.random() * 9, Math.random() * 40 - 12)
      streakGroup.add(m)
      return { mesh: m, speed: 45 + Math.random() * 35 }
    })

    // Dust puffs kicked up from the feet
    const dustGeo = keep(new THREE.IcosahedronGeometry(0.6, 1))
    const dustMat = keep(new THREE.MeshLambertMaterial({ color: 0xf3e2c3 }))
    const dust = Array.from({ length: DUST_COUNT }, () => {
      const m = new THREE.Mesh(dustGeo, dustMat)
      m.visible = false
      scene.add(m)
      return { mesh: m, vel: new THREE.Vector3(), life: 0 }
    })
    let dustTimer = 0
    let dustNext = 0

    // Mouse: the detective turns to look at the cursor during the hero pose
    let mouseX = 0
    const onPointer = (e: PointerEvent) => {
      const r = container.getBoundingClientRect()
      mouseX = Math.max(-1, Math.min(1, ((e.clientX - (r.left + r.width / 2)) / window.innerWidth) * 2.5))
    }
    window.addEventListener('pointermove', onPointer)

    const state: CarState = { x: 0, y: 0, z: 0, heading: 0, speed: 0, steer: 0, yawRate: 0, accel: 0, pitch: 0, roll: 0 }
    let lastTime = performance.now()
    let elapsed = 0
    let lastCycle = -1
    let sprintAngle = 0
    let jumpFrom = 0, jumpTo = TAU
    let lookYaw = 0
    let burstDone = false
    let landT = -10 // time of the last landing (for flash and shockwave)
    let prevSpeed = 0
    const camPos = new THREE.Vector3(0, 7, -30)
    const camTarget = new THREE.Vector3(0, CENTER_Y, 0)
    const tmp = new THREE.Vector3()

    const animate = () => {
      const now = performance.now()
      const dt = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now
      elapsed += dt
      const cycle = Math.floor(elapsed / LOOP)
      const t = elapsed - cycle * LOOP
      if (cycle !== lastCycle) {
        lastCycle = cycle
        burstDone = false
        sprintAngle = lookYaw // start the turntable where the pose left him
      }

      let speed = 0, jumpY = 0, flipX = 0, heading: number
      let sprintK = 0 // 0..1: how much "sprint effects" are visible
      let poseK = 0 // 0..1: how much "hero pose effects" are visible

      if (reduced) {
        heading = Math.sin(elapsed * 0.4) * 0.6
      } else if (t < SPRINT_END) {
        speed = TUNING.turboSpeed * smooth(t / 0.4)
        sprintAngle += TURNTABLE_SPEED * dt
        heading = sprintAngle
        sprintK = smooth(t / 0.4)
        // Plan the twisting backflip: land facing the camera after one extra full turn
        jumpFrom = sprintAngle
        jumpTo = Math.ceil(sprintAngle / TAU) * TAU + TAU
      } else if (t < JUMP_END) {
        const u = (t - SPRINT_END) / (JUMP_END - SPRINT_END)
        speed = 6 // legs keep kicking a little in the air (and no magnifier yet)
        jumpY = 4 * JUMP_HEIGHT * u * (1 - u)
        const e = smooth(u)
        heading = jumpFrom + (jumpTo - jumpFrom) * e
        flipX = -TAU * smooth((u - 0.1) / 0.75) // backflip
        sprintK = 1 - smooth(u / 0.3)
        if (!burstDone && u > 0.5) {
          burstDone = true
          burst(tmp.set(0, jumpY + CENTER_Y, 0))
        }
      } else if (t < POSE_END) {
        if (t - dt < JUMP_END) landT = elapsed
        lookYaw += (mouseX * 0.7 - lookYaw) * (1 - Math.exp(-4 * dt))
        heading = lookYaw
        poseK = smooth((t - JUMP_END) / 0.5) * (1 - smooth((t - (POSE_END - 0.4)) / 0.4))
      } else {
        const u = (t - POSE_END) / (LOOP - POSE_END)
        speed = TUNING.turboSpeed * smooth(u) * 0.6
        sprintAngle += TURNTABLE_SPEED * smooth(u) * dt
        heading = sprintAngle
        sprintK = smooth(u)
      }

      // Feed the game model
      state.speed = speed
      state.accel = (speed - prevSpeed) / Math.max(dt, 1e-3)
      prevSpeed = speed
      state.y = jumpY
      state.heading = heading
      detective.update(state, dt)
      // The jump moves the flip pivot (not the root), so the backflip spins around his belly in the air.
      // update() puts the root at (x, y, z); move it down so the pivot sits at belly height
      flip.position.y = CENTER_Y + jumpY
      flip.rotation.x = flipX
      detective.root.position.y = -CENTER_Y

      // Floor shadow
      const air = Math.min(1, jumpY / JUMP_HEIGHT)
      shadow.scale.setScalar(1 - air * 0.55)
      shadowMat.opacity = 0.28 * (1 - air * 0.6)

      // Glow: gentle pulse, big flash on landing, brighter in the pose
      const sinceLand = elapsed - landT
      const flash = sinceLand >= 0 && sinceLand < 0.6 ? 1 - sinceLand / 0.6 : 0
      const glowSize = 15 + Math.sin(elapsed * 3) * 0.8 + poseK * 3 + flash * 10
      glow.scale.set(glowSize, glowSize, 1)
      glowMat.opacity = 0.55 + poseK * 0.25 + flash * 0.4
      glow.position.y = CENTER_Y + jumpY * 0.6

      // Shockwave
      if (sinceLand >= 0 && sinceLand < 0.7) {
        const k = sinceLand / 0.7
        ring.visible = true
        ring.scale.setScalar(2 + k * 14)
        ringMat.opacity = 0.9 * (1 - k)
      } else ring.visible = false

      // Star burst particles
      for (const s of stars) {
        if (s.life <= 0) continue
        s.life -= dt * 1.1
        s.vel.y -= 22 * dt
        s.mesh.position.addScaledVector(s.vel, dt)
        s.mesh.lookAt(camera.position)
        s.mesh.rotateZ(elapsed * s.spin)
        s.mesh.scale.setScalar(Math.max(0, s.life) * 1.3)
        if (s.life <= 0) s.mesh.visible = false
      }

      // Orbiting clue stars
      for (const [i, m] of orbiters.entries()) {
        const a = elapsed * 1.6 + (i / ORBIT_COUNT) * TAU
        m.visible = poseK > 0.01
        m.position.set(Math.cos(a) * 6.5, CENTER_Y + 1.5 + Math.sin(a * 2 + i) * 1.6, Math.sin(a) * 6.5)
        m.lookAt(camera.position)
        m.rotateZ(elapsed * 3 + i)
        m.scale.setScalar(poseK * (0.8 + Math.sin(elapsed * 6 + i) * 0.25))
      }

      // Speed lines
      streakGroup.rotation.y = heading
      streakGroup.visible = sprintK > 0.01
      streakMat.opacity = 0.75 * sprintK
      for (const s of streaks) {
        s.mesh.position.z += s.speed * dt
        if (s.mesh.position.z > 28) s.mesh.position.z -= 40
      }

      // Dust puffs behind the feet while sprinting
      dustTimer += dt
      if (sprintK > 0.5 && jumpY < 0.1 && dustTimer > 0.07) {
        dustTimer = 0
        const d = dust[dustNext]
        dustNext = (dustNext + 1) % DUST_COUNT
        const back = tmp.set(Math.sin(heading), 0, Math.cos(heading))
        d.mesh.position.set(back.x * 1.2 + (Math.random() - 0.5) * 1.5, 0.4, back.z * 1.2 + (Math.random() - 0.5) * 1.5)
        d.vel.copy(back).multiplyScalar(10 + Math.random() * 6)
        d.vel.y = 2 + Math.random() * 2
        d.life = 1
        d.mesh.visible = true
      }
      for (const d of dust) {
        if (d.life <= 0) continue
        d.life -= dt * 2
        d.mesh.position.addScaledVector(d.vel, dt)
        d.vel.multiplyScalar(1 - 3 * dt)
        const s = Math.max(0, d.life)
        d.mesh.scale.setScalar(s * (2 - s) * 1.4)
        if (d.life <= 0) d.mesh.visible = false
      }

      // Camera: slow orbit sway, rises with the jump, pushes in for the pose
      const sway = Math.sin(elapsed * 0.5) * 4
      const wantPos = tmp.set(sway, 7 + jumpY * 0.45 - poseK * 1.2, -30 + poseK * 3.5 - air * 3)
      camPos.lerp(wantPos, 1 - Math.exp(-3 * dt))
      camTarget.y += (CENTER_Y + jumpY * 0.55 - camTarget.y) * (1 - Math.exp(-5 * dt))
      camera.position.copy(camPos)
      camera.lookAt(camTarget)

      renderer.render(scene, camera)
    }
    renderer.setAnimationLoop(animate)

    return () => {
      renderer.setAnimationLoop(null)
      window.removeEventListener('pointermove', onPointer)
      observer.disconnect()
      detective.dispose()
      disposables.forEach((d) => d.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={ref} className="detective-showcase" style={{ width: '100%', height: '100%' }} />
}
