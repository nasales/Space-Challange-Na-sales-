// Small speedometer in the bottom-right corner (game speed, not real).
import './Speedometer.css'

export default function Speedometer({ kmh, turbo }: { kmh: number; turbo: boolean }) {
  return (
    <div className={`speedometer${turbo ? ' speedometer--turbo' : ''}`} aria-label={`${kmh} km/h`}>
      <span className="speedometer__value">{kmh}</span>
      <span className="speedometer__unit">km/h</span>
    </div>
  )
}
