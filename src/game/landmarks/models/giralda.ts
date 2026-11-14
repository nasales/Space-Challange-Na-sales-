// La Giralda (Seville). Bell tower of the cathedral: a square 12th-century Almohad brick shaft
// (former minaret) decorated on every face with paired horseshoe windows (ajimeces) in the
// middle band and diamond "sebka" lattice panels on the side bands. On top, the Renaissance
// belfry by Hernán Ruiz (1568): bell body with open arches, the "azucenas" body, the "estrellas"
// body, a small dome and the bronze Giraldillo weathervane. Around it, an orange-tree plaza.
// Units are roughly metres; the main face looks toward +Z.
import * as THREE from 'three'
import type { Kit } from '../kit'
import { balustrade, horseshoeArch, orangeTree, pinnacle, sebkaPanel, statue } from '../ornaments'

const BRICK = 0xd9a066 // ochre brick of the shaft
const RELIEF = 0xb97a45 // darker brick of the sebka and frames
const TRIM = 0xf3ead6 // white stone of the belfry
const HOLE = 0x4a3022 // window recesses
const BRONZE = 0x5b4632
const GOLD = 0xf2c14e
const BELL = 0x8a6a3a
const DOME = 0xd9a24e

const S = 13.6 // side of the shaft
const SHAFT_H = 58

/** Paired horseshoe window with a white mullion, inside a slightly larger relief frame. */
function ajimez(kit: Kit, w: number, h: number) {
  const g = new THREE.Group()
  const frame = horseshoeArch(kit, w, h, 0.25, RELIEF)
  g.add(frame)
  const each = w * 0.38
  for (const side of [-1, 1]) {
    const a = horseshoeArch(kit, each, h * 0.82, 0.3, HOLE)
    a.position.set(side * w * 0.22, h * 0.12, 0.05)
    g.add(a)
  }
  g.add(kit.mesh(new THREE.CylinderGeometry(w * 0.035, w * 0.035, h * 0.95, 6), TRIM, 0, h * 0.12 + h * 0.475, 0.2))
  return g
}

/** Decoration of one shaft face (facing +Z, sitting on the face plane z = 0). */
function shaftFace(kit: Kit) {
  const g = new THREE.Group()
  const side = 4.2 // width of each side band
  const midX = S / 2 - side / 2 - 0.5

  // Middle band: a column of windows, small single ones low down, ajimeces higher up
  g.add(kit.box(4.6, SHAFT_H - 6, 0.15, RELIEF, 0, 3, 0.05)) // recessed strip behind the windows
  for (const y of [6, 13]) {
    const a = horseshoeArch(kit, 1.2, 1.8, 0.3, HOLE)
    a.position.set(0, y, 0.2)
    g.add(a)
  }
  for (const y of [20, 28, 36, 44, 51]) {
    const w = ajimez(kit, 3.4, 3.4)
    w.position.set(0, y, 0.2)
    g.add(w)
  }

  // Side bands: arcade of small blind arches and, above it, a tall sebka panel
  for (const sx of [-midX, midX]) {
    const arcadeY = 21
    for (const dx of [-1.25, 0, 1.25]) {
      const a = horseshoeArch(kit, 1, 2.2, 0.3, RELIEF)
      a.position.set(sx + dx, arcadeY, 0.15)
      g.add(a)
    }
    g.add(kit.box(side, 0.35, 0.4, RELIEF, sx, arcadeY + 3.3, 0.2)) // little cornice over the arcade
    const panel = sebkaPanel(kit, side, 26, 3, 9, 0.28, 0.35, RELIEF)
    panel.position.set(sx, arcadeY + 3.8, 0.2)
    g.add(panel)
    g.add(kit.box(side + 0.2, 0.4, 0.4, RELIEF, sx, arcadeY + 30, 0.2)) // frame top
  }

  // Frieze of small blind arches near the top of the shaft
  for (let i = -5; i <= 5; i++) {
    const a = horseshoeArch(kit, 0.8, 0.9, 0.3, RELIEF)
    a.position.set(i * 1.15, SHAFT_H - 2.6, 0.15)
    g.add(a)
  }
  return g
}

