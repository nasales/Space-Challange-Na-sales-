// First screen on the very first visit: pick English or Spanish (src/shared/i18n.ts).
// Both labels are shown in their own language, since we do not know yet which one the player reads.
// Picking saves the choice and reloads the page; later the language can be changed from the menu.
import { setLang, type Lang } from '../../shared/i18n'
import './LanguagePicker.css'

const OPTIONS: { lang: Lang; label: string; hint: string }[] = [
  { lang: 'en', label: 'English', hint: 'Play in English' },
  { lang: 'es', label: 'Español', hint: 'Jugar en español' },
]

export default function LanguagePicker() {
  return (
    <section className="lang-picker" aria-labelledby="lang-picker-title">
      <div className="lang-picker__card">
        <h1 id="lang-picker-title" className="lang-picker__title">
          Choose your language
          <span className="lang-picker__title-es">Elige tu idioma</span>
        </h1>
        <div className="lang-picker__options">
          {OPTIONS.map((o, i) => (
            <button
              key={o.lang}
              type="button"
              className="lang-picker__option"
              lang={o.lang}
              autoFocus={i === 0}
              onClick={() => setLang(o.lang)}
            >
              <span className="lang-picker__label">{o.label}</span>
              <span className="lang-picker__hint">{o.hint}</span>
            </button>
          ))}
        </div>
        <p className="lang-picker__note">
          You can change it later in the menu · Puedes cambiarlo luego en el menú
        </p>
      </div>
    </section>
  )
}

/** Small EN / ES switch for the main menu: the current language is pressed */
export function LanguageSwitch({ current, className }: { current: Lang; className?: string }) {
  return (
    <div className={`lang-switch ${className ?? ''}`} role="group" aria-label={current === 'es' ? 'Idioma' : 'Language'}>
      {OPTIONS.map((o) => (
        <button
          key={o.lang}
          type="button"
          className="lang-switch__btn"
          lang={o.lang}
          aria-pressed={o.lang === current}
          aria-label={o.label}
          onClick={() => {
            if (o.lang !== current) setLang(o.lang)
          }}
        >
          {o.lang.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
