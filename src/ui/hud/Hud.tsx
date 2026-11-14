// Everything drawn on top of the 3D game: controls hint, speed effects, location panel,
// speedometer and the error message (the loading screen is src/ui/loading/MapLoader).
import type { GameStatus, HudState } from '../../shared/events'
import ControlsHint from './ControlsHint'
import LocationPanel from './LocationPanel'
import Speedometer from './Speedometer'
import SpeedLines from './SpeedLines'
import './Hud.css'

export default function Hud({ status, hud }: { status: GameStatus; hud: HudState | null }) {
  return (
    <>
      {status === 'ready' && <ControlsHint />}
      {hud && (
        <>
          <SpeedLines intensity={hud.rush} />
          <LocationPanel info={hud.location} />
          <Speedometer kmh={hud.kmh} turbo={hud.turbo} />
        </>
      )}
      {status === 'error' && (
        <p className="hud__status">
          Map data is missing. Run node scripts/fetch-map-data.mjs and node scripts/fetch-world-data.mjs
        </p>
      )}
    </>
  )
}
