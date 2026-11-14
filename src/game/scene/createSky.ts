// Cielo con degradado (azul arriba, claro en el horizonte) y un sol con halo.
// Ambos siguen a la cámara para que parezcan infinitamente lejos.
import * as THREE from 'three'

export const SKY_TOP = new THREE.Color(0x1a7dff)
export const SKY_HORIZON = new THREE.Color(0x9fe4ff)
/** Dirección hacia el sol: al suroeste (como en España por la tarde) y algo alto, para que
 *  las fachadas que miran al sur estén iluminadas y las sombras no sean eternas. */
export const SUN_DIRECTION = new THREE.Vector3(-0.45, 0.42, 0.78).normalize()

function makeSunTexture(): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,240,1)')
  g.addColorStop(0.16, 'rgba(255,248,210,1)') // disco del sol
  g.addColorStop(0.2, 'rgba(255,230,160,0.55)') // borde del disco
  g.addColorStop(0.5, 'rgba(255,215,140,0.18)') // halo
  g.addColorStop(1, 'rgba(255,210,140,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function createSky() {
  // Esfera enorme vista por dentro, pintada con un degradado según la altura
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: SKY_TOP }, horizon: { value: SKY_HORIZON } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top;
        uniform vec3 horizon;
        varying vec3 vDir;
        void main() {
          float t = pow(clamp(vDir.y, 0.0, 1.0), 0.6);
          gl_FragColor = vec4(mix(horizon, top, t), 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  )
  dome.renderOrder = -1 // se pinta antes que todo lo demás

  const sunTexture = makeSunTexture()
  const sun = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: sunTexture, fog: false, depthWrite: false, transparent: true }),
  )

  const group = new THREE.Group()
  group.add(dome, sun)

  /** Coloca cielo y sol alrededor de la cámara (llamar en cada fotograma). */
  const update = (camera: THREE.PerspectiveCamera) => {
    const r = camera.far * 0.9
    dome.position.copy(camera.position)
    dome.scale.setScalar(r)
    sun.position.copy(camera.position).addScaledVector(SUN_DIRECTION, r * 0.85)
    sun.scale.setScalar(r * 0.22)
  }

  const dispose = () => {
    dome.geometry.dispose()
    ;(dome.material as THREE.Material).dispose()
    sun.material.dispose()
    sunTexture.dispose()
  }

  return { group, update, dispose }
}
