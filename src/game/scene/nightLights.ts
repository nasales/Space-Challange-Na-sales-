// Little warm lights for the night: lit windows, door lamps and soft glows on houses and
// landmarks. No real lights: every light is a flat quad drawn with one shared unlit material
// (the window itself covers what is behind it, its glow is added on top), batched into a few meshes (one per map chunk of houses, one per landmark).
//
// They live in their own scene, drawn straight to the screen AFTER the ink pass
// (createInkOutline), so the night tint does not dim them. The ink pass copies the scene depth
// to the screen, so houses, landmarks and the detective still hide the lights behind them.
//
// Two kinds of light, both in the same geometry:
// - panel: a quad lying on a wall (window, arch, door). Bright core of the window size, soft
//   halo around it.
// - halo: a round glow that always faces the camera (lantern, tower top, floodlight).
//
// The day/night palette (dayCycle.ts) gives one "night" factor, 0 by day and 1 at night; each
// light switches on at its own moment of the dusk (its `phase`), so a town lights up bit by bit.
import * as THREE from 'three'

// ---------------------------------------------------------------------------------------------
// Tweakable constants
// ---------------------------------------------------------------------------------------------

/** Colour of a lit window (warm yellow) and of the glow around the lights (more orange). */
const LIGHT_COLOR = 0xffc04a
const GLOW_COLOR = 0xff9a2e
/** Brightness of the window itself, and of the glow around it (added on top of the picture). */
const CORE_STRENGTH = 1
const HALO_STRENGTH = 0.3
/** Brightness at the centre of a round glow (multiplied by each glow's own intensity). */
const GLOW_STRENGTH = 0.6
/** Halo around a panel: this fraction of its smaller side, at most HALO_MARGIN_MAX world units. */
const HALO_SPREAD = 0.7
const HALO_MARGIN_MAX = 1.6
/** Panels float this far off their wall (world units), so they do not fight with it. */
export const PANEL_OFFSET = 0.12
/**
 * Staggered switch-on: a light with phase p starts at night = p * STAGGER and is fully on
 * (1 - STAGGER) later. 0 = all at once; near 1 = one by one over the whole dusk.
 */
const STAGGER = 0.6
/** How much the distance fog hides the lights (1 = like everything else, 0 = not at all). */
const FOG_FADE = 0.8

// ---------------------------------------------------------------------------------------------
// Shared material
// ---------------------------------------------------------------------------------------------

const uniforms = {
  color: { value: new THREE.Color(LIGHT_COLOR) },
  glow: { value: new THREE.Color(GLOW_COLOR) },
  night: { value: 0 },
  fogNear: { value: 250 },
  fogFar: { value: 900 },
}

let shared: THREE.ShaderMaterial | null = null

