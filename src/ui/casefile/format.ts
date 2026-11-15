// Small formatting helpers for the case file (numbers, dates, test names).
import type { TutorialSeries } from '../../shared/tutorial'
import { L, LANG } from '../../shared/i18n'

const MONTHS = LANG === 'es'
  ? ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTH_SHORT = MONTHS
export const MONTH_LONG = LANG === 'es'
  ? ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  : [
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

/** Decimal comma in Spanish ("0.05" -> "0,05"); display only, never parsed back */
const dec = (s: string) => (LANG === 'es' ? s.replace('.', ',') : s)

/** Three significant digits, without trailing noise ("0.0227", "1.46", "312") */
export function sig(x: number): string {
  if (x === 0) return '0'
  if (Math.abs(x) >= 100) return x.toFixed(0)
  return dec(Number(x.toPrecision(3)).toString())
}

/** Signed number for slopes: "+0.31", "−0.05" (true minus sign) */
export function signed(x: number): string {
  const s = sig(Math.abs(x))
  if (x > 0) return `+${s}`
  if (x < 0) return `−${s}`
  return s
}

export function formatP(p: number): string {
  if (p < 0.001) return dec('p < 0.001')
  // near the 5% line two digits are not enough: 0.0498 must not read "0.05" (it is below it)
  if (p > 0.045 && p < 0.055) {
    const s = Number(p.toPrecision(3))
    return dec(`p = ${p < 0.05 && s >= 0.05 ? '0.0499' : s}`)
  }
  return dec(`p = ${Number(p.toPrecision(2))}`)
}

export function testName(test: string): string {
  if (test.startsWith('mann-kendall')) {
    return test.includes('prewhitening')
      ? L('Mann-Kendall test with pre-whitening', 'test de Mann-Kendall con preblanqueo')
      : L('Mann-Kendall test', 'test de Mann-Kendall')
  }
  return test
}

/** "Data: NASA GPM_3IMERGM v07" (the dataset string already starts with NASA) */
export function credit(...series: TutorialSeries[]): string {
  const names = [...new Set(series.map((s) => (s.dataset.startsWith('NASA') ? s.dataset : `NASA ${s.dataset}`)))]
  return L(`Data: ${names.join('; ')}`, `Datos: ${names.join('; ')}`)
}
