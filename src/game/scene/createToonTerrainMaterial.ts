// Cartoon material for the relief:
// - Cel (toon) shading: light falls into a few flat tones, like a cartoon.
// - Steep parts of the ramps between floors are painted as earth walls with horizontal strata,
//   with a crisp (anti-aliased) edge, like painted toy steps, instead of stretching the ground
//   texture over them.
import * as THREE from 'three'
import { addCartoonShadows, getToonGradient, markAsGround } from './toonGradient'
import { metersToY, HEIGHT_EXAGGERATION } from '../map/projection'

/** Colour of the rock/earth walls. */
const CLIFF_COLOR = new THREE.Color('#ec9a6c') // warm terracotta, matches the sierra level
/**
 * Faces steeper than this (world normal Y = cos of the slope) are painted as walls. 0.78 is about
 * 39 degrees: the middle of the ramps between floors, not their gentle feet and tops.
 */
const CLIFF_NORMAL_Y = 0.78
/** Height between two strata lines on the walls (about every 100 m of real height). */
const STRATA_SPACING = metersToY(100, HEIGHT_EXAGGERATION)
/** Contrast of the strata (1 = no strata). Soft, so the ground does not get busy. */
const STRATA_SHADE = 0.88
/** Ground shadow strength (objects use 1). */
const GROUND_SHADOW = 0.6
/**
 * Ground shadow tint: a lighter, bluer violet than on objects. The shared object tint turns golds
 * and terracottas brown on the ground; this one keeps shadows clean and cool, like a cartoon.
 */
const GROUND_SHADOW_TINT = { multiply: 'vec3(0.6, 0.55, 0.9)', add: 'vec3(0.04, 0.02, 0.12)' }
/**
 * Low walls next to the sea are painted as a sandy beach edge. The first floor is drawn at 40 m,
 * so this stays a little below its top.
 */
const BEACH_WALL_Y = metersToY(30, HEIGHT_EXAGGERATION)
const BEACH_WALL_COLOR = new THREE.Color('#ffd98a')

export function createToonTerrainMaterial(map: THREE.Texture) {
  const material = new THREE.MeshToonMaterial({ map, gradientMap: getToonGradient() })

  material.onBeforeCompile = (shader) => {
    addCartoonShadows(shader, GROUND_SHADOW, GROUND_SHADOW_TINT) // softer, cooler violet than on objects
    markAsGround(shader) // so the outlines put less ink on the ground
    shader.uniforms.cliffColor = { value: CLIFF_COLOR }
    shader.uniforms.beachColor = { value: BEACH_WALL_COLOR }
    shader.uniforms.strataSpacing = { value: STRATA_SPACING }
    // Vertex: pass the world-space normal and height to the fragment shader
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldNormal;\nvarying float vWorldY;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vWorldY = (modelMatrix * vec4(position, 1.0)).y;`,
      )
    // Fragment: steep faces take the wall colour (with strata). Edges are crisp but anti-aliased
    // with fwidth, so they read as painted bands instead of a blurry gradient.
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldNormal;
        varying float vWorldY;
        uniform vec3 cliffColor;
        uniform vec3 beachColor;
        uniform float strataSpacing;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float ny = normalize(vWorldNormal).y;
        float aa = max(fwidth(ny), 0.004);
        float steep = 1.0 - smoothstep(${CLIFF_NORMAL_Y.toFixed(3)} - aa, ${CLIFF_NORMAL_Y.toFixed(3)} + aa, ny);
        float sy = vWorldY / strataSpacing;
        float saa = max(fwidth(sy), 0.001);
        float band = smoothstep(0.5 - saa, 0.5 + saa, fract(sy)) * (1.0 - smoothstep(1.0 - saa, 1.0, fract(sy)));
        vec3 cliff = cliffColor * mix(1.0, ${STRATA_SHADE.toFixed(2)}, band);
        float baa = max(fwidth(vWorldY), 0.001);
        cliff = mix(cliff, beachColor, 1.0 - smoothstep(${BEACH_WALL_Y.toFixed(3)} - baa, ${BEACH_WALL_Y.toFixed(3)} + baa, vWorldY));
        diffuseColor.rgb = mix(diffuseColor.rgb, cliff, steep);`,
      )
  }

  return {
    material,
    dispose: () => {
      material.dispose() // the gradient is shared: not freed here
    },
  }
}
