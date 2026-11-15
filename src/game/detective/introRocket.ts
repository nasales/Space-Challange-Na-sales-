// Rocket entrance for the main-menu detective (DetectiveShowcase, mode 'investigate'), told as a
// comic: three held panels that ride on the camera, then the stage itself as the fourth panel.
//   A  deep space: the rocket zips in, holds (his silhouette in the porthole), winds up, zips off
//   B  re-entry: a flat comic Earth under focus lines; the rocket rattles, then plunges at Spain
//   C  the map of the Iberian peninsula: the landing ring stamps in, a tiny rocket streaks onto it
//   D  the stage: the rocket falls in, crash-lands, lets the detective out and blasts off
// Panels are joined by an ink diagonal wipe (A->B, C->D) and a one-frame impact flash (B->C).
// Everything is posed "on twos" (12 fps, see FRAME): the caller passes a time quantised to it,
// so moves read as key poses with holds; fast moves get smear frames, speed lines and cyan/
// magenta multiple-image ghosts. Look and palette come from comicArt.ts (the main menu's style).
import * as THREE from 'three'
import { L } from '../../shared/i18n'
import {
  PAL, canvasTexture, halftone, comicMaterial, captionTexture, swishWordTexture, impactStarTexture,
  dotTileTexture, cornerMaskTexture, stepPop,
} from './comicArt'
import {
  AFRICA, EURASIA, FRANCE, GREENLAND, IBERIA, NORTH_AFRICA, NORTH_AMERICA, PORTUGAL, SOUTH_AMERICA, UK,
  type LatLon,
} from './coastlines'

/** One drawing on twos (12 fps). */
export const FRAME = 1 / 12
const F = FRAME

/** Entrance timeline in seconds since the menu opened (all on whole frames). */
export const INTRO = {
  A_CAPTION: 2 * F, // "Somewhere above Earth..."
  A_IN: 3 * F, // the rocket zips in
  A_HOLD: 6 * F, // ...and holds
  A_ANTIC: 11 * F, // winds up
  A_OUT: 12 * F, // zips off
  WIPE1: 14 * F, // ink wipe A -> B (covers on the next frame)
  B: 15 * F, // panel B
  B_IN: 17 * F, // the rocket dives in from the corner
  B_HOLD: 19 * F, // re-entry rattle
  B_ANTIC: 25 * F, // pulls back
  B_PLUNGE: 26 * F, // plunges at Spain ("WHOOSH!")
  FLASH: 30 * F, // one impact frame
  C: 31 * F, // panel C
  C_CAPTION: 32 * F, // "Destination: Spain"
  C_TARGET: 33 * F, // landing ring stamps in
  C_STREAK: 36 * F, // tiny rocket streaks onto it
  C_IMPACT: 39 * F, // impact star
  WIPE2: 41 * F, // ink wipe C -> stage
  FALL: 42 * F, // the stage: the rocket falls in
  CRASH: 50 * F, // crash
  POP: 58 * F, // hatch pops open
  CLOSE: 66 * F, // hatch shuts
  RUMBLE: 70 * F, // shakes and straightens up
  LIFT: 74 * F, // blast-off
  GONE: 84 * F, // out of the frame
} as const

/** Where the rocket lands: to the screen left of the detective (+X) and a little behind him. */
export const ROCKET_SPOT = new THREE.Vector3(4.6, 0, 3)
const ROCKET_SCALE = 1.8
const ROCKET_TILT = 0.22 // rest tilt after the crash, leaning over the center of the stage
const ROCKET_LEN = 6.7 // model height (fins to nose tip) before scaling
const FALL_TOP = 30
const CRASH_SQUASH = [0.55, 1.2, 0.9, 1.05, 1] // rocket height per frame after the impact

// Panel layout (camera-local depths; the panels fill this share of the view)
const PANEL_W = 0.9
const PANEL_H = 0.93
const D_BG = 60
const D_ART = 56
const D_ROCKET = 40
const D_FRONT = 30
const D_WIPE = 25
const DOT_PX = 10 // panel halftone pitch in CSS pixels
const TILT = { A: -0.02, B: 0.017, C: -0.01 } // each panel sits a little crooked, like the menu sheets
const STAR_COUNT = 34
const LINE_COUNT = 8

const TAU = Math.PI * 2
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Overshooting arrival (0 -> ~1.1 -> 1). */
const backOut = (x: number) => {
  const t = clamp01(x) - 1
  return 1 + t * t * (2.7 * t + 1.7)
}
/** Whole drawings in a span of seconds (times are sampled mid-drawing, so this never sits on a boundary). */
const frameOf = (s: number) => Math.floor(s / F)

type Keep = <T extends { dispose: () => void }>(x: T) => T
type Panel = 'A' | 'B' | 'C'
/** Rocket pose inside a panel: position in panel units (-1..1), nose angle, length in U, squash. */
type Pose = { x: number; y: number; ang: number; len: number; sx: number; sy: number; flame: number }

// ---------------------------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------------------------
type Proj = (lat: number, lon: number) => [number, number]

function landPath(g: CanvasRenderingContext2D, pts: LatLon, proj: Proj) {
  g.beginPath()
  pts.forEach(([lat, lon], i) => {
    const [x, y] = proj(lat, lon)
    if (i) g.lineTo(x, y)
    else g.moveTo(x, y)
  })
  g.closePath()
}

function land(g: CanvasRenderingContext2D, pts: LatLon, proj: Proj, fill: string, line: number) {
  landPath(g, pts, proj)
  g.fillStyle = fill
  g.fill()
  g.lineWidth = line
  g.strokeStyle = PAL.inkDeep
  g.stroke()
}

/** Where Iberia sits on the Earth disc texture (offset from the disc center, in disc radii). */
const EARTH_LAT0 = 22, EARTH_LON0 = -2
const IBERIA_ON_DISC = (() => {
  const r = Math.PI / 180
  const p = 40 * r, l = (-4 - EARTH_LON0) * r, p0 = EARTH_LAT0 * r
  return { x: Math.cos(p) * Math.sin(l), y: Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l) }
})()
const EARTH_R = 200 / 512 // disc radius in texture units

