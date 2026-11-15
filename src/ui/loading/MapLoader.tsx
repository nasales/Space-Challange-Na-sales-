// Comic loading screen shown while the game builds the map. The bar shows the real progress the
// game reports (0..1, see onProgress in src/shared/events.ts); a 2D detective dashes back and
// forth along it, skidding, turning and tripping. Once the game is ready the bar finishes with a
// short "case open" beat and the screen goes away. Errors are shown by the HUD, not here.
import { useEffect, useState, type CSSProperties } from 'react'
import type { GameStatus } from '../../shared/events'
import type { Outfit } from '../../shared/outfit'
import LoadingDetective from './LoadingDetective'
import './MapLoader.css'
import { L } from '../../shared/i18n'

/** How long the finished bar stays on screen before it disappears (ms). */
const OUTRO_MS = 700

/** Caption under the title for each loading step (thresholds match the steps in GameView). */
function stepCaption(p: number, done: boolean) {
  if (done) return L('Case open!', '¡Caso abierto!')
  if (p < 0.04) return L('Pulling the case files', 'Sacando los expedientes')
  if (p < 0.15) return L('Rolling out the world', 'Desplegando el mundo')
  if (p < 0.89) return L('Sketching coasts, rivers and roads', 'Dibujando costas, ríos y carreteras')
  if (p < 0.92) return L('Building the towns', 'Levantando los pueblos')
  if (p < 0.96) return L('Planting groves and forests', 'Plantando arboledas y bosques')
  return L('Waking up the detective', 'Despertando al detective')
}

export default function MapLoader({ status, progress, outfit }: { status: GameStatus; progress: number; outfit: Outfit }) {
  const done = status === 'ready' || status === 'intro' // fade out as the intro camera starts
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setGone(true), OUTRO_MS)
    return () => clearTimeout(t)
  }, [done])

  if (status === 'error' || gone) return null

  const p = done ? 1 : Math.min(1, Math.max(0, progress))
  const percent = Math.round(p * 100)

  return (
    <div className={`map-loader${done ? ' map-loader--done' : ''}`} style={{ '--p': p } as CSSProperties}>
      <div className="map-loader__stage">
        <h2 className="map-loader__title">{L('Drawing the map…', 'Dibujando el mapa…')}</h2>
        <p className="map-loader__caption">{stepCaption(p, done)}</p>

        <div className="map-loader__track">
          {/* The running detective: path (travel) > face (turns) > body (squash, lean, trip) */}
          <div className="map-loader__path" aria-hidden="true">
            <div className="map-loader__runner">
              <div className="map-loader__face">
                <div className="map-loader__body">
                  <LoadingDetective outfit={outfit} />
                </div>
              </div>
            </div>
          </div>
          {/* Dust puffs and sound effects at the skid and trip spots */}
          <div className="map-loader__fx map-loader__fx--right" aria-hidden="true">
            <span className="map-loader__puff" />
            <span className="map-loader__puff" />
            <span className="map-loader__puff" />
            <span className="map-loader__sfx">{L('Skrrt!', '¡Ñiiic!')}</span>
          </div>
          <div className="map-loader__fx map-loader__fx--trip" aria-hidden="true">
            <span className="map-loader__puff" />
            <span className="map-loader__puff" />
            <span className="map-loader__sfx">{L('Oof!', '¡Uf!')}</span>
          </div>
          <div className="map-loader__fx map-loader__fx--left" aria-hidden="true">
            <span className="map-loader__puff" />
            <span className="map-loader__puff" />
            <span className="map-loader__puff" />
            <span className="map-loader__sfx">{L('Skrrt!', '¡Ñiiic!')}</span>
          </div>

          <div
            className="map-loader__bar"
            role="progressbar"
            aria-label={L('Loading the map', 'Cargando el mapa')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="map-loader__fill" />
          </div>
        </div>
      </div>
    </div>
  )
}
