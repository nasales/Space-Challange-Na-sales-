// Comic-print toolkit for the menu detective's rocket entrance, matching the main menu's look
// (src/ui/menu/MainMenu.css): the same colour tokens, Ben-Day halftone dots, thick ink lines,
// cyan/magenta misregistration ghosts, lettered sound effects in Big Shoulders Display inside the
// menu's starburst, and gold caption boxes. Everything is procedural (canvas textures, shaders).
import * as THREE from 'three'
import { getToonGradient } from '../scene/toonGradient'

/** The main menu's colour tokens (.main-menu custom properties). */
export const PAL = {
  ink: '#3b4a6b',
  inkDeep: '#161b2e',
  sea: '#5ea8c2',
  gold: '#f2c14e',
  red: '#e5322d',
  paper: '#fff8e7',
  cyan: 'rgba(0, 164, 214, 0.85)', // --print-cyan
  magenta: 'rgba(226, 0, 122, 0.75)', // --print-magenta
  cyanSolid: '#00a4d6',
  magentaSolid: '#e2007a',
  manila: '#ecd29a',
  manilaDark: '#d8b46e',
  sticky: '#fde58a',
} as const

/** The menu's font stacks (src/ui/theme/fonts.css). */
export const FONT_DISPLAY = "'Big Shoulders Display', 'Arial Narrow', 'Roboto Condensed', sans-serif"
export const FONT_TYPE = "'Courier Prime', 'Courier New', Courier, monospace"
const FONTS_TO_LOAD = ['900 100px "Big Shoulders Display"', '700 40px "Courier Prime"']

const TAU = Math.PI * 2

/**
 * Canvas texture drawn now with whatever font is available and drawn again once the menu fonts
 * are loaded (document.fonts), so the lettering always ends up in the menu's typefaces.
 */
export function letteredTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  const paint = () => {
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, w, h)
    g.lineJoin = 'round'
    g.lineCap = 'round'
    draw(g, w, h)
  }
  paint()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined
  if (fonts?.load) {
    Promise.all(FONTS_TO_LOAD.map((f) => fonts.load(f)))
      .then(() => {
        paint()
        tex.needsUpdate = true
      })
      .catch(() => {}) // keep the fallback lettering
  }
  return tex
}

/** Plain canvas texture (no lettering). */
export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.lineJoin = 'round'
  g.lineCap = 'round'
  draw(g)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Fills the current clip with a 45-degree grid of Ben-Day dots. */
export function halftone(g: CanvasRenderingContext2D, w: number, h: number, step: number, radius: (x: number, y: number) => number, color: string) {
  g.fillStyle = color
  for (let y = 0, row = 0; y < h + step; y += step * 0.5, row++) {
    for (let x = row % 2 ? step * 0.5 : 0; x < w + step; x += step) {
      const r = radius(x, y)
      if (r <= 0.2) continue
      g.beginPath()
      g.arc(x, y, r, 0, TAU)
      g.fill()
    }
  }
}

/** The menu's starburst (.sfx--burst clip-path), as points in [0, 1]. */
const STAR = [
  [50, 0], [57.3, 17.8], [70.4, 7.7], [68.7, 26.5], [89.1, 18.8], [81.5, 34.8], [92.9, 40.2], [81, 50],
  [97.8, 60.9], [80.6, 64.8], [86, 78.7], [68.1, 72.7], [71.7, 95], [57.3, 82.2], [50, 95], [43.1, 80.2],
  [29.2, 93.2], [28.8, 76.6], [13.3, 79.3], [23, 63], [1.3, 61.1], [18, 50], [7.1, 40.2], [20.3, 35.7],
  [11.7, 19.4], [30.7, 25.8], [30, 8.6], [42.4, 16.9],
].map(([x, y]) => [x / 100, y / 100] as const)

function starPath(g: CanvasRenderingContext2D, x: number, y: number, size: number, inset = 0) {
  const s = size - inset * 2
  g.beginPath()
  STAR.forEach(([px, py], i) => {
    const X = x + inset + px * s, Y = y + inset + py * s
    if (i) g.lineTo(X, Y)
    else g.moveTo(X, Y)
  })
  g.closePath()
}

/**
 * Lettered sound effect in the menu's .sfx--burst style: ink star, gold (or paper) star inside,
 * red Big Shoulders Display letters with an ink stroke, ink drop and a cyan plate ghost.
 */