/** Flat comic Earth (orthographic, Europe and Africa facing us): sea blue, manila land, gold Spain,
 *  halftone terminator, thick ink rim and misregistered cyan/magenta plates. */
const earthTexture = () =>
  canvasTexture(512, 512, (g) => {
    const C = 256, R = 200, rad = Math.PI / 180
    const p0 = EARTH_LAT0 * rad
    const proj: Proj = (lat, lon) => {
      const p = lat * rad, l = (lon - EARTH_LON0) * rad
      let x = Math.cos(p) * Math.sin(l)
      let y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)
      const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l)
      if (cosc < 0) {
        const k = Math.hypot(x, y) || 1 // behind the globe: pinned to the rim
        x /= k
        y /= k
      }
      return [C + x * R, C - y * R]
    }
    g.lineWidth = 10
    g.strokeStyle = PAL.cyan
    g.beginPath()
    g.arc(C - 7, C - 2, R, 0, TAU)
    g.stroke()
    g.strokeStyle = PAL.magenta
    g.beginPath()
    g.arc(C + 7, C + 4, R, 0, TAU)
    g.stroke()
    g.save()
    g.beginPath()
    g.arc(C, C, R, 0, TAU)
    g.clip()
    g.fillStyle = PAL.sea
    g.fillRect(0, 0, 512, 512)
    g.strokeStyle = 'rgba(255, 248, 231, 0.6)' // little comic waves
    g.lineWidth = 3
    for (let i = 0; i < 18; i++) {
      const x = 70 + ((i * 131) % 380), y = 70 + ((i * 89) % 380)
      g.beginPath()
      g.arc(x, y, 8, Math.PI * 1.1, Math.PI * 1.9)
      g.stroke()
    }
    for (const l of [NORTH_AMERICA, SOUTH_AMERICA, GREENLAND, AFRICA, EURASIA, UK]) land(g, l, proj, PAL.manila, 4)
    land(g, IBERIA, proj, PAL.gold, 5)
    // Polar cap
    landPath(g, Array.from({ length: 36 }, (_, i) => [74, -180 + i * 10] as const), proj)
    g.fillStyle = PAL.paper
    g.fill()
    // Terminator: shadow crescent bottom-right in ink Ben-Day dots
    g.beginPath()
    g.rect(0, 0, 512, 512)
    g.arc(C - R * 0.32, C - R * 0.3, R * 1.08, 0, TAU, true)
    g.clip('evenodd')
    g.fillStyle = 'rgba(22, 27, 46, 0.22)'
    g.fillRect(0, 0, 512, 512)
    halftone(g, 512, 512, 11, () => 3.1, PAL.inkDeep)
    g.restore()
    // Glint
    g.fillStyle = PAL.paper
    g.beginPath()
    g.ellipse(C - R * 0.55, C - R * 0.5, 24, 11, -0.7, 0, TAU)
    g.fill()
    g.lineWidth = 11
    g.strokeStyle = PAL.inkDeep
    g.beginPath()
    g.arc(C, C, R, 0, TAU)
    g.stroke()
  })

/** Map of the Iberian peninsula centered on 40 N 4 W; the sea fades into the panel's sea colour. */
const mapTexture = () =>
  canvasTexture(512, 512, (g) => {
    const k = 31 // pixels per degree of latitude
    const proj: Proj = (lat, lon) => [256 + (lon + 4) * k * 0.766, 256 - (lat - 40) * k]
    g.fillStyle = PAL.sea
    g.fillRect(0, 0, 512, 512)
    g.strokeStyle = 'rgba(255, 248, 231, 0.7)'
    g.lineWidth = 4
    for (let i = 0; i < 22; i++) {
      const x = (i * 97) % 512, y = (i * 61) % 512
      g.beginPath()
      g.arc(x, y, 9, Math.PI * 1.1, Math.PI * 1.9)
      g.stroke()
    }
    land(g, FRANCE, proj, PAL.manila, 6)
    land(g, NORTH_AFRICA, proj, PAL.manila, 6)
    land(g, IBERIA, proj, PAL.gold, 7)
    g.save()
    landPath(g, IBERIA, proj)
    g.clip()
    halftone(g, 512, 512, 12, (x, y) => 2.8 * clamp01((x + y - 520) / 300), 'rgba(229, 50, 45, 0.3)') // red dots, shade toward the south-east
    g.restore()
    land(g, PORTUGAL, proj, PAL.manilaDark, 5)
    landPath(g, IBERIA, proj) // coast again over the inner border
    g.lineWidth = 7
    g.strokeStyle = PAL.inkDeep
    g.stroke()
    for (const [lat, lon, rx, ry] of [[39.6, 2.95, 13, 8], [40.0, 4.1, 6, 4], [38.98, 1.4, 6, 4]]) {
      const [x, y] = proj(lat, lon)
      g.beginPath()
      g.ellipse(x, y, rx, ry, 0.2, 0, TAU)
      g.fillStyle = PAL.gold
      g.fill()
      g.lineWidth = 4
      g.strokeStyle = PAL.inkDeep
      g.stroke()
    }
    g.globalCompositeOperation = 'destination-in'
    const grad = g.createRadialGradient(256, 256, 190, 256, 256, 256)
    grad.addColorStop(0, 'rgba(0, 0, 0, 1)')
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 512, 512)
  })

/** Landing ring: red dashed circle and dot, ink-lined. */
const targetTexture = () =>
  canvasTexture(256, 256, (g) => {
    g.lineWidth = 22
    g.strokeStyle = PAL.inkDeep
    g.beginPath()
    g.arc(128, 128, 84, 0, TAU)
    g.stroke()
    g.lineWidth = 12
    g.strokeStyle = PAL.red
    g.setLineDash([30, 16])
    g.stroke()
    g.setLineDash([])
    g.beginPath()
    g.arc(128, 128, 24, 0, TAU)
    g.fillStyle = PAL.red
    g.fill()
    g.lineWidth = 8
    g.strokeStyle = PAL.inkDeep
    g.stroke()
  })

