// Interface language: English (default) or Spanish.
//
// - The player picks the language on a first screen (src/ui/language/LanguagePicker.tsx) and can
//   change it later from the main menu. The choice is saved in this browser (localStorage).
// - The language is read ONCE, when the page loads, and stays fixed for the whole visit. Changing it
//   saves the new value and reloads the page, so every module (also constant tables built at import
//   time) shows the new language. This keeps the code simple: `L('Play', 'Jugar')` anywhere.
// - `?lang=es` / `?lang=en` in the URL forces a language for that visit (handy for testing).
// - Automated browsers (Playwright: navigator.webdriver) skip the first-run picker and use English,
//   so the end-to-end tests keep matching the English text.

export type Lang = 'en' | 'es'

const STORAGE_KEY = 'etd.lang.v1'

function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'es'
}

function fromUrl(): Lang | null {
  try {
    const v = new URLSearchParams(window.location.search).get('lang')
    return isLang(v) ? v : null
  } catch {
    return null
  }
}

function fromStorage(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return isLang(v) ? v : null
  } catch {
    return null // private mode or blocked storage
  }
}

const chosen: Lang | null = fromUrl() ?? fromStorage()

/** Language of this visit (fixed until the page reloads) */
export const LANG: Lang = chosen ?? 'en'

/** false on the very first visit: the app shows the language picker before the menu */
export const LANG_CHOSEN: boolean = chosen !== null || (typeof navigator !== 'undefined' && navigator.webdriver === true)

if (typeof document !== 'undefined') document.documentElement.lang = LANG

/** Pick the text for the current language: L('Play', 'Jugar') */
export function L(en: string, es: string): string {
  return LANG === 'es' ? es : en
}

/** Save the language and reload the page so everything is drawn in it */
export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    /* storage blocked: the URL parameter below still carries the choice for this visit */
  }
  const url = new URL(window.location.href)
  if (fromStorage() === lang) url.searchParams.delete('lang')
  else url.searchParams.set('lang', lang)
  window.location.replace(url.toString())
}

/** A number with fixed decimals, with a decimal comma in Spanish (1.5 -> "1,5") */
export function fmtNumber(n: number, digits: number): string {
  const s = n.toFixed(digits)
  return LANG === 'es' ? s.replace('.', ',') : s
}
