// Torre de Hércules (A Coruña), cartoon style. Roman lighthouse from the 1st century with its
// 1788 neoclassical shell. Signature features, exaggerated: a chunky tapered square tower, the
// thick spiral of the old outer ramp wrapping it in a contrasting colour, big dark windows, two
// stout octagonal stages and an oversized glowing lantern under a fat dome. It stands on a round
// rocky headland with boulders and the "wind rose" mosaic at its foot.
// Units are roughly metres; the door looks toward +Z.
import * as THREE from 'three'
import { wonk, type Kit } from '../kit'
import { balustrade, beam, horseshoeArch, onionDome, pinnacle } from '../ornaments'

const STONE = 0xeadcc0 // warm light granite
const RAMP = 0xb5865a // the spiral, darker and warmer so it reads from far away
const TRIM = 0xc9a77e
const DARK = 0x2b2540
const DOME = 0x4f87b5
const GOLD = 0xf2c14e
const LIGHT = 0xffd93d // lantern glass
const ROCK = 0x9b8f80
const GRASS = 0x7ed957

const WB = 14 // width at the feet
const WT = 11 // width at the top of the body
const BODY_H = 36

/** Width of the tapered body at height y. */
const widthAt = (y: number) => WB + ((WT - WB) * y) / BODY_H

export function buildTorreHercules(kit: Kit): THREE.Group {
  const g = new THREE.Group()
  g.add(kit.box(WB + 2, 1.8, WB + 2, TRIM)) // plinth
  g.add(kit.taper(WB, WB, WT, WT, BODY_H, STONE))

  // Spiral of the old ramp: two turns, one chunky beam per face, corner to corner, so it wraps
  // the tapered tower as one continuous band.
  const turns = 2
  const rise = (BODY_H - 6) / (4 * turns)
  const out = 0.5 // how far the band stands out from the wall
  for (let k = 0; k < 4 * turns; k++) {
    const y0 = 3 + k * rise, y1 = y0 + rise
    const w0 = widthAt(y0) / 2 + out, w1 = widthAt(y1) / 2 + out
    const face = new THREE.Group()
    face.add(beam(kit, new THREE.Vector3(-w0, y0, w0), new THREE.Vector3(w1, y1, w1), 1.4, RAMP))
    face.rotation.y = ((k % 4) * Math.PI) / 2
    g.add(face)
  }

  // Big dark windows (with a light sill) scattered up each face, and an arched door
  const windows = [[-3, 9], [3, 15.5], [-2.4, 22], [2.6, 28], [-2.8, 33]]
  for (let k = 0; k < 4; k++) {
    const face = new THREE.Group()
    for (const [i, [x, y]] of windows.entries()) {
      const z = widthAt(y) / 2 + 0.05
      const sx = x * (k % 2 ? -1 : 1)
      face.add(kit.slab(1.5, 2.6, 0.3, DARK, sx, y, z))
      if ((i + k) % 2 === 0) face.add(kit.lightPanel(1.1, 2.1, sx, y + 0.25, z + 0.25)) // lit at night
      face.add(kit.box(2.1, 0.45, 0.6, TRIM, sx, y - 0.45, z))
    }
    face.rotation.y = (k * Math.PI) / 2
    g.add(face)
  }
  const door = horseshoeArch(kit, 3, 3.6, 0.4, DARK)
  door.position.set(0, 1.8, widthAt(2) / 2 + 0.1)
  g.add(door)

  // ---- Top: fat cornice, balustrade and pinnacles ----
  const top = new THREE.Group()
  let y = 0
  top.add(kit.box(WT + 2.4, 1.8, WT + 2.4, TRIM, 0, y, 0))
  y += 1.8
  const rail = balustrade(kit, WT + 1.4, WT + 1.4, 1.6, STONE)
  rail.position.y = y
  top.add(rail)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const p = pinnacle(kit, 3, STONE, GOLD)
      p.position.set((sx * (WT + 1.4)) / 2, y, (sz * (WT + 1.4)) / 2)
      top.add(p)
    }
  }
  // Two stout octagonal stages, each narrower at the top
  const oct = (rb: number, rt: number, h: number, color: number) => {
    const geo = new THREE.CylinderGeometry(rt, rb, h, 8)
    geo.rotateY(Math.PI / 8) // flat faces toward the axes
    top.add(kit.mesh(geo, color, 0, y + h / 2, 0))
    y += h
  }
  const stage1 = y
  oct(4.8, 4.3, 6.5, STONE)
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2
    const win = kit.slab(1.4, 3, 0.4, DARK, Math.sin(a) * 4.45, stage1 + 1.8, Math.cos(a) * 4.45)
    win.rotation.y = a
    top.add(win)
    top.add(kit.lightPanel(1, 2.4, Math.sin(a) * 4.75, stage1 + 2.1, Math.cos(a) * 4.75, a))
  }
  oct(5.6, 5.6, 1, TRIM)
  oct(3.6, 3.2, 4, STONE)
  oct(4, 4, 0.8, TRIM)

  // ---- Oversized glowing lantern with its frame, and a fat dome ----
  top.add(kit.mesh(new THREE.CylinderGeometry(2.6, 2.6, 3.6, 12), LIGHT, 0, y + 1.8, 0))
  top.add(kit.lightHalo(7, 0, y + 1.8, 0, 1.3)) // the lighthouse lamp: the brightest night light
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3
    top.add(kit.box(0.45, 3.6, 0.45, DARK, Math.sin(a) * 2.7, y, Math.cos(a) * 2.7))
  }
  y += 3.6
  top.add(kit.mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.6, 12), DARK, 0, y + 0.3, 0))
  y += 0.6
  const dome = onionDome(kit, 3, DOME, GOLD)
  dome.position.y = y
  top.add(dome)
  top.position.y = BODY_H
  g.add(wonk(top, 7, 0.03))
  return g
}

