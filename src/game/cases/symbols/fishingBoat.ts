// Small fishing boat (ebro_delta): blue hull with a white rim and a red keel stripe, a white
// wheelhouse, a mast with a boom and a lamp. Bow at +X.
import * as THREE from 'three'
import { extrudeCentred, type SymbolKit } from './kit'

const HULL = 0x2f6fd6
const RIM = 0xf6f1e4
const KEEL = 0xd8432e
const CABIN = 0xf6f1e4
const ROOF = 0xd8432e
const WINDOW = 0x2a3550
const MAST = 0x9a6a3c
const LAMP = 0xffd23a

/** Hull side profile (x, y): flat stern at -X, raised pointed bow at +X; beam (width). */
const HULL_LENGTH = 130
const HULL_HEIGHT = 40
const BOW_RISE = 14
const HULL_BEAM = 46
/** Rim (gunwale) and keel stripe heights. */
const RIM_HEIGHT = 6
const KEEL_HEIGHT = 9
/** How far the rim sticks out of the hull sides; keel width as a fraction of the beam. */
const RIM_OUT = 2
const KEEL_BEAM = 0.7
/** Wheelhouse: size and x position; roof overhang. */
const CABIN_SIZE = { x: 34, y: 30, z: 32 }
const CABIN_X = -22
const ROOF_OVERHANG = 4
const ROOF_THICKNESS = 5
/** Windows: size, on both sides and at the front. */
const WINDOW_SIZE = { w: 10, h: 9 }
/** Mast: x position, radius and top height; boom length and height; lamp size. */
const MAST_X = 18
const MAST_RADIUS = 3.2
const MAST_TOP = 156
const BOOM_LENGTH = 46
const BOOM_Y = 78
const LAMP_SIZE = 8

/** How far the bow and the stern lean out per unit of height. */
const BOW_RAKE = 0.6
const STERN_RAKE = 0.25

/** Side outline of one horizontal band of the hull, from y0 to y1; the top bow corner rises by `rise`. */
function hullProfile(y0: number, y1: number, rise = 0) {
  const half = HULL_LENGTH / 2
  const bowX = (y: number) => half - HULL_HEIGHT * BOW_RAKE + y * BOW_RAKE
  const sternX = (y: number) => -half + (HULL_HEIGHT - y) * STERN_RAKE
  const s = new THREE.Shape()
  s.moveTo(sternX(y0), y0)
  s.lineTo(bowX(y0), y0)
  s.lineTo(bowX(y1 + rise), y1 + rise)
  s.lineTo(sternX(y1), y1)
  s.closePath()
  return s
}

export function buildFishingBoat(kit: SymbolKit) {
  const root = new THREE.Group()
  const keelGeo = kit.geo('boat.keel', () => extrudeCentred(hullProfile(0, KEEL_HEIGHT), HULL_BEAM * KEEL_BEAM))
  root.add(kit.part(keelGeo, kit.mat(KEEL)))
  const hullGeo = kit.geo('boat.hull', () => extrudeCentred(hullProfile(KEEL_HEIGHT, HULL_HEIGHT - RIM_HEIGHT), HULL_BEAM))
  root.add(kit.part(hullGeo, kit.mat(HULL)))
  const rimGeo = kit.geo('boat.rim', () => extrudeCentred(hullProfile(HULL_HEIGHT - RIM_HEIGHT, HULL_HEIGHT, BOW_RISE), HULL_BEAM + RIM_OUT * 2))
  root.add(kit.part(rimGeo, kit.mat(RIM)))

  const deckY = HULL_HEIGHT - RIM_HEIGHT
  const cabinGeo = kit.geo('boat.cabin', () => new THREE.BoxGeometry(CABIN_SIZE.x, CABIN_SIZE.y, CABIN_SIZE.z))
  root.add(kit.part(cabinGeo, kit.mat(CABIN), CABIN_X, deckY + CABIN_SIZE.y / 2, 0))
  const roofGeo = kit.geo('boat.roof', () =>
    new THREE.BoxGeometry(CABIN_SIZE.x + ROOF_OVERHANG * 2, ROOF_THICKNESS, CABIN_SIZE.z + ROOF_OVERHANG * 2),
  )
  root.add(kit.part(roofGeo, kit.mat(ROOF), CABIN_X, deckY + CABIN_SIZE.y + ROOF_THICKNESS / 2, 0))
  const winGeo = kit.geo('boat.window', () => new THREE.BoxGeometry(WINDOW_SIZE.w, WINDOW_SIZE.h, 1.5))
  const winY = deckY + CABIN_SIZE.y * 0.62
  const win = kit.mat(WINDOW)
  for (const side of [-1, 1]) {
    for (const dx of [-8, 8]) root.add(kit.part(winGeo, win, CABIN_X + dx, winY, side * (CABIN_SIZE.z / 2 + 0.5)))
    const front = kit.part(winGeo, win, CABIN_X + CABIN_SIZE.x / 2 + 0.5, winY, side * 7)
    front.rotation.y = Math.PI / 2
    root.add(front)
  }

  const mastGeo = kit.geo('boat.mast', () => new THREE.CylinderGeometry(MAST_RADIUS * 0.8, MAST_RADIUS, MAST_TOP - deckY, 6))
  const wood = kit.mat(MAST)
  root.add(kit.part(mastGeo, wood, MAST_X, (MAST_TOP + deckY) / 2, 0))
  const boomGeo = kit.geo('boat.boom', () => new THREE.CylinderGeometry(MAST_RADIUS * 0.7, MAST_RADIUS * 0.7, BOOM_LENGTH, 5))
  const boom = kit.part(boomGeo, wood, MAST_X + BOOM_LENGTH / 2 - 4, BOOM_Y, 0)
  boom.rotation.z = Math.PI / 2 - 0.35 // raised toward the bow
  root.add(boom)
  const lampGeo = kit.geo('boat.lamp', () => new THREE.OctahedronGeometry(LAMP_SIZE, 0))
  root.add(kit.part(lampGeo, kit.mat(LAMP), MAST_X, MAST_TOP - LAMP_SIZE * 0.2, 0))
  return root
}
