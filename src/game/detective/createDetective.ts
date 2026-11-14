// Detective noir corriendo (personaje original, estilo chibi de cabeza grande).
// Classic noir look: beige double-breasted trench coat with belt, brown fedora with a dark band,
// leather gloves, an expressive face (big eyes, thick brows, a confident smirk), a red scarf
// whose two tails flow behind like cloth, and a magnifying glass in the hand.
// Mira hacia -Z (el "norte" del mundo cuando no está girado), igual que hacía el coche.
//
// Jerarquía:  root (posición y giro) → tilt (un poco de inclinación del terreno)
//             → body (bote, inclinación hacia delante, rebote elástico)
//                → piernas, tronco, faldones, brazos, cabeza → sombrero
import * as THREE from 'three'
import { TUNING, type CarState } from '../car/carPhysics'
import { toonMaterial } from '../scene/toonGradient'
import { createSquash } from '../car/createSquash'
import { DETECTIVE_SCALE } from './detectiveSize'


// Classic noir palette: tan trench coat, brown hat and leather, dark trousers, red scarf accent.
const COAT = 0xd2a868 // beige trench coat
const COAT_DARK = 0xb08548 // collar, lapels and coat tails
const TROUSERS = 0x3a3f58
const SHOES = 0x4a3020
const GLOVES = 0x6b4126 // brown leather
const SKIN = 0xffcfa0
const NOSE = 0xffa978
const HAIR = 0x4a2f1f
const HAT = 0x7a5235 // brown fedora
const HAT_BAND = 0x2b2540
const EYES = 0xffffff
const PUPIL = 0x2b2540
const DARK = 0x2b2540
const BROWS = 0x3b2516
const GOLD = 0xf2c14e
const BELT = 0x9a7040 // coat belt, same fabric a bit darker
const BUCKLE = GOLD
const SCARF = 0xe5322d // bufanda roja
const SCARF_DARK = 0xb8231f // fringe at the scarf ends
/** Por debajo de esta velocidad se considera que está parado. */
const STILL_SPEED = 0.8
/** Segundos parado antes de sacar la lupa. */
const INSPECT_DELAY = 0.35
/** Rapidez del barrido de la lupa de un lado a otro (rad/s). */
const SWEEP_SPEED = 1.4
/** Intensidad de la sombra violeta en el personaje (1 = como el resto de objetos). */
const DETECTIVE_SHADOW = 0.55
const GLASS = 0xbdf3ff
const WOOD = 0x7a4a2c
/** Radius of the lens glass disc in model units (times DETECTIVE_SCALE in the world). */
const GLASS_RADIUS = 0.19
// Lens focus pose (model units / radians): right arm raised forward and a bit out, the handle
// turned up so the glass sits above the hand, clear of the arm and of the head
const FOCUS_ARM_X = 1.35 // arm forward, a little below horizontal
const FOCUS_ARM_Z = 0.3 // and a little out to the right
/**
 * Direction the glass faces in the focus pose, in the detective's frame (he looks towards -Z):
 * back, up and to the right, so the camera ends up beside his right ear, looking forward and
 * down through the lens. Neither the head nor the arm is on that line of sight.
 */
const FOCUS_NORMAL = new THREE.Vector3(0.35, 0.35, 1).normalize()

