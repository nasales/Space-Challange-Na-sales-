// Climate variables the player can investigate. Mirrors the `variables` table that
// archivos_preSupabase/etl_espana.py fills (VARS: id, name_en, unit; schema in supabase_schema.sql).
// Static list: the UI does not query the database for it. Keep the ids in sync with that file.

export interface ClimateVariable {
  /** Database id (variables.id), e.g. "tair" */
  id: string
  /** Name shown in the game (variables.name_en) */
  name: string
  unit: string
}

export const CLIMATE_VARIABLES: readonly ClimateVariable[] = [
  { id: 'tair', name: 'Air temperature (near surface)', unit: '°C' },
  { id: 'wind', name: 'Wind speed (near surface)', unit: 'm/s' },
  { id: 'soilmoist', name: 'Topsoil moisture (0-10 cm)', unit: 'kg/m²' },
  { id: 'evap', name: 'Evapotranspiration', unit: 'mm/day' },
  { id: 'precip', name: 'Precipitation', unit: 'mm/day' },
  { id: 't2m_long', name: 'Air temperature at 2 m (long record, coarse)', unit: '°C' },
]
