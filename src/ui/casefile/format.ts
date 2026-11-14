// Small formatting helpers for the case file (numbers, dates, test names).
import type { TutorialSeries } from '../../shared/tutorial'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTH_SHORT = MONTHS
export const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Repairs UTF-8 text that was decoded as Latin-1 somewhere on the way ("Â°C" -> "°C",
 * "kg/mÂ²" -> "kg/m²"). Correct text is returned unchanged.
 */
export function fixText(text: string): string {
  return text.replace(/Â([°²³±·µ])/g, '$1').replace(/Ã±/g, 'ñ').replace(/Ã³/g, 'ó').replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í')
}

/** Units without the note in brackets: "kg/m² (0-10 cm)" -> "kg/m²" (for "per decade" phrases) */
export function baseUnits(units: string): string {
  return units.replace(/\s*\(.*\)\s*$/, '').trim() || units
}

/** "2024-10" -> "Oct 2024"; "2024" -> "2024" */
export function formatDate(date: string): string {
  const [y, m] = date.split('-')
  return m ? `${MONTHS[Number(m) - 1] ?? m} ${y}` : y
}

/** Three significant digits, without trailing noise ("0.0227", "1.46", "312") */
export function sig(x: number): string {
  if (x === 0) return '0'
  if (Math.abs(x) >= 100) return x.toFixed(0)
  return Number(x.toPrecision(3)).toString()
}

/** Signed number for slopes: "+0.31", "−0.05" (true minus sign) */
export function signed(x: number): string {
  const s = sig(Math.abs(x))
  if (x > 0) return `+${s}`
  if (x < 0) return `−${s}`
  return s
}

export function formatP(p: number): string {
  if (p < 0.001) return 'p < 0.001'
  return `p = ${Number(p.toPrecision(2))}`
}

export function testName(test: string): string {
  if (test.startsWith('mann-kendall')) {
    return test.includes('prewhitening') ? 'Mann-Kendall test with pre-whitening' : 'Mann-Kendall test'
  }
  return test
}

/** "Data: NASA GPM_3IMERGM v07" (the dataset string already starts with NASA) */
export function credit(...series: TutorialSeries[]): string {
  const names = [...new Set(series.map((s) => (s.dataset.startsWith('NASA') ? s.dataset : `NASA ${s.dataset}`)))]
  return `Data: ${names.join('; ')}`
}
