// Dibuja el paisaje por regiones: miles de árboles y viñas con InstancedMesh (copias de un mismo
// modelo), agrupados por trozos del mapa para que three.js descarte los que no salen en cámara.
// Los molinos son pocos y van sueltos, porque sus aspas giran. Los árboles NO bloquean al
// detective (correr por un bosque no debe frustrar); los molinos sí, como las casas.
// Los árboles que se meten entre la cámara y el detective "se agachan" (se aplastan como un
// arbusto) para no taparlo: se hace en el shader, sin tocar las copias una a una.
import * as THREE from 'three'
import { toonMaterial } from '../scene/toonGradient'
import { SCENERY_MODELS, WINDMILL_HUB, windmillSails } from './sceneryModels'
import { KIND_RADIUS, type SceneryItem, type SceneryKind } from './placeScenery'

/** Tamaño de los trozos del mapa (unidades del mundo). */
const CHUNK = 300
/** Vueltas por segundo (en radianes) de las aspas. */
const SAIL_SPEED = 0.9
/** Más lejos de esto (unidades) las aspas no se animan: no se notaría. */
const ANIMATE_DISTANCE = 1500
/** Distancia (unidades) a la línea cámara-detective por debajo de la cual un árbol se agacha. */
const DUCK_RADIUS = 6
/** Ancho de la transición entre agachado y de pie. */
const DUCK_FADE = 6
/** Solo se dibujan los trozos de árboles a menos de esta distancia (unidades) del detective. */
const VIEW_DISTANCE = 1100
/** Con la cámara más lejos que esto (vista aérea) los árboles no se dibujan: serían puntitos. */
const HIDE_ABOVE = 700

/**
 * Material de los árboles: el toon de siempre + "agacharse". Cada copia mira dónde está su base
 * (instanceMatrix) y, si queda cerca del segmento detective → cámara, se aplasta hacia el suelo.
 */
function duckingMaterial() {
  const material = toonMaterial(0xffffff, { vertexColors: true })
  const uniforms = {
    uDuckA: { value: new THREE.Vector2() }, // detective
    uDuckB: { value: new THREE.Vector2() }, // cámara
  }
  const toon = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    toon.call(material, shader, renderer)
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uDuckA;\nuniform vec2 uDuckB;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 duckOrigin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
        #else
          vec2 duckOrigin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
        #endif
        vec2 duckAB = uDuckB - uDuckA;
        float duckT = clamp(dot(duckOrigin - uDuckA, duckAB) / max(dot(duckAB, duckAB), 1e-3), 0.0, 1.0);
        float duckD = distance(duckOrigin, uDuckA + duckAB * duckT);
        float duck = 1.0 - smoothstep(${DUCK_RADIUS.toFixed(1)}, ${(DUCK_RADIUS + DUCK_FADE).toFixed(1)}, duckD);
        transformed.y *= mix(1.0, 0.22, duck);
        transformed.xz *= mix(1.0, 0.7, duck);`,
      )
  }
  material.customProgramCacheKey = () => 'scenery-duck'
  return { material, uniforms }
}

export function createScenery(items: SceneryItem[]) {
  const group = new THREE.Group()
  const { material, uniforms } = duckingMaterial() // árboles y viñas
  const millMaterial = toonMaterial(0xffffff, { vertexColors: true }) // los molinos no se agachan
  const geometries = new Map<SceneryKind, THREE.BufferGeometry>()
  const geometryFor = (kind: SceneryKind) => {
    if (!geometries.has(kind)) geometries.set(kind, SCENERY_MODELS[kind]())
    return geometries.get(kind)!
  }

  // ---- Árboles y viñas: una InstancedMesh por trozo y tipo ----
  const buckets = new Map<string, SceneryItem[]>()
  const windmills: SceneryItem[] = []
  for (const it of items) {
    if (it.kind === 'windmill') {
      windmills.push(it)
      continue
    }
    const key = `${Math.floor(it.x / CHUNK)},${Math.floor(it.z / CHUNK)},${it.kind}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(it)
  }
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const scl = new THREE.Vector3()
  const chunks: THREE.InstancedMesh[] = []
  for (const list of buckets.values()) {
    const mesh = new THREE.InstancedMesh(geometryFor(list[0].kind), material, list.length)
    list.forEach((it, i) => {
      pos.set(it.x, it.y, it.z)
      q.setFromAxisAngle(up, it.rot)
      scl.setScalar(it.scale)
      m.compose(pos, q, scl)
      mesh.setMatrixAt(i, m)
    })
    mesh.computeBoundingSphere()
    mesh.castShadow = mesh.receiveShadow = true
    group.add(mesh)
    chunks.push(mesh)
  }

  // ---- Molinos: cuerpo + aspas que giran ----
  const sailsGeo = windmillSails()
  const sails: THREE.Mesh[] = []
  for (const w of windmills) {
    const holder = new THREE.Group()
    holder.position.set(w.x, w.y, w.z)
    holder.rotation.y = w.rot
    holder.scale.setScalar(w.scale)
    const body = new THREE.Mesh(geometryFor('windmill'), millMaterial)
    const s = new THREE.Mesh(sailsGeo, millMaterial)
    s.position.set(0, WINDMILL_HUB.y, WINDMILL_HUB.z)
    s.rotation.z = w.rot * 3 // cada uno empieza en una posición distinta
    for (const part of [body, s]) {
      part.castShadow = part.receiveShadow = true
      holder.add(part)
    }
    group.add(holder)
    sails.push(s)
  }

  /**
   * Gira las aspas de los molinos cercanos y dice a los árboles dónde están el detective (x, z)
   * y la cámara, para que se agachen los que se meten en medio. Oculta los trozos lejanos.
   * @param cameraDistance distancia de la cámara al detective
   */
  const update = (dt: number, x: number, z: number, camera: THREE.Vector3, cameraDistance: number) => {
    const aerial = cameraDistance > HIDE_ABOVE
    for (const mesh of chunks) {
      const c = mesh.boundingSphere!.center
      mesh.visible = !aerial && (c.x - x) ** 2 + (c.z - z) ** 2 < (VIEW_DISTANCE + mesh.boundingSphere!.radius) ** 2
    }
    uniforms.uDuckA.value.set(x, z)
    uniforms.uDuckB.value.set(camera.x, camera.z)
    sails.forEach((s, i) => {
      const w = windmills[i]
      if ((w.x - x) ** 2 + (w.z - z) ** 2 < ANIMATE_DISTANCE ** 2) s.rotation.z += SAIL_SPEED * dt
    })
  }

  /** ¿Choca el punto (x, z) con un molino? */
  const blocks = (x: number, z: number) =>
    windmills.some((w) => {
      const r = KIND_RADIUS.windmill * w.scale * 0.8
      return (w.x - x) ** 2 + (w.z - z) ** 2 < r * r
    })

  return {
    group,
    update,
    blocks,
    count: items.length,
    dispose: () => {
      geometries.forEach((g) => g.dispose())
      sailsGeo.dispose()
      material.dispose()
      millMaterial.dispose()
    },
  }
}
