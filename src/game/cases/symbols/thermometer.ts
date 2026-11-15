// Thermometer (cordoba_heat): a red bulb and a tube filled red almost to the top (a high
// reading), with dark scale rings and a white empty top.
import * as THREE from 'three'
import type { SymbolKit } from './kit'

const RED = 0xe8322a
const GLASS = 0xf4f7ff // the empty part of the tube
const SCALE = 0x2a2d3a
const COLLAR = 0xc7cbd6

/** Bulb radius and tube radius (world units). */
const BULB_RADIUS = 28
const TUBE_RADIUS = 15
const TUBE_SEGMENTS = 8
/** Tube from the top of the collar to the bottom of the rounded cap; top of the red column. */
const TUBE_BOTTOM = 46
const TUBE_TOP = 146
const READING = 120
/** Collar ring between bulb and tube: radius and height. */
const COLLAR_RADIUS = 18
const COLLAR_HEIGHT = 8
/** Scale rings on the tube: thickness, how far they stand out, heights. */
const RING_HEIGHT = 2.6
const RING_OUT = 1.2
const RINGS = [64, 82, 100, 136]

export function buildThermometer(kit: SymbolKit) {
  const root = new THREE.Group()
  const red = kit.mat(RED)
  const glass = kit.mat(GLASS)
  const bulbGeo = kit.geo('thermo.bulb', () => new THREE.IcosahedronGeometry(BULB_RADIUS, 1))
  root.add(kit.part(bulbGeo, red, 0, BULB_RADIUS, 0))
  const collarGeo = kit.geo('thermo.collar', () => new THREE.CylinderGeometry(COLLAR_RADIUS, COLLAR_RADIUS, COLLAR_HEIGHT, TUBE_SEGMENTS))
  root.add(kit.part(collarGeo, kit.mat(COLLAR), 0, TUBE_BOTTOM - COLLAR_HEIGHT / 2, 0))

  const tube = (key: string, y0: number, y1: number, mat: THREE.Material) => {
    const g = kit.geo(key, () => new THREE.CylinderGeometry(TUBE_RADIUS, TUBE_RADIUS, y1 - y0, TUBE_SEGMENTS))
    root.add(kit.part(g, mat, 0, (y0 + y1) / 2, 0))
  }
  tube('thermo.column', TUBE_BOTTOM, READING, red)
  tube('thermo.empty', READING, TUBE_TOP, glass)
  const capGeo = kit.geo('thermo.cap', () => new THREE.SphereGeometry(TUBE_RADIUS, TUBE_SEGMENTS, 3, 0, Math.PI * 2, 0, Math.PI / 2))
  root.add(kit.part(capGeo, glass, 0, TUBE_TOP, 0))

  const ringGeo = kit.geo('thermo.ring', () => new THREE.CylinderGeometry(TUBE_RADIUS + RING_OUT, TUBE_RADIUS + RING_OUT, RING_HEIGHT, TUBE_SEGMENTS))
  const scale = kit.mat(SCALE)
  for (const y of RINGS) root.add(kit.part(ringGeo, scale, 0, y, 0))
  return root
}
