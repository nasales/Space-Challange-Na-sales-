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

/** Wind animation frame rate: comic "on twos" stepping, like the river water. */
const ANIM_FPS = 12

/**
 * Material de los árboles: el toon de siempre + "agacharse" + the comic Spider-Verse look.
 * - Ducking: each copy checks where its base is (instanceMatrix) and, if it is close to the
 *   detective → camera segment, squashes down towards the ground.
 * - Wind on twos: the crown sways with the per-vertex `aSway` weight (0 on the trunk), with a
 *   per-tree phase, in time steps of 1/12 s.
 * - Comic shading on top of the 2-tone cel + violet shadow: a crisp light band on the sunlit top
 *   of each clump, Ben-Day halftone dots that grow with the shade, sparse ink hatching in the
 *   deepest shadow and a faint cyan / magenta misregistration rim on the silhouette.
 */
function duckingMaterial(
  shared = {
    uDuckA: { value: new THREE.Vector2() }, // detective
    uDuckB: { value: new THREE.Vector2() }, // cámara
    uTime: { value: 0 }, // stepped on twos
  },
  duckOn = true,
) {
  const material = toonMaterial(0xffffff, { vertexColors: true })
  // uDuckOn = 0: flat things the detective drives over (wheat fields) never shrink
  const uniforms = { ...shared, uDuckOn: { value: duckOn ? 1 : 0 } }
  const toon = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    toon.call(material, shader, renderer)
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      /* glsl */ `{
        // How much light this pixel gets (same measure as addCartoonShadows): 0 sun, 1 shade
        const vec3 lumaW = vec3(0.299, 0.587, 0.114);
        vec3 litC = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
        float lightC = dot(litC, lumaW) / max(dot(diffuseColor.rgb, lumaW), 1e-3);
        float shadeC = smoothstep(0.88, 0.74, lightC);
        float ndl = 0.0;
        #if NUM_DIR_LIGHTS > 0
          ndl = dot(normal, directionalLights[0].direction);
        #endif
        float dist = length(vViewPosition);
        float near = 1.0 - smoothstep(260.0, 650.0, dist); // comic detail fades out far away

        // 1) Light band on the sunlit top of each clump (crisp, anti-aliased edge)
        float bw = max(fwidth(ndl), 1e-3);
        float lightBand = smoothstep(0.78 - bw, 0.78 + bw, ndl) * (1.0 - shadeC);
        outgoingLight = mix(outgoingLight, outgoingLight * 1.1 + vec3(0.07, 0.06, -0.01), lightBand * 0.85);

        // 2) Ben-Day halftone in the shade: screen-space dots on a 45 degree grid, bigger with more shade
        vec2 hp = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / 5.0;
        float hd = length(fract(hp) - 0.5);
        float dotR = 0.44 * shadeC * near;
        float hw = max(fwidth(hd), 1e-3);
        float dots = 1.0 - smoothstep(dotR - hw, dotR + hw, hd);
        outgoingLight = mix(outgoingLight, outgoingLight * 0.62, dots);

        // 3) Sparse ink hatching where the shadow is deepest (facing away from the sun)
        float core = shadeC * smoothstep(-0.15, -0.55, ndl) * near;
        float hl = abs(fract((gl_FragCoord.x - gl_FragCoord.y) / 6.0) - 0.5);
        float hatch = 1.0 - smoothstep(0.06, 0.06 + max(fwidth(hl) * 1.5, 0.02), hl);
        outgoingLight = mix(outgoingLight, vec3(0.102, 0.078, 0.137), hatch * core * 0.45);

        // 4) Offset-print misregistration: a faint cyan rim on one side, magenta on the other
        float fres = 1.0 - abs(dot(normal, normalize(-vViewPosition)));
        float rim = smoothstep(0.62, 0.86, fres) * near;
        vec3 ink2 = normal.x < 0.0 ? vec3(0.2, 0.78, 1.0) : vec3(1.0, 0.32, 0.62);
        outgoingLight = mix(outgoingLight, ink2, rim * 0.28);
      }
      #include <opaque_fragment>`,
    )
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec2 uDuckA;\nuniform vec2 uDuckB;\nuniform float uTime;\nuniform float uDuckOn;\nattribute float aSway;',
      )
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
        float duck = 1.0 - smoothstep(${DUCK_RADIUS.toFixed(1)}, ${(DUCK_RADIUS + DUCK_FADE).toFixed(1)}, duckD) * uDuckOn;
        transformed.y *= mix(1.0, 0.22, duck);
        transformed.xz *= mix(1.0, 0.7, duck);
        // Wind: a slow sway plus a quicker flutter, each tree with its own phase (stepped time)
        float swayPh = dot(duckOrigin, vec2(0.071, 0.113));
        vec2 gust = vec2(sin(uTime * 1.3 + swayPh), 0.5 * cos(uTime * 0.9 + swayPh * 1.7));
        gust += 0.25 * vec2(sin(uTime * 4.1 + swayPh * 3.0), cos(uTime * 3.3 + swayPh * 2.0));
        transformed.xz += gust * aSway * (1.0 - duck);`,
      )
  }
  material.customProgramCacheKey = () => 'scenery-duck-comic'
  return { material, uniforms: shared }
}

export function createScenery(items: SceneryItem[]) {
  const group = new THREE.Group()
  const { material, uniforms } = duckingMaterial() // árboles y viñas
  const flatMaterial = duckingMaterial(uniforms, false).material // wheat fields: same wind, no ducking
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
    const mesh = new THREE.InstancedMesh(geometryFor(list[0].kind), list[0].kind === 'wheat' ? flatMaterial : material, list.length)
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
  let clock = 0
  const update = (dt: number, x: number, z: number, camera: THREE.Vector3, cameraDistance: number) => {
    clock += dt
    uniforms.uTime.value = Math.floor(clock * ANIM_FPS) / ANIM_FPS
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
      flatMaterial.dispose()
      millMaterial.dispose()
    },
  }
}
