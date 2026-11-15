// Cielo con degradado (azul arriba, claro en el horizonte) y un sol con halo.
// Ambos siguen a la cámara para que parezcan infinitamente lejos.
// Day/night: colours and the positions of the sun, the moon and the stars come from the
// time-of-day palette (dayCycle.ts).
import * as THREE from 'three'
import type { DayPalette } from './dayCycle'

export const SKY_TOP = new THREE.Color(0x1a7dff)
export const SKY_HORIZON = new THREE.Color(0x92d6ff) // a touch bluer: the fog uses it, less milky
/** Dirección hacia el sol: al suroeste (como en España por la tarde) y algo alto, para que
 *  las fachadas que miran al sur estén iluminadas y las sombras no sean eternas.
 *  Fixed afternoon sun, now only for the hillshade painted on the map texture (buildToyMap);
 *  the moving sun in the sky and the lights follow dayCycle.ts. */
export const SUN_DIRECTION = new THREE.Vector3(-0.45, 0.42, 0.78).normalize()

/** Sizes relative to the sky dome radius. */
const SUN_SIZE = 0.22
const SUN_SIZE_AT_HORIZON = 1.35 // the disc looks bigger when it is low
const MOON_SIZE = 0.13
/** Sun and moon fade out between these heights (unit-vector y) as they sink below the horizon. */
const FADE_BELOW = -0.1
const FADE_ABOVE = -0.02
/** Strength of the warm glow around the low sun (its colour is in the palette). */
const GLOW_STRENGTH = 0.55
const STAR_COUNT = 220
const STAR_SIZE = 2.4 // pixels
const MOON_COLOR = 0xe6ecff

function makeDiscTexture(stops: [number, string][], craters = false): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [at, color] of stops) g.addColorStop(at, color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  if (craters) {
    ctx.fillStyle = 'rgba(150,165,215,0.5)'
    for (const [x, y, r] of [[0.44, 0.42, 0.05], [0.56, 0.52, 0.035], [0.47, 0.6, 0.025]]) {
      ctx.beginPath()
      ctx.arc(x * size, y * size, r * size, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const makeSunTexture = () =>
  makeDiscTexture([
    [0, 'rgba(255,255,240,1)'],
    [0.16, 'rgba(255,248,210,1)'], // disco del sol
    [0.2, 'rgba(255,230,160,0.55)'], // borde del disco
    [0.5, 'rgba(255,215,140,0.18)'], // halo
    [1, 'rgba(255,210,140,0)'],
  ])

const makeMoonTexture = () =>
  makeDiscTexture(
    [
      [0, 'rgba(255,255,255,1)'],
      [0.27, 'rgba(240,244,255,1)'], // moon disc
      [0.31, 'rgba(200,212,255,0.35)'], // rim
      [0.6, 'rgba(170,190,255,0.1)'], // halo
      [1, 'rgba(170,190,255,0)'],
    ],
    true,
  )

/** A few stars over the upper half of the sky; always the same ones (fixed pseudo-random seed). */
function makeStars(): THREE.Points {
  let seed = 2026
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const positions = new Float32Array(STAR_COUNT * 3)
  const colors = new Float32Array(STAR_COUNT * 3)
  for (let k = 0; k < STAR_COUNT; k++) {
    const y = 0.06 + random() * 0.94
    const angle = random() * Math.PI * 2
    const flat = Math.sqrt(1 - y * y)
    positions.set([Math.cos(angle) * flat, y, Math.sin(angle) * flat], k * 3)
    const brightness = 0.35 + random() * 0.65
    const warm = random() < 0.2 ? 0.8 : 1 // a few slightly yellow ones
    colors.set([brightness, brightness, brightness * warm], k * 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: STAR_SIZE, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false }),
  )
  stars.frustumCulled = false
  return stars
}

const fadeAtHorizon = (height: number) => Math.min(1, Math.max(0, (height - FADE_BELOW) / (FADE_ABOVE - FADE_BELOW)))

export function createSky() {
  // Esfera enorme vista por dentro, pintada con un degradado según la altura
  const uniforms = {
    top: { value: SKY_TOP.clone() },
    horizon: { value: SKY_HORIZON.clone() },
    glow: { value: new THREE.Color(0x000000) },
    sunDir: { value: SUN_DIRECTION.clone() },
  }
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top;
        uniform vec3 horizon;
        uniform vec3 glow;
        uniform vec3 sunDir;
        varying vec3 vDir;
        void main() {
          vec3 dir = normalize(vDir);
          float t = pow(clamp(dir.y, 0.0, 1.0), 0.6);
          vec3 color = mix(horizon, top, t);
          // Sunrise / sunset: warm glow around the sun, strongest near the horizon
          float toSun = max(dot(dir, sunDir), 0.0);
          color += glow * (pow(toSun, 5.0) * (1.0 - t) * ${GLOW_STRENGTH.toFixed(2)});
          gl_FragColor = vec4(color, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  )
  dome.renderOrder = -1 // se pinta antes que todo lo demás

  const sunTexture = makeSunTexture()
  const sun = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: sunTexture, fog: false, depthWrite: false, transparent: true }),
  )
  const moonTexture = makeMoonTexture()
  const moon = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: moonTexture, color: MOON_COLOR, fog: false, depthWrite: false, transparent: true }),
  )
  const stars = makeStars()
  const starMaterial = stars.material as THREE.PointsMaterial

  const group = new THREE.Group()
  group.add(dome, stars, sun, moon)

  /** Coloca cielo, sol, luna y estrellas alrededor de la cámara (llamar en cada fotograma). */
  const update = (camera: THREE.PerspectiveCamera, palette: DayPalette) => {
    const r = camera.far * 0.9
    dome.position.copy(camera.position)
    dome.scale.setScalar(r)
    uniforms.top.value.copy(palette.skyTop)
    uniforms.horizon.value.copy(palette.skyHorizon)
    uniforms.glow.value.copy(palette.skyGlow)
    uniforms.sunDir.value.copy(palette.sunDirection)

    const sunHeight = palette.sunDirection.y
    sun.visible = sunHeight > FADE_BELOW
    sun.position.copy(camera.position).addScaledVector(palette.sunDirection, r * 0.85)
    sun.scale.setScalar(r * SUN_SIZE * (1 + (SUN_SIZE_AT_HORIZON - 1) * (1 - Math.min(1, Math.max(0, sunHeight * 2)))))
    sun.material.color.copy(palette.sunDisc)
    sun.material.opacity = fadeAtHorizon(sunHeight)

    const moonHeight = palette.moonDirection.y
    moon.visible = moonHeight > FADE_BELOW
    moon.position.copy(camera.position).addScaledVector(palette.moonDirection, r * 0.85)
    moon.scale.setScalar(r * MOON_SIZE)
    moon.material.opacity = fadeAtHorizon(moonHeight) * Math.min(1, palette.stars * 2)

    stars.visible = palette.stars > 0.01
    stars.position.copy(camera.position)
    stars.scale.setScalar(r * 0.88)
    starMaterial.opacity = palette.stars
  }

  const dispose = () => {
    dome.geometry.dispose()
    ;(dome.material as THREE.Material).dispose()
    sun.material.dispose()
    sunTexture.dispose()
    moon.material.dispose()
    moonTexture.dispose()
    stars.geometry.dispose()
    starMaterial.dispose()
  }

  return { group, update, dispose }
}