/** Radial focus lines (white, tint with the material) converging on the center, clear in the middle. */
const focusTexture = () =>
  canvasTexture(512, 512, (g) => {
    g.fillStyle = '#ffffff'
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * TAU + ((i * 37) % 7) * 0.012
      const w = 0.006 + ((i * 13) % 5) * 0.003
      const r0 = 150 + ((i * 53) % 70)
      g.beginPath()
      g.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0)
      g.lineTo(256 + Math.cos(a - w) * 400, 256 + Math.sin(a - w) * 400)
      g.lineTo(256 + Math.cos(a + w) * 400, 256 + Math.sin(a + w) * 400)
      g.closePath()
      g.fill()
    }
  })

/** Impact frame: paper with ink focus lines. */
const flashTexture = () =>
  canvasTexture(256, 256, (g) => {
    g.fillStyle = PAL.paper
    g.fillRect(0, 0, 256, 256)
    g.fillStyle = PAL.inkDeep
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * TAU, w = 0.02 + (i % 3) * 0.012
      g.beginPath()
      g.moveTo(128 + Math.cos(a) * 46, 128 + Math.sin(a) * 46)
      g.lineTo(128 + Math.cos(a - w) * 200, 128 + Math.sin(a - w) * 200)
      g.lineTo(128 + Math.cos(a + w) * 200, 128 + Math.sin(a + w) * 200)
      g.closePath()
      g.fill()
    }
  })

/** Wipe band: solid ink in the middle, Ben-Day dots growing toward it at both edges. */
const wipeTexture = () =>
  canvasTexture(512, 64, (g) => {
    g.fillStyle = PAL.inkDeep
    g.fillRect(128, 0, 256, 64)
    halftone(g, 512, 64, 12, (x) => {
      const d = x < 256 ? (x - 0) / 128 : (512 - x) / 128 // 0 at the edge, 1 where the solid part starts
      return 7.5 * clamp01(d)
    }, PAL.inkDeep)
  })

/** Re-entry fire: a bow-shock crescent hugging the nose (red, gold, paper core, ink line). */
const fireTexture = () =>
  canvasTexture(256, 256, (g) => {
    const shape = (r: number, h: number) => {
      g.beginPath()
      g.moveTo(128 - r, 200)
      g.quadraticCurveTo(128 - r, 200 - h, 128, 200 - h * 1.25)
      g.quadraticCurveTo(128 + r, 200 - h, 128 + r, 200)
      g.quadraticCurveTo(128, 150, 128 - r, 200)
      g.closePath()
    }
    shape(118, 170)
    g.fillStyle = PAL.red
    g.fill()
    g.lineWidth = 9
    g.strokeStyle = PAL.inkDeep
    g.stroke()
    shape(84, 130)
    g.fillStyle = PAL.gold
    g.fill()
    shape(46, 88)
    g.fillStyle = PAL.paper
    g.fill()
  })

/** Porthole interior: sea-blue glass with the detective's ink silhouette (fedora, head, shoulders). */
const silhouetteTexture = () =>
  canvasTexture(128, 128, (g) => {
    g.beginPath()
    g.arc(64, 64, 62, 0, TAU)
    g.clip()
    g.fillStyle = PAL.sea
    g.fillRect(0, 0, 128, 128)
    g.fillStyle = PAL.inkDeep
    g.beginPath()
    g.ellipse(64, 132, 46, 34, 0, 0, TAU)
    g.fill()
    g.beginPath()
    g.arc(64, 80, 24, 0, TAU)
    g.fill()
    g.beginPath()
    g.ellipse(64, 60, 40, 8, -0.08, 0, TAU)
    g.fill()
    g.beginPath()
    g.roundRect(44, 28, 40, 32, 8)
    g.fill()
  })

/** Porthole glass: two paper shine strokes. */
const shineTexture = () =>
  canvasTexture(128, 128, (g) => {
    g.strokeStyle = PAL.paper
    g.lineWidth = 10
    g.beginPath()
    g.moveTo(30, 58)
    g.lineTo(58, 30)
    g.stroke()
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(42, 76)
    g.lineTo(76, 42)
    g.stroke()
  })

/** Four-point star (white; vertex colours tint it paper or gold). */
const starTexture = () =>
  canvasTexture(64, 64, (g) => {
    g.beginPath()
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU - Math.PI / 2
      const r = i % 2 ? 6 : 30
      if (i) g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r)
      else g.moveTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r)
    }
    g.closePath()
    g.fillStyle = '#ffffff'
    g.fill()
  })

