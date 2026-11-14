// Escena 3D del mundo: el planeta entero en gris "sin explorar" y el país explorado como maqueta de color.
// Recorres el país corriendo con un detective noir; la cámara lo persigue.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { loadCountryData } from './map/mapData'
import { loadWorldData } from './map/worldData'
import { buildToyMap } from './map/buildToyMap'
import { buildWorldTexture } from './map/buildWorldTexture'
import { smoothHeights } from './map/terrace'
import { lonLatToWorld, worldToLonLat, UNITS_PER_KM } from './map/projection'
import { createScene } from './scene/createScene'
import { createTerrain } from './scene/createTerrain'
import { createWorldTerrain } from './scene/createWorldTerrain'
import { createSky } from './scene/createSky'
import { createLighting } from './scene/createLighting'
import { createClouds } from './scene/createClouds'
import { createInkOutline } from './scene/createInkOutline'
import { createDetective } from './detective/createDetective'
import { createDust } from './effects/createDust'
import { createFootprints } from './effects/createFootprints'
import { createMagnifier } from './effects/createMagnifier'
import { placeTowns } from './towns/placeTowns'
import { createTowns } from './towns/createTowns'
import { placeScenery, loadScenery } from './scenery/placeScenery'
import { createScenery } from './scenery/createScenery'
import { createCarState, stepCar, TUNING, type Ground } from './car/carPhysics'
import { createChaseCamera } from './camera/chaseCamera'
import { createKeyboard } from './input/keyboard'
import { nearestPlace } from './location/nearestPlace'
import { createLandmarks, loadLandmarks } from './landmarks/createLandmarks'
import type { GameCallbacks, GameStatus, HudState } from '../shared/events'
import './GameView.css'

const EXPLORED_COUNTRY = 'ESP'
/** Cada cuánto se actualiza la interfaz (no hace falta hacerlo en cada fotograma). */
const HUD_INTERVAL = 0.1 // s
/** Velocidad del juego → km/h que se muestran (escala inventada, de juego). */
const KMH_PER_UNIT = 2.2

function makeTexture(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy() // nitidez en vista inclinada
  return texture
}

