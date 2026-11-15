// Two volume sliders (Music, Sound effects), saved in this browser. Used in the main menu and the
// pause panel. The values live in src/shared/sound.ts; the music and the effects follow them live.
import { useId, type CSSProperties } from 'react'
import { playSfx, setSoundSettings, useSoundSettings, type SoundSettings } from '../../shared/sound'
import './SoundSliders.css'

interface Props {
  /** Extra class for placement */
  className?: string
}

const ROWS: { key: keyof SoundSettings; label: string; name: string }[] = [
  { key: 'music', label: 'Music', name: 'Music volume' },
  { key: 'sfx', label: 'Effects', name: 'Sound effects volume' },
]

export default function SoundSliders({ className }: Props) {
  const settings = useSoundSettings()
  const id = useId()
  return (
    <div className={`sound-sliders${className ? ` ${className}` : ''}`} role="group" aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className="sound-sliders__title">
        Sound
      </p>
      {ROWS.map(({ key, label, name }) => {
        const value = Math.round(settings[key] * 100)
        return (
          <label key={key} className="sound-sliders__row">
            <span className="sound-sliders__label">{label}</span>
            <input
              className="sound-sliders__range"
              type="range"
              min={0}
              max={100}
              step={5}
              value={value}
              style={{ '--fill': `${value}%` } as CSSProperties}
              aria-label={name}
              aria-valuetext={value === 0 ? 'Off' : `${value} %`}
              onChange={(e) => {
                setSoundSettings({ [key]: Number(e.target.value) / 100 })
                // Effects slider: a tick at the new level, so the player hears it
                if (key === 'sfx') playSfx('tick')
              }}
              // Keep the arrows on the slider (the pause panel moves focus with them otherwise)
              onKeyDown={(e) => {
                if (/^(Arrow|Home$|End$|Page)/.test(e.key)) e.stopPropagation()
              }}
            />
            <span className="sound-sliders__value" aria-hidden="true">
              {value === 0 ? 'Off' : value}
            </span>
          </label>
        )
      })}
    </div>
  )
}
