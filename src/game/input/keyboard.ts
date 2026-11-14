// Lee el teclado y lo convierte en "mandos" del coche: acelerar, girar, turbo...

export interface DriveInput {
  /** -1 (marcha atrás/freno) a 1 (acelerar) */
  throttle: number
  /** -1 (izquierda) a 1 (derecha) */
  steer: number
  turbo: boolean
}

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight',
])

export function createKeyboard() {
  const down = new Set<string>()
  const pressedOnce = new Set<string>() // teclas pulsadas desde la última consulta (para interruptores)

  const onDown = (e: KeyboardEvent) => {
    if (!GAME_KEYS.has(e.code)) return
    e.preventDefault() // que las flechas no hagan scroll en la página
    if (!down.has(e.code)) pressedOnce.add(e.code)
    down.add(e.code)
  }
  const onUp = (e: KeyboardEvent) => down.delete(e.code)
  const onBlur = () => down.clear() // si cambias de ventana, se sueltan todas
  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  window.addEventListener('blur', onBlur)

  const is = (...codes: string[]) => codes.some((c) => down.has(c))

  return {
    read(): DriveInput {
      return {
        throttle: (is('KeyW', 'ArrowUp') ? 1 : 0) - (is('KeyS', 'ArrowDown') ? 1 : 0),
        steer: (is('KeyD', 'ArrowRight') ? 1 : 0) - (is('KeyA', 'ArrowLeft') ? 1 : 0),
        turbo: is('ShiftLeft', 'ShiftRight'),
      }
    },
    /** true una sola vez por pulsación (p. ej. para encender/apagar la sirena) */
    wasPressed(code: string) {
      const had = pressedOnce.has(code)
      pressedOnce.delete(code)
      return had
    },
    dispose() {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    },
  }
}
