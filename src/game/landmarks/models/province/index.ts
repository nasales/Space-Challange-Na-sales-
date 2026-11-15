// Small monuments of the provincial capitals (one per capital that had no landmark yet). Visual
// only: in landmarks.json they carry `"travel": false`, so they stay off the M travel map.
// Each gets a soft floodlight at night (one halo in front, added here).
import * as THREE from 'three'
import type { Kit } from '../../kit'
import type { LandmarkModel } from '../index'
import { hillBase, pavedBase } from './parts'
import * as castile from './castile'
import * as north from './north'
import * as east from './east'
import * as south from './south'

/** Adds one soft night floodlight in front of the model (its +Z side), sized to it. */
const withGlow = (build: (kit: Kit) => THREE.Group) => (kit: Kit) => {
  const g = build(kit)
  const box = new THREE.Box3().setFromObject(g)
  const w = box.max.x - box.min.x, h = box.max.y - box.min.y
  g.add(kit.lightHalo(Math.max(w, h) * 0.32, (box.max.x + box.min.x) / 2, h * 0.35, box.max.z + 1.5, 0.35))
  return g
}

const paved = (build: (kit: Kit) => THREE.Group): LandmarkModel => ({ build: withGlow(build), base: pavedBase(), margin: 2.5 })
const onHill = (build: (kit: Kit) => THREE.Group, top: number): LandmarkModel => ({ build: withGlow(build), base: hillBase(top), margin: 3 })

export const PROVINCE_MODELS: Record<string, LandmarkModel> = {
  'muralla-avila': paved(castile.buildMurallaAvila),
  'catedral-leon': paved(castile.buildCatedralLeon),
  'cristo-otero': onHill(castile.buildCristoOtero, 5),
  'arcos-soria': paved(castile.buildArcosSoria),
  'san-pablo-valladolid': paved(castile.buildSanPabloValladolid),
  'catedral-zamora': paved(castile.buildCatedralZamora),
  'palacio-infantado': paved(castile.buildPalacioInfantado),
  'puerta-toledo-ciudad-real': paved(castile.buildPuertaToledoCR),
  'puerta-hierros': paved(castile.buildPuertaHierros),
  'torre-bujaco': paved(castile.buildTorreBujaco),
  'puerta-palmas': paved(castile.buildPuertaPalmas),
  'catedral-oviedo': paved(north.buildCatedralOviedo),
  'palacio-magdalena': paved(north.buildPalacioMagdalena),
  'muralla-lugo': paved(north.buildMurallaLugo),
  peregrina: paved(north.buildPeregrina),
  'buen-pastor': paved(north.buildBuenPastor),
  'santa-maria-vitoria': paved(north.buildSantaMariaVitoria),
  'ayuntamiento-pamplona': paved(north.buildAyuntamientoPamplona),
  'la-redonda': paved(north.buildLaRedonda),
  'catedral-girona': paved(east.buildCatedralGirona),
  'seu-vella': onHill(east.buildSeuVella, 6),
  'amfiteatre-tarragona': paved(east.buildAmfiteatreTarragona),
  'catedral-huesca': paved(east.buildCatedralHuesca),
  'torre-salvador': paved(east.buildTorreSalvador),
  fadri: paved(east.buildFadri),
  'santa-barbara': onHill(east.buildSantaBarbara, 9),
  'la-seu-palma': paved(east.buildLaSeuPalma),
  'colon-huelva': paved(south.buildColonHuelva),
  'catedral-jaen': paved(south.buildCatedralJaen),
  manquita: paved(south.buildManquita),
}
