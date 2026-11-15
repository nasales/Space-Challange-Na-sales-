// Casas de los pueblos y ciudades, estilo maqueta cartoon.
// - Cada tipo de casa se monta con piezas (muros, zócalo, tejado, puerta, ventanas...) y se junta en
//   UNA geometría con el color guardado en cada vértice: así todas las piezas usan un solo material.
// - Las ~6.000 casas se dibujan con InstancedMesh (copias de la misma geometría en distintos sitios),
//   agrupadas por trozos del mapa para que three.js no dibuje los trozos que no salen en cámara.
// - Las casas bloquean al detective (rejilla espacial para comprobarlo rápido).
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { toonMaterial } from '../scene/toonGradient'
import { piece, box, plate } from '../scene/vertexPieces'
import { makeLightBatch, makeLightMesh } from '../scene/nightLights'
import type { HouseSpot, HouseVariant, TownStyle } from './placeTowns'

/** Tamaño de las casas respecto a sus medidas base (una casa baja mide 10 de ancho sin escalar). */
const HOUSE_SCALE = 1.1
/** Tamaño de los trozos del mapa (unidades del mundo) para descartar lo que no se ve. */
const CHUNK = 300
/** Cuánto se hunden los muros bajo el suelo (para que no se vean huecos en las cuestas). */
const SINK = 3
/** Altura del punto más alto de cada tipo (sin escalar): casa baja, de dos alturas, alargada, iglesia, bloque, torre. */
const ROOF_TOP: Record<HouseVariant, number> = { 0: 11, 1: 16.5, 2: 11, 3: 33, 4: 24, 5: 45, 6: 11 }
/** Huecos oscuros del campanario. */
const BELFRY = 0x2a2833

// ---- Night lights (see scene/nightLights.ts): lit windows and a lamp over some doors ----
/** Share of the houses with somebody at home (the rest stay dark all night). */
const LIT_HOUSES = 0.9
/** Share of the windows of a lit house that are lit. */
const LIT_WINDOWS = 0.7
/** Share of the lit houses with a lamp over the door. */
const DOOR_LAMPS = 0.6
/** Door lamp: size of its glow (house units) and brightness. */
const DOOR_LAMP_RADIUS = 1.5
const DOOR_LAMP_INTENSITY = 0.75
/** Lit windows are a little smaller than the window itself, so its frame still shows. */
const LIT_WINDOW_SIZE = 0.82
/** Seed of the random choice of lit windows (same lights every time). */
const LIGHT_SEED = 2026

/** A place where a house can have a light: a window, or the door (lamp above it). */
interface LightSlot {
  door: boolean
  w: number
  h: number
  x: number
  /** base of the window or door */
  y0: number
  z: number
  rotY: number
}
/** Light slots of each house type, filled in when its geometry is built (same for both styles). */
const LIGHT_SLOTS = new Map<HouseVariant, LightSlot[]>()

const PALETTES: Record<TownStyle, Record<string, number>> = {
  // Sur y centro: casas encaladas, zócalo ocre, teja roja y contraventanas azules
  south: { wall: 0xfbf7ef, band: 0xf0b84a, roof: 0xe2643c, door: 0x7a4a2c, window: 0x2f6fb5, iron: 0x2a2833, gold: 0xf2c14e,
    block: 0xf7cf8f, tower: 0xf3b4a2, cornice: 0xfbf7ef },
  // Norte: piedra, tejado de pizarra y ventanas blancas
  north: { wall: 0xd3c9b6, band: 0x9a8f80, roof: 0x4d566b, door: 0x5a3a22, window: 0xf7f7f2, iron: 0xf7f7f2, gold: 0xf2c14e,
    block: 0xc4bfb6, tower: 0xb4c0c8, cornice: 0x8e8a84 },
  // Meseta (Castilla, Madrid, Aragón, La Rioja): ochre adobe, brown-red tile, dark wooden shutters, brick blocks
  castile: { wall: 0xe8bf7e, band: 0xb9824e, roof: 0xbf5636, door: 0x5e3a22, window: 0x7a3f2a, iron: 0x2a2833, gold: 0xf2c14e,
    block: 0xcf7a52, tower: 0xead3ad, cornice: 0xf4e6c8 },
  // Mediterranean coast: warm cream walls, orange tile, green shutters, pastel blocks
  levante: { wall: 0xf8e6c4, band: 0xe0a066, roof: 0xf08a3c, door: 0x6b4026, window: 0x3f9a62, iron: 0x2a2833, gold: 0xf2c14e,
    block: 0xf6d9b8, tower: 0xbfe0e0, cornice: 0xfff6e6 },
}

