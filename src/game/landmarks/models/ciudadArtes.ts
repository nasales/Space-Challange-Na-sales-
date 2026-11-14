// Ciudad de las Artes y las Ciencias (Valencia, Santiago Calatrava), cartoon style: chunky, rounded
// white shapes, few fat ribs, a big bright-blue eye and vivid turquoise water. White buildings over long
// turquoise pools in the old bed of the Turia river, here brought closer together along X:
// the Palau de les Arts (west) with its tiled shells and the long "feather" on top, the
// Hemisfèric (centre), an eye whose lid is a row of white ribs over the pupil, the Museu de les
// Ciències (east) with its white "tree" ribs and glass, and the Umbracle walkway of arches (+Z).
// Units are roughly metres.
import * as THREE from 'three'
import type { Kit } from '../kit'

const WHITE = 0xfbfcfd
const TILE = 0xd9ecf5 // white broken-tile cladding (trencadís), slightly blue
const POOL = 0x1ccfe6
const GLASS = 0x8fdcff
const PUPIL = 0x2f8fe8 // the eye's big bright-blue pupil
const PLANT = 0x52c94a

const POOL_Y = 0.6 // height of the pool surface

/** Ellipsoid (or a slice of one) from a sphere with positive per-axis scale. */
function ellipsoid(kit: Kit, rx: number, ry: number, rz: number, color: number, phiLength = Math.PI * 2, thetaLength = Math.PI) {
  const geo = new THREE.SphereGeometry(1, 18, 10, 0, phiLength, 0, thetaLength)
  geo.scale(rx, ry, rz)
  return kit.mesh(geo, color)
}

function hemisferic(kit: Kit) {
  const g = new THREE.Group()
  g.add(ellipsoid(kit, 17, 1.2, 9, WHITE)) // base of the eye, flush with the water
  const pupil = ellipsoid(kit, 6.2, 6.2, 6.2, PUPIL)
  pupil.position.y = 3.2
  const shine = ellipsoid(kit, 1.4, 1.4, 1.4, WHITE) // cartoon highlight on the pupil
  shine.position.set(-2.2, 7.6, 3.2)
  g.add(shine)
  g.add(pupil)
  // The eyelid: white ribs, tallest in the middle, spanning across the eye
  for (let i = -5; i <= 5; i++) {
    const k = Math.sqrt(1 - (i / 6.2) ** 2)
    const rib = new THREE.TorusGeometry(9 * k, 0.75, 6, 14, Math.PI)
    rib.scale(1, 0.85, 1)
    rib.rotateY(Math.PI / 2)
    g.add(kit.mesh(rib, WHITE, i * 2.8, 0.4, 0))
  }
  // Long ridge beam joining the top of the ribs
  g.add(kit.box(31, 1.2, 1.6, WHITE, 0, 7.2, 0))
  return g
}

function palauDeLesArts(kit: Kit) {
  const g = new THREE.Group()
  const core = ellipsoid(kit, 12, 13, 9, TILE)
  core.position.y = 2
  g.add(core)
  // Two outer shells that wrap the core, open at the ends
  for (const side of [-1, 1]) {
    const shell = ellipsoid(kit, 15, 12, 11, WHITE, Math.PI)
    shell.rotation.y = side < 0 ? 0 : Math.PI
    shell.rotation.z = side * 0.12
    shell.position.set(side * 1.5, 1, 0)
    g.add(shell)
  }
  // The "feather": a long thin blade arching over the top
  const s = new THREE.Shape()
  s.moveTo(-16, 6)
  s.bezierCurveTo(-8, 20, 6, 24, 18, 26)
  s.lineTo(18.5, 24.6)
  s.bezierCurveTo(6, 21.5, -6, 18, -13, 5)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.5, bevelSegments: 2, curveSegments: 14 })
  geo.translate(0, 0, -1.5)
  g.add(kit.mesh(geo, WHITE))
  return g
}

