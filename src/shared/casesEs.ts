// Spanish text for the featured cases (src/shared/i18n.ts). The English originals live in
// data/cases_index.json and data/tutorial_data/<case_id>.json; only what the player sees is here.
// The Spanish story scripts are in data/tutorials/es/<case_id>.json.
import { LANG } from './i18n'

export interface CaseTextEs {
  title: string
  place: string
  question: string
}

export const CASES_ES: Record<string, CaseTextEs> = {
  dana_valencia: {
    title: 'La DANA de Valencia',
    place: 'Valencia',
    question: 'Tras las inundaciones de la DANA de 2024, ¿llueve cada vez más en Valencia, o está cambiando otra cosa?',
  },
  donana: {
    title: 'Los humedales de Doñana',
    place: 'Doñana',
    question: 'Doñana se está quedando sin agua. ¿Es la lluvia, o algo que los satélites no pueden ver?',
  },
  sierra_culebra: {
    title: 'El incendio de la Sierra de la Culebra',
    place: 'Sierra de la Culebra (Zamora)',
    question: 'Tras el gran incendio de 2022, ¿se está volviendo la Sierra de la Culebra más cálida y seca?',
  },
  galicia_fires: {
    title: 'Los incendios de Galicia',
    place: 'Ourense (Galicia)',
    question: 'Galicia es verde y húmeda, y aun así arde cada vez más. ¿Qué dicen la temperatura y el suelo?',
  },
  ebro_delta: {
    title: 'El delta del Ebro',
    place: 'Delta del Ebro',
    question: 'Tras la borrasca Gloria, ¿está cambiando el clima del delta del Ebro?',
  },
  filomena_madrid: {
    title: 'La borrasca Filomena',
    place: 'Madrid',
    question: 'Si Madrid tuvo su mayor nevada en medio siglo, ¿significa eso que no se está calentando?',
  },
  almeria_murcia: {
    title: 'Las tierras secas de Almería y Murcia',
    place: 'Almería-Murcia',
    question: '¿Se está volviendo el sureste de España todavía más seco?',
  },
  cordoba_heat: {
    title: 'El calor de Córdoba',
    place: 'Córdoba',
    question: 'Córdoba no deja de batir récords de calor. ¿Es de verdad cada verano más caluroso, o fueron solo años malos?',
  },
  aneto_glacier: {
    title: 'El glaciar del Aneto',
    place: 'Aneto (Pirineos)',
    question: 'El mayor glaciar de los Pirineos está menguando. ¿Es el calor, o hay menos nieve y lluvia?',
  },
  daimiel: {
    title: 'Las Tablas de Daimiel',
    place: 'Tablas de Daimiel',
    question: 'El humedal de las Tablas de Daimiel se sigue secando. ¿Está mandando el cielo menos agua?',
  },
}

/** Spanish names of the variables used in data/tutorial_data/*.json (by variable code) */
export const CASE_VARIABLE_NAMES_ES: Record<string, string> = {
  T2M: 'Temperatura del aire a 2 m',
  PRECIP: 'Precipitación',
  SOILM: 'Humedad del suelo (10 cm superiores)',
}

/** A case's text in the current language (English = the original from data/cases_index.json) */
export function localCase<T extends { id: string; title: string; place: string; question?: string }>(c: T): T {
  const es = LANG === 'es' ? CASES_ES[c.id] : undefined
  if (!es) return c
  return { ...c, title: es.title, place: es.place, ...(c.question !== undefined ? { question: es.question } : {}) }
}