/** Tejado a dos aguas: prisma triangular de ancho w, alto h y fondo d (cumbrera a lo largo de Z). */
function roof(w: number, h: number, d: number, color: number, y0: number, rotY = 0) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, 0)
  s.lineTo(w / 2, 0)
  s.lineTo(0, h)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false })
  geo.translate(0, 0, -d / 2)
  return piece(geo, color, 0, y0, 0, rotY)
}

/** Medidas de los edificios (sin escalar): ancho (X), fondo (Z), alto de muros y número de plantas. */
const BUILDINGS = {
  4: { w: 16, d: 14, h: 20, floors: 4 }, // bloque de pisos
  5: { w: 14, d: 14, h: 40, floors: 8 }, // torre
} as const

/** Bloque de pisos o torre: caja de color con rejilla de ventanas en las cuatro fachadas y azotea. */
function buildBuilding(parts: THREE.BufferGeometry[], variant: 4 | 5, p: Record<string, number>, slots: LightSlot[]) {
  const windowPlate = (w: number, h: number, x: number, y0: number, z: number, rotY = 0) => {
    slots.push({ door: false, w, h, x, y0, z, rotY })
    return plate(w, h, p.window, x, y0, z, rotY)
  }
  const { w, d, h, floors } = BUILDINGS[variant]
  const facade = variant === 4 ? p.block : p.tower
  const floorH = h / floors
  parts.push(box(w, h + SINK, d, facade, 0, -SINK), box(w + 0.1, 1.5 + SINK, d + 0.1, p.band, 0, -SINK))
  parts.push(box(w + 0.8, 1, d + 0.8, p.cornice, 0, h)) // cornisa
  // Ventanas: 3 o 4 por fachada y planta (la planta baja, portal y escaparates)
  const cols = (len: number) => (len >= 16 ? [-5.4, -1.8, 1.8, 5.4] : [-4.2, 0, 4.2])
  for (let f = 1; f < floors; f++) {
    const y = f * floorH + 1.2
    for (const x of cols(w)) {
      parts.push(windowPlate(1.8, 2.4, x, y, d / 2 + 0.02), windowPlate(1.8, 2.4, -x, y, -d / 2 - 0.02, Math.PI))
      if (variant === 4) parts.push(box(2.4, 0.3, 1, p.iron, x, y - 0.4, d / 2 + 0.5)) // balconcitos
    }
    for (const z of cols(d)) {
      parts.push(windowPlate(1.8, 2.4, w / 2 + 0.02, y, z, Math.PI / 2), windowPlate(1.8, 2.4, -w / 2 - 0.02, y, -z, -Math.PI / 2))
    }
  }
  parts.push(plate(3, 3.8, p.door, 0, 0, d / 2 + 0.03)) // portal
  slots.push({ door: true, w: 3, h: 3.8, x: 0, y0: 0, z: d / 2 + 0.03, rotY: 0 })
  for (const x of [-w / 2 + 3, w / 2 - 3]) parts.push(windowPlate(3.4, 2.6, x, 0.8, d / 2 + 0.03)) // escaparates
  // Azotea: depósito de agua (bloque) o caseta con antena (torre)
  if (variant === 4) {
    parts.push(cylinderPiece(1.6, 2.4, p.cornice, -4, h + 1, -3))
  } else {
    parts.push(box(4, 2.5, 4, p.cornice, 2, h + 1, -2), box(0.3, 4, 0.3, p.iron, 2, h + 3.5, -2))
  }
}

