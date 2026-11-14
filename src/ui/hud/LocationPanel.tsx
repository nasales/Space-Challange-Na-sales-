// Top-right panel: where you are (nearest town, region and exact coordinates).
// If a landmark is nearby, it is shown first with a short description.
import type { LocationInfo } from '../../shared/events'
import './LocationPanel.css'

/** Closer than this to a town counts as being "in" it. */
const INSIDE_KM = 6

const formatCoord = (value: number, pos: string, neg: string) =>
  `${Math.abs(value).toFixed(4)}° ${value >= 0 ? pos : neg}`

export default function LocationPanel({ info }: { info: LocationInfo }) {
  const inside = info.km < INSIDE_KM
  const lm = info.landmark
  return (
    <section
      className={`location-panel${lm ? ' location-panel--landmark' : ''}`}
      aria-live="polite"
      aria-label="Current location"
    >
      <span className="location-panel__pin" aria-hidden="true" />
      {lm ? (
        <>
          <p className="location-panel__place">{lm.name}</p>
          <p className="location-panel__region">
            {lm.city}, {info.region}
          </p>
          <p className="location-panel__description">{lm.description}</p>
        </>
      ) : (
        <>
          <p className="location-panel__place">
            {inside ? info.place : `Near ${info.place}`}
            {!inside && <span className="location-panel__km">{Math.round(info.km)} km</span>}
          </p>
          {info.region && <p className="location-panel__region">{info.region}</p>}
        </>
      )}
      <p className="location-panel__coords">
        {formatCoord(info.lat, 'N', 'S')}, {formatCoord(info.lon, 'E', 'W')}
      </p>
    </section>
  )
}