/**
 * Round rocky headland: lawn, a rock mound with a grass top, big boulders around its rim, a
 * path to the door and the wind rose. Everything stays inside the w x d footprint (walkable).
 * Returns the group and the height of its surface.
 */
export function buildTorreHerculesBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const top = 2.6
  const r = Math.min(w, d) / 2
  g.add(kit.mesh(new THREE.CylinderGeometry(r * 0.9, r, top - 0.4, 12), ROCK, 0, (top - 0.4) / 2, 0))
  g.add(kit.mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.9, 0.4, 12), GRASS, 0, top - 0.2, 0))
  // Boulders sitting on the rim, inside the footprint
  for (let i = 0; i < 10; i++) {
    const a = i * 0.63 + 0.4
    if (Math.abs(Math.sin(a) - 1) < 0.25) continue // keep the front path clear
    const size = 1.2 + (i % 3) * 0.5
    const rr = r - size - 0.3
    g.add(kit.mesh(new THREE.IcosahedronGeometry(size, 0), ROCK, Math.cos(a) * rr, top - 0.2, Math.sin(a) * rr))
  }
  g.add(kit.box(3.4, 0.15, r * 0.85, 0xe2d4b8, 0, top, r * 0.42)) // path
  // Wind rose: a stone disc with an eight-pointed star
  const rose = new THREE.Group()
  rose.add(kit.mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.15, 16), 0xf3ead6, 0, 0.08, 0))
  for (let k = 0; k < 8; k++) {
    const s = new THREE.Shape()
    const len = k % 2 ? 1.4 : 2.2
    s.moveTo(-0.4, 0)
    s.lineTo(0, len)
    s.lineTo(0.4, 0)
    s.closePath()
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false })
    geo.rotateX(-Math.PI / 2)
    geo.rotateY((k * Math.PI) / 4)
    rose.add(kit.mesh(geo, k % 2 ? 0x5a8fd0 : 0x2f5aa0, 0, 0.15, 0))
  }
  rose.position.set(0, top + 0.1, 12.5) // on the path, in front of the door
  g.add(rose)
  return { group: g, top }
}
