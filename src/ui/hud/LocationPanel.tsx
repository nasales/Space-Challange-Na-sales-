// Place name under the minimap: where you are (nearest town and region).
// If a landmark is nearby, its name and "city, region" are shown instead.
import type { LocationInfo } from '../../shared/events'
import './LocationPanel.css'

/** Closer than this to a town counts as being "in" it. */
const INSIDE_KM = 6

export default function LocationPanel({ info }: { info: LocationInfo }) {
  const inside = info.km < INSIDE_KM
  const lm = info.landmark
  return (
    <section
      className={`location-panel${lm ? ' location-panel--landmark' : ''}`}
      aria-live="polite"
      aria-label="Current location"
    >
      {lm ? (
        <>
          <p className="location-panel__place">{lm.name}</p>
          <p className="location-panel__region">
            {lm.city}, {info.region}
          </p>
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
    </section>
  )
}