/** The one material of every night light (see makeLightBatch for the geometry it expects). */
export function getNightLightMaterial(): THREE.ShaderMaterial {
  if (!shared) {
    shared = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        attribute vec2 corner; // -1..1 across the quad
        attribute vec2 core;   // part of the quad that is the window itself (0 = round glow)
        attribute vec3 params; // x: glow radius (0 = panel), y: phase 0..1, z: intensity
        uniform float night;
        uniform float fogNear;
        uniform float fogFar;
        varying vec2 vCorner;
        varying vec2 vCore;
        varying float vLevel;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          // Round glow: open the quad toward the camera and bring it a little closer
          mv.xy += corner * params.x;
          mv.z += params.x;
          float start = params.y * ${STAGGER.toFixed(2)};
          float on = smoothstep(start, start + ${(1 - STAGGER).toFixed(2)}, night);
          float fog = smoothstep(fogNear, fogFar, -mv.z) * ${FOG_FADE.toFixed(2)};
          vLevel = on * (1.0 - fog) * params.z;
          vCorner = corner;
          vCore = core;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 color;
        uniform vec3 glow;
        varying vec2 vCorner;
        varying vec2 vCore;
        varying float vLevel;
        void main() {
          vec2 a = abs(vCorner);
          // Distance from the window edge to the quad edge, 0..1 (inside the window: 0)
          float d = length(max(a - vCore, 0.0) / max(1.0 - vCore, 1e-4));
          float fade = max(1.0 - d, 0.0);
          float panel = step(1e-3, vCore.x);
          float pane = panel * step(d, 0.0) * ${CORE_STRENGTH.toFixed(2)};
          float halo = mix(pow(fade, 2.5) * ${GLOW_STRENGTH.toFixed(2)}, fade * fade * ${HALO_STRENGTH.toFixed(2)}, panel);
          // Premultiplied: the lit window replaces what is behind it (alpha), the glow is only added
          float cover = pane * min(vLevel, 1.0);
          gl_FragColor = vec4(color * cover + glow * (halo * vLevel * (1.0 - cover)), cover);
          #include <colorspace_fragment>
        }`,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      transparent: true,
      depthWrite: false,
      // In front of the wall they lie on, at any distance
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -8,
      fog: false,
    })
  }
  return shared
}

// ---------------------------------------------------------------------------------------------
// Geometry batches
// ---------------------------------------------------------------------------------------------

/**
 * Collects lights and builds ONE geometry with all of them (4 vertices per light).
 * Positions are in the space of the mesh that will draw it; the mesh must not be scaled.
 */
export function makeLightBatch() {
  const position: number[] = []
  const corner: number[] = []
  const core: number[] = []
  const params: number[] = []
  let count = 0
  const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  const u = new THREE.Vector3(), v = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3()

  return {
    get count() {
      return count
    },

    /**
     * Window-like light on a wall. `matrix` places a w x h rectangle that lies in its XY plane,
     * centred at its origin and facing +Z (any rotation, uniform scale).
     * @param phase 0..1: when it switches on during the dusk
     */
    addPanel(matrix: THREE.Matrix4, w: number, h: number, phase: number, intensity = 1) {
      matrix.extractBasis(u, v, n)
      const scale = u.length()
      u.normalize()
      v.normalize()
      n.normalize()
      const halfW = (w * scale) / 2, halfH = (h * scale) / 2
      const margin = Math.min(HALO_MARGIN_MAX, Math.min(halfW, halfH) * 2 * HALO_SPREAD)
      c.setFromMatrixPosition(matrix).addScaledVector(n, PANEL_OFFSET)
      for (const [sx, sy] of CORNERS) {
        p.copy(c).addScaledVector(u, sx * (halfW + margin)).addScaledVector(v, sy * (halfH + margin))
        position.push(p.x, p.y, p.z)
        corner.push(sx, sy)
        core.push(halfW / (halfW + margin), halfH / (halfH + margin))
        params.push(0, phase, intensity)
      }
      count++
    },

    /** Round glow of the given radius centred at (x, y, z); it always faces the camera. */
    addHalo(x: number, y: number, z: number, radius: number, phase: number, intensity = 1) {
      for (const [sx, sy] of CORNERS) {
        position.push(x, y, z)
        corner.push(sx, sy)
        core.push(0, 0)
        params.push(radius, phase, intensity)
      }
      count++
    },

    /** The geometry of everything added so far (null if there is nothing). */
    build(): THREE.BufferGeometry | null {
      if (count === 0) return null
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
      geometry.setAttribute('corner', new THREE.Float32BufferAttribute(corner, 2))
      geometry.setAttribute('core', new THREE.Float32BufferAttribute(core, 2))
      geometry.setAttribute('params', new THREE.Float32BufferAttribute(params, 3))
      const index = new Uint32Array(count * 6)
      for (let k = 0; k < count; k++) index.set([k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3], k * 6)
      geometry.setIndex(new THREE.BufferAttribute(index, 1))
      geometry.computeBoundingSphere()
      // Round glows open in the shader: make room for them (and for the panel halos)
      let reach = 0
      for (let k = 0; k < params.length; k += 3) reach = Math.max(reach, params[k])
      geometry.boundingSphere!.radius += reach * 2 + HALO_MARGIN_MAX
      return geometry
    },
  }
}

/** A mesh of night lights for a batch (null if the batch is empty). */
export function makeLightMesh(batch: ReturnType<typeof makeLightBatch>): THREE.Mesh | null {
  const geometry = batch.build()
  return geometry ? new THREE.Mesh(geometry, getNightLightMaterial()) : null
}

// ---------------------------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------------------------

/** The scene of the night lights (add the groups of light meshes to `scene`) and its per-frame update. */
export function createNightLights() {
  const scene = new THREE.Scene()
  scene.visible = false

  /** One update per frame: `night` 0..1 from the day palette, and the current fog distances. */
  const update = (night: number, fogNear: number, fogFar: number) => {
    scene.visible = night > 0.002 // by day nothing is drawn at all
    uniforms.night.value = night
    uniforms.fogNear.value = fogNear
    uniforms.fogFar.value = fogFar
  }

  return { scene, update, dispose: () => getNightLightMaterial().dispose() }
}
