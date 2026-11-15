// Rivers as real water: a flat ribbon of animated cartoon water lying inside each carved channel.
// The look is comic-book (flat colour bands, halftone dots in the deep middle, white current
// streaks, foam on rapids, motion "on twos") and every river shows its own size: big rivers are
// deep navy and flow slowly and heavily; small ones are shallow, clear and quick.
//
// River ends (labelled by prepareRivers in map/rivers.ts):
// - source: the ribbon starts narrow with a round end; a spring wells up there (bubbling core and
//   rings spreading out) and the current streaks are born at it and drift downstream;
// - mouth: the ribbon runs a little past the coast, drops to the sea and dissolves into it with a
//   comic halftone fade in the coastal sea colour;
// - join: a tributary ends inside the main river, just under its water level, so they merge;
// - fade: it ran on a little into a neighbouring country; it narrows and dissolves (halftone);
// - cut (zone edge, end of the land, or a spot without a channel): a round end.
import * as THREE from 'three'
import type { River, RiverEnd } from '../map/mapData'
import { chaikin, channelDepth, DOWNSTREAM, riverHalfWidthKm, riverWidthScale } from '../map/rivers'
import { lonLatToWorld, SEA_Y, UNITS_PER_KM } from '../map/projection'
import { SEA } from '../map/palette'

/** Distance (world units) between two cross sections of the ribbon. */
const STEP = 4
/** The ribbon is a bit wider than the channel: the banks clip it into a natural shoreline. */
const WIDTH_FACTOR = 1.06
/** Water level, as a fraction of the channel depth above its bed. */
const WATER_LEVEL = 0.6
/** Cross sections averaged on each side when smoothing the water level along the river. */
const LEVEL_SMOOTH = 3
/** Animation frame rate: comic "on twos" stepping. */
const ANIM_FPS = 12
/** Segments of the half circle that rounds each end of a ribbon. */
const CAP_SEGMENTS = 8
/** Mouths: how far (cross sections) to look past the river end for the sea, and how many sea sections to add. */
const MOUTH_SEARCH = 5
const MOUTH_SEA_SECTIONS = 4
/** Mouths: the water fades into the sea over this distance (world units) before the ribbon end. */
const MOUTH_FADE = 14
/** Height of the water over the sea surface where the river dissolves into it. */
const MOUTH_LEVEL = 0.08
/** Mouths: cross sections before the coast over which the water glides down to the sea. */
const MOUTH_RAMP = 5
/** A gap of sea this short (cross sections) between two stretches of land is bridged by the water. */
const INLET_SECTIONS = 8
/** Fade ends (into a neighbouring country): the water dissolves over this distance (world units). */
const FADE_END = 48
/** Joins: the tributary ends this far below the main river's water, so the main ribbon covers the seam. */
const JOIN_DROP = 0.3
/** The ground this far (world units) outside the ribbon is the natural bank: water never rises above it. */
const BANK_PROBE = 10
/** Thinnest water layer (world units) over the bed; less than that counts as "no channel here". */
const MIN_WATER = 0.08

interface RiverGround {
  heightAt: (x: number, z: number) => number
  isExploredLand: (x: number, z: number) => boolean
  /** Land with real relief where rivers may run: the country and its neighbours (defaults to isExploredLand). */
  isRiverLand?: (x: number, z: number) => boolean
}

type XZ = [number, number]

/** One continuous piece of water ribbon, from upstream (index 0) to downstream. */
interface Run {
  pts: XZ[]
  /** Channel half width (world units) at each point. */
  hw: number[]
  bed: number[]
  level: number[]
  /** 1 where the river dissolves into the sea. */
  fade: number[]
  /** No rapids here (the smooth glide down to the sea). */
  calm: boolean[]
  /** Points added past the coast (no channel under them). */
  sea: boolean[]
  kinds: [RiverEnd, RiverEnd]
  deepness: number
  /** River index, so a tributary never "joins" itself. */
  river: number
}

