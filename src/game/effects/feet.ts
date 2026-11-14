// Pies del detective: dónde están en el mundo y cuándo pisa cada uno.
// Lo usan el polvo (una nubecita por pisada) y las huellas.
import type { CarState } from '../car/carPhysics'
import { DETECTIVE_SCALE } from '../detective/detectiveSize'

/** Separación de cada pie respecto al centro del cuerpo (unidades del mundo). */
const SIDE = 0.2 * DETECTIVE_SCALE

/** Posición en el mundo del pie izquierdo (-1) o derecho (+1). */
export function footPosition(s: CarState, side: -1 | 1) {
  const cos = Math.cos(s.heading), sin = Math.sin(s.heading)
  const lx = side * SIDE // a la derecha del cuerpo, girado según hacia dónde mira
  return { x: s.x + lx * cos, z: s.z - lx * sin }
}

/**
 * Detecta las pisadas a partir de la fase de la zancada: cada vez que la fase cruza un múltiplo
 * de π, un pie toca el suelo (alternando izquierdo y derecho). Devuelve qué pie ha pisado, o null.
 */
export function createStepCounter() {
  let last: number | null = null
  return (phase: number): -1 | 1 | null => {
    const step = Math.floor(phase / Math.PI)
    const changed = last !== null && step !== last
    last = step
    if (!changed) return null
    return step % 2 === 0 ? 1 : -1
  }
}
