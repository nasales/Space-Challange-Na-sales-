// Detective outfit: the colors the player picks in the Wardrobe.
// Shared by the UI (Wardrobe screen) and the game (detective model), so neither imports the other.
// Changing this file needs agreement from both areas.

export type OutfitPart = 'coat' | 'hat' | 'scarf' | 'trousers'

/** One CSS hex color (#rrggbb) per part. */
export type Outfit = Record<OutfitPart, string>

export const OUTFIT_PARTS: { part: OutfitPart; label: string }[] = [
  { part: 'coat', label: 'Trench coat' },
  { part: 'hat', label: 'Fedora' },
  { part: 'scarf', label: 'Scarf' },
  { part: 'trousers', label: 'Trousers' },
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
    { name: 'Classic tan', color: '#d2a868' },
    { name: 'Rain grey', color: '#8d939b' },
    { name: 'Olive', color: '#7d8550' },
    { name: 'Midnight', color: '#3f4a6e' },
    { name: 'Burgundy', color: '#7e3341' },
    { name: 'Cream', color: '#efe3c4' },
  ],
  hat: [
    { name: 'Brown felt', color: '#7a5235' },
    { name: 'Charcoal', color: '#3b3a40' },
    { name: 'Camel', color: '#b98a52' },
    { name: 'Navy', color: '#2f3d63' },
    { name: 'Forest', color: '#3d5a40' },
    { name: 'Plum', color: '#5b3654' },
  ],
  scarf: [
    { name: 'Red', color: '#e5322d' },
    { name: 'Mustard', color: '#f2c14e' },
    { name: 'Teal', color: '#2f9a94' },
    { name: 'Violet', color: '#7a4fb5' },
    { name: 'Orange', color: '#f07a2b' },
    { name: 'Sky', color: '#5ea8c2' },
  ],
  trousers: [
    { name: 'Ink', color: '#3a3f58' },
    { name: 'Black', color: '#25242b' },
    { name: 'Brown', color: '#5a3d2b' },
    { name: 'Stone', color: '#9a9184' },
    { name: 'Moss', color: '#4b5a3a' },
    { name: 'Wine', color: '#5c2834' },
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