export function createDetective() {
  const materials = new Map<number, THREE.Material>()
  const mat = (color: number) => {
    // Sombra suave: con la sombra violeta completa, el negro del traje se vería morado
    if (!materials.has(color)) materials.set(color, toonMaterial(color, {}, DETECTIVE_SHADOW))
    return materials.get(color)!
  }
  const geometries: THREE.BufferGeometry[] = []
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0) => {
    geometries.push(geo)
    const m = new THREE.Mesh(geo, mat(color))
    m.position.set(x, y, z)
    m.castShadow = true
    parent.add(m)
    return m
  }
  const box = (p: THREE.Object3D, w: number, h: number, d: number, c: number, x = 0, y = 0, z = 0) =>
    add(p, new THREE.BoxGeometry(w, h, d), c, x, y, z)
  const ball = (p: THREE.Object3D, r: number, c: number, x = 0, y = 0, z = 0) =>
    add(p, new THREE.IcosahedronGeometry(r, 2), c, x, y, z)
  const pivot = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    parent.add(g)
    return g
  }

  const root = new THREE.Group()
  const tilt = pivot(root, 0, 0, 0)
  const body = pivot(tilt, 0, 0, 0)
  tilt.scale.setScalar(DETECTIVE_SCALE)

  // ---- Piernas (pivote en la cadera) ----
  const HIP = 0.85
  const legs = [-1, 1].map((side) => {
    const leg = pivot(body, side * 0.2, HIP, 0)
    box(leg, 0.24, 0.68, 0.26, TROUSERS, 0, -0.34, 0)
    box(leg, 0.28, 0.16, 0.46, SHOES, 0, -0.76, -0.08) // zapato, con la punta hacia delante
    return leg
  })

  // ---- Tronco: gabardina que se ensancha, cinturón, botones y cuello subido ----
  add(body, new THREE.CylinderGeometry(0.4, 0.52, 0.95, 12), COAT, 0, HIP + 0.47, 0)
  add(body, new THREE.CylinderGeometry(0.53, 0.53, 0.12, 12), BELT, 0, HIP + 0.25, 0)
  box(body, 0.16, 0.12, 0.05, BUCKLE, 0, HIP + 0.25, -0.53) // hebilla
  // Double-breasted: two columns of buttons
  for (const y of [HIP + 0.48, HIP + 0.7]) for (const x of [-0.13, 0.13]) ball(body, 0.05, DARK, x, y, -0.45 + (y - HIP) * 0.04)
  for (const side of [-1, 1]) box(body, 0.16, 0.05, 0.3, COAT_DARK, side * 0.42, HIP + 0.92, 0) // epaulettes
  for (const side of [-1, 1]) {
    const collar = box(body, 0.34, 0.32, 0.1, COAT_DARK, side * 0.22, HIP + 1.0, -0.2)
    collar.rotation.set(-0.25, side * 0.6, side * -0.25) // levantado y abierto, muy noir
  }
  // Faldones de la gabardina: cuelgan de la cadera y vuelan hacia atrás al correr
  const flaps = [-1, 1].map((side) => {
    const flap = pivot(body, side * 0.24, HIP + 0.05, 0.22)
    box(flap, 0.46, 0.62, 0.08, COAT_DARK, 0, -0.31, 0)
    flap.rotation.y = side * 0.25
    return flap
  })
  const front = pivot(body, 0, HIP + 0.05, -0.3) // faldón delantero (más corto, deja ver las piernas)
  for (const side of [-1, 1]) box(front, 0.22, 0.4, 0.06, COAT, side * 0.18, -0.2, 0)

  // ---- Brazos (pivote en el hombro). La mano derecha lleva una lupa ----
  const SHOULDER = HIP + 0.85
  const arms = [-1, 1].map((side) => {
    const arm = pivot(body, side * 0.5, SHOULDER, 0)
    box(arm, 0.2, 0.66, 0.22, COAT, 0, -0.33, 0)
    ball(arm, 0.12, GLOVES, 0, -0.72, 0) // guantes negros
    return arm
  })

  // ---- Bufanda roja: vuelta al cuello y dos puntas que ondean detrás al correr ----
  // Each tail is a chain of segments hanging from the back of the neck, outside the coat, so it
  // never cuts through the body; every segment follows the previous one with a delay, like cloth.
  add(body, new THREE.TorusGeometry(0.36, 0.13, 8, 18).rotateX(Math.PI / 2), SCARF, 0, SHOULDER + 0.02, 0)
  const SEG = 0.26
  const scarfTails = [-1, 1].map((side, t) => {
    const segments: THREE.Group[] = []
    let parent: THREE.Object3D = pivot(body, side * 0.12, SHOULDER - 0.02, 0.46)
    const count = t === 0 ? 3 : 2 // two tails of different length
    for (let i = 0; i < count; i++) {
      const seg = pivot(parent, 0, i === 0 ? 0 : -SEG, 0)
      box(seg, 0.2 - i * 0.015, SEG + 0.02, 0.06, SCARF, 0, -SEG / 2, 0)
      segments.push(seg)
      parent = seg
    }
    box(parent, 0.19, 0.06, 0.065, SCARF_DARK, 0, -SEG - 0.02, 0) // fringe
    segments[0].rotation.y = side * 0.15
    return segments
  })
  const lupa = pivot(arms[1], 0, -0.75, -0.05)
  add(lupa, new THREE.CylinderGeometry(0.04, 0.05, 0.36, 8), WOOD, 0, -0.16, 0) // mango
  const lens = pivot(lupa, 0, -0.5, 0)
  add(lens, new THREE.TorusGeometry(0.2, 0.045, 8, 20), GOLD)
  add(lens, new THREE.CylinderGeometry(GLASS_RADIUS, GLASS_RADIUS, 0.03, 20).rotateX(Math.PI / 2), GLASS)

  // ---- Cabeza grande con nariz, ojos y cejas serias ----
  const head = pivot(body, 0, SHOULDER + 0.05, 0)
  ball(head, 0.55, SKIN, 0, 0.5, 0)
  ball(head, 0.14, NOSE, 0, 0.42, -0.54)
  // Big cartoon eyes (white with a dark pupil and a highlight), thick brows with one raised
  // ("hmm, interesting...") and a confident lopsided smirk
  for (const side of [-1, 1]) {
    const eye = ball(head, 0.13, EYES, side * 0.2, 0.6, -0.48)
    eye.scale.set(0.9, 1.15, 0.5)
    const pupil = ball(head, 0.07, PUPIL, side * 0.19, 0.58, -0.545)
    pupil.scale.set(1, 1.2, 0.5)
    ball(head, 0.025, EYES, side * 0.19 + 0.03, 0.62, -0.575) // highlight
    const brow = box(head, 0.28, 0.08, 0.08, BROWS, side * 0.21, side > 0 ? 0.82 : 0.78, -0.47)
    brow.rotation.z = side > 0 ? -0.15 : 0.3 // left brow frowns, right brow is raised
  }
  const smirk = box(head, 0.22, 0.045, 0.05, DARK, 0.05, 0.25, -0.5)
  smirk.rotation.z = 0.18
  // Pelo: casquete oscuro en la nuca y las sienes (si no, visto desde atrás parece calvo)
  const hair = ball(head, 0.56, HAIR, 0, 0.56, 0.08)
  hair.scale.set(1.02, 0.78, 1)
  for (const side of [-1, 1]) {
    const ear = ball(head, 0.12, SKIN, side * 0.54, 0.46, -0.02) // orejas
    ear.scale.set(0.6, 1, 0.8)
  }
  // Fedora (se levanta un poco al correr, con un muelle)
  const hat = pivot(head, 0, 0.88, 0)
  add(hat, new THREE.CylinderGeometry(0.78, 0.78, 0.06, 20), HAT, 0, 0, 0)
  add(hat, new THREE.CylinderGeometry(0.46, 0.52, 0.42, 16), HAT, 0, 0.23, 0)
  add(hat, new THREE.CylinderGeometry(0.53, 0.53, 0.12, 16), HAT_BAND, 0, 0.08, 0)
  add(hat, new THREE.BoxGeometry(0.08, 0.1, 0.6), HAT_BAND, 0, 0.45, 0) // dent on the crown
  hat.rotation.x = -0.12 // calado hacia delante

  // ---- Animación ----
  const squash = createSquash()
  let phase = 0 // fase de la zancada (radianes)
  let time = 0
  let hatLift = 0, hatVel = 0
  let stillTime = 0 // segundos que lleva parado
  let inspect = 0 // 0 = lupa guardada, 1 = investigando
  let focus = 0 // 0 = normal, 1 = lens held up facing the camera (driven by the camera flight)
  const lensWorld = new THREE.Vector3()
  const lensNormalWorld = new THREE.Vector3()
  const lensScale = new THREE.Vector3()
  // Scratch objects for orienting the glass
  const wantNormal = new THREE.Vector3()
  const axisX = new THREE.Vector3()
  const axisY = new THREE.Vector3()
  const basis = new THREE.Matrix4()
  const wantWorld = new THREE.Quaternion()
  const parentWorld = new THREE.Quaternion()
  const wantLocal = new THREE.Quaternion()
  const IDENTITY = new THREE.Quaternion()
  const UP = new THREE.Vector3(0, 1, 0)
  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v))

  /** Coloca el personaje según la física y anima la carrera. */
  const update = (s: CarState, dt: number) => {
    root.position.set(s.x, s.y, s.z)
    root.rotation.y = s.heading
    tilt.rotation.x = s.pitch * 0.3 // una persona sigue casi recta aunque haya cuesta
    tilt.rotation.z = s.roll * 0.3
    time += dt

    const speed = Math.abs(s.speed)
    const run = Math.min(1, speed / 12) // 0 parado, 1 corriendo
    const sprint = Math.max(0, Math.min(1, (speed - TUNING.maxSpeed) / (TUNING.turboSpeed - TUNING.maxSpeed)))
    // Pasos más rápidos cuanto más corre; con sprint, las piernas van como un molinillo
    phase += dt * (run * (7 + speed * 0.12) + sprint * 14) * Math.sign(s.speed || 1)
    const swing = Math.sin(phase)
    const legAmp = run * (0.85 + sprint * 0.5)
    legs[0].rotation.x = swing * legAmp
    legs[1].rotation.x = -swing * legAmp
    // Brazos al revés que las piernas; con sprint, muy exagerados
    const armAmp = run * (0.9 + sprint * 0.6)
    arms[0].rotation.x = -swing * armAmp
    arms[1].rotation.x = swing * armAmp * 0.7 - run * 0.3 // el de la lupa, algo más recogido
    arms[0].rotation.z = -0.15 - sprint * 0.35 // brazos abiertos al esprintar
    arms[1].rotation.z = 0.15 + sprint * 0.35

    // Cuerpo: bote en cada paso, inclinado hacia delante y hacia dentro en las curvas
    body.position.y = Math.abs(Math.sin(phase)) * 0.14 * run
    body.rotation.x = -(0.12 * run + 0.3 * sprint)
    body.rotation.z = clamp(-s.yawRate * s.speed * 0.004, 0.3)
    // Faldones: vuelan hacia atrás y aletean
    for (const [i, f] of flaps.entries()) f.rotation.x = -(0.15 + run * 0.6 + sprint * 0.6) + Math.sin(phase * 2 + i) * 0.15 * run
    front.rotation.x = -swing * 0.3 * run
    // Scarf: the first segment lifts back with speed; each next segment repeats the wave a bit
    // later and stronger, so the tail ripples like cloth (and sways gently when standing still)
    for (const [i, tail] of scarfTails.entries()) {
      const freq = 3 + run * 9
      tail.forEach((seg, k) => {
        const wave = Math.sin(time * freq + i * 1.3 - k * 0.9)
        const lift = k === 0 ? 0.3 + run * 0.65 + sprint * 0.3 : run * 0.14 // back and down, never flat
        seg.rotation.x = -lift + wave * (0.06 + 0.22 * run) * (1 + k * 0.6)
        seg.rotation.z = (i ? 1 : -1) * wave * 0.04 * (k + 1) * (0.3 + run)
      })
    }

    // Parado: respira y mira a los lados de vez en cuando (como buscando pistas)
    // (no breathing while holding the lens up: the camera is framed on the glass)
    const idle = 1 - run
    head.rotation.y = idle * Math.sin(time * 0.8) * Math.max(0, Math.sin(time * 0.31)) * 0.7
    head.rotation.x = idle * Math.sin(time * 1.7) * 0.04 - sprint * 0.1
    body.scale.y = 1 + idle * Math.sin(time * 2.2) * 0.015 * (1 - focus)

    // ---- Investigar: tras un instante parado, saca la lupa y barre la zona con ella ----
    stillTime = speed < STILL_SPEED ? stillTime + dt : 0
    const wantInspect = stillTime > INSPECT_DELAY ? 1 : 0
    // Sale con calma y se guarda deprisa (en cuanto echa a correr)
    inspect += (wantInspect - inspect) * (1 - Math.exp(-(wantInspect ? 5 : 14) * dt))
    if (inspect > 0.001) {
      const sweep = Math.sin(time * SWEEP_SPEED) * (1 - focus) // -1..1: de un lado a otro (stops while focusing)
      const mix = (a: number, b: number) => a + (b - a) * inspect
      arms[1].rotation.x = mix(arms[1].rotation.x, 1.05 + Math.sin(time * 2.3) * 0.06 * (1 - focus)) // brazo hacia delante y abajo
      arms[1].rotation.z = mix(arms[1].rotation.z, -0.15 + sweep * 0.4) // barrido lateral
      arms[0].rotation.x = mix(arms[0].rotation.x, -0.25) // la otra mano, a la espalda
      arms[0].rotation.z = mix(arms[0].rotation.z, 0.25)
      body.rotation.x = mix(body.rotation.x, -0.22) // inclinado, mirando con atención
      head.rotation.x = mix(head.rotation.x, -0.35)
      head.rotation.y = mix(head.rotation.y, -sweep * 0.35) // la cabeza sigue a la lupa
    }

    // ---- Lens focus: raise the lens in front of the right shoulder, glass facing the camera ----
    const fmix = (a: number, b: number) => a + (b - a) * focus
    arms[1].rotation.x = fmix(arms[1].rotation.x, FOCUS_ARM_X)
    arms[1].rotation.z = fmix(arms[1].rotation.z, FOCUS_ARM_Z)
    lupa.rotation.x = fmix(0, Math.PI - FOCUS_ARM_X) // handle points up from the hand: lens above it
    body.rotation.x = fmix(body.rotation.x, -0.04)
    body.rotation.z = fmix(body.rotation.z, 0)
    head.rotation.x = fmix(head.rotation.x, -0.12)
    head.rotation.y = fmix(head.rotation.y, -0.45) // looks at the lens

    // Sombrero: muelle que lo levanta al esprintar y lo hace botar en cada paso
    const target = sprint * 0.3 + Math.abs(Math.sin(phase)) * 0.06 * run
    hatVel += ((target - hatLift) * 120 - hatVel * 9) * dt
    hatLift += hatVel * dt
    hat.position.y = 0.88 + Math.max(0, hatLift)
    hat.rotation.x = -0.12 + sprint * 0.35

    // Rebote elástico al caer o frenar en seco
    const sq = squash.update(s, dt)
    body.scale.x = body.scale.z = 1 + sq * 0.5
    body.scale.y *= 1 - sq

    // Glass orientation: from its rest pose, turn it so its normal (local +Z) points along
    // FOCUS_NORMAL (in the detective's frame), with its up as close to world up as possible
    if (focus > 0) {
      root.updateMatrixWorld(true)
      wantNormal.copy(FOCUS_NORMAL).applyAxisAngle(UP, root.rotation.y)
      axisX.crossVectors(UP, wantNormal).normalize()
      axisY.crossVectors(wantNormal, axisX)
      wantWorld.setFromRotationMatrix(basis.makeBasis(axisX, axisY, wantNormal))
      lens.parent!.getWorldQuaternion(parentWorld)
      wantLocal.copy(parentWorld).invert().multiply(wantWorld)
      lens.quaternion.slerpQuaternions(IDENTITY, wantLocal, focus)
    } else {
      lens.quaternion.identity()
    }
  }

  return {
    root,
    update,
    /** Fase de la zancada (rad). Cada vez que pasa por un múltiplo de π, un pie pisa el suelo. */
    get stridePhase() {
      return phase
    },
    /** 0 = lupa guardada, 1 = investigando (sale al estar un rato parado). */
    get inspect() {
      return inspect
    },
    /** 0..1: how far the lens is raised to face the camera (set it before update, every frame). */
    setFocus(f: number) {
      focus = Math.max(0, Math.min(1, f))
      // Once the camera is fully in, the UI glass lens (with its own brass bezel) takes the 3D
      // lens's place: the 3D rim is wider than that bezel and would show inside and around it
      lens.visible = focus < 1
    },
    /** World position of the centre of the lens glass. */
    lensPosition() {
      return lens.getWorldPosition(lensWorld)
    },
    /** World-space normal of the lens glass (its local +Z: towards the chase camera at rest and in the focus pose). */
    lensNormal() {
      return lens.getWorldDirection(lensNormalWorld)
    },
    /** World radius of the lens glass disc (model radius times the world scale, DETECTIVE_SCALE). */
    lensRadius() {
      return GLASS_RADIUS * lens.getWorldScale(lensScale).x
    },
    dispose: () => {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
    },
  }
}
