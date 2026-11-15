// Acueducto de Segovia: dos pisos de arcos de granito (abajo altos, arriba bajos)
// y el canal del agua encima. Va a lo largo del eje X.
import * as THREE from 'three'
import type { Kit, Opening } from '../kit'

const GRANITE = 0xbba27e
const BAND = 0xa68e6c

export function buildAcueductoSegovia(kit: Kit): THREE.Group {
  const g = new THREE.Group()
  const ARCHES = 16
  const SPAN = 5.6 // pilar + hueco
  const L = ARCHES * SPAN + 2
  const D = 2.6
  const LOW = 15, HIGH = 6.6, BAND_H = 0.8

  const arches = (width: number, height: number, bottom: number): Opening[] =>
    Array.from({ length: ARCHES }, (_, i) => ({
      x: -L / 2 + 1 + SPAN * (i + 0.5),
      width,
      height,
      bottom,
      arch: true,
    }))

  // Piso de abajo: arcos altos y estrechos
  g.add(kit.facade(L, LOW, D, arches(3.6, 10.6, 0), GRANITE))
  // Imposta que separa los pisos
  g.add(kit.box(L + 0.6, BAND_H, D + 0.8, BAND, 0, LOW, 0))
  // Piso de arriba: arcos más bajos
  const upper = kit.facade(L, HIGH, D * 0.9, arches(3.2, 2.8, 0.8), GRANITE)
  upper.position.y = LOW + BAND_H
  g.add(upper)
  // Canal del agua en lo alto
  g.add(kit.box(L + 0.4, 1.2, D * 0.9 + 0.4, BAND, 0, LOW + BAND_H + HIGH, 0))
  // Night lights: a warm glow under every other tall arch
  for (let i = 0; i < ARCHES; i += 2) g.add(kit.lightHalo(3, -L / 2 + 1 + SPAN * (i + 0.5), 5, 0, 0.7))
  return g
}