/** Hórreo colours: granite pillars and body, wooden slats, terracotta roof (Galician type). */
const HORREO = { granite: 0xc9c1b2, darkGranite: 0x9c9384, slat: 0x8a5a36, roof: 0xd8693f, cross: 0x9c9384 }

/**
 * Hórreo (Galicia / Asturias raised granary): a long narrow box on stone stilts with flat caps
 * (so mice cannot climb), slatted wooden sides, a gable roof along X and a small stone cross.
 * Footprint about 10 x 4.5; roof top at 11 (see surfaceOf / ROOF_TOP).
 */
function buildHorreo(parts: THREE.BufferGeometry[]) {
  for (const x of [-4, 0, 4]) {
    for (const z of [-1.4, 1.4]) {
      parts.push(box(0.9, 3.2 + SINK, 0.9, HORREO.darkGranite, x, -SINK, z)) // pillar
      parts.push(box(1.7, 0.5, 1.7, HORREO.granite, x, 3.2, z)) // flat cap
    }
  }
  parts.push(box(10.6, 0.5, 4.6, HORREO.granite, 0, 3.7)) // floor slab
  parts.push(box(10, 3.8, 4, HORREO.slat, 0, 4.2)) // body
  for (const x of [-5.05, 5.05]) parts.push(box(0.9, 3.8, 4.3, HORREO.granite, x * 0.99, 4.2)) // stone end walls
  for (const x of [-3, -1, 1, 3]) {
    // light vertical slats on both long sides
    parts.push(plate(0.5, 3.4, 0xb37a48, x, 4.4, 2.02), plate(0.5, 3.4, 0xb37a48, -x, 4.4, -2.02, Math.PI))
  }
  parts.push(roof(5.4, 2.5, 11.4, HORREO.roof, 8, Math.PI / 2))
  parts.push(box(0.35, 1.6, 0.35, HORREO.cross, 5.3, 9.6), box(0.35, 0.35, 1.1, HORREO.cross, 5.3, 10.5)) // cross on the gable
}

/** Depósito de agua: cilindro con la base en y0. */
const cylinderPiece = (r: number, hgt: number, color: number, x: number, y0: number, z: number) =>
  piece(new THREE.CylinderGeometry(r, r, hgt, 8), color, x, y0 + hgt / 2, z)

