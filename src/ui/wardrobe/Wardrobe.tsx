// Wardrobe: the detective's closet as a comic page, in the same print style as the main menu
// (ink lines, halftone dots, misprinted caption boxes, pinned sheets and red string).
// The player picks a clothing part (sheets on a string), then a fabric card for it.
// Every sheet has its own hover/focus "show" (CSS only, see Wardrobe.css).
// The live 3D detective is passed in as a slot from App.tsx, so the UI never imports from src/game.
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import {
  DEFAULT_OUTFIT,
  OUTFIT_PARTS,
  OUTFIT_PRESETS,
  saveOutfit,
  type Outfit,
  type OutfitPart,
} from '../../shared/outfit'
import panelBg from '../assets/menu/panel-bg.svg'
import './Wardrobe.css'
import { L } from '../../shared/i18n'

interface WardrobeProps {
  outfit: Outfit
  onChange: (o: Outfit) => void
  onBack: () => void
  preview: ReactNode
}

// Small fixed tilts so the paper looks hand-pinned, not laid out by a grid
const PART_TILT = [-3, 2.5, -2, 3]
const CARD_TILT = [-2.5, 2, -1.5, 2.5, -2, 1.5]

// Comic sound effect shown by each fabric card's hover show (one per card position).
const CARD_SFX = [
  L('Snip!', '¡Tris!'),
  L('Ooh!', '¡Oooh!'),
  L('Snazzy!', '¡Qué estilo!'),
  L('Sharp!', '¡Elegante!'),
  L('Swank!', '¡Con clase!'),
  L('Nice!', '¡Genial!'),
]

// Spanish "the fabric for the ..." needs the right article for each part.
const FABRIC_FOR_ES: Record<OutfitPart, string> = {
  coat: 'Elige la tela de la gabardina',
  hat: 'Elige la tela del sombrero',
  scarf: 'Elige la tela de la bufanda',
  trousers: 'Elige la tela de los pantalones',
}

// Comic sound effect shown by each part sheet's hover show.
const PART_SFX: Record<OutfitPart, string> = {
  coat: L('Swish!', '¡Fiu!'),
  hat: L('Tip!', '¡Toc!'),
  scarf: L('Flap!', '¡Flap!'),
  trousers: L('Hup!', '¡Hop!'),
}

function colorName(part: OutfitPart, color: string) {
  const preset = OUTFIT_PRESETS[part].find((p) => p.color.toLowerCase() === color.toLowerCase())
  return preset ? preset.name : L('Custom', 'Personalizado')
}

// Small ink drawings of each piece, filled with the color the player picked.
function PartIcon({ part, color }: { part: OutfitPart; color: string }) {
  return (
    <svg className="wr-part__icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {part === 'coat' && (
        <>
          <path fill={color} d="M17 5h14l9 5 4 30-7 2-2-19v23H13V23l-2 19-7-2 4-30z" />
          <path className="wr-ink-line" d="M17 5l7 11 7-11M24 16v26M13 29h22" />
          <circle className="wr-ink-dot" cx="20" cy="22" r="1.6" />
          <circle className="wr-ink-dot" cx="28" cy="22" r="1.6" />
        </>
      )}
      {part === 'hat' && (
        <>
          <ellipse fill={color} cx="24" cy="32" rx="21" ry="6.5" />
          <path fill={color} d="M12 31c0-11 3-21 12-21s12 10 12 21z" />
          <path className="wr-ink-line" d="M19 12l5 4 5-4" />
          <path className="wr-ink-fill" d="M12.6 25.5h22.8v4.5H12.6z" />
        </>
      )}
      {part === 'scarf' && (
        <>
          <path fill={color} d="M23 18l-5 21-7-1.5 5-21z" />
          <path fill={color} d="M26 18l5 22 7-2-5-21z" />
          <path fill={color} d="M8 9c5 7 27 7 32 0l2 8c-7 8-29 8-36 0z" />
          <path className="wr-ink-line" d="M12 38l-1 4M15 39l-1 4M32 40l1 4M35 39l1 4" />
        </>
      )}
      {part === 'trousers' && (
        <>
          <path fill={color} d="M12 6h24l3 36H28.5L24 19l-4.5 23H9z" />
          <path className="wr-ink-line" d="M12 12h24M24 12v7M30 12v5" />
        </>
      )}
    </svg>
  )
}

