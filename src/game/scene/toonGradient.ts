// Degradado de luz compartido por todo lo que se pinta "estilo dibujos animados"
// (terreno, coche, monumentos): así todo tiene exactamente los mismos tonos de sombra.
import * as THREE from 'three'

/** Tonos de luz del sombreado cel: sombra, media luz, luz (de oscuro a claro). */
const TONES = [150, 255] // solo 2 tonos: luz y sombra, cortados a cuchillo como en un cómic

let shared: THREE.DataTexture | null = null

/** Textura diminuta (3x1 píxeles) que usa MeshToonMaterial para repartir la luz en tonos. */
export function getToonGradient(): THREE.DataTexture {
  if (!shared) {
    const data = new Uint8Array(TONES.length * 4)
    TONES.forEach((t, i) => data.set([t, t, t, 255], i * 4))
    shared = new THREE.DataTexture(data, TONES.length, 1, THREE.RGBAFormat)
    shared.minFilter = shared.magFilter = THREE.NearestFilter // tonos con borde nítido, sin degradado
    shared.needsUpdate = true
  }
  return shared
}

/** En sombra: el color base se oscurece y enfría (multiplicando) y se le suma un toque violeta. */
const SHADOW_MULTIPLY = 'vec3(0.5, 0.44, 0.72)'
const SHADOW_ADD = 'vec3(0.05, 0.025, 0.13)' // violeta #6B4FA0 de la paleta

/**
 * Sombras "de dibujo animado": en vez de oscurecer hacia marrón, las zonas poco iluminadas
 * se tiñen de azul violáceo. Se mide cuánta luz recibe el píxel respecto a su color base.
 * Modifica el código del shader (se llama dentro de onBeforeCompile).
 * @param strength 1 = sombra completa; menos = más suave (el suelo usa menos para no cargar la vista)
 */
export function addCartoonShadows(shader: { fragmentShader: string }, strength = 1) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <opaque_fragment>',
    `{
      const vec3 luma = vec3(0.299, 0.587, 0.114);
      vec3 lit = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
      float light = dot(lit, luma) / max(dot(diffuseColor.rgb, luma), 1e-3);
      float shade = smoothstep(0.88, 0.74, light) * ${strength.toFixed(2)}; // 0 al sol, 1 en sombra
      vec3 shadowed = diffuseColor.rgb * ${SHADOW_MULTIPLY} + ${SHADOW_ADD};
      outgoingLight = mix(outgoingLight, shadowed + totalEmissiveRadiance, shade);
    }
    #include <opaque_fragment>`,
  )
}

/** Material cartoon de un color (con brillo propio opcional, p. ej. faros o sirena). */
export function toonMaterial(
  color: THREE.ColorRepresentation,
  extra: THREE.MeshToonMaterialParameters = {},
  shadowStrength = 1, // menos de 1: sombra violeta más suave (p. ej. para colores muy oscuros)
) {
  const material = new THREE.MeshToonMaterial({ color, gradientMap: getToonGradient(), ...extra })
  material.onBeforeCompile = (shader) => addCartoonShadows(shader, shadowStrength)
  // three.js reutiliza shaders si el texto de onBeforeCompile coincide; con esta clave cada
  // intensidad de sombra tiene su propio shader (si no, todas usarían el primero que se compile)
  material.customProgramCacheKey = () => `toon-shadow-${shadowStrength}`
  return material
}

/**
 * Marca el material como "suelo" para los contornos de tinta: escribe 0 en el canal alfa
 * de la imagen intermedia (el resto de cosas escriben 1). createInkOutline lo usa para poner
 * menos tinta en el terreno. El alfa no se ve en pantalla.
 */
export function markAsGround(shader: { fragmentShader: string }) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <opaque_fragment>',
    `#include <opaque_fragment>
    gl_FragColor.a = 0.0;`,
  )
}
