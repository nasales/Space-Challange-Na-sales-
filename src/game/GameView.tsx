// Escena 3D del mundo: el planeta entero en gris "sin explorar" y el país explorado como maqueta de color.
// Recorres el país corriendo con un detective noir; la cámara lo persigue.
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { loadCountryData } from './map/mapData'
import { loadWorldData } from './map/worldData'
import { buildToyMap } from './map/buildToyMap'
import { buildWorldTexture } from './map/buildWorldTexture'
import { addRelief, smoothHeights } from './map/terrace'
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
import { placeTowns } from './towns/placeTowns'
import { createTowns } from './towns/createTowns'
import { placeScenery, loadScenery } from './scenery/placeScenery'
import { createScenery } from './scenery/createScenery'
import { createCarState, stepCar, TUNING, type Ground } from './car/carPhysics'
import { createChaseCamera } from './camera/chaseCamera'
import { createKeyboard } from './input/keyboard'
import { nearestPlace } from './location/nearestPlace'
import { createLandmarks, loadLandmarks } from './landmarks/createLandmarks'
import { bendRiversAround, prepareRivers } from './map/rivers'
import { createRivers } from './scene/createRivers'
import { loadRoads, roadsInBounds } from './roads/roadData'
import { createRoads } from './roads/createRoads'
import { createCaseMarkers } from './cases/createCaseMarkers'
import { CASES } from '../levels/data'
import type { GameStatus, GameViewProps, HudState } from '../shared/events'
import './GameView.css'

const EXPLORED_COUNTRY = 'ESP'
/** Cada cuánto se actualiza la interfaz (no hace falta hacerlo en cada fotograma). */
const HUD_INTERVAL = 0.1 // s
/** Game speed → km/h shown in the HUD (made-up game scale; full turbo still reads ~308 km/h). */
const KMH_PER_UNIT = (2.2 * 140) / TUNING.turboSpeed
/** Thrown by the loading steps when the view was closed while the map was still being built. */
const CANCELLED = Symbol('cancelled')

function makeTexture(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy() // nitidez en vista inclinada
  return texture
}

