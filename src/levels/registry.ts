// Level component of each featured case, by case id (data/cases_index.json).
// A case without an entry shows the placeholder card. To add a level:
//   import DanaValenciaLevel from './cases/DanaValenciaLevel'
//   export const LEVELS = { dana_valencia: DanaValenciaLevel, ... }
import type { ComponentType } from 'react'
import type { CaseLevelProps } from './types'

export const LEVELS: Partial<Record<string, ComponentType<CaseLevelProps>>> = {}

export function getLevel(caseId: string): ComponentType<CaseLevelProps> | undefined {
  return LEVELS[caseId]
}
