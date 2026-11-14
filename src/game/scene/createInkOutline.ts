// Contornos de tinta estilo cómic, como un efecto de "posprocesado":
// 1) La escena se dibuja en una imagen intermedia (render target) que guarda también la profundidad.
// 2) Un rectángulo a pantalla completa copia esa imagen y pinta de negro los bordes.
//
// ¿Cómo sabe dónde hay un borde? Mira la profundidad de cada píxel y la de sus vecinos.
// En pantalla, la inversa de la profundidad de una superficie plana cambia de forma lineal, así que
// su "segunda derivada" (laplaciano) es 0 en cualquier plano, aunque sea una cuesta. Solo salta en
// las siluetas (objeto contra fondo) y en las aristas (un canto, el borde de un acantilado).
// Así no se dibujan rayas en el suelo, solo donde un dibujante pasaría la tinta.
import * as THREE from 'three'

/** Color de la tinta. */
const INK = new THREE.Color('#1A1423')
/** Sensibilidad: a partir de este cambio relativo empieza a haber línea, y en este es línea entera. */
const EDGE_START = 0.012
const EDGE_FULL = 0.04
/** En el suelo hace falta un salto mayor para que haya línea, y la tinta es más clara. */
const GROUND_EDGE_START = 0.04 // was 0.07 / 0.25: the terraces are softer on the bigger map
const GROUND_EDGE_FULL = 0.15
const GROUND_INK = 0.55
/** Grosor de la línea, en píxeles. */
const LINE_WIDTH = 1.6
/**
 * Colour grade applied to the whole picture (cartoon "vivid" look):
 * SATURATION pushes every colour away from grey; VIBRANCE adds extra saturation to dull colours
 * only (vivid ones and near-greys like skin and clouds stay sane); CONTRAST spreads tones around
 * mid-grey. All in linear light, before the ink.
 */
const SATURATION = '1.1'
const VIBRANCE = '0.15'
const CONTRAST = '1.05'
/**
 * Object ink gets lighter with distance (fraction of fadeNear where it starts/ends, and the
 * strength it keeps), so tiny objects such as olive trees do not turn into black rings at mid zoom.
 */
const OBJECT_INK_FAR_START = '0.15'
const OBJECT_INK_FAR_END = '0.6'
const OBJECT_INK_FAR = '0.45'

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 texel; // tamaño de un píxel (por el grosor de la línea)
  uniform float cameraNear;
  uniform float cameraFar;
  uniform vec3 ink;
  uniform float fadeNear;
  uniform float fadeFar;
  varying vec2 vUv;

  // Profundidad real (distancia a la cámara) a partir del valor guardado (0..1)
  float viewDepth(vec2 uv) {
    float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
    return 2.0 * cameraNear * cameraFar / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
  }

  void main() {
    vec4 color = texture2D(tColor, vUv);
    float d = viewDepth(vUv);
    float w = 1.0 / d;
    // Laplaciano de la inversa de la profundidad (vecinos en cruz y en diagonal)
    float sumCross = 1.0 / viewDepth(vUv + vec2(texel.x, 0.0)) + 1.0 / viewDepth(vUv - vec2(texel.x, 0.0))
                + 1.0 / viewDepth(vUv + vec2(0.0, texel.y)) + 1.0 / viewDepth(vUv - vec2(0.0, texel.y));
    float sumDiag = 1.0 / viewDepth(vUv + texel) + 1.0 / viewDepth(vUv - texel)
               + 1.0 / viewDepth(vUv + vec2(texel.x, -texel.y)) + 1.0 / viewDepth(vUv + vec2(-texel.x, texel.y));
    float lap = abs(sumCross + sumDiag - 8.0 * w);
    // Relativo a la profundidad del píxel (o de sus vecinos, si el píxel es cielo)
    float rel = lap / max(w, lap * 0.25);

    // ¿Hay algún objeto (no suelo) en este píxel o al lado? El suelo escribe alfa 0 (markAsGround)
    float object = max(color.a, max(
      max(texture2D(tColor, vUv + vec2(texel.x, 0.0)).a, texture2D(tColor, vUv - vec2(texel.x, 0.0)).a),
      max(texture2D(tColor, vUv + vec2(0.0, texel.y)).a, texture2D(tColor, vUv - vec2(0.0, texel.y)).a)));
    // Objetos: tinta completa. Suelo: solo los saltos grandes, más suave y que se apaga antes a lo lejos
    float objectEdge = smoothstep(${EDGE_START}, ${EDGE_FULL}, rel) * (1.0 - smoothstep(fadeNear, fadeFar, d))
                     * mix(1.0, ${OBJECT_INK_FAR}, smoothstep(fadeNear * ${OBJECT_INK_FAR_START}, fadeNear * ${OBJECT_INK_FAR_END}, d));
    float groundEdge = smoothstep(${GROUND_EDGE_START}, ${GROUND_EDGE_FULL}, rel) * ${GROUND_INK}
                     * (1.0 - smoothstep(fadeNear * 0.4, fadeNear, d));
    float edge = mix(groundEdge, objectEdge, object);
    // Colour grade: saturation + vibrance + contrast (see constants above)
    vec3 c = color.rgb;
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float hi = max(c.r, max(c.g, c.b));
    float sat = (hi - min(c.r, min(c.g, c.b))) / max(hi, 1e-4);
    c = max(mix(vec3(luma), c, ${SATURATION} + ${VIBRANCE} * (1.0 - sat)), 0.0);
    c = 0.18 * pow(c / 0.18, vec3(${CONTRAST}));
    gl_FragColor = vec4(mix(c, ink, edge), 1.0);
    #include <colorspace_fragment>
  }
`

export function createInkOutline(renderer: THREE.WebGLRenderer) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2())
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    samples: 2, // antialiasing ligero dentro de la imagen intermedia (4 costaba demasiado)
    depthTexture: new THREE.DepthTexture(size.x, size.y),
  })
  target.texture.colorSpace = THREE.SRGBColorSpace

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      tColor: { value: target.texture },
      tDepth: { value: target.depthTexture },
      texel: { value: new THREE.Vector2(LINE_WIDTH / size.x, LINE_WIDTH / size.y) },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 1000 },
      ink: { value: INK },
      fadeNear: { value: 300 },
      fadeFar: { value: 900 },
    },
    depthTest: false,
    depthWrite: false,
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  const quadScene = new THREE.Scene()
  quadScene.add(quad)
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  /** Dibuja la escena con contornos. fadeNear/fadeFar: distancias donde la tinta se desvanece. */
  const render = (scene: THREE.Scene, camera: THREE.PerspectiveCamera, fadeNear: number, fadeFar: number) => {
    // Si la ventana ha cambiado de tamaño, la imagen intermedia también
    renderer.getDrawingBufferSize(size)
    if (size.x !== target.width || size.y !== target.height) {
      target.setSize(size.x, size.y)
      material.uniforms.texel.value.set(LINE_WIDTH / size.x, LINE_WIDTH / size.y)
    }
    material.uniforms.cameraNear.value = camera.near
    material.uniforms.cameraFar.value = camera.far
    material.uniforms.fadeNear.value = fadeNear
    material.uniforms.fadeFar.value = fadeFar

    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    renderer.render(quadScene, quadCamera)
  }

  return {
    render,
    dispose: () => {
      target.dispose()
      target.depthTexture?.dispose()
      material.dispose()
      quad.geometry.dispose()
    },
  }
}