/**
 * One storey of the belfry: four walls with an arched opening each, white pilasters at the
 * corners and a cornice on top. Returns the group; the storey sits on y = 0.
 */
function belfryStorey(kit: Kit, w: number, h: number, holeW: number, holeH: number, holeBottom: number, wall: number) {
  const g = new THREE.Group()
  const t = 0.8
  const opening = [{ x: 0, width: holeW, height: holeH, arch: true, bottom: holeBottom }]
  for (let k = 0; k < 4; k++) {
    // Walls on ±Z are full width; walls on ±X fit between them (no overlapping faces)
    const width = k % 2 === 0 ? w : w - t * 2
    const f = kit.facade(width, h, t, opening, wall)
    const face = new THREE.Group()
    f.position.z = w / 2 - t / 2
    face.add(f)
    // Pilasters on both sides of the opening
    for (const px of [-(holeW / 2 + 0.6), holeW / 2 + 0.6]) face.add(kit.box(0.5, h, 0.3, TRIM, px, 0, w / 2 + 0.1))
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  for (const x of [-w / 2, w / 2]) for (const z of [-w / 2, w / 2]) g.add(kit.box(0.9, h, 0.9, TRIM, x, 0, z)) // corners
  g.add(kit.box(w * 0.45, h, w * 0.45, HOLE)) // dark core so the openings read as deep
  return g
}

export function buildGiralda(kit: Kit): THREE.Group {
  const g = new THREE.Group()

  // ---- Almohad shaft ----
  g.add(kit.box(S + 0.8, 1.2, S + 0.8, RELIEF)) // plinth
  g.add(kit.box(S, SHAFT_H, S, BRICK))
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Group()
    const deco = shaftFace(kit)
    deco.position.z = S / 2
    face.add(deco)
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  let y = SHAFT_H
  g.add(kit.box(S + 0.6, 0.8, S + 0.6, TRIM, 0, y, 0)) // cornice where the belfry begins
  y += 0.8
  const rail = balustrade(kit, S, S, 1.4, TRIM)
  rail.position.y = y
  g.add(rail)
  for (const x of [-S / 2, S / 2]) {
    for (const z of [-S / 2, S / 2]) {
      const p = pinnacle(kit, 2.6, TRIM, GOLD)
      p.position.set(x, y, z)
      g.add(p)
    }
  }

  // ---- Bell body: big arches with a bell in each ----
  const BELL_W = 10.4, BELL_H = 11
  const bells = belfryStorey(kit, BELL_W, BELL_H, 5, 5.6, 1.4, BRICK)
  bells.position.y = y
  g.add(bells)
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2, r = BELL_W / 2 - 1.6
    const bx = Math.sin(a) * r, bz = Math.cos(a) * r
    g.add(kit.mesh(new THREE.CylinderGeometry(0.6, 1.3, 2, 10), BELL, bx, y + 1.4 + 4.6, bz))
    g.add(kit.box(1.8, 0.3, 0.3, BRONZE, bx, y + 1.4 + 5.6 + 0.6, bz)) // yoke
  }
  y += BELL_H
  g.add(kit.box(BELL_W + 1.4, 0.8, BELL_W + 1.4, TRIM, 0, y, 0))
  y += 0.8
  const rail2 = balustrade(kit, BELL_W + 0.6, BELL_W + 0.6, 1.2, TRIM)
  rail2.position.y = y
  g.add(rail2)
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const p = pinnacle(kit, 2.2, TRIM, GOLD)
      p.position.set((x * (BELL_W + 0.6)) / 2, y, (z * (BELL_W + 0.6)) / 2)
      g.add(p)
    }
  }

  // ---- "Azucenas" body ----
  const AZ_W = 8, AZ_H = 8
  const az = belfryStorey(kit, AZ_W, AZ_H, 3, 2.8, 1.6, TRIM)
  az.position.y = y
  g.add(az)
  y += AZ_H
  g.add(kit.box(AZ_W + 1.2, 0.6, AZ_W + 1.2, RELIEF, 0, y, 0))
  y += 0.6

  // ---- "Estrellas" body: square with a round window on each face ----
  const ES_W = 6, ES_H = 6
  g.add(kit.box(ES_W, ES_H, ES_W, BRICK, 0, y, 0))
  for (const x of [-ES_W / 2, ES_W / 2]) for (const z of [-ES_W / 2, ES_W / 2]) g.add(kit.box(0.6, ES_H, 0.6, TRIM, x, y, z))
  for (let k = 0; k < 4; k++) {
    const disc = new THREE.CylinderGeometry(1.1, 1.1, 0.3, 12)
    disc.rotateX(Math.PI / 2)
    disc.rotateY((k * Math.PI) / 2)
    const a = (k * Math.PI) / 2
    g.add(kit.mesh(disc, HOLE, Math.sin(a) * (ES_W / 2 + 0.05), y + ES_H / 2, Math.cos(a) * (ES_W / 2 + 0.05)))
  }
  y += ES_H
  g.add(kit.box(ES_W + 1, 0.5, ES_W + 1, TRIM, 0, y, 0))
  y += 0.5

  // ---- Final drum, dome and Giraldillo ----
  g.add(kit.mesh(new THREE.CylinderGeometry(2.2, 2.4, 4, 8), TRIM, 0, y + 2, 0))
  y += 4
  g.add(kit.mesh(new THREE.SphereGeometry(2.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), DOME, 0, y, 0))
  y += 2.5
  g.add(kit.mesh(new THREE.CylinderGeometry(0.25, 0.35, 1, 6), BRONZE, 0, y + 0.5, 0))
  g.add(kit.mesh(new THREE.IcosahedronGeometry(0.7, 1), GOLD, 0, y + 1.5, 0)) // globe
  y += 2
  const giraldillo = statue(kit, 4, BRONZE)
  giraldillo.position.y = y
  g.add(giraldillo)
  // The banner (lábaro) she holds up, which turns with the wind
  g.add(kit.mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 5), BRONZE, -0.7, y + 3, 0))
  g.add(kit.box(1.6, 1.2, 0.12, BRONZE, -1.5, y + 3.3, 0))
  return g
}

