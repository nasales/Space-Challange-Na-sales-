// Escena básica de three.js: renderizador (con sombras), cámara y niebla.
// El cielo, el sol y las luces están en createSky.ts y createLighting.ts.
import * as THREE from 'three'
import { SKY_HORIZON } from './createSky'

export function createScene(container: HTMLElement) {
  // Sin antialiasing aquí: la escena se dibuja en una imagen intermedia que ya lo tiene (createInkOutline)
  const renderer = new THREE.WebGLRenderer({ antialias: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap // sombras con el borde suavizado
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = SKY_HORIZON.clone()
  // La niebla, del color del horizonte, difumina lo lejano y da sensación de distancia
  scene.fog = new THREE.Fog(SKY_HORIZON.clone(), 250, 900)

  const camera = new THREE.PerspectiveCamera(
    50,
    container.clientWidth / container.clientHeight,
    0.05,
    8000,
  )

  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)

  const dispose = () => {
    observer.disconnect()
    renderer.setAnimationLoop(null)
    renderer.dispose()
    // Free the WebGL context now (browsers cap live contexts), so Main menu -> Play never leaks one
    renderer.forceContextLoss()
    renderer.domElement.remove()
  }

  return { renderer, scene, camera, dispose }
}
