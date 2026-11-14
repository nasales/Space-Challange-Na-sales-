// Nubecitas de polvo estilo cartoon en los pies del detective.
// - En cada pisada sale una nubecita (más grandes y más numerosas al esprintar).
// - Al frenar en seco o girar muy rápido, ráfaga continua: como un personaje de dibujos que derrapa.
// Cada nube nace pequeña, se hincha, sube un poco y se encoge hasta desaparecer. Hay un número
// fijo de nubes que se reutilizan (sin crear basura) y se dibujan todas con una InstancedMesh.
import * as THREE from 'three'
import { TUNING, type CarState } from '../car/carPhysics'
import { toonMaterial } from '../scene/toonGradient'
import { createStepCounter, footPosition } from './feet'

const COUNT = 140
const LIFE = 0.7 // s que dura cada nube
const SIZE = 1.05 // radio de una nube normal (unidades)
const COLOR = 0xfff1d6

interface Puff {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  age: number
  size: number
}

export function createDust() {
  const geometry = new THREE.IcosahedronGeometry(1, 1)
  const material = toonMaterial(COLOR)
  const mesh = new THREE.InstancedMesh(geometry, material, COUNT)
  mesh.frustumCulled = false // las nubes se mueven por todo el mapa
  const puffs: Puff[] = Array.from({ length: COUNT }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: LIFE, size: 0 }))
  let next = 0
  let pending = 0 // nubes "a medias" de la ráfaga de derrape (ritmo independiente de los FPS)
  const stepped = createStepCounter()
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const pos = new THREE.Vector3()
  const scl = new THREE.Vector3()

  /** Suelta una nube en (x, y, z), saliendo hacia atrás y hacia arriba. */
  const emit = (x: number, y: number, z: number, s: CarState, size: number) => {
    const p = puffs[next]
    next = (next + 1) % COUNT
    const back = -Math.sign(s.speed || 1)
    const fx = -Math.sin(s.heading), fz = -Math.cos(s.heading)
    p.x = x + (Math.random() - 0.5) * 0.6
    p.y = y + 0.2
    p.z = z + (Math.random() - 0.5) * 0.6
    p.vx = fx * back * 2.5 + (Math.random() - 0.5) * 2
    p.vy = 1 + Math.random() * 1.5
    p.vz = fz * back * 2.5 + (Math.random() - 0.5) * 2
    p.age = 0
    p.size = size * (0.7 + Math.random() * 0.6)
  }

  const update = (s: CarState, heightAt: (x: number, z: number) => number, stridePhase: number, dt: number) => {
    const speed = Math.abs(s.speed)
    const sprint = Math.max(0, Math.min(1, (speed - TUNING.maxSpeed) / (TUNING.turboSpeed - TUNING.maxSpeed)))

    // Una nubecita en cada pisada (dos o tres al esprintar)
    const foot = stepped(stridePhase)
    if (foot !== null && speed > 3) {
      const f = footPosition(s, foot)
      const y = heightAt(f.x, f.z)
      const n = 1 + Math.round(sprint * 2)
      for (let i = 0; i < n; i++) emit(f.x, y, f.z, s, SIZE * (0.8 + sprint * 0.9))
    }

    // Derrape: frenazo en seco o curva cerrada a toda velocidad → ráfaga en los dos pies
    const sliding = (s.accel < -30 && speed > 8) || (Math.abs(s.speed * s.yawRate) > 45 && speed > 20)
    if (sliding) {
      pending += 30 * dt
      while (pending >= 1) {
        pending -= 1
        const f = footPosition(s, Math.random() < 0.5 ? -1 : 1)
        emit(f.x, heightAt(f.x, f.z), f.z, s, SIZE * 1.1)
      }
    } else {
      pending = 0
    }

    for (let i = 0; i < COUNT; i++) {
      const p = puffs[i]
      if (p.age < LIFE) {
        p.age += dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt
        p.vx *= 1 - 3 * dt // el aire frena la nube
        p.vz *= 1 - 3 * dt
      }
      const t = Math.min(1, p.age / LIFE)
      // Crece rápido y se encoge despacio (forma de "pop" cartoon)
      const k = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75
      const r = p.size * Math.max(0, k)
      pos.set(p.x, p.y, p.z)
      scl.set(r, r, r)
      m.compose(pos, q, scl)
      mesh.setMatrixAt(i, m)
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  return {
    mesh,
    update,
    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  }
}
