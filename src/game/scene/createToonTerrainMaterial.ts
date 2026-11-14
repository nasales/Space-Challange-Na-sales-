// Material "de dibujos animados" para el relieve:
// - Sombreado cel (toon): la luz se reparte en pocos tonos planos, como en un cartoon.
// - Las paredes empinadas (acantilados entre pisos) se pintan de color tierra con vetas
//   horizontales, en vez de estirar encima la textura del suelo.
import * as THREE from 'three'
import { addCartoonShadows, getToonGradient, markAsGround } from './toonGradient'

/** Color de las paredes de roca/tierra. */
const CLIFF_COLOR = new THREE.Color('#f2a066')
/** Separación (unidades del mundo) entre las vetas horizontales de los acantilados. */
const STRATA_SPACING = 6
/** Contraste de las vetas (1 = sin vetas). Suave, para que el suelo no cargue la vista. */
const STRATA_SHADE = 0.94
/** Intensidad de la sombra en el suelo (los objetos usan 1). */
const GROUND_SHADOW = 0.5

export function createToonTerrainMaterial(map: THREE.Texture) {
  const material = new THREE.MeshToonMaterial({ map, gradientMap: getToonGradient() })

  material.onBeforeCompile = (shader) => {
    addCartoonShadows(shader, GROUND_SHADOW) // sombras violetas, pero más suaves que en los objetos
    markAsGround(shader) // para que los contornos pongan menos tinta en el suelo
    shader.uniforms.cliffColor = { value: CLIFF_COLOR }
    shader.uniforms.strataSpacing = { value: STRATA_SPACING }
    // Vértices: pasamos al fragmento la normal y la altura en coordenadas del mundo
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldNormal;\nvarying float vWorldY;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vWorldY = (modelMatrix * vec4(position, 1.0)).y;`,
      )
    // Fragmento: cuanto más vertical es la cara, más color de acantilado (con vetas)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldNormal;
        varying float vWorldY;
        uniform vec3 cliffColor;
        uniform float strataSpacing;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float steep = smoothstep(0.82, 0.55, normalize(vWorldNormal).y);
        float band = step(0.5, fract(vWorldY / strataSpacing));
        vec3 cliff = cliffColor * mix(${STRATA_SHADE.toFixed(2)}, 1.0, band);
        diffuseColor.rgb = mix(diffuseColor.rgb, cliff, steep);`,
      )
  }

  return {
    material,
    dispose: () => {
      material.dispose() // el degradado es compartido: no se libera aquí
    },
  }
}
