// Registro de modelos: id del monumento (en landmarks.json) → cómo se construye.
// Los monumentos sin modelo todavía no se dibujan.
import type * as THREE from 'three'
import type { Kit } from '../kit'
import { buildPuertaDeAlcala, buildPuertaDeAlcalaBase } from './puertaDeAlcala'
import { buildAcueductoSegovia } from './acueductoSegovia'
import { buildSagradaFamilia } from './sagradaFamilia'

export interface LandmarkModel {
  /** El monumento en sí (unidades del modelo, base en y = 0). */
  build: (kit: Kit) => THREE.Group
  /**
   * Suelo propio (jardín, plaza...) de tamaño w x d. Si no hay, se usa una losa de piedra.
   * Devuelve el grupo y la altura de su superficie, donde se apoya el monumento.
   */
  base?: (kit: Kit, w: number, d: number) => { group: THREE.Group; top: number }
  /** Cuánto sobresale el suelo alrededor del monumento (unidades del modelo). */
  margin?: number
}

export const LANDMARK_MODELS: Record<string, LandmarkModel> = {
  'puerta-de-alcala': { build: buildPuertaDeAlcala, base: buildPuertaDeAlcalaBase, margin: 3 },
  'acueducto-segovia': { build: buildAcueductoSegovia },
  'sagrada-familia': { build: buildSagradaFamilia },
}
