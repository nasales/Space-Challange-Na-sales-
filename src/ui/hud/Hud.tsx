// Everything drawn on top of the 3D game: controls hint, speed effects, minimap with the
// location panel under it, speedometer and the error message (the loading screen is src/ui/loading/MapLoader).
// hidden: fades the whole HUD out (while a featured case is open, so only the dialogue shows).
// highlight: a part of the HUD pulses (the map tutorial points at it).
import type { GameStatus, HudState } from '../../shared/events'
import ControlsHint from './ControlsHint'
import LocationPanel from './LocationPanel'
import Minimap from './Minimap'
import Speedometer from './Speedometer'
import SpeedLines from './SpeedLines'
import './Hud.css'
import { L } from '../../shared/i18n'

export default function Hud({
  status,
  hud,
  hidden = false,
  highlight = null,
}: {
  status: GameStatus
  hud: HudState | null
  hidden?: boolean
  highlight?: 'corner' | null
}) {
  return (
    <div className={`hud${hidden ? ' is-hidden' : ''}`} aria-hidden={hidden || undefined}>
      {status === 'ready' && <ControlsHint />}
      {hud && (
        <>
          <SpeedLines intensity={hud.rush} />
          <div className={`hud__corner${highlight === 'corner' ? ' is-highlighted' : ''}`}>
            <Minimap x={hud.x} z={hud.z} heading={hud.heading} />
            <LocationPanel info={hud.location} />
          </div>
          <Speedometer kmh={hud.kmh} turbo={hud.turbo} />
        </>
      )}
      {status === 'error' && (
        <p className="hud__status">
          {L(
            'Map data is missing. Run node scripts/fetch-map-data.mjs and node scripts/fetch-world-data.mjs',
            'Faltan los datos del mapa. Ejecuta node scripts/fetch-map-data.mjs y node scripts/fetch-world-data.mjs',
          )}
        </p>
      )}
    </div>
  )
}
