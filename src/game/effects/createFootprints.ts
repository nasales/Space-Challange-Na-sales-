// Huellas del detective en el suelo:
// - En cada pisada, una suela de zapato (puntera + tacón) orientada hacia donde corre,
//   alternando pie izquierdo y derecho.
// - Al frenar en seco, los dos pies dejan dos franjas de derrape (como en los dibujos animados).
// Hay un cupo fijo de cada tipo (las más viejas se reciclan) y se dibujan con InstancedMesh.
import * as THREE from 'three'
import type { CarState } from '../car/carPhysics'
import { DETECTIVE_SCALE } from '../detective/detectiveSize'
import { createStepCounter, footPosition } from './feet'

const PRINTS = 400
const SLIDES = 300
const LIFT = 0.06 // separación del suelo para que no parpadee con el terreno
const PRINT_SIZE = 0.55 * DETECTIVE_SCALE
const SLIDE_WIDTH = 0.28 * DETECTIVE_SCALE

/** Suela de zapato plana: puntera ovalada y tacón, con la punta hacia -Z (delante). */
function shoeSoleGeometry() {
  const toe = new THREE.Shape()
  toe.absellipse(0, 0.22, 0.3, 0.42, 0, Math.PI * 2, false, 0)
  const heel = new THREE.Shape()
  heel.absellipse(0, -0.5, 0.24, 0.22, 0, Math.PI * 2, false, 0)
  const geo = new THREE.ShapeGeometry([toe, heel], 10)
  geo.rotateX(-Math.PI / 2) // tumbada: el eje Y del dibujo pasa a ser -Z (hacia delante)
  return geo
}

const markMaterial = () =>
  new THREE.MeshBasicMaterial({
    color: 0x4a2f22,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    polygonOffset: true, // se dibuja "encima" del suelo aunque estén a la misma altura
    polygonOffsetFactor: -2,
  })

export function createFootprints() {
  const printGeo = shoeSoleGeometry()
  const slideGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  const printMat = markMaterial()
  const slideMat = markMaterial()
  const prints = new THREE.InstancedMesh(printGeo, printMat, PRINTS)
  const slides = new THREE.InstancedMesh(slideGeo, slideMat, SLIDES)
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
  for (const im of [prints, slides]) {
    im.frustumCulled = false
    im.renderOrder = 1
    for (let i = 0; i < im.count; i++) im.setMatrixAt(i, hidden)
  }
  const group = new THREE.Group()
  group.add(prints, slides)

  const stepped = createStepCounter()
  let nextPrint = 0, nextSlide = 0
  /** Última posición de cada pie mientras derrapa (null = no estaba derrapando). */
  let lastSlide: { x: number; y: number; z: number }[] | null = null
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const scl = new THREE.Vector3()

  const update = (s: CarState, heightAt: (x: number, z: number) => number, stridePhase: number) => {
    const speed = Math.abs(s.speed)

    // ---- Una huella por pisada ----
    const foot = stepped(stridePhase)
    if (foot !== null && speed > 1) {
      const f = footPosition(s, foot)
      pos.set(f.x, heightAt(f.x, f.z) + LIFT, f.z)
      q.setFromAxisAngle(up, s.heading + (s.speed < 0 ? Math.PI : 0))
      scl.setScalar(PRINT_SIZE)
      m.compose(pos, q, scl)
      prints.setMatrixAt(nextPrint, m)
      nextPrint = (nextPrint + 1) % PRINTS
      prints.instanceMatrix.needsUpdate = true
    }

    // ---- Franjas de derrape al frenar en seco ----
    if (!(s.accel < -30 && speed > 8)) {
      lastSlide = null
      return
    }
    const now = ([-1, 1] as const).map((side) => {
      const f = footPosition(s, side)
      return { x: f.x, y: heightAt(f.x, f.z) + LIFT, z: f.z }
    })
    if (!lastSlide) {
      lastSlide = now
      return
    }
    for (let i = 0; i < 2; i++) {
      const a = lastSlide[i], b = now[i]
      const dx = b.x - a.x, dz = b.z - a.z
      const len = Math.hypot(dx, dz)
      if (len < 0.5) continue // esperamos a que el pie avance un poco
      pos.set((a.x + b.x) / 2, Math.max(a.y, b.y), (a.z + b.z) / 2)
      q.setFromAxisAngle(up, Math.atan2(dx, dz))
      scl.set(SLIDE_WIDTH, 1, len)
      m.compose(pos, q, scl)
      slides.setMatrixAt(nextSlide, m)
      nextSlide = (nextSlide + 1) % SLIDES
      lastSlide[i] = b
    }
    slides.instanceMatrix.needsUpdate = true
  }

  return {
    group,
    update,
    dispose: () => {
      printGeo.dispose()
      slideGeo.dispose()
      printMat.dispose()
      slideMat.dispose()
    },
  }
}
