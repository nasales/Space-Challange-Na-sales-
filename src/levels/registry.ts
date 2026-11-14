// Level component of each featured case, by case id (data/cases_index.json).
// A case without an entry shows the placeholder card. To add a level:
//   import DanaValenciaLevel from './cases/DanaValenciaLevel'
//   export const LEVELS = { dana_valencia: DanaValenciaLevel, ... }
import type { ComponentType } from 'react'
import AlmeriaLevel from './almeria/AlmeriaLevel'
import AnetoLevel from './aneto/AnetoLevel'
import DonanaLevel from './donana/DonanaLevel'
import FilomenaLevel from './filomena/FilomenaLevel'
import type { CaseLevelProps } from './types'

export const LEVELS: Partial<Record<string, ComponentType<CaseLevelProps>>> = {
  filomena_madrid: FilomenaLevel,
  donana: DonanaLevel,
  almeria_murcia: AlmeriaLevel,
  aneto_glacier: AnetoLevel,
}

export function getLevel(caseId: string): ComponentType<CaseLevelProps> | undefined {
  return LEVELS[caseId]
}
