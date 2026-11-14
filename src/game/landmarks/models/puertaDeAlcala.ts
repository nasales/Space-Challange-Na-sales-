// Puerta de Alcalá (Madrid, 1778). Fachada de granito con tres arcos centrales y dos puertas
// adinteladas a los lados. La fachada exterior (+Z, la que ves al llegar) lleva columnas jónicas;
// la interior, pilastras. Encima: entablamento con dentículos, ático con la lápida de bronce
// "REGE CAROLO III ANNO MDCCLXXVIII", frontón con el escudo real y su corona, figuras y trofeos.
// Alrededor, el jardín de la plaza de la Independencia con su verja negra y dorada.
import * as THREE from 'three'
import type { Kit } from '../kit'
import { archRing, bush, crownedShield, dentils, fence, flowerBed, ionicColumn, statue, trophy } from '../ornaments'

const GRANITE = 0xc7bfb2 // granito gris claro (muros)
const STONE = 0xf6edd8 // caliza blanca (decoración)
const TRIM = 0xe8dcc0 // molduras
const PLINTH = 0xa89f92 // zócalo
const STATUE = 0xf1e7d0
const BRONZE = 0x4b3a2a
const GOLD = 0xf2c14e
const RED = 0xd23a30
const YELLOW = 0xf6c945

const W = 40, H = 13, D = 6
/** Huecos de izquierda a derecha: puerta, arco, arco central, arco, puerta. */
const OPENINGS = [
  { x: -15.5, width: 3.6, height: 7 },
  { x: -7.5, width: 5.2, height: 6, arch: true },
  { x: 0, width: 6, height: 6.4, arch: true },
  { x: 7.5, width: 5.2, height: 6, arch: true },
  { x: 15.5, width: 3.6, height: 7 },
]
/** Machones (trozos de muro entre huecos): [desde, hasta] en X. */
const PIERS = [[-20, -17.3], [-13.7, -10.1], [-4.9, -3], [3, 4.9], [10.1, 13.7], [17.3, 20]]
const COLUMNS_X = [-12.8, -11, -3.95, 3.95, 11, 12.8]
const ZOCALO = 1

/** Letras de la inscripción como bloquecitos dorados (una fila de texto). */
function inscriptionRow(kit: Kit, text: string, y: number, z: number, letter: number) {
  const g = new THREE.Group()
  const step = letter * 0.75
  const start = -((text.length - 1) * step) / 2
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ') continue
    g.add(kit.box(letter * 0.5, letter, letter * 0.25, GOLD, start + i * step, y, z))
  }
  return g
}

