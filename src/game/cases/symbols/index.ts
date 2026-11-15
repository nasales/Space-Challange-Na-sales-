// One symbol per featured case (caseId -> builder). A case without an entry here keeps the "!"
// drawn by createCaseMarkers. To add a symbol: new file in this folder + one line below.
import type { SymbolBuilder } from './kit'
import { buildPaella } from './paella'
import { buildFlamingo } from './flamingo'
import { buildPineTree } from './pineTree'
import { buildFlame } from './flame'
import { buildFishingBoat } from './fishingBoat'
import { buildSnowman } from './snowman'
import { buildTomato } from './tomato'
import { buildThermometer } from './thermometer'
import { buildMountain } from './mountain'
import { buildDuck } from './duck'

export { createSymbolKit, type SymbolKit } from './kit'

export const CASE_SYMBOLS: Record<string, SymbolBuilder> = {
  dana_valencia: buildPaella,
  donana: buildFlamingo,
  sierra_culebra: buildPineTree,
  galicia_fires: buildFlame,
  ebro_delta: buildFishingBoat,
  filomena_madrid: buildSnowman,
  almeria_murcia: buildTomato,
  cordoba_heat: buildThermometer,
  aneto_glacier: buildMountain,
  daimiel: buildDuck,
}
