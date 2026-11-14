// Small reminder of the controls in a corner.
import './ControlsHint.css'

const CONTROLS: [string[], string][] = [
  [['W', 'A', 'S', 'D'], 'Run'],
  [['Shift'], 'Sprint'],
  [['Wheel'], 'Zoom out'],
  [['Space'], 'Investigate (when stopped)'],
  [['Esc'], 'Pause'],
]

export default function ControlsHint() {
  return (
    <ul className="controls-hint" aria-label="Controls">
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
