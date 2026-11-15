// Small reminder of the controls in a corner.
import './ControlsHint.css'
import { L } from '../../shared/i18n'

const CONTROLS: [string[], string][] = [
  [['W', 'A', 'S', 'D'], L('Run', 'Correr')],
  [['Shift'], L('Sprint', 'Esprintar')],
  [[L('Wheel', 'Rueda')], L('Zoom out', 'Alejar la cámara')],
  [[L('Space', 'Espacio')], L('Investigate (when stopped)', 'Investigar (parado)')],
  [['M'], L('Map / travel', 'Mapa / viajar')],
  [['Esc'], L('Pause', 'Pausa')],
]

export default function ControlsHint() {
  return (
    <ul className="controls-hint" aria-label={L('Controls', 'Controles')}>
      {CONTROLS.map(([keys, label]) => (
        <li key={label} className="controls-hint__row">
          <span className="controls-hint__keys">
            {keys.map((k) => (
              <kbd key={k}>{k}</kbd>
            ))}
          </span>
          {label}
        </li>
      ))}
    </ul>
  )
}