export default function Wardrobe({ outfit, onChange, onBack, preview }: WardrobeProps) {
  const [part, setPart] = useState<OutfitPart>('coat')
  // Comic flourishes only after a real interaction, so the first frame stays calm.
  const [keyboard, setKeyboard] = useState(false)
  const [dealt, setDealt] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [resetCount, setResetCount] = useState(0)
  const uid = useId()
  const partLabel = OUTFIT_PARTS.find((p) => p.part === part)?.label ?? ''
  const isDefault = OUTFIT_PARTS.every(({ part: p }) => outfit[p] === DEFAULT_OUTFIT[p])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  // Keyboard focus shows (and the focus ring) start only after a real key press.
  useEffect(() => {
    if (keyboard) return
    const onKey = () => setKeyboard(true)
    window.addEventListener('keydown', onKey, { once: true })
    return () => window.removeEventListener('keydown', onKey)
  }, [keyboard])

  const apply = (next: Outfit) => {
    onChange(next)
    saveOutfit(next)
  }

  const pageStyle = { '--panel-bg': `url("${panelBg}")` } as CSSProperties

  return (
    <section className="wardrobe" aria-labelledby={`${uid}-title`}>
      <div className="wardrobe__panel">
        <div className="wardrobe__page" style={pageStyle} data-kbd={keyboard || undefined}>
          <header className="wr-head">
            <button type="button" className="wr-back" onClick={onBack} aria-label={L('Back to the menu (Escape)', 'Volver al menú (Escape)')}>
              <span className="wr-sheet wr-back__paper">
                <span className="wr-pin" aria-hidden="true" />
                <svg className="wr-back__arrow" viewBox="0 0 32 24" aria-hidden="true" focusable="false">
                  <path d="M13 3L3 12l10 9v-5.5h16v-7H13z" />
                </svg>
                <span className="wr-back__word">{L('Back', 'Volver')}</span>
                <span className="wr-back__key">Esc</span>
              </span>
              <span className="wr-sfx wr-sfx--back" aria-hidden="true">
                {L('See ya!', '¡Hasta luego!')}
              </span>
            </button>

            <div className="wr-masthead">
              <h1 className="wr-title" id={`${uid}-title`}>
                {L('Wardrobe', 'Vestuario')}
              </h1>
              <p className="wr-tagline">
                {L('Dress your detective. Every clue needs a good coat.', 'Viste a tu detective. Toda pista merece una buena gabardina.')}
              </p>
            </div>
          </header>

          <fieldset className="wr-parts">
            <legend className="wr-legend">{L('Pick a piece', 'Elige una prenda')}</legend>
            <div className="wr-parts__row">
              <svg className="wr-parts__string" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
                <path className="wr-string-ink" d="M12.5 3 Q25 8 37.5 3 Q50 8 62.5 3 Q75 8 87.5 3" />
                <path className="wr-string" d="M12.5 3 Q25 8 37.5 3 Q50 8 62.5 3 Q75 8 87.5 3" />
              </svg>
              {OUTFIT_PARTS.map(({ part: p, label }, i) => (
                <label
                  key={p}
                  className={`wr-part wr-part--${p}`}
                  style={{ '--tilt': `${PART_TILT[i % PART_TILT.length]}deg` } as CSSProperties}
                >
                  <input
                    className="wr-radio"
                    type="radio"
                    name={`${uid}-part`}
                    value={p}
                    checked={part === p}
                    onChange={() => {
                      setPart(p)
                      setDealt(true)
                    }}
                    autoFocus={i === 0}
                  />
                  <span className="wr-sheet wr-part__paper">
                    <PartIcon part={p} color={outfit[p]} />
                    <span className="wr-part__label">{label}</span>
                  </span>
                  <span className="wr-sfx wr-sfx--part" aria-hidden="true">
                    {PART_SFX[p]}
                  </span>
                </label>
              ))}
              {[12.5, 37.5, 62.5, 87.5].map((x) => (
                <span
                  key={x}
                  className="wr-pin wr-pin--string"
                  style={{ left: `${x}%` }}
                  aria-hidden="true"
                />
              ))}
            </div>
          </fieldset>

          <fieldset className={`wr-swatches${dealt ? ' is-dealing' : ''}`} key={part}>
            <legend className="wr-legend">
              {L(`Choose the fabric for the ${partLabel.toLowerCase()}`, FABRIC_FOR_ES[part])}
            </legend>
            <div className="wr-cards">
              {OUTFIT_PRESETS[part].map(({ name, color }, i) => {
                const key = `${part}:${color}`
                return (
                  <label
                    key={color}
                    className={`wr-card wr-card--${i + 1}${picked === key ? ' is-picked' : ''}`}
                    style={{ '--tilt': `${CARD_TILT[i % CARD_TILT.length]}deg`, '--i': i } as CSSProperties}
                  >
                    <input
                      className="wr-radio"
                      type="radio"
                      name={`${uid}-color-${part}`}
                      value={color}
                      checked={outfit[part].toLowerCase() === color.toLowerCase()}
                      onChange={() => {
                        setPicked(key)
                        apply({ ...outfit, [part]: color })
                      }}
                    />
                    <span className="wr-sheet wr-card__paper">
                      <span className="wr-pin" aria-hidden="true" />
                      <span className="wr-card__fabric" style={{ background: color }} aria-hidden="true" />
                      <span className="wr-card__name">{name}</span>
                      {i === 0 && (
                        <span className="wr-card__original" aria-hidden="true">
                          {L('Original', 'Original')}
                        </span>
                      )}
                      <span className="wr-card__marker" aria-hidden="true" />
                    </span>
                    <span className="wr-sfx wr-sfx--card" aria-hidden="true">
                      {CARD_SFX[i % CARD_SFX.length]}
                    </span>
                    {picked === key && (
                      <span className="wr-pow" aria-hidden="true">
                        {L('Pow!', '¡Pum!')}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <footer className="wr-foot">
            <p className="wr-readout" aria-live="polite">
              <span className="wr-readout__part">{partLabel}:</span> {colorName(part, outfit[part])}
            </p>
            <button
              type="button"
              className="wr-reset"
              onClick={() => {
                apply({ ...DEFAULT_OUTFIT })
                setResetCount((n) => n + 1)
              }}
              disabled={isDefault}
            >
              <span className="wr-reset__burst" aria-hidden="true" />
              <span className="wr-reset__stamp">{L('Reset look', 'Restablecer look')}</span>
              {resetCount > 0 && isDefault && (
                <span key={resetCount} className="wr-reset__slam" aria-hidden="true">
                  {L('Reset!', '¡Como nuevo!')}
                </span>
              )}
            </button>
          </footer>

          <p className="wr-credit">{L('Data: NASA MERRA-2', 'Datos: NASA MERRA-2')}</p>
        </div>
      </div>

      <div className="wardrobe__stage">
        <div className="wardrobe__rays" aria-hidden="true" />
        <div className="wardrobe__dots" aria-hidden="true" />
        <div className="wardrobe__preview">{preview}</div>
      </div>
    </section>
  )
}