export function burstWordTexture(word: string, inner: string = PAL.gold) {
  return letteredTexture(512, 512, (g, w) => {
    const u = w / 60 // the CSS --u of a 60u-wide burst
    g.translate(w / 2, w / 2)
    g.rotate((-12 * Math.PI) / 180) // like .sfx--pow
    g.translate(-w / 2, -w / 2)
    g.fillStyle = PAL.inkDeep
    starPath(g, 8, 8, w - 16)
    g.fill()
    g.fillStyle = inner
    starPath(g, 8, 8, w - 16, u * 2.2)
    g.fill()
    g.save()
    starPath(g, 8, 8, w - 16, u * 2.2)
    g.clip()
    halftone(g, w, w, 14, (x, y) => 2.6 * Math.hypot(x - w / 2, y - w / 2) / (w / 2), 'rgba(229, 50, 45, 0.28)')
    g.restore()
    drawWord(g, word, w / 2, w / 2 + u, u * 14 * Math.min(1, 4 / word.length), PAL.red, u)
  })
}

/** Lettered "swish" in the menu's .sfx--swish style: sea-blue skewed letters with motion bars on the left. */
export function swishWordTexture(word: string) {
  return letteredTexture(512, 192, (g, w, h) => {
    const u = w / 70
    // Motion bars trailing the word
    g.fillStyle = PAL.inkDeep
    for (const [y, len] of [[0.32, 0.18], [0.5, 0.24], [0.68, 0.16]] as const) {
      g.fillRect(u * 1, h * y - u * 0.7, w * len, u * 1.4)
    }
    g.save()
    g.translate(w * 0.6, h / 2)
    g.transform(1, 0, -0.21, 1, 0, 0) // skewX(-12deg)
    drawWord(g, word, 0, u, u * 15, PAL.sea, u)
    g.restore()
  })
}