function museuCiencies(kit: Kit) {
  const g = new THREE.Group()
  const L = 48, D = 18, H = 16
  g.add(kit.box(L, H, D, GLASS))
  // Front: a row of white "trees" (Y-shaped columns) holding a beam
  const n = 9
  for (let i = 0; i <= n; i++) {
    const x = -L / 2 + (L * i) / n
    for (const lean of [-0.28, 0.28]) {
      const arm = kit.box(1.5, H - 2, 1.5, WHITE, x, 0, D / 2 + 1.2)
      arm.position.set(x - Math.sin(lean) * (H - 2) / 2, (H - 2) / 2, D / 2 + 1.2) // feet together: a V
      arm.rotation.z = lean
      g.add(arm)
    }
  }
  g.add(kit.box(L + 2, 1.6, 2.4, WHITE, 0, H - 1.6, D / 2 + 1.2))
  // Roof: a comb of white triangular teeth across the building
  for (let i = 0; i < n; i++) {
    const tooth = kit.pediment(L / n - 0.4, 3.4, D + 2, WHITE, H)
    tooth.position.x = -L / 2 + (L * (i + 0.5)) / n
    g.add(tooth)
  }
  // Solid white ends
  for (const x of [-L / 2 - 1, L / 2 + 1]) g.add(kit.box(2, H + 3, D + 2, WHITE, x, 0, 0))
  return g
}

/** Umbracle: a long walkway under white arches, with planters along it. Runs along X. */
function umbracle(kit: Kit, length: number) {
  const g = new THREE.Group()
  const n = Math.floor(length / 8)
  for (let i = 0; i <= n; i++) {
    const arch = new THREE.TorusGeometry(5, 0.7, 6, 12, Math.PI)
    arch.scale(1, 1.3, 1)
    arch.rotateY(Math.PI / 2)
    g.add(kit.mesh(arch, WHITE, -length / 2 + (length * i) / n, 0, 0))
  }
  for (const z of [-3, 3]) {
    g.add(kit.box(length, 0.9, 0.9, WHITE, 0, 6, z * 0.9)) // top beams
    g.add(kit.box(length - 2, 0.7, 1.4, PLANT, 0, 6.8, z * 0.9)) // vines growing over them
  }
  for (const z of [-3.6, 3.6]) {
    g.add(kit.box(length, 0.8, 1.4, 0xd9d3c4, 0, 0, z))
    g.add(kit.box(length - 1, 0.9, 1, PLANT, 0, 0.8, z))
  }
  return g
}

export function buildCiudadArtes(kit: Kit): THREE.Group {
  const g = new THREE.Group()
  // Long pool under all the buildings
  g.add(kit.box(170, POOL_Y, 30, POOL, 0, 0, 0))
  for (const z of [-15.5, 15.5]) g.add(kit.box(172, 0.9, 1, 0xd9d3c4, 0, 0, z)) // pool edges

  const palau = palauDeLesArts(kit)
  palau.position.set(-62, POOL_Y, 0)
  g.add(palau)
  const eye = hemisferic(kit)
  eye.position.set(-6, POOL_Y, 0)
  g.add(eye)
  const museu = museuCiencies(kit)
  museu.position.set(54, POOL_Y, -2)
  g.add(museu)
  const walk = umbracle(kit, 140)
  walk.position.set(0, 0, 24)
  g.add(walk)
  return g
}

/**
 * Gardens of the old riverbed: light paving, lawns and a row of palm-like trees.
 * w and d: size of the base (model units). Returns the group and the height of its surface.
 */
export function buildCiudadArtesBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 0.3
  g.add(kit.box(w + 16, 0.03, d + 16, 0x8fd16a)) // riverbed park
  g.add(kit.box(w, top, d, 0xe9e4d8))
  for (const z of [-d / 2 + 3, d / 2 - 3]) g.add(kit.box(w - 6, 0.15, 3, 0x6cc24a, 0, top, z)) // lawns
  // Palms along the lawns: thin trunk and a star of leaves
  for (let x = -w / 2 + 8; x < w / 2 - 4; x += 14) {
    for (const z of [-d / 2 + 3, d / 2 - 3]) {
      g.add(kit.box(0.5, 7, 0.5, 0x8a6a46, x, top, z))
      for (let k = 0; k < 5; k++) {
        const leaf = kit.box(3.4, 0.25, 0.8, 0x3f9b46, x, top + 7, z)
        leaf.rotation.set(0, (k * Math.PI * 2) / 5, -0.35)
        leaf.position.x += Math.cos((k * Math.PI * 2) / 5) * 1.4
        leaf.position.z -= Math.sin((k * Math.PI * 2) / 5) * 1.4
        g.add(leaf)
      }
    }
  }
  return { group: g, top }
}
