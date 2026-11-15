// Climate variables the player can investigate. Mirrors the `variables` table that
// archivos_preSupabase/etl_espana.py fills (VARS: id, name_en, unit; schema in supabase_schema.sql).
// Static list: the UI does not query the database for it. Keep the ids in sync with that file.
// `shortName`, `icon` and `blurb` are UI-only extras (they are not in the database).
import { L } from './i18n'

/** Small pictogram drawn next to the variable in the interface */
export type VariableIcon = 'thermometer' | 'wind' | 'soil' | 'evaporation' | 'rain' | 'hourglass'

export interface ClimateVariable {
  /** Database id (variables.id), e.g. "tair" */
  id: string
  /** Name shown in the game (variables.name_en) */
  name: string
  /** One-line label under the clue medallion; the full name and unit show on hover/focus */
  shortName: string
  unit: string
  icon: VariableIcon
  /** One plain-English line that invites the player to look (never a conclusion) */
  blurb: string
}

export const CLIMATE_VARIABLES: readonly ClimateVariable[] = [
  {
    id: 'tair',
    name: L('Air temperature (near surface)', 'Temperatura del aire (junto al suelo)'),
    shortName: L('Air temperature', 'Temperatura del aire'),
    unit: '°C',
    icon: 'thermometer',
    blurb: L('Is the air here heating up or cooling down?', '¿El aire de aquí se calienta o se enfría?'),
  },
  {
    id: 'wind',
    name: L('Wind speed (near surface)', 'Velocidad del viento (junto al suelo)'),
    shortName: L('Wind speed', 'Velocidad del viento'),
    unit: 'm/s',
    icon: 'wind',
    blurb: L('Are the winds picking up or dying down?', '¿El viento sopla más fuerte o se calma?'),
  },
  {
    id: 'soilmoist',
    name: L('Topsoil moisture (0-10 cm)', 'Humedad del suelo superficial (0-10 cm)'),
    shortName: L('Soil moisture', 'Humedad del suelo'),
    unit: 'kg/m²',
    icon: 'soil',
    blurb: L('How wet is the top layer of the ground?', '¿Cómo de húmeda está la capa de arriba del suelo?'),
  },
  {
    id: 'evap',
    name: L('Evapotranspiration', 'Evapotranspiración'),
    shortName: L('Evapotranspiration', 'Evapotranspiración'),
    unit: 'mm/day',
    icon: 'evaporation',
    blurb: L('How much water rises from soil and plants?', '¿Cuánta agua sube del suelo y de las plantas?'),
  },
  {
    id: 'precip',
    name: L('Precipitation', 'Precipitación'),
    shortName: L('Precipitation', 'Precipitación'),
    unit: 'mm/day',
    icon: 'rain',
    blurb: L('How much rain and snow falls here?', '¿Cuánta lluvia y nieve cae aquí?'),
  },
  {
    id: 't2m_long',
    name: L('Air temperature at 2 m (long record, coarse)', 'Temperatura del aire a 2 m (serie larga, más gruesa)'),
    shortName: L('Long record', 'Serie larga'),
    unit: '°C',
    icon: 'hourglass',
    blurb: L('The longest temperature record, seen from farther away.', 'La serie de temperatura más larga, vista desde más lejos.'),
  },
]