/** Construye la geometría de un tipo de casa (frente hacia +Z, base en y = 0). */
function buildHouse(variant: HouseVariant, style: TownStyle) {
  const p = PALETTES[style]
  const parts: THREE.BufferGeometry[] = []
  // Every window and door is also noted down as a place for a night light
  const slots: LightSlot[] = []
  const windowPlate = (w: number, h: number, x: number, y0: number, z: number, rotY = 0) => {
    slots.push({ door: false, w, h, x, y0, z, rotY })
    return plate(w, h, p.window, x, y0, z, rotY)
  }
  const doorPlate = (w: number, h: number, x: number, z: number) => {
    slots.push({ door: true, w, h, x, y0: 0, z, rotY: 0 })
    return plate(w, h, p.door, x, 0, z)
  }
  const windowsFront = (xs: number[], ys: number[], z: number) => {
    for (const x of xs) for (const y of ys) parts.push(windowPlate(1.6, 1.7, x, y, z))
  }
  if (variant === 0) {
    // Casa baja
    parts.push(box(10, 7 + SINK, 9, p.wall, 0, -SINK), box(10.1, 1.2 + SINK, 9.1, p.band, 0, -SINK))
    parts.push(roof(11.4, 4, 10, p.roof, 7))
    parts.push(doorPlate(2, 3.6, 0, 4.52))
    windowsFront([-3, 3], [3.2], 4.52)
    for (const sx of [-5.05, 5.05]) parts.push(windowPlate(1.6, 1.7, sx * 0.994, 3.2, 0, Math.sign(sx) * Math.PI / 2))
  } else if (variant === 1) {
    // Casa de dos alturas, con balcón y chimenea
    parts.push(box(11, 12 + SINK, 10, p.wall, 0, -SINK), box(11.1, 1.2 + SINK, 10.1, p.band, 0, -SINK))
    parts.push(roof(12.4, 4.5, 11, p.roof, 12))
    parts.push(doorPlate(2, 3.6, 0, 5.02))
    windowsFront([-3.2, 3.2], [3.2], 5.02)
    windowsFront([-3.2, 0, 3.2], [8], 5.02)
    parts.push(box(5, 0.4, 1.3, p.iron, 0, 6.6, 5.6)) // balcón
    parts.push(box(5, 1, 0.12, p.iron, 0, 7, 6.2)) // barandilla
    parts.push(box(1.4, 3.5, 1.4, p.wall, 3, 13, -2)) // chimenea
  } else if (variant === 2) {
    // Casa alargada (tejado con la cumbrera a lo largo)
    parts.push(box(16, 7 + SINK, 9, p.wall, 0, -SINK), box(16.1, 1.2 + SINK, 9.1, p.band, 0, -SINK))
    parts.push(roof(10.4, 4, 17.4, p.roof, 7, Math.PI / 2))
    parts.push(doorPlate(2, 3.6, -4, 4.52))
    windowsFront([0, 4, 6.5], [3.2], 4.52)
  } else if (variant === 4 || variant === 5) {
    buildBuilding(parts, variant, p, slots)
  } else if (variant === 6) {
    buildHorreo(parts)
  } else {
    // Iglesia con campanario
    parts.push(box(12, 10 + SINK, 22, p.wall, 0, -SINK, -2), box(12.1, 1.5 + SINK, 22.1, p.band, 0, -SINK, -2))
    parts.push(roof(13.4, 5, 23, p.roof, 10))
    parts.push(box(6.5, 24 + SINK, 6.5, p.wall, 0, -SINK, 10)) // torre
    for (const [x, z, w, d] of [[0, 13.3, 2, 0.3], [0, 6.7, 2, 0.3], [3.3, 10, 0.3, 2], [-3.3, 10, 0.3, 2]])
      parts.push(box(w, 3, d, BELFRY, x, 18.5, z)) // huecos de las campanas
    parts.push(piece(new THREE.ConeGeometry(4.9, 6, 4), p.roof, 0, 27, 10, Math.PI / 4)) // chapitel
    parts.push(box(0.4, 2.6, 0.4, p.gold, 0, 30, 10), box(1.6, 0.4, 0.4, p.gold, 0, 31.4, 10)) // cruz
    parts.push(doorPlate(3, 5, 0, 13.28)) // portada
    for (const z of [-8, -2, 4]) for (const sx of [-6.05, 6.05]) parts.push(windowPlate(1.4, 3, sx * 0.995, 4, z, Math.sign(sx) * Math.PI / 2))
  }
  const merged = mergeGeometries(parts)!
  parts.forEach((g) => g.dispose())
  LIGHT_SLOTS.set(variant, slots)
  return merged
}

/** Tejado a dos aguas: altura en un punto a distancia |t| de la cumbrera (muro + perfil del tejado). */
const gable = (t: number, wallTop: number, half: number, rise: number) => wallTop + rise * Math.max(0, 1 - Math.abs(t) / half)
const inside = (lx: number, lz: number, hx: number, z0: number, z1: number) => Math.abs(lx) <= hx && lz >= z0 && lz <= z1

/**
 * Altura de la superficie de cada tipo de casa en un punto (lx, lz) de su planta, sin escalar.
 * -Infinity si el punto está fuera. Sale de las mismas medidas que buildHouse: así el detective
 * pisa justo el tejado que se ve.
 */