// ---------------------------------------------------------------------------------------------
// Rocket model (nose along +Y, lowest point at y = 0, porthole on +Z), cel shaded with ink hull
// ---------------------------------------------------------------------------------------------
function buildRocket(keep: Keep, dotPx: number) {
  const group = new THREE.Group()
  const inner = new THREE.Group()
  inner.position.y = 0.1
  group.add(inner)
  const ink = keep(new THREE.MeshBasicMaterial({ color: PAL.inkDeep, side: THREE.BackSide }))
  const paper = keep(comicMaterial(PAL.paper, dotPx))
  const red = keep(comicMaterial(PAL.red, dotPx))
  const gold = keep(comicMaterial(PAL.gold, dotPx))
  const dark = keep(comicMaterial(PAL.ink, dotPx))
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, hull = 0) => {
    const m = new THREE.Mesh(keep(geo), mat)
    m.position.set(x, y, z)
    if (hull > 0) {
      const h = new THREE.Mesh(geo, ink) // inverted hull = thick ink line
      h.scale.setScalar(1 + hull)
      m.add(h)
    }
    parent.add(m)
    return m
  }
  const profile = [[0, 0.3], [0.9, 0.3], [1.15, 1.2], [1.28, 2.4], [1.2, 3.7], [1.0, 4.5], [0, 4.5]].map(([r, y]) => new THREE.Vector2(r, y))
  add(inner, new THREE.LatheGeometry(profile, 10), paper, 0, 0, 0, 0.08)
  add(inner, new THREE.ConeGeometry(1.02, 1.9, 10), red, 0, 5.45, 0, 0.09)
  add(inner, new THREE.IcosahedronGeometry(0.22, 0), gold, 0, 6.42, 0, 0.2)
  add(inner, new THREE.CylinderGeometry(1.22, 1.22, 0.3, 10), gold, 0, 1.3, 0, 0.06)
  add(inner, new THREE.CylinderGeometry(0.62, 0.8, 0.45, 10), dark, 0, 0.12, 0, 0.08)
  const finShape = new THREE.Shape()
  finShape.moveTo(0, 0)
  finShape.lineTo(1.0, -0.45)
  finShape.lineTo(1.05, 0.2)
  finShape.quadraticCurveTo(0.65, 0.9, 0, 2.0)
  finShape.closePath()
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.22, bevelEnabled: false }).translate(0, 0, -0.11)
  for (const a of [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]) {
    const fin = add(inner, finGeo, red, Math.cos(a) * 0.85, 0.35, Math.sin(a) * 0.85, 0.1)
    fin.rotation.y = -a
  }
  // Flat flame: gold with a paper core, ink-lined
  const flame = new THREE.Group()
  flame.name = 'flame'
  flame.position.y = -0.1
  inner.add(flame)
  add(flame, new THREE.ConeGeometry(0.6, 2.3, 7).rotateX(Math.PI).translate(0, -1.15, 0), keep(new THREE.MeshBasicMaterial({ color: PAL.gold })), 0, 0, 0, 0.12)
  add(flame, new THREE.ConeGeometry(0.32, 1.3, 7).rotateX(Math.PI).translate(0, -0.65, 0), keep(new THREE.MeshBasicMaterial({ color: PAL.paper })), 0, 0, 0)
  // Porthole: dark hole, the silhouette disc in it, and a hinged hatch (gold rim + glass shine)
  add(inner, new THREE.CircleGeometry(0.64, 16), keep(new THREE.MeshBasicMaterial({ color: PAL.inkDeep })), 0, 3.0, 1.2)
  const sil = add(inner, new THREE.CircleGeometry(0.6, 16), keep(new THREE.MeshBasicMaterial({ map: keep(silhouetteTexture()) })), 0, 3.0, 1.215)
  sil.name = 'silhouette'
  const hatch = new THREE.Group()
  hatch.name = 'hatch'
  hatch.position.set(-0.66, 3.0, 1.24)
  inner.add(hatch)
  add(hatch, new THREE.TorusGeometry(0.66, 0.15, 6, 16), gold, 0.66, 0, 0, 0.18)
  add(hatch, new THREE.CircleGeometry(0.6, 16), keep(new THREE.MeshBasicMaterial({ map: keep(shineTexture()), transparent: true, depthWrite: false })), 0.66, 0, 0.02)
  return group
}

/** Parts of one rocket copy (found by name, so they also work on clones). */
function rocketParts(group: THREE.Object3D) {
  return {
    inner: group.children[0],
    flame: group.getObjectByName('flame')!,
    hatch: group.getObjectByName('hatch')!,
    silhouette: group.getObjectByName('silhouette')!,
  }
}

/** Flat one-colour copy of a rocket: the misregistered cyan/magenta plate ghost. */
function ghostOf(model: THREE.Object3D, mat: THREE.Material) {
  const g = model.clone()
  g.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) {
      m.material = mat
      m.renderOrder = 5
    }
  })
  g.visible = false
  return g
}

// ---------------------------------------------------------------------------------------------
// Panel choreography (key poses; sampled on twos by the caller)
// ---------------------------------------------------------------------------------------------
const NOSE_RIGHT = -Math.PI / 2
const aimAt = (x: number, y: number, tx: number, ty: number, ph: number) => Math.atan2((ty - y) * ph, tx - x) - Math.PI / 2

function poseA(e: number): Pose | null {
  if (e < INTRO.A_IN || e >= INTRO.WIPE1 + F) return null
  if (e < INTRO.A_ANTIC) {
    // Zips in from the left edge (three drawings, the middle one past the mark), then holds and bobs
    const u = clamp01((e - INTRO.A_IN) / (INTRO.A_HOLD - INTRO.A_IN))
    const bob = e >= INTRO.A_HOLD ? (frameOf(e) % 4 < 2 ? 0.025 : -0.025) : 0
    return { x: lerp(-1.6, -0.05, backOut(u)), y: 0.12 + bob, ang: NOSE_RIGHT + bob * 1.5, len: 0.95, sx: 1, sy: 1, flame: 1 + (frameOf(e) % 2) * 0.25 }
  }
  if (e < INTRO.A_OUT) {
    // Anticipation: rocks back, squashed, nose up
    return { x: -0.2, y: 0.14, ang: NOSE_RIGHT + 0.28, len: 0.95, sx: 1.2, sy: 0.78, flame: 0.4 }
  }
  const u = (e - INTRO.A_OUT) / (INTRO.WIPE1 + F - INTRO.A_OUT)
  return { x: lerp(-0.2, 2.0, u * u), y: lerp(0.14, -0.55, u), ang: NOSE_RIGHT - 0.35, len: 0.95, sx: 1, sy: 1, flame: 1.8 }
}

function poseB(e: number, ph: number): Pose | null {
  if (e < INTRO.B_IN || e >= INTRO.FLASH) return null
  const hx = 0.5, hy = 0.55
  if (e < INTRO.B_ANTIC) {
    const u = clamp01((e - INTRO.B_IN) / (INTRO.B_HOLD - INTRO.B_IN))
    const k = backOut(u)
    const jit = e >= INTRO.B_HOLD ? (frameOf(e) % 2 ? 0.014 : -0.014) : 0 // re-entry rattle
    const x = lerp(1.5, hx, k) + jit, y = lerp(1.4, hy, k) - jit
    return { x, y, ang: aimAt(x, y, 0, 0, ph) + jit * 3, len: 0.9, sx: 1, sy: 1, flame: 1.2 }
  }
  if (e < INTRO.B_PLUNGE) {
    const x = hx + 0.08, y = hy + 0.08
    return { x, y, ang: aimAt(x, y, 0, 0, ph), len: 0.9, sx: 1.18, sy: 0.8, flame: 0.5 }
  }
  // Plunge: three drawings, shrinking hard toward Spain
  const u = (e - INTRO.B_PLUNGE) / (INTRO.FLASH - F - INTRO.B_PLUNGE)
  if (u >= 1) return null
  const k = Math.pow(1 - u, 1.5)
  return { x: hx * k, y: hy * k, ang: aimAt(hx, hy, 0, 0, ph), len: 0.9 * Math.pow(1 - u, 1.6) + 0.04, sx: 1, sy: 1, flame: 1.6 }
}