/** Only the 3D canvas. The HUD and status messages live in src/ui, fed through the callbacks. */
export default function GameView({ onStatus, onHud, onLensFocus, onProgress, focusLens = false, outfit, paused = false, completedCases }: GameViewProps) {
  const container = useRef<HTMLDivElement>(null)
  // Latest callbacks (and pause flag), read from inside the animation loop without restarting the scene
  const callbacks = useRef({ onStatus, onHud, onLensFocus, onProgress, focusLens, paused, completedCases })
  useEffect(() => {
    callbacks.current = { onStatus, onHud, onLensFocus, onProgress, focusLens, paused, completedCases }
  })
  const setStatus = (status: GameStatus) => callbacks.current.onStatus?.(status)
  const setHud = (hud: HudState) => callbacks.current.onHud?.(hud)
  // Wardrobe outfit: used when the detective is built, then applied live with setOutfit (no map rebuild)
  const outfitRef = useRef(outfit)
  const detectiveRef = useRef<ReturnType<typeof createDetective> | null>(null)
  useEffect(() => {
    outfitRef.current = outfit
    if (outfit) detectiveRef.current?.setOutfit(outfit)
  }, [outfit])

  useEffect(() => {
    const el = container.current!
    let cancelled = false
    let cleanup = () => {}
    // Loading bar: report progress (0..1), then give the browser a frame to paint it before the
    // next heavy (synchronous) build step. Stops the build if the view was closed meanwhile.
    let disposePartial = () => {}
    const progress = async (p: number) => {
      callbacks.current.onProgress?.(p)
      await new Promise<void>((resolve) => {
        const fallback = setTimeout(resolve, 60) // hidden tab: no animation frames
        requestAnimationFrame(() => {
          clearTimeout(fallback)
          setTimeout(resolve, 0)
        })
      })
      if (cancelled) throw CANCELLED
    }
    // Data files: the first 35 % of the bar, one slice per file as it arrives
    const FILES = 5
    let filesDone = 0
    const fetched = <T,>(promise: Promise<T>) =>
      promise.then((value) => {
        filesDone++
        if (!cancelled) callbacks.current.onProgress?.((0.35 * filesDone) / FILES)
        return value
      })
    callbacks.current.onProgress?.(0)

    Promise.all([fetched(loadCountryData(EXPLORED_COUNTRY)), fetched(loadWorldData()), fetched(loadLandmarks(EXPLORED_COUNTRY)), fetched(loadScenery(EXPLORED_COUNTRY)), fetched(loadRoads(EXPLORED_COUNTRY))])
      .then(async ([explored, world, landmarkList, sceneryRegions, roadList]) => {
        if (cancelled) return
        await progress(0.36)
        const country = world.countries.find((c) => c.id === EXPLORED_COUNTRY)!
        const { renderer, scene, camera, dispose } = createScene(el)
        disposePartial = dispose

        // Mundo gris sin explorar
        const worldTexture = makeTexture(buildWorldTexture(world), renderer)
        const zoneBounds = explored.zones.map((z) => z.bounds)
        const worldMesh = createWorldTerrain(world, worldTexture, { country, zones: zoneBounds })
        scene.add(worldMesh)

        // Monumentos: se construyen ya para poder allanar el terreno debajo de ellos
        const landmarks = createLandmarks(landmarkList)
        scene.add(landmarks.group)
        await progress(0.4)

        // País explorado: una maqueta por zona (p. ej. Península y Canarias).
        // Alturas suavizadas: las mismas para la textura y la malla, así encajan
        // Rivers bend around the monuments so no plaza or model stands in the water
        const clearings = landmarks.riverClearings(10)
        // Roads bend around the monuments too (circles in world units)
        const roadClearings = landmarks.riverClearings(8).map((c) => ({ ...lonLatToWorld(c.lon, c.lat), r: c.radiusKm * UNITS_PER_KM }))
        const zones: {
          terrain: ReturnType<typeof createTerrain>
          texture: THREE.CanvasTexture
          water: ReturnType<typeof createRivers>
          roads: ReturnType<typeof createRoads>
        }[] = []
        for (const [i, z] of explored.zones.entries()) {
          const zoneProgress = (part: number) => progress(0.4 + (0.35 * (i + part)) / explored.zones.length)
          // Rivers: gaps closed, ends labelled (spring / mouth / confluence), then bent around monuments
          const zone = z.rivers ? { ...z, rivers: bendRiversAround(prepareRivers(z.rivers, z), clearings) } : z
          // Smoothed heights plus extra relief (slopes everywhere): same grid for texture and mesh
          const heights = addRelief(smoothHeights(zone.heights, zone.heightWidth, zone.heightHeight), zone.heightWidth, zone.heightHeight)
          landmarks.flattenTerrain(zone, heights) // explanadas bajo los monumentos
          const textureWidth = Math.min(4096, zone.heightWidth * 2)
          const texture = makeTexture(buildToyMap(zone, heights, country, textureWidth), renderer)
          const terrain = createTerrain(zone, heights, country, texture, clearings)
          scene.add(terrain.group)
          const water = createRivers(zone.rivers, terrain) // animated water inside the carved channels
          scene.add(water.mesh)
          await zoneProgress(0.6)
          // Main roads: bridges over the rivers above, around the monuments, only on explored land
          const roads = createRoads(roadsInBounds(roadList, zone.bounds), {
            heightAt: terrain.heightAt,
            isExploredLand: terrain.isExploredLand,
            rivers: zone.rivers,
            clearings: roadClearings,
            landmarkDistance: landmarks.distance,
          })
          scene.add(roads.group)
          zones.push({ terrain, texture, water, roads })
          await zoneProgress(1)
        }
        const roadSurfaceAt = (x: number, z: number) => Math.max(...zones.map((zn) => zn.roads.surfaceAt(x, z)))
        const nearRoad = (x: number, z: number, m: number) => zones.some((zn) => zn.roads.nearRoad(x, z, m))
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
        await progress(0.78)

        landmarks.place(main.heightAt) // on their flattened plazas (the detective can climb them, like houses)
        // Featured cases: a floating "!" over each one (prototype, no interaction yet)
        const caseMarkers = createCaseMarkers(CASES)
        caseMarkers.place(main.heightAt, landmarks.surfaceAt) // rings also lie on monument plazas
        scene.add(caseMarkers.group)

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
          nearRiver: (x, z, m) => terrainAt(x, z)?.nearRiver(x, z, m) ?? false,
          nearRoad,
        })
        const towns = createTowns(houses)
        scene.add(towns.group)
        await progress(0.85)

        // Paisaje por regiones: olivares, viñedos, bosques, dehesa, palmeras y molinos (scenery.json)
        const sceneryItems = placeScenery(sceneryRegions, {
          heightAt: (x, z) => terrainAt(x, z)?.heightAt(x, z) ?? 0,
          metersAt: (x, z) => terrainAt(x, z)?.metersAt(x, z) ?? 0,
          isLand: (x, z) => terrainAt(x, z)?.isExploredLand(x, z) ?? false,
          nearHouse: towns.blocks,
          landmarkDistance: landmarks.distance,
          nearRiver: (x, z, m) => terrainAt(x, z)?.nearRiver(x, z, m) ?? false,
          nearRoad,
        })
        const scenery = createScenery(sceneryItems)
        scene.add(scenery.group)
        await progress(0.95)

        // El detective: empieza en Madrid, mirando hacia la Puerta de Alcalá
        // Ground under the detective: the terrain or, over a house or a monument, its roof.
        // So he climbs houses and monuments like mountain steps (no collisions)
        const surfaceAt = (x: number, z: number) => Math.max(main.heightAt(x, z), towns.surfaceAt(x, z), landmarks.surfaceAt(x, z), roadSurfaceAt(x, z))
        // For the camera: ground without monuments (it treats monuments as walls, see chaseCamera)
        const groundNoLandmarks = (x: number, z: number) => Math.max(main.heightAt(x, z), towns.surfaceAt(x, z), roadSurfaceAt(x, z))
        const ground: Ground = {
          heightAt: surfaceAt,
          isDrivable: (x, z) => main.isExploredLand(x, z) && !scenery.blocks(x, z),
        }
        const madrid = lonLatToWorld(-3.7038, 40.4168)
        const puerta = landmarks.positionOf('puerta-de-alcala') ?? madrid
        const start = { x: puerta.x - 30, z: puerta.z + 105 } // lo bastante lejos para verla entera
        const carState = createCarState(start.x, start.z, Math.atan2(-(puerta.x - start.x), -(puerta.z - start.z)), ground)
        const detective = createDetective(outfitRef.current)
        detectiveRef.current = detective
        scene.add(detective.root)
        // Efectos al correr: nubecitas de polvo en cada pisada y huellas en el suelo
        const dust = createDust()
        const footprints = createFootprints()
        scene.add(dust.mesh, footprints.group)
        const keyboard = createKeyboard()
        const chase = createChaseCamera(camera, renderer.domElement)
        chase.startIntro() // swoop from far above Spain down to the detective; control starts when it lands
        // Solo en desarrollo: acceso desde la consola/Playwright para depurar
        if (import.meta.env.DEV) Object.assign(window, { __game: { carState, camera, chase, ground, detective, renderer, scene, towns, houses, scenery, sceneryItems, landmarks, caseMarkers, main } })

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
            stopped: detective.inspect > 0.5, // magnifier out: the player may open the variable picker
            caseZone: caseMarkers.zoneAt(carState.x, carState.z),
          })
        }
        // Lens flight state: 'in' reported once per flight; a flight that has started must end with 'out'
        let lensInReported = false
        let lensFlying = false
        let lastTime: number | null = null
        let shownCompleted: readonly string[] | undefined
        renderer.setAnimationLoop((time) => {
          // Segundos desde el fotograma anterior, con la marca de tiempo que da el navegador.
          // Acotado entre 0 y 0,1 s: si el juego se atasca un momento, no da un salto enorme
          const dt = lastTime === null ? 0 : Math.min(Math.max((time - lastTime) / 1000, 0), 0.1)
          lastTime = time
          // Lens focus: the camera flies into the hand lens while the app asks for it. The keyboard
          // stays ignored from the request until the flight back out has been reported
          const wantLens = !!callbacks.current.focusLens
          if (wantLens) lensFlying = true
          else lensInReported = false
          // Intro swoop: no control (and no HUD) until the camera lands on the chase view.
          // The pause panel or an open case level also make the game ignore the keyboard
          const introBefore = chase.introActive
          const input = lensFlying || introBefore || callbacks.current.paused ? { throttle: 0, steer: 0, turbo: false } : keyboard.read()
          stepCar(carState, input, ground, dt)
          detective.setFocus(chase.stepFocus(wantLens, dt))
          detective.update(carState, dt)
          dust.update(carState, surfaceAt, detective.stridePhase, dt)
          footprints.update(carState, surfaceAt, detective.stridePhase)
          const lens = chase.focus > 0 ? { center: detective.lensPosition(), normal: detective.lensNormal(), radius: detective.lensRadius() } : null
          chase.update(carState, groundNoLandmarks, dt, detective.inspect, towns.topAt, landmarks.surfaceAt, lens)
          if (introBefore && !chase.introActive) {
            setStatus('ready')
            hudClock = HUD_INTERVAL // show the HUD on the landing frame
          }
          if (wantLens && chase.focus === 1 && !lensInReported) {
            lensInReported = true
            callbacks.current.onLensFocus?.('in')
          } else if (!wantLens && lensFlying && chase.focus === 0) {
            lensFlying = false
            callbacks.current.onLensFocus?.('out')
          }
          clouds.update(dt)
          // Solved cases in green (only when the app sends a new list)
          if (callbacks.current.completedCases !== shownCompleted) {
            shownCompleted = callbacks.current.completedCases
            for (const c of CASES) caseMarkers.setCompleted(c.id, !!shownCompleted?.includes(c.id))
          }
          caseMarkers.update(dt)
          for (const z of zones) {
            z.water.update(dt)
            z.roads.update(dt)
          }
          scenery.update(dt, carState.x, carState.z, camera.position, chase.distance)
          // La niebla y el plano cercano de la cámara se adaptan a la distancia:
          // de cerca hay niebla para dar profundidad; de lejos se aparta para ver todo.
          // Subir "near" de lejos da más precisión de profundidad y evita parpadeos.
          const d = chase.distance
          // Close-range terms in world units (not km): objects keep their size on the bigger map,
          // so the near fog must not move away with it (tree pop-in, ink reaching too far)
          fog.near = 240 + d * 1.5
          fog.far = 1200 + d * 6
          camera.near = Math.max(0.05, d / 300)
          camera.far = d * 20 + 1000 * UNITS_PER_KM
          camera.updateProjectionMatrix()
          sky.update(camera)
          lighting.update(detective.root.position, Math.max(40, Math.min(d * 1.6, 3000 * UNITS_PER_KM)))
          ink.render(scene, camera, fog.near, fog.near + (fog.far - fog.near) * 0.5)
          hudClock += dt
          if (hudClock >= HUD_INTERVAL && !chase.introActive) {
            hudClock = 0
            updateHud(input.turbo && input.throttle > 0)
          }
        })
        callbacks.current.onProgress?.(1)
        // 'intro' while the camera swoops in ('ready' when it lands); straight to 'ready' if there is no intro
        setStatus(chase.introActive ? 'intro' : 'ready')

        cleanup = () => {
          keyboard.dispose()
          chase.dispose()
          detective.dispose()
          detectiveRef.current = null
          dust.dispose()
          footprints.dispose()
          landmarks.dispose()
          towns.dispose()
          scenery.dispose()
          worldMesh.geometry.dispose()
          ;(worldMesh.material as THREE.Material).dispose()
          worldTexture.dispose()
          for (const { terrain, texture, water, roads } of zones) {
            terrain.dispose()
            texture.dispose()
            water.dispose()
            roads.dispose()
          }
          sky.dispose()
          lighting.dispose()
          clouds.dispose()
          caseMarkers.dispose()
          ink.dispose()
          dispose()
          if (import.meta.env.DEV) delete (window as { __game?: unknown }).__game
        }
      })
      .catch((err) => {
        if (err === CANCELLED) {
          disposePartial() // closed mid-build: drop the renderer and its canvas
          return
        }
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