function surfaceOf(variant: HouseVariant, lx: number, lz: number): number {
  switch (variant) {
    case 0: return inside(lx, lz, 5, -4.5, 4.5) ? gable(lx, 7, 5.7, 4) : -Infinity
    case 1: return inside(lx, lz, 5.5, -5, 5) ? gable(lx, 12, 6.2, 4.5) : -Infinity
    case 2: return inside(lx, lz, 8, -4.5, 4.5) ? gable(lz, 7, 5.2, 4) : -Infinity
    case 3: {
      let top = inside(lx, lz, 6, -13, 9) ? gable(lx, 10, 6.7, 5) : -Infinity // nave
      if (inside(lx, lz, 3.25, 6.75, 13.25)) {
        // torre con chapitel (pirámide de 4 caras desde y = 24 hasta 30)
        const m = Math.max(Math.abs(lx), Math.abs(lz - 10))
        top = Math.max(top, 24 + 6 * Math.max(0, 1 - m / 3.46))
      }
      return top
    }
    case 6: return inside(lx, lz, 5.3, -2.3, 2.3) ? gable(lz, 8, 2.7, 2.5) : -Infinity // hórreo
    default: {
      const b = BUILDINGS[variant]
      return inside(lx, lz, b.w / 2, -b.d / 2, b.d / 2) ? b.h + 1 : -Infinity // azotea (encima de la cornisa)
    }
  }
}

