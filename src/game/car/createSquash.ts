// Rebote elástico de la carrocería (squash & stretch, como en los dibujos animados).
// Un muelle que se aplasta cuando el coche cae de un escalón o cambia de golpe de velocidad,
// y luego oscila unas cuantas veces hasta volver a su forma.
import type { CarState } from './carPhysics'

const STIFFNESS = 170 // fuerza del muelle (más = rebota más rápido)
const DAMPING = 8 // freno del muelle (menos = rebota más veces)
const FROM_VERTICAL = 0.0035 // cuánto aplasta un cambio brusco de velocidad vertical
const FROM_ACCEL = 0.0012 // cuánto aplasta un acelerón o frenazo
const MAX = 0.28

export function createSquash() {
  let value = 0 // > 0 aplastado, < 0 estirado
  let velocity = 0
  let lastY: number | null = null
  let lastVy = 0
  let lastAccel = 0

  /** Devuelve el aplastamiento actual (0 = forma normal). */
  const update = (s: CarState, dt: number) => {
    if (!(dt > 0)) return value
    const vy = lastY === null ? 0 : (s.y - lastY) / dt
    const ay = (vy - lastVy) / dt // aceleración vertical: positiva al "aterrizar"
    const jerk = Math.abs(s.accel - lastAccel) / dt
    lastY = s.y
    lastVy = vy
    lastAccel = s.accel

    const push = Math.max(-40, Math.min(40, ay * FROM_VERTICAL + jerk * FROM_ACCEL))
    velocity += (-STIFFNESS * value - DAMPING * velocity + push * 10) * dt
    value = Math.max(-MAX, Math.min(MAX, value + velocity * dt))
    return value
  }

  return { update }
}
