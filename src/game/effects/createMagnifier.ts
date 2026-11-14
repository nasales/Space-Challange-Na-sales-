// Círculo de lupa en el suelo: aparece cuando el detective se para a investigar.
// Aro dorado con borde de tinta, cristal brillante con un reflejo y una onda tipo "radar" que
// se expande cada poco, como si estuviera escaneando la zona. Sigue a la lupa de la mano
// (un poco por delante) y sale con un "pop" elástico; al echar a correr, se encoge y desaparece.
import * as THREE from 'three'

const RADIUS = 3.6 // radio del círculo (unidades del mundo)
const LEAD = 6 // cuánto por delante de la lupa se proyecta
const SIDE = 4 // y hacia la derecha (la lupa va en la mano derecha): así el cuerpo no lo tapa desde atrás
const LIFT = 0.1 // separación del suelo
const PULSE_EVERY = 1.3 // s entre ondas de "radar"
const GOLD = 0xf2c14e
const INK = 0x1a1423

const flatMaterial = (color: number, opacity = 1) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: false,
    polygonOffset: true, // encima del suelo aunque estén a la misma altura
    polygonOffsetFactor: -4,
  })

/** Anillo plano tumbado en el suelo (de radio r1 a r2; opcionalmente solo un arco). */
const flatRing = (r1: number, r2: number, start = 0, length = Math.PI * 2) =>
  new THREE.RingGeometry(r1, r2, 48, 1, start, length).rotateX(-Math.PI / 2)

/** Curva de "pop": se pasa un poco del tamaño final y vuelve (como un muelle). */
const easeOutBack = (t: number) => {
  const c = 1.7
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}

export function createMagnifier() {
  const R = RADIUS
  const parts: [THREE.BufferGeometry, THREE.MeshBasicMaterial][] = [
    [new THREE.CircleGeometry(R, 48).rotateX(-Math.PI / 2), flatMaterial(0xffffff, 0.3)], // cristal
    [flatRing(R * 0.55, R * 0.7, 2.1, 0.9), flatMaterial(0xffffff, 0.85)], // reflejo
    [flatRing(R * 0.93, R * 1.12), flatMaterial(GOLD)], // aro dorado
    [flatRing(R * 0.88, R * 0.94), flatMaterial(INK)], // tinta por dentro
    [flatRing(R * 1.11, R * 1.18), flatMaterial(INK)], // tinta por fuera
  ]
  const group = new THREE.Group()
  for (const [geo, mat] of parts) {
    const m = new THREE.Mesh(geo, mat)
    m.renderOrder = 2
    group.add(m)
  }
  // Onda de "radar" que se expande y se desvanece
  const pulseMat = flatMaterial(0xffffff, 0.6)
  const pulseGeo = flatRing(R * 0.96, R * 1.04)
  const pulse = new THREE.Mesh(pulseGeo, pulseMat)
  pulse.renderOrder = 2
  group.add(pulse)
  group.visible = false
  let time = 0

  /**
   * @param inspect 0..1 cuánto está investigando el detective
   * @param lens posición de la lupa de la mano; heading: hacia dónde mira el detective
   */
  const update = (inspect: number, lens: THREE.Vector3, heading: number, heightAt: (x: number, z: number) => number, dt: number) => {
    group.visible = inspect > 0.02
    if (!group.visible) return
    time += dt
    const x = lens.x - Math.sin(heading) * LEAD + Math.cos(heading) * SIDE
    const z = lens.z - Math.cos(heading) * LEAD - Math.sin(heading) * SIDE
    group.position.set(x, heightAt(x, z) + LIFT, z)
    group.rotation.y = heading + time * 0.6 // el reflejo gira despacio
    group.scale.setScalar(Math.max(0.001, easeOutBack(inspect)))
    const t = (time % PULSE_EVERY) / PULSE_EVERY
    pulse.scale.setScalar(1 + t * 0.8)
    pulseMat.opacity = 0.6 * (1 - t)
  }

  return {
    group,
    update,
    dispose: () => {
      for (const [geo, mat] of parts) {
        geo.dispose()
        mat.dispose()
      }
      pulseGeo.dispose()
      pulseMat.dispose()
    },
  }
}
