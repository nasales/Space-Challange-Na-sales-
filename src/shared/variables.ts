// Climate variables the player can investigate. Mirrors the `variables` table that
// archivos_preSupabase/etl_espana.py fills (VARS: id, name_en, unit; schema in supabase_schema.sql).
// Static list: the UI does not query the database for it. Keep the ids in sync with that file.
// `icon` and `blurb` are UI-only extras (they are not in the database).

/** Small pictogram drawn next to the variable in the interface */
export type VariableIcon = 'thermometer' | 'wind' | 'soil' | 'evaporation' | 'rain' | 'hourglass'

export interface ClimateVariable {
  /** Database id (variables.id), e.g. "tair" */
  id: string
  /** Name shown in the game (variables.name_en) */
  name: string
  unit: string
  icon: VariableIcon
  /** One plain-English line that invites the player to look (never a conclusion) */
  blurb: string
}

export const CLIMATE_VARIABLES: readonly ClimateVariable[] = [
  {
    id: 'tair',
    name: 'Air temperature (near surface)',
    unit: '°C',
    icon: 'thermometer',
    blurb: 'Is the air here heating up or cooling down?',
  },
  {
    id: 'wind',
    name: 'Wind speed (near surface)',
    unit: 'm/s',
    icon: 'wind',
    blurb: 'Are the winds picking up or dying down?',
  },
  {
    id: 'soilmoist',
    name: 'Topsoil moisture (0-10 cm)',
    unit: 'kg/m²',
    icon: 'soil',
    blurb: 'How wet is the top layer of the ground?',
  },
  {
    id: 'evap',
    name: 'Evapotranspiration',
    unit: 'mm/day',
    icon: 'evaporation',
    blurb: 'How much water rises from soil and plants?',
  },
  {
    id: 'precip',
    name: 'Precipitation',
    unit: 'mm/day',
    icon: 'rain',
    blurb: 'How much rain and snow falls here?',
  },
  {
    id: 't2m_long',
    name: 'Air temperature at 2 m (long record, coarse)',
    unit: '°C',
    icon: 'hourglass',
    blurb: 'The longest temperature record, seen from farther away.',
  },
]
