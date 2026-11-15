// Witnesses of the featured cases: a 3D character standing next to each case marker on the map.
// The game builds the model from `look`; the UI shows `name` and `role` in the dialogue.
// Fictional adults only (AGENTS.md rule 11): never real victims or real people.
// Changing this file needs agreement from Data (Diego), Interface and Game.
import { L } from './i18n'

export type HairStyle = 'short' | 'bald' | 'bun' | 'long' | 'curly'
export type HatStyle = 'none' | 'cap' | 'straw' | 'beret'

export interface WitnessLook {
  /** CSS hex colours */
  skin: string
  hair: string
  hairStyle: HairStyle
  shirt: string
  trousers: string
  hat: HatStyle
  hatColor?: string
  beard?: boolean
  glasses?: boolean
  /** Optional apron / vest colour over the shirt */
  apron?: string
  /** 0.9-1.1, relative to the detective's height */
  height?: number
}

export interface Witness {
  caseId: string
  name: string
  /** Short role shown under the name, e.g. "Orange farmer, l'Horta Sud" */
  role: string
  look: WitnessLook
}

/** Cases with a witness on the map. Start: Valencia DANA. */
export const WITNESSES: Partial<Record<string, Witness>> = {
  dana_valencia: {
    caseId: 'dana_valencia',
    name: 'Vicent',
    role: L("Retired orange farmer, l'Horta Sud", "Naranjero jubilado, l'Horta Sud"),
    look: {
      skin: '#d9a77c',
      hair: '#d8d8d8',
      hairStyle: 'short',
      shirt: '#5b7fb8',
      trousers: '#4a4038',
      hat: 'cap',
      hatColor: '#2f3a4a',
      beard: false,
      glasses: true,
      apron: '#7a8c4a',
      height: 0.96,
    },
  },
  filomena_madrid: {
    caseId: 'filomena_madrid',
    name: 'Pilar',
    role: L('Newspaper kiosk owner, Madrid', 'Dueña de un quiosco de prensa, Madrid'),
    look: {
      skin: '#e8b892',
      hair: '#b9b4ae',
      hairStyle: 'curly',
      shirt: '#b8433a',
      trousers: '#3a3f55',
      hat: 'beret',
      hatColor: '#2b2f45',
      glasses: true,
      apron: '#d9c38c',
      height: 0.92,
    },
  },
  cordoba_heat: {
    caseId: 'cordoba_heat',
    name: 'Rafael',
    role: L('Olive farmer, Guadalquivir valley', 'Olivarero, valle del Guadalquivir'),
    look: {
      skin: '#c48a5c',
      hair: '#2b2420',
      hairStyle: 'short',
      shirt: '#f2efe6',
      trousers: '#5c6a3c',
      hat: 'straw',
      hatColor: '#e2c27a',
      beard: true,
      height: 1.02,
    },
  },
  aneto_glacier: {
    caseId: 'aneto_glacier',
    name: 'Jordi',
    role: L('Mountain hut keeper, Pyrenees', 'Guarda de refugio, Pirineos'),
    look: {
      skin: '#d6a07a',
      hair: '#6b4a32',
      hairStyle: 'short',
      shirt: '#c0392b',
      trousers: '#3b4252',
      hat: 'cap',
      hatColor: '#2e5e8c',
      beard: true,
      apron: '#e0b04a',
      height: 1.04,
    },
  },
  donana: {
    caseId: 'donana',
    name: 'Carmen',
    role: L('Birdwatching guide, Doñana', 'Guía de observación de aves, Doñana'),
    look: {
      skin: '#c99068',
      hair: '#3a2a20',
      hairStyle: 'bun',
      shirt: '#7c8a4e',
      trousers: '#c8b48a',
      hat: 'straw',
      hatColor: '#d9bf86',
      glasses: false,
      apron: '#5e6b3a',
      height: 0.95,
    },
  },
}

export function getWitness(caseId: string): Witness | undefined {
  return WITNESSES[caseId]
}
