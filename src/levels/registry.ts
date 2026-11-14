// Level component of each featured case, by case id (data/cases_index.json).
// A case without an entry shows the placeholder card. To add a level:
//   import DanaValenciaLevel from './cases/DanaValenciaLevel'
//   export const LEVELS = { dana_valencia: DanaValenciaLevel, ... }
import type { ComponentType } from 'react'
import AlmeriaLevel from './almeria/AlmeriaLevel'
import AnetoLevel from './aneto/AnetoLevel'
import CordobaLevel from './cordoba/CordobaLevel'
import CulebraLevel from './culebra/CulebraLevel'
import DanaLevel from './dana/DanaLevel'
import DonanaLevel from './donana/DonanaLevel'
import EbroLevel from './ebro/EbroLevel'
import FilomenaLevel from './filomena/FilomenaLevel'
import GaliciaLevel from './galicia/GaliciaLevel'
import type { CaseLevelProps } from './types'

export const LEVELS: Partial<Record<string, ComponentType<CaseLevelProps>>> = {
  filomena_madrid: FilomenaLevel,
  donana: DonanaLevel,
  almeria_murcia: AlmeriaLevel,
  aneto_glacier: AnetoLevel,
  sierra_culebra: CulebraLevel,
  dana_valencia: DanaLevel,
  galicia_fires: GaliciaLevel,
  ebro_delta: EbroLevel,
  cordoba_heat: CordobaLevel,
}

export function getLevel(caseId: string): ComponentType<CaseLevelProps> | undefined {
  return LEVELS[caseId]
}