/**
 * Plaza around the tower: cobbles, a stone curb, orange trees and bollards.
 * w and d: size of the plaza (model units). Returns the group and the height of its surface.
 */
export function buildGiraldaBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 0.3
  g.add(kit.box(w + 16, 0.03, d + 16, 0xe8d7b5)) // cobbled square (drivable)
  g.add(kit.box(w + 1, 0.05, d + 1, 0xc9b38c)) // darker border
  g.add(kit.box(w, top, d, 0xdccdb0)) // stone platform
  for (const x of [-w / 2 + 2, w / 2 - 2]) {
    for (const z of [-d / 2 + 2, 0, d / 2 - 2]) {
      if (z === 0 && Math.abs(x) < S / 2 + 3) continue
      const t = orangeTree(kit, 2.4)
      t.position.set(x, top, z)
      g.add(t)
    }
  }
  for (const z of [-d / 2 + 2, d / 2 - 2]) {
    const t = orangeTree(kit, 2.4)
    t.position.set(0, top, z)
    g.add(t)
  }
  // Bollards along the front and back edges
  for (let x = -w / 2 + 4; x <= w / 2 - 4 + 1e-6; x += 2) {
    for (const z of [d / 2 - 0.4, -d / 2 + 0.4]) {
      g.add(kit.mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.9, 6), 0x3b3a3a, x, top + 0.45, z))
    }
  }
  return { group: g, top }
}
