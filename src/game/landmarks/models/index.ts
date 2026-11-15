// Registro de modelos: id del monumento (en landmarks.json) → cómo se construye.
// Los monumentos sin modelo todavía no se dibujan.
import type * as THREE from 'three'
import type { Kit } from '../kit'
import { buildPuertaDeAlcala, buildPuertaDeAlcalaBase } from './puertaDeAlcala'
import { buildAcueductoSegovia } from './acueductoSegovia'
import { buildSagradaFamilia } from './sagradaFamilia'
import { buildGiralda, buildGiraldaBase } from './giralda'
import { buildAlhambra, buildAlhambraBase } from './alhambra'
import { buildCatedralSantiago, buildCatedralSantiagoBase } from './catedralSantiago'
import { buildGuggenheim, buildGuggenheimBase } from './guggenheim'
import { buildCiudadArtes, buildCiudadArtesBase } from './ciudadArtes'
import { buildTorreHercules, buildTorreHerculesBase } from './torreHercules'
import { buildMezquitaCordoba, buildMezquitaCordobaBase } from './mezquitaCordoba'
import { buildCatedralBurgos, buildCatedralBurgosBase } from './catedralBurgos'
import { buildTeatroMerida, buildTeatroMeridaBase } from './teatroMerida'
import { buildBasilicaPilar, buildBasilicaPilarBase } from './basilicaPilar'
import { buildPlazaMayorSalamanca, buildPlazaMayorSalamancaBase } from './plazaMayorSalamanca'
import { buildCasasColgadas, buildCasasColgadasBase } from './casasColgadas'
import { buildCastilloPenafiel, buildCastilloPenafielBase } from './castilloPenafiel'
import { buildCatedralMurcia, buildCatedralMurciaBase } from './catedralMurcia'
import { buildAlcazarToledo, buildAlcazarToledoBase } from './alcazarToledo'
import { buildAlcazabaAlmeria, buildAlcazabaAlmeriaBase } from './alcazabaAlmeria'
import { PROVINCE_MODELS } from './province'

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
  giralda: { build: buildGiralda, base: buildGiraldaBase, margin: 6 },
  alhambra: { build: buildAlhambra, base: buildAlhambraBase, margin: 8 },
  'catedral-santiago': { build: buildCatedralSantiago, base: buildCatedralSantiagoBase, margin: 5 },
  guggenheim: { build: buildGuggenheim, base: buildGuggenheimBase, margin: 8 },
  'ciudad-artes': { build: buildCiudadArtes, base: buildCiudadArtesBase, margin: 6 },
  'torre-hercules': { build: buildTorreHercules, base: buildTorreHerculesBase, margin: 9 },
  'mezquita-cordoba': { build: buildMezquitaCordoba, base: buildMezquitaCordobaBase, margin: 6 },
  'catedral-burgos': { build: buildCatedralBurgos, base: buildCatedralBurgosBase, margin: 5 },
  'teatro-merida': { build: buildTeatroMerida, base: buildTeatroMeridaBase, margin: 6 },
  'basilica-pilar': { build: buildBasilicaPilar, base: buildBasilicaPilarBase, margin: 6 },
  'plaza-mayor-salamanca': { build: buildPlazaMayorSalamanca, base: buildPlazaMayorSalamancaBase, margin: 4 },
  'casas-colgadas': { build: buildCasasColgadas, base: buildCasasColgadasBase, margin: 6 },
  'castillo-penafiel': { build: buildCastilloPenafiel, base: buildCastilloPenafielBase, margin: 4 },
  'catedral-murcia': { build: buildCatedralMurcia, base: buildCatedralMurciaBase, margin: 6 },
  'alcazar-toledo': { build: buildAlcazarToledo, base: buildAlcazarToledoBase, margin: 6 },
  'alcazaba-almeria': { build: buildAlcazabaAlmeria, base: buildAlcazabaAlmeriaBase, margin: 10 },
  // One small monument per provincial capital (visual only, not on the travel map)
  ...PROVINCE_MODELS,
}
