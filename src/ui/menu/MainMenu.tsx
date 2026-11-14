// Main menu: left panel with the game title and the Play button (country selection will go here
// later), right panel with a comic-style stage for the animated character.
// The character is passed in as a slot from App.tsx, so the UI never imports from src/game.
import type { ReactNode } from 'react'
import './MainMenu.css'

interface MainMenuProps {
  onPlay: () => void
  character: ReactNode
}

export default function MainMenu({ onPlay, character }: MainMenuProps) {
  return (
    <section className="main-menu">
      <div className="main-menu__panel">
        <p className="main-menu__kicker">Case file #2026</p>
        <h1 className="main-menu__title">
          Earth Trend
          <span>Detective</span>
        </h1>
        <p className="main-menu__tagline">Follow the clues. Read the data. Crack the climate case.</p>
        <button type="button" className="main-menu__play" onClick={onPlay} autoFocus>
          Play
        </button>
        <p className="main-menu__credit">Data: NASA MERRA-2</p>
      </div>

      <div className="main-menu__stage">
        <div className="main-menu__rays" aria-hidden="true" />
        <div className="main-menu__dots" aria-hidden="true" />
        <div className="main-menu__character">{character}</div>
      </div>
    </section>
  )
}