export function buildPuertaDeAlcala(kit: Kit): THREE.Group {
  const g = new THREE.Group()
  const front = D / 2

  // ---- Cuerpo ----
  g.add(kit.box(W + 0.8, ZOCALO, D + 0.8, PLINTH)) // zócalo
  const wall = kit.facade(W, H - ZOCALO, D, OPENINGS.map((o) => ({ ...o, height: o.height - ZOCALO })), GRANITE)
  wall.position.y = ZOCALO
  g.add(wall)
  // Impostas: molduras en los machones a la altura donde arrancan los arcos
  for (const [a, b] of PIERS) g.add(kit.box(b - a + 0.2, 0.45, D + 0.4, TRIM, (a + b) / 2, 6, 0))
  // Roscas de los arcos con su clave, y dintel con relieve sobre las puertas
  for (const o of OPENINGS) {
    if (o.arch) {
      g.add(archRing(kit, o.x, o.height, o.width / 2, 0.75, D + 0.3, TRIM, STONE))
    } else {
      g.add(kit.box(o.width + 1.2, 0.55, D + 0.5, TRIM, o.x, o.height, 0)) // dintel
      g.add(kit.box(o.width - 0.4, 2.4, D + 0.2, STONE, o.x, o.height + 1.2, 0)) // relieve
      for (const z of [front + 0.15, -front - 0.15]) {
        g.add(kit.mesh(new THREE.IcosahedronGeometry(0.55, 1), STATUE, o.x, o.height + 2.4, z)) // cabeza de león
        // Guirnalda: bolitas colgando en curva
        for (let i = 0; i <= 6; i++) {
          const t = i / 6, x = o.x - 1.3 + t * 2.6
          g.add(kit.mesh(new THREE.IcosahedronGeometry(0.22, 0), TRIM, x, o.height + 1.9 - Math.sin(t * Math.PI) * 0.7, z))
        }
      }
    }
  }

  // ---- Columnas (fuera) y pilastras (dentro y esquinas) ----
  for (const x of COLUMNS_X) {
    const c = ionicColumn(kit, H - ZOCALO, 0.7, STONE, TRIM)
    c.position.set(x, ZOCALO, front + 0.8)
    g.add(c)
    g.add(kit.box(1.3, H - ZOCALO, 0.5, TRIM, x, ZOCALO, -front - 0.25))
  }
  for (const x of [-19.2, 19.2]) for (const z of [front + 0.25, -front - 0.25]) g.add(kit.box(1.4, H - ZOCALO, 0.5, TRIM, x, ZOCALO, z))

  // ---- Entablamento: arquitrabe, friso, dentículos y cornisa (vuela sobre las columnas) ----
  const ez = 0.5, ed = D + 2.6
  g.add(kit.box(W + 0.6, 0.8, ed, TRIM, 0, H, ez))
  g.add(kit.box(W + 0.4, 1, ed - 0.4, GRANITE, 0, H + 0.8, ez))
  g.add(dentils(kit, W + 0.4, 0.35, TRIM, H + 1.8, ez + ed / 2 - 0.1))
  g.add(kit.box(W + 2, 0.7, ed + 0.8, TRIM, 0, H + 2.15, ez))
  const top = H + 2.85

  // ---- Ático central con la lápida ----
  g.add(kit.box(17, 3.8, D, STONE, 0, top, 0))
  g.add(kit.box(11.5, 2.4, 0.25, BRONZE, 0, top + 0.7, front + 0.1))
  g.add(inscriptionRow(kit, 'REGE CAROLO III', top + 1.75, front + 0.25, 0.5))
  g.add(inscriptionRow(kit, 'ANNO MDCCLXXVIII', top + 0.95, front + 0.25, 0.5))
  g.add(kit.box(18, 0.6, D + 0.6, TRIM, 0, top + 3.8, 0))
  const pedY = top + 4.4
  g.add(kit.pediment(18, 3.6, D * 0.8, GRANITE, pedY))

  // ---- Escudo real con corona, y dos figuras (la Fama) a sus lados ----
  const shield = crownedShield(kit, 4.2, RED, YELLOW, GOLD)
  shield.position.set(0, pedY - 0.4, D * 0.4 + 0.05)
  g.add(shield)
  for (const side of [-1, 1]) {
    const fame = statue(kit, 2.6, STATUE, 'sit')
    fame.position.set(side * 3.6, pedY, D * 0.4 + 0.6)
    fame.rotation.y = -side * 0.4
    g.add(fame)
  }
  // Niños en las esquinas del ático
  for (const side of [-1, 1]) {
    const child = statue(kit, 2.4, STATUE)
    child.position.set(side * 8.2, pedY, 0)
    child.rotation.y = side < 0 ? Math.PI : 0
    g.add(child)
  }
  // Trofeos militares sobre las columnas y las esquinas
  for (const x of [-11.9, 11.9, -18.8, 18.8]) {
    const t = trophy(kit, Math.abs(x) > 15 ? 3.6 : 4.4, STATUE, RED, YELLOW, BRONZE)
    t.position.set(x, top, 0.5)
    g.add(t)
  }
  return g
}

/**
 * Jardín alrededor de la Puerta: bordillo, césped, parterres de flores, setos y verja.
 * w y d: tamaño del jardín (unidades del modelo). Devuelve el grupo y la altura del césped.
 */
export function buildPuertaDeAlcalaBase(kit: Kit, w: number, d: number) {
  const g = new THREE.Group()
  const lawnTop = 0.4
  // Plaza empedrada alrededor (por aquí se puede conducir)
  g.add(kit.box(w + 16, 0.03, d + 16, 0xe9dcc0))
  g.add(kit.box(w + 1.2, 0.05, d + 1.2, 0xc9b994)) // cenefa más oscura junto al bordillo
  g.add(kit.box(w, 0.35, d, 0xcfc6b5)) // bordillo
  g.add(kit.box(w - 0.6, lawnTop, d - 0.6, 0x5ccf4a)) // césped
  // Parterres delante y detrás, con flores de colores
  const flowers = [0xff4f6d, 0xffd23f, 0xff8fd8, 0xffffff, 0xff6b2c]
  for (const z of [d / 2 - 1.1, -d / 2 + 1.1]) {
    const bed = flowerBed(kit, w - 4, 1.2, 0x7a4a2c, flowers)
    bed.position.set(0, lawnTop, z)
    g.add(bed)
  }
  // Setos redondos en las esquinas y a los lados
  for (const x of [-w / 2 + 1.2, w / 2 - 1.2]) {
    for (const z of [-d / 2 + 1.2, 0, d / 2 - 1.2]) {
      const b = bush(kit, 1.8, 0x2fa84a, 0x7a4a2c)
      b.position.set(x, lawnTop, z)
      g.add(b)
    }
  }
  // Verja de hierro negro con puntas doradas
  const f = fence(kit, w - 0.3, d - 0.3, 1.3, 0.9, 0x1d2128, GOLD)
  f.position.y = 0.35
  g.add(f)
  return { group: g, top: lawnTop }
}
