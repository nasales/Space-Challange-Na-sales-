// TypeScript mirror of docs/contract.md (backend -> interface).
// Do not change it unless docs/contract.md changes (needs Person 3 + Yeipi approval).

export interface CaseData {
  /** Place name shown to the player */
  place: string
  lat: number
  lon: number
  /** Variable id, e.g. "surface_temperature" */
  variable: string
  /** Units, e.g. "K", "mm/day" */
  units: string
  /** NASA source, e.g. "MERRA-2 M2TMNXSLV" */
  dataset: string
  /** ISO dates (YYYY-MM or YYYY-MM-DD) */
  dates: string[]
  /** Same length as dates; null for gaps */
  values: (number | null)[]
  /** Trend per year, in units/year */
  slope: number
  /** Significance test p-value (0-1) */
  p_value: number
  /** p_value < 0.05 */
  significant: boolean
  /** e.g. "mann-kendall" */
  test: string
}
