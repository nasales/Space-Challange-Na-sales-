// Detective outfit: the colors the player picks in the Wardrobe.
// Shared by the UI (Wardrobe screen) and the game (detective model), so neither imports the other.
// Changing this file needs agreement from both areas.
import { L } from './i18n'

export type OutfitPart = 'coat' | 'hat' | 'scarf' | 'trousers'

/** One CSS hex color (#rrggbb) per part. */
export type Outfit = Record<OutfitPart, string>

export const OUTFIT_PARTS: { part: OutfitPart; label: string }[] = [
  { part: 'coat', label: L('Trench coat', 'Gabardina') },
  { part: 'hat', label: L('Fedora', 'Sombrero') },
  { part: 'scarf', label: L('Scarf', 'Bufanda') },
  { part: 'trousers', label: L('Trousers', 'Pantalones') },
]

/** The original look of the detective. */
export const DEFAULT_OUTFIT: Outfit = {
  coat: '#d2a868',
  hat: '#7a5235',
  scarf: '#e5322d',
  trousers: '#3a3f58',
}

/** Preset colors per part (the first one is the default). */
export const OUTFIT_PRESETS: Record<OutfitPart, { name: string; color: string }[]> = {
  coat: [
    { name: L('Classic tan', 'Tostado clásico'), color: '#d2a868' },
    { name: L('Rain grey', 'Gris lluvia'), color: '#8d939b' },
    { name: L('Olive', 'Oliva'), color: '#7d8550' },
    { name: L('Midnight', 'Medianoche'), color: '#3f4a6e' },
    { name: L('Burgundy', 'Burdeos'), color: '#7e3341' },
    { name: L('Cream', 'Crema'), color: '#efe3c4' },
  ],
  hat: [
    { name: L('Brown felt', 'Fieltro marrón'), color: '#7a5235' },
    { name: L('Charcoal', 'Carbón'), color: '#3b3a40' },
    { name: L('Camel', 'Camel'), color: '#b98a52' },
    { name: L('Navy', 'Azul marino'), color: '#2f3d63' },
    { name: L('Forest', 'Bosque'), color: '#3d5a40' },
    { name: L('Plum', 'Ciruela'), color: '#5b3654' },
  ],
  scarf: [
    { name: L('Red', 'Rojo'), color: '#e5322d' },
    { name: L('Mustard', 'Mostaza'), color: '#f2c14e' },
    { name: L('Teal', 'Verde azulado'), color: '#2f9a94' },
    { name: L('Violet', 'Violeta'), color: '#7a4fb5' },
    { name: L('Orange', 'Naranja'), color: '#f07a2b' },
    { name: L('Sky', 'Cielo'), color: '#5ea8c2' },
  ],
  trousers: [
    { name: L('Ink', 'Tinta'), color: '#3a3f58' },
    { name: L('Black', 'Negro'), color: '#25242b' },
    { name: L('Brown', 'Marrón'), color: '#5a3d2b' },
    { name: L('Stone', 'Piedra'), color: '#9a9184' },
    { name: L('Moss', 'Musgo'), color: '#4b5a3a' },
    { name: L('Wine', 'Vino'), color: '#5c2834' },
  ],
}

const STORAGE_KEY = 'etd.outfit.v1'
const HEX = /^#[0-9a-f]{6}$/i

/** Reads the saved outfit; falls back to the default for anything missing or invalid. */
export function loadOutfit(): Outfit {
  const outfit = { ...DEFAULT_OUTFIT }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Outfit>
    for (const { part } of OUTFIT_PARTS) {
      const c = saved[part]
      if (typeof c === 'string' && HEX.test(c)) outfit[part] = c
    }
  } catch {
    // Storage blocked or corrupt: use the default look
  }
  return outfit
}

export function saveOutfit(outfit: Outfit) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(outfit))
  } catch {
    // Storage blocked: the choice only lasts for this visit
  }
}