function poseC(e: number, ph: number): Pose | null {
  if (e < INTRO.C_STREAK || e >= INTRO.C_IMPACT) return null
  const u = (e - INTRO.C_STREAK) / (INTRO.C_IMPACT - F - INTRO.C_STREAK)
  const sx = 0.95, sy = 1.0
  const x = lerp(sx, 0.08, u * u), y = lerp(sy, 0.1, u * u)
  return { x, y, ang: aimAt(sx, sy, 0, 0, ph), len: 0.34, sx: 1, sy: 1, flame: 1.4 }
}

const panelAt = (e: number): Panel | null =>
  e < INTRO.B ? 'A' : e < INTRO.FLASH ? 'B' : e < INTRO.C ? null : e < INTRO.FALL ? 'C' : null

// ---------------------------------------------------------------------------------------------
// The intro
// ---------------------------------------------------------------------------------------------
export function createRocketIntro(scene: THREE.Scene, camera: THREE.PerspectiveCamera, keep: Keep, renderer: THREE.WebGLRenderer) {
  const dpr = renderer.getPixelRatio()
  const dotPx = 4.5 * dpr
  const model = buildRocket(keep, dotPx)
  const ghostCyanMat = keep(new THREE.MeshBasicMaterial({ color: PAL.cyanSolid, transparent: true, opacity: 0.6, depthWrite: false }))
  const ghostMagentaMat = keep(new THREE.MeshBasicMaterial({ color: PAL.magentaSolid, transparent: true, opacity: 0.5, depthWrite: false }))

  // ---- World rocket (stage = panel D) and its plate ghosts ----
  const worldRocket = new THREE.Group()
  worldRocket.visible = false
  scene.add(worldRocket)
  model.rotation.y = Math.PI + 0.4 // porthole toward the camera and the center of the stage
  worldRocket.add(model)
  const world = rocketParts(model)
  const worldGhosts = [ghostOf(worldRocket, ghostCyanMat), ghostOf(worldRocket, ghostMagentaMat)]
  worldGhosts.forEach((g) => scene.add(g))
  const shadowMat = keep(new THREE.MeshBasicMaterial({ color: PAL.inkDeep, transparent: true, opacity: 0, depthWrite: false }))
  const shadow = new THREE.Mesh(keep(new THREE.CircleGeometry(3.4, 20).rotateX(-Math.PI / 2)), shadowMat)
  shadow.position.set(ROCKET_SPOT.x, 0.02, ROCKET_SPOT.z)
  scene.add(shadow)

  // ---- Camera-locked comic panels ----
  if (!camera.parent) scene.add(camera)
  const screen = new THREE.Group() // full-view layers (wipe, flash)
  camera.add(screen)
  const sheet = new THREE.Group() // the current panel (tilted, can shake)
  camera.add(sheet)
  const plane = keep(new THREE.PlaneGeometry(1, 1))
  const flat = (params: THREE.MeshBasicMaterialParameters) =>
    keep(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, ...params }))
  const layer = (parent: THREE.Object3D, mat: THREE.Material, order: number) => {
    const m = new THREE.Mesh(plane, mat)
    m.renderOrder = order
    parent.add(m)
    return m
  }
  // Frame: ink drop shadow, ink line, paper border, panel colour, Ben-Day dots
  const frameShadow = layer(sheet, flat({ color: PAL.inkDeep }), -24)
  const frameInk = layer(sheet, flat({ color: PAL.inkDeep }), -23)
  const framePaper = layer(sheet, flat({ color: PAL.paper }), -22)
  const bgMat = flat({ color: PAL.inkDeep })
  const bg = layer(sheet, bgMat, -21)
  const dotTex = keep(dotTileTexture())
  const dotsMat = flat({ map: dotTex, alphaMap: keep(cornerMaskTexture()), color: PAL.paper, opacity: 0.2 })
  const dots = layer(sheet, dotsMat, -20)

  // Panel A: stars
  const starGeo = keep(new THREE.BufferGeometry())
  const starN = Array.from({ length: STAR_COUNT }, (_, i) => [((i * 0.618) % 1) * 1.9 - 0.95, ((i * 0.383 + 0.17) % 1) * 1.9 - 0.95])
  const starPos = new THREE.BufferAttribute(new Float32Array(STAR_COUNT * 3), 3)
  const starCol = new THREE.BufferAttribute(new Float32Array(STAR_COUNT * 3), 3)
  starGeo.setAttribute('position', starPos)
  starGeo.setAttribute('color', starCol)
  const starMat = keep(new THREE.PointsMaterial({ map: keep(starTexture()), size: 13 * dpr, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false }))
  const stars = new THREE.Points(starGeo, starMat)
  stars.renderOrder = -18
  stars.frustumCulled = false
  sheet.add(stars)
  const paperC = new THREE.Color(PAL.paper), goldC = new THREE.Color(PAL.gold)

  // Panel B: focus lines + Earth
  const focusMat = flat({ map: keep(focusTexture()), color: PAL.paper, opacity: 0.55 })
  const focus = layer(sheet, focusMat, -17)
  const earth = layer(sheet, flat({ map: keep(earthTexture()) }), -16)

  // Panel C: map + landing ring
  const map = layer(sheet, flat({ map: keep(mapTexture()) }), -16)
  const targetMat = flat({ map: keep(targetTexture()) })
  const target = layer(sheet, targetMat, -15)

  // Speed lines (one pool for every panel)
  const lineMat = flat({ color: PAL.paper })
  const lines = Array.from({ length: LINE_COUNT }, () => layer(sheet, lineMat, -14))

  // Panel rocket (a clone of the world model), its re-entry fire and its plate ghosts
  const panelRocket = model.clone()
  panelRocket.rotation.set(0, 0, 0)
  sheet.add(panelRocket)
  const panelParts = rocketParts(panelRocket)
  const panelGhosts = [ghostOf(panelRocket, ghostCyanMat), ghostOf(panelRocket, ghostMagentaMat)]
  panelGhosts.forEach((g) => sheet.add(g))
  const fire = new THREE.Mesh(plane, flat({ map: keep(fireTexture()) }))
  fire.position.set(0, 6.6, 1.6)
  fire.scale.set(3.6, 3.6, 1)
  fire.renderOrder = 6
  panelRocket.add(fire)

  // Front layers: captions, lettering, impact stars
  const capA = layer(sheet, flat({ map: keep(captionTexture(L('Somewhere above Earth...', 'En algún lugar sobre la Tierra...'))) }), 10)
  const capC = layer(sheet, flat({ map: keep(captionTexture(L('Destination: Spain', 'Destino: España'))) }), 10)
  const whoosh = layer(sheet, flat({ map: keep(swishWordTexture(L('Whoosh!', '¡Fiuuu!'))) }), 11)
  const impactTex = keep(impactStarTexture())
  const impact = layer(sheet, flat({ map: impactTex }), 11)

  // Full-view transitions
  const wipeMat = flat({ map: keep(wipeTexture()) })
  const wipe = layer(screen, wipeMat, 30)
  const flash = layer(screen, flat({ map: keep(flashTexture()) }), 30)

  const halfTan = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  /** Panel half sizes and unit (the smaller half size) at a camera depth. */
  const dims = (d: number) => {
    const hh = halfTan() * d, hw = hh * camera.aspect
    const pw = hw * PANEL_W, ph = hh * PANEL_H
    return { hw, hh, pw, ph, u: Math.min(pw, ph) }
  }
  const place = (m: THREE.Object3D, x: number, y: number, d: number, sw: number, sh = sw) => {
    m.position.set(x, y, -d)
    m.scale.set(sw, sh, 1)
  }

  function poseAt(e: number, panel: Panel | null, ph: number) {
    if (panel === 'A') return poseA(e)
    if (panel === 'B') return poseB(e, ph)
    if (panel === 'C') return poseC(e, ph)
    return null
  }

  /** Puts a rocket copy on a pose (panel units -> camera-local units at depth d). */
  function setRocket(obj: THREE.Object3D, p: Pose, d: number, smear: number) {
    const { pw, ph, u } = dims(d)
    const s = (p.len * u) / ROCKET_LEN
    obj.position.set(p.x * pw, p.y * ph, -d)
    obj.rotation.set(0, 0, p.ang)
    obj.scale.set(s * p.sx * (1 - 0.22 * smear), s * p.sy * (1 + 0.7 * smear), s * p.sx)
  }

  function updatePanels(e: number) {
    const panel = panelAt(e)
    sheet.visible = panel !== null
    const f = frameOf(e)

    // ---- Transitions ----
    const wipeFrame = e >= INTRO.WIPE1 && e < INTRO.B + 2 * F ? frameOf(e - INTRO.WIPE1) : e >= INTRO.WIPE2 && e < INTRO.FALL + 2 * F ? frameOf(e - INTRO.WIPE2) : -1
    wipe.visible = wipeFrame >= 0
    if (wipe.visible) {
      const { hw, hh } = dims(D_WIPE)
      const span = Math.hypot(hw, hh) * 2
      wipe.position.set([-1.25, 0, 1.25][wipeFrame] * span * 0.55, 0, -D_WIPE)
      wipe.rotation.z = -0.5
      wipe.scale.set(span * 2.2, span * 1.6, 1)
    }
    flash.visible = e >= INTRO.FLASH && e < INTRO.C
    if (flash.visible) {
      const { hw, hh } = dims(D_WIPE)
      place(flash, 0, 0, D_WIPE, hw * 2.05, hh * 2.05)
      flash.rotation.z = 0
    }
    if (!panel) return

    // ---- Frame ----
    const bgd = dims(D_BG)
    // Panel A pops in: small and crooked, past full size, settled (three drawings)
    const popIn = panel === 'A' ? [0.86, 1.04, 1][Math.min(2, f)] : 1
    const shakeFrame = panel === 'C' ? frameOf(e - INTRO.C_IMPACT) : -1
    const shake = shakeFrame === 0 || shakeFrame === 1 ? (shakeFrame === 0 ? 1 : -1) * 0.025 * bgd.u : 0
    sheet.rotation.z = TILT[panel] + (panel === 'A' && f === 0 ? -0.06 : 0)
    sheet.scale.setScalar(popIn)
    sheet.position.set(shake, -shake * 0.6, 0)
    const border = 0.035 * bgd.u, ink = 0.016 * bgd.u
    place(bg, 0, 0, D_BG, bgd.pw * 2, bgd.ph * 2)
    place(framePaper, 0, 0, D_BG + 0.2, (bgd.pw + border) * 2, (bgd.ph + border) * 2)
    place(frameInk, 0, 0, D_BG + 0.4, (bgd.pw + border + ink) * 2, (bgd.ph + border + ink) * 2)
    place(frameShadow, 0.035 * bgd.u, -0.045 * bgd.u, D_BG + 0.6, (bgd.pw + border + ink) * 2, (bgd.ph + border + ink) * 2)
    place(dots, 0, 0, D_BG - 0.2, bgd.pw * 2, bgd.ph * 2)
    const cssH = Math.max(1, renderer.domElement.clientHeight)
    const dotWorld = ((bgd.hh * 2) / cssH) * DOT_PX * 2 // the tile holds two dots
    dotTex.repeat.set((bgd.pw * 2) / dotWorld, (bgd.ph * 2) / dotWorld)
    bgMat.color.set(panel === 'A' ? PAL.inkDeep : panel === 'B' ? PAL.ink : PAL.sea)
    dotsMat.color.set(panel === 'A' ? PAL.paper : PAL.inkDeep)
    dotsMat.opacity = panel === 'A' ? 0.2 : panel === 'B' ? 0.4 : 0.25

    // ---- Art ----
    const art = dims(D_ART)
    stars.visible = panel === 'A'
    if (stars.visible) {
      for (let i = 0; i < STAR_COUNT; i++) {
        starPos.setXYZ(i, starN[i][0] * art.pw, starN[i][1] * art.ph, -D_ART)
        const on = (i + (f >> 1)) % 3 !== 0 // twinkle: a third of the stars dim, changing every other drawing
        const c = i % 5 === 0 ? goldC : paperC
        starCol.setXYZ(i, c.r * (on ? 1 : 0.35), c.g * (on ? 1 : 0.35), c.b * (on ? 1 : 0.35))
      }
      starPos.needsUpdate = true
      starCol.needsUpdate = true
    }
    focus.visible = earth.visible = panel === 'B'
    if (panel === 'B') {
      const R = Math.min(0.86 * art.pw, 0.7 * art.ph)
      const punch = frameOf(e - INTRO.B_PLUNGE) === 2 ? 1.06 : 1 // punches in when the rocket hits
      const size = ((R * 2) / (EARTH_R * 2)) * punch
      // Iberia (on the disc) sits on the panel center, where the focus lines meet
      place(earth, -IBERIA_ON_DISC.x * R * punch, -IBERIA_ON_DISC.y * R * punch, D_ART, size)
      place(focus, 0, 0, D_ART + 0.3, art.pw * 2, art.ph * 2)
      focus.rotation.z = f % 2 ? 0.02 : -0.02 // the lines shimmer drawing to drawing
    }
    map.visible = target.visible = panel === 'C'
    if (panel === 'C') {
      place(map, 0, 0, D_ART, Math.min(art.pw, art.ph) * 2)
      const tf = frameOf(e - INTRO.C_TARGET)
      target.visible = tf >= 0
      // Stamps in big, overshoots small, settles; then pulses every other drawing
      const ts = tf < 0 ? 0 : tf === 0 ? 1.6 : tf === 1 ? 0.85 : tf === 2 ? 1 : (tf >> 1) % 2 ? 1.1 : 1
      place(target, 0, 0, D_ART - 0.5, art.u * 0.32 * ts)
    }

    // ---- Rocket, smear, speed lines and plate ghosts ----
    const rd = dims(D_ROCKET)
    const p0 = poseAt(e, panel, rd.ph)
    const p1 = panelAt(e - F) === panel ? poseAt(e - F, panel, rd.ph) : null
    const p2 = panelAt(e - 2 * F) === panel ? poseAt(e - 2 * F, panel, rd.ph) : null
    const dist = (a: Pose | null, b: Pose | null) => (a && b ? Math.hypot((a.x - b.x) * rd.pw, (a.y - b.y) * rd.ph) / rd.u : 0)
    const fast = dist(p0, p1) > 0.28
    const wasFast = dist(p1, p2) > 0.28
    panelRocket.visible = p0 !== null
    if (p0) {
      setRocket(panelRocket, p0, D_ROCKET, fast ? 1 : 0)
      panelParts.inner.rotation.y = 0.25
      panelParts.flame.scale.set(1, p0.flame, 1)
      fire.visible = panel !== 'A'
      fire.scale.setScalar(f % 2 ? 3.6 : 3.2)
    }
    // Ghosts: the last two drawings on fast moves, or a plate offset on the arrival drawing
    panelGhosts.forEach((g, i) => {
      const prev = i === 0 ? p1 : p2
      g.visible = false
      if (p0 && fast && prev) {
        setRocket(g, prev, D_ROCKET + 1, 0.5)
        g.visible = true
      } else if (p0 && wasFast) {
        setRocket(g, p0, D_ROCKET + 1, 0)
        g.position.x += (i === 0 ? -1 : 1) * 0.05 * rd.u
        g.visible = true
      }
    })
    // Speed lines along the move, behind the rocket (this drawing and, shorter, the next one)
    const seg = fast ? [p1!, p0!] : wasFast && p0 ? [p2!, p1!] : null
    lineMat.color.set(panel === 'A' ? PAL.paper : PAL.inkDeep)
    lines.forEach((l, i) => {
      l.visible = seg !== null && i < 5
      if (!seg || !l.visible) return
      const ad = dims(D_ART - 1)
      const ax = seg[0].x * ad.pw, ay = seg[0].y * ad.ph, bx = seg[1].x * ad.pw, by = seg[1].y * ad.ph
      const len = Math.hypot(bx - ax, by - ay) * (fast ? 1 : 0.5) * (0.6 + ((i * 7) % 4) * 0.12)
      const ang = Math.atan2(by - ay, bx - ax)
      const off = ([-0.22, -0.09, 0.03, 0.14, 0.26][i]) * ad.u * seg[1].len
      const back = ad.u * seg[1].len * 0.5 + len / 2
      l.position.set(bx - Math.cos(ang) * back - Math.sin(ang) * off, by - Math.sin(ang) * back + Math.cos(ang) * off, -(D_ART - 1))
      l.rotation.z = ang
      l.scale.set(len, 0.012 * ad.u, 1)
    })

    // ---- Captions and lettering (front) ----
    const fr = dims(D_FRONT)
    const capW = Math.min(1.7 * fr.u, 1.8 * fr.pw), capH = capW / 4
    for (const [cap, start, end, p] of [[capA, INTRO.A_CAPTION, INTRO.WIPE1 + F, 'A'], [capC, INTRO.C_CAPTION, INTRO.WIPE2 + F, 'C']] as const) {
      const k = panel === p ? stepPop(frameOf(e - start), frameOf(end - e)) : { scale: 0, rot: 0 }
      cap.visible = k.scale > 0
      if (cap.visible) {
        place(cap, -fr.pw + capW / 2 + 0.06 * fr.u, fr.ph - capH / 2 - 0.07 * fr.u, D_FRONT, capW * k.scale, capH * k.scale)
        cap.rotation.z = -0.025
      }
    }
    const w = panel === 'B' ? stepPop(frameOf(e - INTRO.B_PLUNGE), frameOf(INTRO.FLASH - e)) : { scale: 0, rot: 0 }
    whoosh.visible = w.scale > 0
    if (whoosh.visible) {
      const ww = 1.25 * fr.u
      place(whoosh, -0.25 * fr.pw, 0.55 * fr.ph, D_FRONT, ww * w.scale, (ww * 192 / 512) * w.scale)
      whoosh.rotation.z = 0.1 + w.rot * 0.5
    }
    // Impact star: on Spain at the end of B, on the landing ring in C
    const impactStart = panel === 'B' ? INTRO.FLASH - F : panel === 'C' ? INTRO.C_IMPACT : -1
    // (in B it is a single big drawing: the twinkle where the rocket went in)
    const ik = panel === 'B' ? (frameOf(e - impactStart) === 0 ? { scale: 1.2, rot: 0.1 } : { scale: 0, rot: 0 })
      : impactStart >= 0 ? stepPop(frameOf(e - impactStart), frameOf(INTRO.WIPE2 + F - e)) : { scale: 0, rot: 0 }
    impact.visible = ik.scale > 0
    if (impact.visible) {
      place(impact, 0, 0, D_FRONT, fr.u * (panel === 'B' ? 0.35 : 0.6) * ik.scale)
      impact.rotation.z = ik.rot
    }
  }

  /** World rocket pose at (quantised) time e. */
  function worldPose(e: number) {
    let y: number, tilt: number, sx: number, sy: number
    let jitter = 0, flame = 0
    if (e < INTRO.CRASH) {
      // Falls tail first: hangs at the top, then drops faster and faster, wobbling, stretched
      const u = clamp01((e - INTRO.FALL) / (INTRO.CRASH - INTRO.FALL))
      y = FALL_TOP * (1 - u * u)
      tilt = ROCKET_TILT + (frameOf(e) % 2 ? 0.22 : -0.16) * (1 - 0.5 * u)
      sy = 1.15 + 0.35 * u * u
      sx = 1 / Math.sqrt(sy)
      flame = frameOf(e) % 2 ? 1.3 : 0.7
    } else if (e < INTRO.LIFT) {
      const k = frameOf(e - INTRO.CRASH)
      sy = CRASH_SQUASH[Math.min(k, CRASH_SQUASH.length - 1)]
      if (frameOf(e - INTRO.POP) === 0) sy = 0.94 // recoil when the hatch pops
      sx = 1 / Math.sqrt(Math.max(0.3, sy))
      y = -0.35 // dug into the ground a little
      tilt = ROCKET_TILT + (k === 0 ? 0.18 : k === 1 ? -0.08 : 0)
      if (e >= INTRO.RUMBLE) {
        // Rumble: shakes, straightens up and crouches before blast-off
        const r = clamp01((e - INTRO.RUMBLE) / (INTRO.LIFT - INTRO.RUMBLE - F))
        tilt = lerp(ROCKET_TILT, 0, r)
        jitter = (frameOf(e) % 2 ? 0.18 : -0.18) * r
        sy = 1 - 0.14 * r
        sx = 1 / Math.sqrt(sy)
        y = lerp(-0.35, 0, r)
        flame = r * (frameOf(e) % 2 ? 0.6 : 0.3)
      }
    } else {
      // Blast-off: stretch frame, then accelerates straight up
      const k = frameOf(e - INTRO.LIFT)
      const u = e - INTRO.LIFT
      y = 4 * u + 0.5 * 120 * u * u
      sy = k === 0 ? 1.4 : 1.25
      sx = 1 / Math.sqrt(sy)
      flame = k % 2 ? 1.8 : 1.4
      tilt = 0
    }
    return { y, tilt, jitter, sx, sy, flame }
  }

  function applyWorld(obj: THREE.Object3D, p: ReturnType<typeof worldPose>, dx = 0) {
    obj.position.set(ROCKET_SPOT.x + p.jitter + dx, p.y, ROCKET_SPOT.z)
    obj.rotation.set(0, 0, p.tilt)
    obj.scale.set(ROCKET_SCALE * p.sx, ROCKET_SCALE * p.sy, ROCKET_SCALE * p.sx)
  }

  function updateWorld(e: number) {
    worldRocket.visible = e >= INTRO.FALL && e < INTRO.GONE
    const p = worldPose(e)
    applyWorld(worldRocket, p)
    world.flame.visible = p.flame > 0
    world.flame.scale.set(1, Math.max(0.01, p.flame), 1)
    // Hatch: open past the mark, settle, hold, snap shut (key drawings)
    const ho = frameOf(e - INTRO.POP), hc = frameOf(e - INTRO.CLOSE)
    const open = ho < 0 ? 0 : hc >= 1 ? 0 : hc === 0 ? 0.4 : ho === 0 ? 0.6 : ho === 1 ? 1.15 : 1
    world.hatch.rotation.y = -2.1 * open
    world.silhouette.visible = e < INTRO.POP
    // Plate ghosts: trail the last two drawings while falling / lifting, offset on the impact
    const fallingFast = e >= INTRO.FALL + 4 * F && e < INTRO.CRASH
    const lifting = e >= INTRO.LIFT && e < INTRO.GONE
    const impactK = frameOf(e - INTRO.CRASH)
    worldGhosts.forEach((g, i) => {
      g.visible = false
      if (!worldRocket.visible) return
      if (fallingFast || lifting) {
        applyWorld(g, worldPose(e - (i + 1) * F))
        g.position.z += 0.5
        g.visible = true
      } else if (impactK === 0 || impactK === 1) {
        applyWorld(g, p, (i === 0 ? -1 : 1) * (impactK === 0 ? 0.5 : 0.25))
        g.position.z += 0.5
        g.visible = true
      }
    })
    shadowMat.opacity = worldRocket.visible ? 0.3 * (1 - clamp01(p.y / 30)) : 0
    shadow.scale.setScalar(0.4 + 0.6 * (1 - clamp01(p.y / 30)))
  }

  let finished = false
  return {
    /** The world rocket (falls, crashes, takes off); its position is the base of the rocket. */
    worldRocket,
    /** World position of the porthole (where the detective pops out). */
    porthole: (out: THREE.Vector3) => world.silhouette.getWorldPosition(out),
    /** World position of the nozzle (for exhaust puffs). */
    nozzle: (out: THREE.Vector3) => world.flame.getWorldPosition(out),
    /** Poses everything for entrance time `e`: sampled mid-drawing on twos by the caller, (n + 0.5) * FRAME. */
    update(e: number) {
      if (finished) return
      updatePanels(e)
      updateWorld(e)
    },
    /** Hides everything once the entrance is over (the loop needs a clear stage). */
    finish() {
      if (finished) return
      finished = true
      sheet.visible = screen.visible = false
      worldRocket.visible = shadow.visible = false
      worldGhosts.forEach((g) => (g.visible = false))
    },
  }
}