/** Uppercase display lettering: cyan ghost, ink drop, ink stroke, coloured fill. */
function drawWord(g: CanvasRenderingContext2D, word: string, x: number, y: number, px: number, fill: string, u: number) {
  const text = word.toUpperCase()
  g.font = `900 ${Math.round(px)}px ${FONT_DISPLAY}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = PAL.cyan // misregistered cyan plate
  g.fillText(text, x - u * 0.9, y)
  g.lineWidth = u * 1.2
  g.strokeStyle = PAL.inkDeep
  g.fillStyle = PAL.inkDeep
  g.strokeText(text, x + u * 0.8, y + u * 0.8) // ink drop
  g.fillText(text, x + u * 0.8, y + u * 0.8)
  g.strokeText(text, x, y)
  g.fillStyle = fill
  g.fillText(text, x, y)
}

/** Narration caption box like the menu title: gold, red halftone dots, ink border and ink drop shadow, typewriter text. */
export function captionTexture(text: string) {
  return letteredTexture(512, 128, (g, w, h) => {
    const sh = 9, line = 6
    const bw = w - sh - line, bh = h - sh - line
    g.fillStyle = PAL.inkDeep
    g.fillRect(line / 2 + sh, line / 2 + sh, bw, bh) // drop shadow
    g.fillStyle = PAL.gold
    g.fillRect(line / 2, line / 2, bw, bh)
    g.save()
    g.beginPath()
    g.rect(line / 2, line / 2, bw, bh)
    g.clip()
    halftone(g, w, h, 12, () => 2.2, 'rgba(229, 50, 45, 0.28)')
    g.restore()
    g.lineWidth = line
    g.strokeStyle = PAL.inkDeep
    g.strokeRect(line / 2, line / 2, bw, bh)
    g.fillStyle = PAL.inkDeep
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    let px = 44
    g.font = `700 ${px}px ${FONT_TYPE}`
    while (g.measureText(text).width > bw - 40 && px > 16) {
      px -= 2
      g.font = `700 ${px}px ${FONT_TYPE}`
    }
    g.fillText(text, line / 2 + bw / 2, line / 2 + bh / 2 + 2)
  })
}

/** Impact star (no lettering): ink starburst, gold inside, paper core, with cyan/magenta plate ghosts. */
export function impactStarTexture() {
  return canvasTexture(256, 256, (g) => {
    g.fillStyle = PAL.cyan
    starPath(g, 4, 10, 236)
    g.fill()
    g.fillStyle = PAL.magenta
    starPath(g, 16, 4, 236)
    g.fill()
    g.fillStyle = PAL.inkDeep
    starPath(g, 10, 8, 236)
    g.fill()
    g.fillStyle = PAL.gold
    starPath(g, 10, 8, 236, 14)
    g.fill()
    g.fillStyle = PAL.paper
    starPath(g, 10, 8, 236, 62)
    g.fill()
  })
}

/** Flat comic smoke puff: paper disc, ink halftone shadow crescent, thick ink outline. */
export function comicPuffTexture() {
  return canvasTexture(128, 128, (g) => {
    g.beginPath()
    g.arc(64, 64, 52, 0, TAU)
    g.fillStyle = PAL.paper
    g.fill()
    g.save()
    g.clip()
    g.beginPath()
    g.rect(0, 0, 128, 128)
    g.arc(52, 50, 50, 0, TAU, true) // lit part cut out: what is left is the shadow crescent
    g.clip('evenodd')
    g.fillStyle = PAL.manila
    g.fillRect(0, 0, 128, 128)
    halftone(g, 128, 128, 9, () => 2.1, PAL.ink)
    g.restore()
    g.lineWidth = 9
    g.strokeStyle = PAL.inkDeep
    g.beginPath()
    g.arc(64, 64, 52, 0, TAU)
    g.stroke()
  })
}

/** Tileable single Ben-Day dot (white; tint it with the material colour, repeat it on the panel). */
export function dotTileTexture() {
  const tex = canvasTexture(32, 32, (g) => {
    g.fillStyle = '#ffffff'
    for (const [x, y] of [[8, 8], [24, 24]]) {
      g.beginPath()
      g.arc(x, y, 4.2, 0, TAU)
      g.fill()
    }
  })
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** Alpha map that is clear in the middle and solid in the corners (dots densest in the corners, like the menu wall). */
export function cornerMaskTexture() {
  const tex = canvasTexture(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 58, 20, 64, 64, 92)
    grad.addColorStop(0, '#000000')
    grad.addColorStop(1, '#ffffff')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
  })
  tex.colorSpace = THREE.NoColorSpace
  return tex
}

/**
 * Flat cel material for 3D props: two tones with a hard terminator, and ink Ben-Day dots in the
 * shadow (screen-space dots, so they stay the same size like printed dots).
 */
export function comicMaterial(color: THREE.ColorRepresentation, dotPx: number) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: getToonGradient() })
  const ink = new THREE.Color(PAL.inkDeep)
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDot = { value: dotPx }
    shader.uniforms.uInk = { value: ink }
    shader.fragmentShader = 'uniform float uDot;\nuniform vec3 uInk;\n' + shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `{
        const vec3 luma = vec3(0.299, 0.587, 0.114);
        vec3 lit = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
        float light = dot(lit, luma) / max(dot(diffuseColor.rgb, luma), 1e-3);
        float shade = 1.0 - step(0.8, light); // hard terminator: lit or shadow, nothing between
        vec2 p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * (gl_FragCoord.xy / uDot);
        float dots = 1.0 - step(0.3, length(fract(p) - 0.5));
        vec3 base = diffuseColor.rgb;
        vec3 col = mix(base, base * vec3(0.62, 0.66, 0.86), shade);
        col = mix(col, uInk, shade * dots * 0.8);
        outgoingLight = col + totalEmissiveRadiance;
      }
      #include <opaque_fragment>`,
    )
  }
  m.customProgramCacheKey = () => 'comic-halftone'
  return m
}

/**
 * Stepped pop like the menu's sfx-burst keyframes on steps(): small, past full size (tilted),
 * held at full size, a last bigger drawing, gone. `framesIn` = drawings since it appeared,
 * `framesLeft` = drawings left before it goes (0 = the last one).
 */
export function stepPop(framesIn: number, framesLeft: number) {
  if (framesIn < 0 || framesLeft < 0) return { scale: 0, rot: 0 }
  if (framesIn === 0) return { scale: 0.6, rot: -0.5 }
  if (framesIn === 1) return { scale: 1.25, rot: 0.14 }
  if (framesLeft === 0) return { scale: 1.08, rot: 0.1 }
  return { scale: 1, rot: 0.07 }
}
