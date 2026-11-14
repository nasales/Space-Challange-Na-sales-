// Física "arcade" del detective (empezó siendo la de un coche): sencilla, pero fluida.
// - Acelera y frena de forma progresiva (inercia), las cuestas lo frenan.
// - La dirección se suaviza y gira menos a alta velocidad.
// - Sigue el terreno: altura e inclinación suavizadas para que no tiemble en los escalones.
// - No entra en el mar: si choca con la costa, se desliza a lo largo de ella.
import type { DriveInput } from '../input/keyboard'
import { DETECTIVE as CAR } from '../detective/detectiveSize' // huella en el suelo

export interface Ground {
  heightAt: (x: number, z: number) => number
  /** ¿Se puede conducir aquí? (tierra del país explorado) */
  isDrivable: (x: number, z: number) => boolean
}

export interface CarState {
  x: number
  z: number
  y: number
  /** Hacia dónde mira (rad). 0 = norte (-Z); positivo = gira a la izquierda */
  heading: number
  /** Velocidad hacia delante (unidades/s); negativa = marcha atrás */
  speed: number
  /** Volante suavizado (-1 a 1) */
  steer: number
  /** Velocidad de giro actual (rad/s), usada para ladear la carrocería */
  yawRate: number
  /** Aceleración actual, usada para el cabeceo */
  accel: number
  pitch: number
  roll: number
}

// Ajustes del manejo (unidades del mundo por segundo)
export const TUNING = {
  maxSpeed: 48,
  turboSpeed: 140,
  reverseSpeed: 15,
  accel: 26,
  turboAccel: 85,
  brake: 70,
  coastDrag: 3, // cuánto frena al soltar (una persona se para enseguida; el coche usaba 0.9)
  turnRate: 1.9, // rad/s a velocidad media
  steerResponse: 7, // rapidez del volante
  slopeFactor: 14, // cuánto frenan las cuestas
}

export function createCarState(x: number, z: number, heading: number, ground: Ground): CarState {
  return {
    x, z, heading,
    y: ground.heightAt(x, z),
    speed: 0, steer: 0, yawRate: 0, accel: 0, pitch: 0, roll: 0,
  }
}

/** Acerca "valor" a "objetivo" de forma suave e independiente de los FPS. */
export const damp = (value: number, target: number, rate: number, dt: number) =>
  value + (target - value) * (1 - Math.exp(-rate * dt))

export function stepCar(s: CarState, input: DriveInput, ground: Ground, dt: number) {
  if (!(dt > 0)) return // sin tiempo transcurrido no hay nada que simular (y evitamos dividir entre 0)
  const T = TUNING
  const top = input.turbo ? T.turboSpeed : T.maxSpeed
  const fx = -Math.sin(s.heading), fz = -Math.cos(s.heading) // vector "hacia delante"

  // ---- Velocidad ----
  const before = s.speed
  if (input.throttle > 0) {
    if (s.speed < 0) s.speed += T.brake * dt // frenando la marcha atrás
    else s.speed += (input.turbo ? T.turboAccel : T.accel) * (1 - s.speed / top) * 1.6 * dt
  } else if (input.throttle < 0) {
    if (s.speed > 0) s.speed -= T.brake * dt // frenar
    else s.speed -= T.accel * 0.6 * dt // marcha atrás
  } else {
    s.speed -= s.speed * T.coastDrag * dt // rodando sin acelerar
    if (Math.abs(s.speed) < 0.3) s.speed = 0
  }
  // Las cuestas: subir frena, bajar empuja un poco
  const half = CAR.length / 2
  const ahead = ground.heightAt(s.x + fx * half, s.z + fz * half)
  const behind = ground.heightAt(s.x - fx * half, s.z - fz * half)
  const grade = Math.max(-1, Math.min(1, (ahead - behind) / CAR.length))
  s.speed -= grade * T.slopeFactor * dt
  s.speed = Math.max(-T.reverseSpeed, Math.min(s.speed, top))
  s.accel = damp(s.accel, (s.speed - before) / dt, 6, dt)

  // ---- Dirección ----
  s.steer = damp(s.steer, input.steer, T.steerResponse, dt)
  // Una persona puede girar sobre sí misma estando parada (un coche no): mínimo de giro de 0,8
  const speedFactor = Math.max(0.8, Math.min(1, Math.abs(s.speed) / 8)) * (1 - 0.45 * Math.min(1, Math.abs(s.speed) / T.turboSpeed))
  s.yawRate = -s.steer * T.turnRate * speedFactor * (s.speed < -0.5 ? -1 : 1)
  s.heading += s.yawRate * dt

  // ---- Avanzar (sin meterse en el mar) ----
  const nfx = -Math.sin(s.heading), nfz = -Math.cos(s.heading)
  const dx = nfx * s.speed * dt, dz = nfz * s.speed * dt
  const nose = (x: number, z: number) => // comprobamos el morro (o la cola si va marcha atrás)
    ground.isDrivable(x + nfx * Math.sign(s.speed || 1) * CAR.length * 0.5, z + nfz * Math.sign(s.speed || 1) * CAR.length * 0.5)
  if (nose(s.x + dx, s.z + dz)) {
    s.x += dx
    s.z += dz
  } else if (Math.abs(dx) > Math.abs(dz) * 0.25 && nose(s.x + dx, s.z)) {
    s.x += dx // deslizarse a lo largo de la costa (solo si de verdad hay movimiento en ese eje)
    s.speed *= 0.97
  } else if (Math.abs(dz) > Math.abs(dx) * 0.25 && nose(s.x, s.z + dz)) {
    s.z += dz
    s.speed *= 0.97
  } else {
    s.speed = 0 // de frente contra la costa: se para
  }

  // ---- Seguir el terreno: altura e inclinación a partir de las 4 esquinas ----
  const hl = CAR.length * 0.4, hw = CAR.width * 0.5
  const rx = -nfz, rz = nfx // vector "a la derecha"
  const hF = ground.heightAt(s.x + nfx * hl, s.z + nfz * hl)
  const hB = ground.heightAt(s.x - nfx * hl, s.z - nfz * hl)
  const hR = ground.heightAt(s.x + rx * hw, s.z + rz * hw)
  const hL = ground.heightAt(s.x - rx * hw, s.z - rz * hw)
  const groundY = Math.max((hF + hB + hR + hL) / 4, ground.heightAt(s.x, s.z))
  // Sube rápido (para no atravesar el suelo) y baja algo más suave (como si cayera)
  s.y = groundY > s.y ? damp(s.y, groundY, 30, dt) : damp(s.y, groundY, 10, dt)
  s.pitch = damp(s.pitch, Math.atan2(hF - hB, hl * 2), 10, dt)
  s.roll = damp(s.roll, Math.atan2(hR - hL, hw * 2), 10, dt)
}