export function createTowns(houses: HouseSpot[]) {
  const group = new THREE.Group()
  const material = toonMaterial(0xffffff, { vertexColors: true })
  const geometries = new Map<string, THREE.BufferGeometry>()
  const geometryFor = (style: TownStyle, variant: HouseVariant) => {
    const key = `${style}-${variant}`
    if (!geometries.has(key)) geometries.set(key, buildHouse(variant, style))
    return geometries.get(key)!
  }

  // Agrupar por trozo del mapa y tipo de casa
  const buckets = new Map<string, HouseSpot[]>()
  for (const h of houses) {
    const key = `${Math.floor(h.x / CHUNK)},${Math.floor(h.z / CHUNK)},${h.style},${h.variant}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(h)
  }
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const scl = new THREE.Vector3()
  for (const list of buckets.values()) {
    const { style, variant } = list[0]
    const mesh = new THREE.InstancedMesh(geometryFor(style, variant), material, list.length)
    list.forEach((h, i) => {
      pos.set(h.x, h.y, h.z)
      q.setFromAxisAngle(up, h.rot)
      scl.setScalar(h.scale * HOUSE_SCALE)
      m.compose(pos, q, scl)
      mesh.setMatrixAt(i, m)
    })
    mesh.computeBoundingSphere() // esfera que envuelve todas las copias: para descartar el trozo entero
    mesh.castShadow = mesh.receiveShadow = true
    group.add(mesh)
  }

  // ---- Night lights: the lit windows and door lamps of every house of a map chunk in ONE mesh ----
  // Which ones are lit is random but always the same (seeded). Positions are final (world).
  const lights = new THREE.Group()
  const lightGeometries: THREE.BufferGeometry[] = []
  {
    let seed = LIGHT_SEED
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const chunks = new Map<string, HouseSpot[]>()
    for (const h of houses) {
      const key = `${Math.floor(h.x / CHUNK)},${Math.floor(h.z / CHUNK)}`
      if (!chunks.has(key)) chunks.set(key, [])
      chunks.get(key)!.push(h)
    }
    const slotMatrix = new THREE.Matrix4()
    const world = new THREE.Matrix4()
    const lamp = new THREE.Vector3()
    for (const list of chunks.values()) {
      const batch = makeLightBatch()
      for (const h of list) {
        const atHome = random() < LIT_HOUSES
        const phase = random() // the windows of a house come on almost together
        const withLamp = random() < DOOR_LAMPS
        const s = h.scale * HOUSE_SCALE
        pos.set(h.x, h.y, h.z)
        q.setFromAxisAngle(up, h.rot)
        scl.setScalar(s)
        m.compose(pos, q, scl)
        for (const slot of LIGHT_SLOTS.get(h.variant) ?? []) {
          const lit = random() < LIT_WINDOWS, jitter = random() * 0.15 // always drawn: same lights whatever the ratios
          if (!atHome) continue
          if (slot.door) {
            if (!withLamp) continue
            lamp.set(slot.x, slot.y0 + slot.h + 0.9, slot.z + 0.5).applyMatrix4(m)
            batch.addHalo(lamp.x, lamp.y, lamp.z, DOOR_LAMP_RADIUS * s, phase, DOOR_LAMP_INTENSITY)
          } else if (lit) {
            slotMatrix.makeRotationY(slot.rotY).setPosition(slot.x, slot.y0 + slot.h / 2, slot.z)
            world.multiplyMatrices(m, slotMatrix)
            batch.addPanel(world, slot.w * LIT_WINDOW_SIZE, slot.h * LIT_WINDOW_SIZE, Math.min(1, phase * 0.85 + jitter))
          }
        }
      }
      const mesh = makeLightMesh(batch)
      if (!mesh) continue
      lightGeometries.push(mesh.geometry)
      lights.add(mesh)
    }
  }

  // ---- Choques: rejilla espacial (celda → casas) para comprobar solo las cercanas ----
  const CELL = 40
  const grid = new Map<string, HouseSpot[]>()
  for (const h of houses) {
    const key = `${Math.floor(h.x / CELL)},${Math.floor(h.z / CELL)}`
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key)!.push(h)
  }
  /** ¿Choca el punto (x, z) con alguna casa? (extra: margen añadido al radio, p. ej. para no plantar árboles pegados) */
  const blocks = (x: number, z: number, extra = 0) => {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL)
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const cell = grid.get(`${cx + i},${cz + j}`)
        if (!cell) continue
        for (const h of cell) {
          const r = h.radius * h.scale * 0.9 + extra
          if ((h.x - x) ** 2 + (h.z - z) ** 2 < r * r) return true
        }
      }
    }
    return false
  }

  /** Altura del tejado en (x, z) si hay una casa encima; si no, -Infinity. (La usa la cámara.) */
  const topAt = (x: number, z: number) => {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL)
    let top = -Infinity
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (const h of grid.get(`${cx + i},${cz + j}`) ?? []) {
          const r = h.radius * h.scale * 1.3 // un poco más ancho: el tejado vuela sobre los muros
          if ((h.x - x) ** 2 + (h.z - z) ** 2 < r * r) top = Math.max(top, h.y + ROOF_TOP[h.variant] * h.scale * HOUSE_SCALE)
        }
      }
    }
    return top
  }

  /**
   * Altura de la superficie de las casas en (x, z): tejado o azotea, o -Infinity si no hay casa.
   * El detective la usa como "suelo", así que escala las casas igual que las montañas.
   */
  const surfaceAt = (x: number, z: number) => {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL)
    let top = -Infinity
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (const h of grid.get(`${cx + i},${cz + j}`) ?? []) {
          const dx = x - h.x, dz = z - h.z
          const s = h.scale * HOUSE_SCALE
          if (dx * dx + dz * dz > (25 * s) ** 2) continue // lejos: ni se mira
          // Al sistema de la casa: deshacer el giro y la escala
          const cos = Math.cos(h.rot), sin = Math.sin(h.rot)
          const lx = (dx * cos - dz * sin) / s
          const lz = (dx * sin + dz * cos) / s
          const local = surfaceOf(h.variant, lx, lz)
          if (local > -Infinity) top = Math.max(top, h.y + local * s)
        }
      }
    }
    return top
  }

  return {
    group,
    /** Night lights (lit windows, door lamps): goes in the night-lights scene, not in the main one. */
    lights,
    blocks,
    topAt,
    surfaceAt,
    count: houses.length,
    dispose: () => {
      geometries.forEach((g) => g.dispose())
      lightGeometries.forEach((g) => g.dispose())
      material.dispose()
    },
  }
}