/** Only the 3D canvas. The HUD and status messages live in src/ui, fed through the callbacks. */
export default function GameView({ onStatus, onHud }: GameCallbacks) {
  const container = useRef<HTMLDivElement>(null)
  // Latest callbacks, read from inside the animation loop without restarting the scene
  const callbacks = useRef({ onStatus, onHud })
  useEffect(() => {
    callbacks.current = { onStatus, onHud }
  })
  const setStatus = (status: GameStatus) => callbacks.current.onStatus?.(status)
  const setHud = (hud: HudState) => callbacks.current.onHud?.(hud)

  useEffect(() => {
    const el = container.current!
    let cancelled = false
    let cleanup = () => {}

    Promise.all([loadCountryData(EXPLORED_COUNTRY), loadWorldData(), loadLandmarks(EXPLORED_COUNTRY), loadScenery(EXPLORED_COUNTRY)])
      .then(([explored, world, landmarkList, sceneryRegions]) => {
        if (cancelled) return
        const country = world.countries.find((c) => c.id === EXPLORED_COUNTRY)!
        const { renderer, scene, camera, dispose } = createScene(el)

        // Mundo gris sin explorar
        const worldTexture = makeTexture(buildWorldTexture(world), renderer)
        const zoneBounds = explored.zones.map((z) => z.bounds)
        const worldMesh = createWorldTerrain(world, worldTexture, { country, zones: zoneBounds })
        scene.add(worldMesh)

        // Monumentos: se construyen ya para poder allanar el terreno debajo de ellos
        const landmarks = createLandmarks(landmarkList)
        scene.add(landmarks.group)

        // País explorado: una maqueta por zona (p. ej. Península y Canarias).
        // Alturas suavizadas: las mismas para la textura y la malla, así encajan
        const zones = explored.zones.map((zone) => {
          const heights = smoothHeights(zone.heights, zone.heightWidth, zone.heightHeight)
          landmarks.flattenTerrain(zone, heights) // explanadas bajo los monumentos
          const textureWidth = Math.min(4096, zone.heightWidth * 2)
          const texture = makeTexture(buildToyMap(zone, heights, country, textureWidth), renderer)
          const terrain = createTerrain(zone, heights, country, texture)
          scene.add(terrain.group)
          return { terrain, texture }
        })
        const main = zones[0].terrain // la zona principal

        // Ambiente: cielo con sol, luces con sombras y nubes moviéndose sobre España
        const sky = createSky()
        const lighting = createLighting()
        scene.add(sky.group, lighting.group)
        worldMesh.receiveShadow = true
        const mb = zoneBounds[0]
        const nw = lonLatToWorld(mb.west - 3, mb.north + 3)
        const se = lonLatToWorld(mb.east + 3, mb.south - 3)
        const clouds = createClouds({ minX: nw.x, maxX: se.x, minZ: nw.z, maxZ: se.z })
        scene.add(clouds.mesh)

        landmarks.place(main.heightAt) // sobre sus explanadas (el detective no los puede atravesar)

        // Pueblos y ciudades: casitas en las poblaciones reales. Cada punto se consulta en la
        // zona (Península o Canarias) que lo contiene
        const terrainAt = (x: number, z: number) => {
          const { lon, lat } = worldToLonLat(x, z)
          const i = explored.zones.findIndex((zn) => lon >= zn.bounds.west && lon <= zn.bounds.east && lat >= zn.bounds.south && lat <= zn.bounds.north)
          return i >= 0 ? zones[i].terrain : null
        }
        const houses = placeTowns(explored.places, {
          heightAt: (x, z) => terrainAt(x, z)?.heightAt(x, z) ?? 0,
          isLand: (x, z) => terrainAt(x, z)?.isExploredLand(x, z) ?? false,
          landmarkDistance: landmarks.distance,
        })
        const towns = createTowns(houses)
        scene.add(towns.group)

        // Paisaje por regiones: olivares, viñedos, bosques, dehesa, palmeras y molinos (scenery.json)
        const sceneryItems = placeScenery(sceneryRegions, {
          heightAt: (x, z) => terrainAt(x, z)?.heightAt(x, z) ?? 0,
          metersAt: (x, z) => terrainAt(x, z)?.metersAt(x, z) ?? 0,
          isLand: (x, z) => terrainAt(x, z)?.isExploredLand(x, z) ?? false,
          nearHouse: towns.blocks,
          landmarkDistance: landmarks.distance,
        })
        const scenery = createScenery(sceneryItems)
        scene.add(scenery.group)

        // El detective: empieza en Madrid, mirando hacia la Puerta de Alcalá
        // El "suelo" que pisa el detective: el terreno o, si está sobre una casa, su tejado.
        // Así escala las casas igual que los escalones de las montañas (no chocan)
        const surfaceAt = (x: number, z: number) => Math.max(main.heightAt(x, z), towns.surfaceAt(x, z))
        const ground: Ground = {
          heightAt: surfaceAt,
          isDrivable: (x, z) => main.isExploredLand(x, z) && !landmarks.blocks(x, z) && !scenery.blocks(x, z),
        }
        const madrid = lonLatToWorld(-3.7038, 40.4168)
        const puerta = landmarks.positionOf('puerta-de-alcala') ?? madrid
        const start = { x: puerta.x - 30, z: puerta.z + 105 } // lo bastante lejos para verla entera
        const carState = createCarState(start.x, start.z, Math.atan2(-(puerta.x - start.x), -(puerta.z - start.z)), ground)
        const detective = createDetective()
        scene.add(detective.root)
        // Efectos al correr: nubecitas de polvo en cada pisada y huellas en el suelo
        const dust = createDust()
        const footprints = createFootprints()
        const magnifier = createMagnifier() // círculo de lupa al pararse a investigar
        scene.add(dust.mesh, footprints.group, magnifier.group)
        const keyboard = createKeyboard()
        const chase = createChaseCamera(camera, renderer.domElement)
        // Solo en desarrollo: acceso desde la consola/Playwright para depurar
        if (import.meta.env.DEV) Object.assign(window, { __game: { carState, camera, chase, ground, detective, renderer, scene, towns, houses, scenery, sceneryItems } })

        const fog = scene.fog as THREE.Fog
        const ink = createInkOutline(renderer) // contornos negros de cómic
        let hudClock = HUD_INTERVAL
        // Pasa a la interfaz dónde está el detective y a qué velocidad va
        const updateHud = (turbo: boolean) => {
          const { lat, lon } = worldToLonLat(carState.x, carState.z)
          const near = nearestPlace(explored.places, lat, lon)
          const landmark = landmarks.nearest(carState.x, carState.z)
          const speed = Math.abs(carState.speed)
          setHud({
            location: {
              lat, lon,
              place: near?.place.name ?? '',
              region: near?.place.region ?? '',
              km: near?.km ?? 0,
              landmark: landmark ? { name: landmark.name, city: landmark.city, description: landmark.description } : null,
            },
            kmh: Math.round(speed * KMH_PER_UNIT),
            turbo,
            rush: Math.min(1, Math.max(0, (speed - TUNING.maxSpeed) / (TUNING.turboSpeed - TUNING.maxSpeed))),
          })
        }
        let lastTime: number | null = null
        renderer.setAnimationLoop((time) => {
          // Segundos desde el fotograma anterior, con la marca de tiempo que da el navegador.
          // Acotado entre 0 y 0,1 s: si el juego se atasca un momento, no da un salto enorme
          const dt = lastTime === null ? 0 : Math.min(Math.max((time - lastTime) / 1000, 0), 0.1)
          lastTime = time
          const input = keyboard.read()
          stepCar(carState, input, ground, dt)
          detective.update(carState, dt)
          dust.update(carState, surfaceAt, detective.stridePhase, dt)
          footprints.update(carState, surfaceAt, detective.stridePhase)
          magnifier.update(detective.inspect, detective.lensPosition(), carState.heading, surfaceAt, dt)
          chase.update(carState, surfaceAt, dt, detective.inspect, towns.topAt)
          clouds.update(dt)
          scenery.update(dt, carState.x, carState.z, camera.position, chase.distance)
          // La niebla y el plano cercano de la cámara se adaptan a la distancia:
          // de cerca hay niebla para dar profundidad; de lejos se aparta para ver todo.
          // Subir "near" de lejos da más precisión de profundidad y evita parpadeos.
          const d = chase.distance
          fog.near = 60 * UNITS_PER_KM + d * 1.5
          fog.far = 300 * UNITS_PER_KM + d * 6
          camera.near = Math.max(0.05, d / 300)
          camera.far = d * 20 + 1000 * UNITS_PER_KM
          camera.updateProjectionMatrix()
          sky.update(camera)
          lighting.update(detective.root.position, Math.max(40, Math.min(d * 1.6, 3000 * UNITS_PER_KM)))
          ink.render(scene, camera, fog.near, fog.near + (fog.far - fog.near) * 0.5)
          hudClock += dt
          if (hudClock >= HUD_INTERVAL) {
            hudClock = 0
            updateHud(input.turbo && input.throttle > 0)
          }
        })
        setStatus('ready')

        cleanup = () => {
          keyboard.dispose()
          chase.dispose()
          detective.dispose()
          dust.dispose()
          footprints.dispose()
          magnifier.dispose()
          landmarks.dispose()
          towns.dispose()
          scenery.dispose()
          worldMesh.geometry.dispose()
          ;(worldMesh.material as THREE.Material).dispose()
          worldTexture.dispose()
          for (const { terrain, texture } of zones) {
            terrain.dispose()
            texture.dispose()
          }
          sky.dispose()
          lighting.dispose()
          clouds.dispose()
          ink.dispose()
          dispose()
        }
      })
      .catch((err) => {
        console.error(err)
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      cleanup()
    }
  }, [])

  return (
    <div className="game-view">
      <div ref={container} className="game-view__canvas" />
    </div>
  )
}