const rgb = (c: readonly number[]) => new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace)
const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Resamples a polyline (world x/z) to points STEP apart. */
function resample(pts: XZ[]): XZ[] {
  const out: XZ[] = [pts[0]]
  let carry = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    let d = STEP - carry
    while (d <= len) {
      const t = d / len
      out.push([ax + (bx - ax) * t, az + (bz - az) * t])
      d += STEP
    }
    carry = len - (d - STEP)
  }
  const last = pts[pts.length - 1]
  if (out.length < 2 || Math.hypot(last[0] - out[out.length - 1][0], last[1] - out[out.length - 1][1]) > STEP * 0.3) out.push(last)
  return out
}

/** Unit tangent (downstream) of a polyline at point i. */
function tangent(pts: XZ[], i: number): XZ {
  const [px, pz] = pts[Math.max(0, i - 1)]
  const [nx, nz] = pts[Math.min(pts.length - 1, i + 1)]
  const tx = nx - px, tz = nz - pz
  const tl = Math.hypot(tx, tz) || 1
  return [tx / tl, tz / tl]
}

export function createRivers(rivers: River[] | undefined, ground: RiverGround) {
  const isLand = ground.isRiverLand ?? ground.isExploredLand
  // (the height right at the coast blends the sea with the land beside it, kept >= SEA_Y + 0.3)
  const isSea = (x: number, z: number) => !isLand(x, z) && Math.abs(ground.heightAt(x, z) - SEA_Y) < 0.25
  const runs: Run[] = []

  // ---- 1) Cut every river line into runs over explored land, labelled at both ends ----
  ;(rivers ?? []).forEach((river, ri) => {
    const hwFull = riverHalfWidthKm(river.rank) * UNITS_PER_KM
    const deepness = river.rank === 1 ? 1 : river.rank === 2 ? 0.7 : 0.4
    river.lines.forEach((line, li) => {
      const ends = river.ends?.[li] ?? (['cut', 'cut'] as [RiverEnd, RiverEnd])
      const world = chaikin(line, 3).map(([lon, lat]) => {
        const p = lonLatToWorld(lon, lat)
        return [p.x, p.z] as XZ
      })
      if (world.length < 2) return
      const pts = resample(world)
      const n = pts.length
      // Half width along the whole line: narrow at the spring, wider at the mouth
      const along = [0]
      for (let i = 1; i < n; i++) along.push(along[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
      const totalKm = along[n - 1] / UNITS_PER_KM
      const hw = along.map((a) => hwFull * riverWidthScale(a / UNITS_PER_KM, totalKm, ends))

      // Runs of consecutive points on land (the country and the stretch into its neighbours). A
      // river that crosses a narrow inlet of the sea (the Ebro delta) keeps flowing over it
      const onLand = pts.map(([x, z]) => isLand(x, z))
      for (let i = 1, gap = -1; i < n; i++) {
        if (!onLand[i] && onLand[i - 1]) gap = i
        if (onLand[i] && !onLand[i - 1] && gap > 0 && i - gap <= INLET_SECTIONS) onLand.fill(true, gap, i)
      }
      let s = -1
      for (let i = 0; i <= n; i++) {
        const land = i < n && onLand[i]
        if (land && s < 0) s = i
        if (!land && s >= 0) {
          if (i - s > 1) {
            const kindAt = (k: number, lineEnd: RiverEnd): RiverEnd =>
              k < 0 || k >= n ? lineEnd : isSea(pts[k][0], pts[k][1]) ? 'mouth' : 'cut'
            runs.push({
              pts: pts.slice(s, i),
              hw: hw.slice(s, i),
              bed: [],
              level: [],
              fade: [],
              calm: [],
              sea: new Array(i - s).fill(false),
              kinds: [kindAt(s - 1, ends[0]), kindAt(i, ends[1])],
              deepness,
              river: ri,
            })
          }
          s = -1
        }
      }
    })
  })

  // ---- 2) Mouths reach the sea; flow direction; water level ----
  for (let r = 0; r < runs.length; r++) {
    const run = runs[r]
    for (const side of [0, 1] as const) {
      if (run.kinds[side] !== 'mouth') continue
      if (!extendIntoSea(run, side, isSea)) run.kinds[side] = 'cut' // no sea close enough: just a round end
    }
    // Upstream first: a spring flows into a confluence or the sea; on a tie, from high to low ground
    const bedStart = ground.heightAt(run.pts[0][0], run.pts[0][1])
    const bedEnd = ground.heightAt(run.pts[run.pts.length - 1][0], run.pts[run.pts.length - 1][1])
    const d = DOWNSTREAM[run.kinds[1]] - DOWNSTREAM[run.kinds[0]]
    if (d < 0 || (d === 0 && bedStart < bedEnd)) reverseRun(run)
    computeLevels(run, ground)
  }
  // Spots without a channel (water would float above the banks) split the run
  const split: Run[] = []
  for (const run of runs) split.push(...splitDry(run))

  // ---- 3) Tributaries end just under the main river's water ----
  joinTributaries(split)

  // ---- 4) Geometry ----
  const geo = buildGeometry(split)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(geo.pos, 3))
  geometry.setAttribute('aAcross', new THREE.Float32BufferAttribute(geo.across, 1))
  geometry.setAttribute('aAlong', new THREE.Float32BufferAttribute(geo.along, 1))
  geometry.setAttribute('aSlope', new THREE.Float32BufferAttribute(geo.slope, 1))
  geometry.setAttribute('aDeep', new THREE.Float32BufferAttribute(geo.deep, 1))
  geometry.setAttribute('aHalfW', new THREE.Float32BufferAttribute(geo.halfW, 1))
  geometry.setAttribute('aFade', new THREE.Float32BufferAttribute(geo.fade, 1))
  geometry.setAttribute('aSpring', new THREE.Float32BufferAttribute(geo.spring, 3))
  geometry.setIndex(geo.index)
  geometry.computeBoundingSphere()

  const material = new THREE.ShaderMaterial({
    fog: true,
    side: THREE.DoubleSide, // the round end fans are built without caring about winding
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uShallow: { value: rgb(SEA.coast) },
        uMid: { value: rgb(SEA.shallow) },
        uDeep: { value: rgb(SEA.deep) },
        uAbyss: { value: new THREE.Color('#1B3F9E') },
        uFoam: { value: new THREE.Color('#FFFFFF') },
      },
    ]),
    vertexShader: /* glsl */ `
      attribute float aAcross;
      attribute float aAlong;
      attribute float aSlope;
      attribute float aDeep;
      attribute float aHalfW;
      attribute float aFade;
      attribute vec3 aSpring;
      varying float vAcross;
      varying float vAlong;
      varying float vSlope;
      varying float vDeep;
      varying float vHalfW;
      varying float vFade;
      varying vec3 vSpring;
      varying vec3 vWorld;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vAcross = aAcross;
        vAlong = aAlong;
        vSlope = aSlope;
        vDeep = aDeep;
        vHalfW = aHalfW;
        vFade = aFade;
        vSpring = aSpring;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uShallow;
      uniform vec3 uMid;
      uniform vec3 uDeep;
      uniform vec3 uAbyss;
      uniform vec3 uFoam;
      varying float vAcross;
      varying float vAlong;
      varying float vSlope;
      varying float vDeep;
      varying float vHalfW;
      varying float vFade;
      varying vec3 vSpring;
      varying vec3 vWorld;
      #include <common>
      #include <fog_pars_fragment>

      float hash11(float p) { return fract(sin(p * 127.1) * 43758.5453); }
      float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      // crisp but anti-aliased step
      float band(float edge, float v) { float w = max(fwidth(v), 1e-4); return smoothstep(edge - w, edge + w, v); }

      void main() {
        // 0) Mouth: the water breaks into a halftone pattern of holes that grow until it is gone
        mat2 rot = mat2(0.7071, -0.7071, 0.7071, 0.7071);
        if (vFade > 0.001) {
          vec2 hc = fract(rot * vWorld.xz / 1.8) - 0.5;
          if (length(hc) < vFade * 0.75) discard;
        }

        // a: 0 in the middle, 1 at the channel edge (the ribbon is WIDTH_FACTOR wider)
        float a = abs(vAcross) * ${WIDTH_FACTOR.toFixed(2)};
        float centre = 1.0 - a;                      // 1 in the middle, 0 at the edge
        float spring = vSpring.z;                     // 1 on a run that starts at a spring
        float sd = length(vWorld.xz - vSpring.xy);    // distance from that spring
        // (no white water right at the spring, so its rings stay readable on steep slopes)
        // (only on real drops: the gentle slope of a river running downhill stays smooth water)
        float rapids = smoothstep(0.1, 0.3, vSlope) * (1.0 - vFade) * mix(1.0, smoothstep(10.0, 26.0, sd), spring);
        float speed = mix(14.0, 6.0, vDeep) * (1.0 + rapids * 2.0);
        float v = vAcross * vHalfW;                   // signed distance across (world units)

        // 1) Flat colour bands from the banks to the deep middle (deeper rivers get more bands);
        //    their edges wobble slowly downstream, like liquid
        float wobble = (vnoise(vec2(vAlong * 0.06 - uTime * speed * 0.02, sign(vAcross) * 7.0)) - 0.5) * 0.16;
        float c2 = centre + wobble;
        vec3 col = uShallow;
        col = mix(col, uMid, band(0.14, c2));
        col = mix(col, uDeep, band(0.42, c2) * step(0.5, vDeep));
        col = mix(col, uAbyss, band(0.7, c2) * step(0.9, vDeep));

        // 2) Halftone dots (comic Ben-Day print) darkening the deep middle; they fade when tiny
        vec2 hp = rot * vWorld.xz / 2.4;
        vec2 cell = fract(hp) - 0.5;
        float dotR = 0.42 * smoothstep(0.25, 1.0, centre) * vDeep;
        float d = length(cell);
        float dw = max(fwidth(d), 1e-4);
        float dots = 1.0 - smoothstep(dotR - dw, dotR + dw, d);
        float far = smoothstep(0.25, 0.6, fwidth(hp.x));
        dots = mix(dots, dotR * dotR * 2.5, far);
        col = mix(col, col * 0.72, dots * (1.0 - rapids));

        // 3) Current lines: short, thin, tapered comic "speed lines" on wavy lanes, drifting
        //    downstream at the river's own pace (big rivers slow and heavy, small ones quick).
        //    At a spring they are born a little downstream of it, so the water visibly flows out
        float laneW = 2.6;
        float vw = v + 1.1 * sin(vAlong * 0.05 + floor(v / laneW) * 1.7) + 0.6 * sin(vAlong * 0.13);
        float lane = floor(vw / laneW);
        float lv = abs(fract(vw / laneW) - 0.5);
        float dashLen = mix(7.0, 14.0, vDeep);
        float s = (vAlong - uTime * speed) / dashLen + hash11(lane) * 17.0;
        float seg = floor(s);
        float rnd = hash21(vec2(seg, lane));
        float keep = step(0.8, rnd);
        float fs = fract(s);
        float len = mix(0.25, 0.5, fract(rnd * 13.0));
        float dash = smoothstep(0.0, len * 0.4, fs) * (1.0 - smoothstep(len * 0.6, len, fs));
        float thick = 0.05 * dash; // tapered: thick in the middle, pointed at both ends
        float thin = 1.0 - smoothstep(thick, thick + max(fwidth(vw / laneW) * 1.2, 0.015), lv);
        float born = mix(1.0, smoothstep(3.0, 16.0, sd), spring);
        float streak = thin * keep * smoothstep(0.08, 0.3, centre) * (1.0 - far * 0.9) * born * (1.0 - vFade);
        col = mix(col, uFoam, streak * 0.8);

        // 4) Rapids: blobs of white water where the river runs down a ramp
        float fn = vnoise(vec2((vAlong - uTime * speed * 0.6) * 0.22, v * 0.3));
        fn = 0.6 * fn + 0.4 * vnoise(vec2((vAlong - uTime * speed * 0.9) * 0.5, v * 0.7));
        float wb = band(mix(0.85, 0.6, rapids), fn);
        col = mix(col, uFoam, wb * rapids * 0.8);

        // 5) Foam line along the banks (and around the round ends), wobbling with the current
        float wob = 0.05 * sin(vAlong * 0.35 - uTime * 3.0);
        float foam = band(0.86 + wob, a) * (1.0 - band(0.95 + wob, a));
        col = mix(col, uFoam, foam * 0.9 * (1.0 - vFade));

        // 6) Spring: water wells up in a bubbling white core and spreads out in rings
        float boil = vnoise(vWorld.xz * 0.9 + floor(uTime * 6.0) * 3.1);
        float core = 1.0 - smoothstep(1.2, 3.2, sd + (boil - 0.5) * 1.6);
        float rr = (sd - uTime * 3.0) / 3.4;
        float rl = abs(fract(rr) - 0.5);
        float ring = 1.0 - smoothstep(0.07, 0.07 + max(fwidth(rr) * 1.5, 0.02), rl);
        float rings = ring * (1.0 - smoothstep(5.0, 18.0, sd)) * smoothstep(1.5, 3.0, sd);
        col = mix(col, uFoam, spring * max(core * 0.9, rings * 0.7) * (1.0 - far));

        // 7) Sparkles: tiny highlights that blink frame by frame
        vec2 sp = floor(vWorld.xz / 3.0);
        float tw = hash21(sp + floor(uTime * 2.0));
        vec2 sc = fract(vWorld.xz / 3.0) - 0.5;
        float star = 1.0 - smoothstep(0.03, 0.09, abs(sc.x) + abs(sc.y));
        col = mix(col, uFoam, star * step(0.93, tw) * (1.0 - far) * smoothstep(0.2, 0.5, centre));

        // 8) Mouth: the colour turns into the light coastal sea before the water breaks up
        col = mix(col, uShallow, smoothstep(0.0, 0.5, vFade));

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
        gl_FragColor.a = 0.0; // marks it as ground for the ink pass (light outlines only)
      }
    `,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = 1

  let clock = 0
  return {
    mesh,
    update(dt: number) {
      clock += dt
      material.uniforms.uTime.value = Math.floor(clock * ANIM_FPS) / ANIM_FPS
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}

/**
 * Adds cross sections past a mouth end until the ribbon is well into the sea. Returns false if
 * the sea is not within MOUTH_SEARCH sections of the end (then it is not really a mouth here).
 */
function extendIntoSea(run: Run, side: 0 | 1, isSea: (x: number, z: number) => boolean): boolean {
  const n = run.pts.length
  const end = side === 0 ? 0 : n - 1
  const [tx, tz] = tangent(run.pts, end)
  const dir = side === 0 ? -1 : 1
  const [ex, ez] = run.pts[end]
  const added: XZ[] = []
  let seaCount = 0
  for (let k = 1; seaCount < MOUTH_SEA_SECTIONS; k++) {
    const p: XZ = [ex + tx * STEP * k * dir, ez + tz * STEP * k * dir]
    if (isSea(p[0], p[1])) seaCount++
    else if (seaCount > 0) break // back on land (a narrow inlet): stop here
    else if (k > MOUTH_SEARCH) return false
    added.push(p)
  }
  const hw = run.hw[end]
  if (side === 0) {
    run.pts.unshift(...added.reverse())
    run.hw.unshift(...added.map(() => hw))
    run.sea.unshift(...added.map(() => true))
  } else {
    run.pts.push(...added)
    run.hw.push(...added.map(() => hw))
    run.sea.push(...added.map(() => true))
  }
  return true
}

function reverseRun(run: Run) {
  run.pts.reverse()
  run.hw.reverse()
  run.sea.reverse()
  run.kinds = [run.kinds[1], run.kinds[0]]
}

/** Bed, water level and mouth fade of a run (already oriented upstream → downstream). */
function computeLevels(run: Run, ground: RiverGround) {
  const n = run.pts.length
  run.bed = run.pts.map(([x, z], i) => (run.sea[i] ? SEA_Y : ground.heightAt(x, z)))
  const depth = run.hw.map((h) => channelDepth(h / UNITS_PER_KM))
  // Smoothed bed + a share of the channel depth, always kept inside the channel
  run.level = run.bed.map((_, i) => {
    let sum = 0, cnt = 0
    for (let k = Math.max(0, i - LEVEL_SMOOTH); k <= Math.min(n - 1, i + LEVEL_SMOOTH); k++) {
      sum += run.bed[k]
      cnt++
    }
    const y = sum / cnt + depth[i] * WATER_LEVEL
    return Math.min(run.bed[i] + depth[i] * 0.85, Math.max(run.bed[i] + depth[i] * 0.2, y))
  })
  // Never above the natural ground on both sides (no water floating over flat ground)
  for (let i = 0; i < n; i++) {
    if (run.sea[i]) continue
    const [x, z] = run.pts[i]
    const [tx, tz] = tangent(run.pts, i)
    const off = run.hw[i] * WIDTH_FACTOR + BANK_PROBE
    const bank = Math.max(ground.heightAt(x - tz * off, z + tx * off), ground.heightAt(x + tz * off, z - tx * off))
    run.level[i] = Math.min(run.level[i], bank)
  }
  // Water runs downhill (the carve follows the same rule, see riverProfiles), but never sinks to
  // the bed: one low spot (a bank lowered by a nearby channel) must not drain the river below it
  for (let i = 1; i < n; i++) {
    if (run.sea[i]) continue
    run.level[i] = Math.max(Math.min(run.level[i], run.level[i - 1]), Math.min(run.level[i], run.bed[i] + depth[i] * 0.2))
  }
  // Mouths: the last stretch glides down to the sea surface (no rapids) and, from the coast on,
  // fades into the sea
  run.fade = new Array(n).fill(0)
  run.calm = new Array(n).fill(false)
  if (run.kinds[1] === 'mouth') {
    const seaY = SEA_Y + MOUTH_LEVEL
    let coast = run.sea.indexOf(true)
    if (coast < 0) coast = n - 1
    const rampStart = Math.max(0, coast - MOUTH_RAMP)
    const top = run.level[rampStart]
    for (let i = rampStart; i < n; i++) {
      const t = smooth(rampStart, coast, i)
      run.level[i] = run.sea[i] ? seaY : Math.max(seaY, Math.min(run.level[i], top + (seaY - top) * t))
      run.calm[i] = true
    }
    let seaLen = 0
    for (let i = coast; i < n - 1; i++) seaLen += Math.hypot(run.pts[i + 1][0] - run.pts[i][0], run.pts[i + 1][1] - run.pts[i][1])
    let dist = 0
    for (let i = coast; i < n; i++) {
      if (i > coast) dist += Math.hypot(run.pts[i][0] - run.pts[i - 1][0], run.pts[i][1] - run.pts[i - 1][1])
      run.fade[i] = smooth(0, Math.max(seaLen, MOUTH_FADE), dist)
    }
  }
  // Fade ends (a little way into a neighbouring country): the water dissolves before the end
  for (const side of [0, 1] as const) {
    if (run.kinds[side] !== 'fade') continue
    let dist = 0
    for (let k = 0; k < n; k++) {
      const i = side === 0 ? k : n - 1 - k
      const j = side === 0 ? i - 1 : i + 1
      if (k > 0) dist += Math.hypot(run.pts[i][0] - run.pts[j][0], run.pts[i][1] - run.pts[j][1])
      if (dist > FADE_END) break
      run.fade[i] = Math.max(run.fade[i], 1 - smooth(0, FADE_END, dist))
    }
  }
}

/** Splits a run where its water would be thinner than MIN_WATER (no channel under it). */
function splitDry(run: Run): Run[] {
  const n = run.pts.length
  // (the glide down to a mouth counts as wet: the bed by the coast is kept a bit above the sea,
  // so the water there dips under it for a moment instead of ending before the beach)
  const wet = run.level.map((y, i) => run.sea[i] || run.calm[i] || y >= run.bed[i] + MIN_WATER)
  if (wet.every(Boolean)) return [run]
  const out: Run[] = []
  let s = -1
  for (let i = 0; i <= n; i++) {
    const w = i < n && wet[i]
    if (w && s < 0) s = i
    if (!w && s >= 0) {
      if (i - s > 1) {
        const pick = <T,>(a: T[]) => a.slice(s, i)
        out.push({
          ...run,
          pts: pick(run.pts),
          hw: pick(run.hw),
          bed: pick(run.bed),
          level: pick(run.level),
          fade: pick(run.fade),
          calm: pick(run.calm),
          sea: pick(run.sea),
          kinds: [s === 0 ? run.kinds[0] : 'cut', i === n ? run.kinds[1] : 'cut'],
        })
      }
      s = -1
    }
  }
  return out
}

/** Lowers the last stretch of each tributary to just under the main river's water where they meet. */
function joinTributaries(runs: Run[]) {
  const CELL = 24
  const grid = new Map<string, { x: number; z: number; level: number; hw: number; run: Run }[]>()
  for (const run of runs) {
    run.pts.forEach(([x, z], i) => {
      if (run.sea[i]) return
      const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`
      let list = grid.get(key)
      if (!list) grid.set(key, (list = []))
      list.push({ x, z, level: run.level[i], hw: run.hw[i], run })
    })
  }
  for (const run of runs) {
    for (const side of [0, 1] as const) {
      if (run.kinds[side] !== 'join') continue
      const n = run.pts.length
      const end = side === 0 ? 0 : n - 1
      const [ex, ez] = run.pts[end]
      let best: { level: number; hw: number } | null = null
      let bestD = Infinity
      const cx = Math.floor(ex / CELL), cz = Math.floor(ez / CELL)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          for (const p of grid.get(`${cx + dx},${cz + dz}`) ?? []) {
            if (p.run === run || p.run.river === run.river) continue
            const d = Math.hypot(p.x - ex, p.z - ez)
            if (d < bestD && d < p.hw * 1.5 + STEP) {
              bestD = d
              best = p
            }
          }
        }
      }
      if (!best) {
        run.kinds[side] = 'cut' // the main river is not drawn here
        continue
      }
      // Blend over the part of the tributary that lies inside the main river's water
      const target = best.level - JOIN_DROP
      const reach = best.hw * 1.3 + STEP
      let dist = 0
      for (let k = 0; k < n; k++) {
        const i = side === 0 ? k : n - 1 - k
        if (k > 0) {
          const j = side === 0 ? i - 1 : i + 1
          dist += Math.hypot(run.pts[i][0] - run.pts[j][0], run.pts[i][1] - run.pts[j][1])
        }
        if (dist > reach) break
        const w = smooth(reach, reach * 0.4, dist)
        run.level[i] = run.level[i] + (target - run.level[i]) * w
      }
    }
  }
}

/** Ribbon strips with a round half-circle fan at each end. */
function buildGeometry(runs: Run[]) {
  const pos: number[] = []
  const across: number[] = []
  const along: number[] = []
  const slope: number[] = []
  const deep: number[] = []
  const halfW: number[] = []
  const fade: number[] = []
  const spring: number[] = []
  const index: number[] = []

  for (const run of runs) {
    const n = run.pts.length
    const springOn = run.kinds[0] === 'source' ? 1 : 0
    const [sx, sz] = run.pts[0]
    let vertexCount = pos.length / 3
    const vertex = (x: number, y: number, z: number, ac: number, al: number, sl: number, w: number, f: number) => {
      pos.push(x, y, z)
      across.push(ac)
      along.push(al)
      slope.push(sl)
      deep.push(run.deepness)
      halfW.push(w)
      fade.push(f)
      spring.push(sx, sz, springOn)
      return vertexCount++
    }

    const dists = [0]
    for (let i = 1; i < n; i++) dists.push(dists[i - 1] + Math.hypot(run.pts[i][0] - run.pts[i - 1][0], run.pts[i][1] - run.pts[i - 1][1]))
    const drops = run.level.map((_, i) => run.calm[i] ? 0 : Math.max(0, (run.level[Math.max(0, i - 1)] - run.level[Math.min(n - 1, i + 1)]) / (STEP * 2)))
    // Strip: two vertices per cross section (side -1, side +1)
    const sides: [number, number][] = []
    for (let i = 0; i < n; i++) {
      const [x, z] = run.pts[i]
      const [tx, tz] = tangent(run.pts, i)
      const w = run.hw[i] * WIDTH_FACTOR
      const a = vertex(x + tz * w, run.level[i], z - tx * w, -1, dists[i], drops[i], w, run.fade[i])
      const b = vertex(x - tz * w, run.level[i], z + tx * w, 1, dists[i], drops[i], w, run.fade[i])
      sides.push([a, b])
      if (i > 0) {
        const [pa, pb] = sides[i - 1]
        index.push(pa, pb, a, pb, b, a)
      }
    }
    // Round ends: a half circle from the +1 side, around the outer tip, to the -1 side
    for (const end of [0, n - 1]) {
      const [x, z] = run.pts[end]
      const [tx, tz] = tangent(run.pts, end)
      const out = end === 0 ? -1 : 1
      const w = run.hw[end] * WIDTH_FACTOR
      const y = run.level[end]
      const f = run.fade[end]
      const centre = vertex(x, y, z, 0, dists[end], drops[end], w, f)
      const rim: number[] = [sides[end][1]]
      const half = CAP_SEGMENTS / 2
      for (let k = 1; k < CAP_SEGMENTS; k++) {
        const phi = (k / CAP_SEGMENTS) * Math.PI
        const c = Math.cos(phi), s = Math.sin(phi)
        // perpendicular (+1 side) is (-tz, tx); outward is the tangent times `out`
        const px = -tz * c + tx * out * s
        const pz = tx * c + tz * out * s
        const al = dists[end] + out * w * s
        if (k === half) {
          // the tip is split in two so each half keeps one "edge side" (clean foam line)
          rim.push(vertex(x + px * w, y, z + pz * w, 1, al, drops[end], w, f))
          rim.push(vertex(x + px * w, y, z + pz * w, -1, al, drops[end], w, f))
        } else {
          rim.push(vertex(x + px * w, y, z + pz * w, k < half ? 1 : -1, al, drops[end], w, f))
        }
      }
      rim.push(sides[end][0])
      for (let k = 0; k < rim.length - 1; k++) {
        if (k === half) continue // between the two tip copies
        index.push(centre, rim[k], rim[k + 1])
      }
    }
  }
  return { pos, across, along, slope, deep, halfW, fade, spring, index }
}
