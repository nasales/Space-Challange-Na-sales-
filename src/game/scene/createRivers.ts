// Rivers as real water: a flat ribbon of animated cartoon water lying inside each carved channel.
// The look is comic-book (flat colour bands, halftone dots in the deep middle, white current
// streaks, foam on rapids, motion "on twos") and every river shows its own size: big rivers are
// deep navy and flow slowly and heavily; small ones are shallow, clear and quick.
import * as THREE from 'three'
import type { River } from '../map/mapData'
import { chaikin, channelDepth, riverHalfWidthKm } from '../map/rivers'
import { lonLatToWorld, UNITS_PER_KM } from '../map/projection'
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

interface RiverGround {
  heightAt: (x: number, z: number) => number
  isExploredLand: (x: number, z: number) => boolean
}

const rgb = (c: readonly number[]) => new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace)

/** Resamples a polyline (world x/z) to points STEP apart. */
function resample(pts: [number, number][]): [number, number][] {
  const out: [number, number][] = [pts[0]]
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

/** Splits a centre line into runs of consecutive points that lie on explored land. */
function landRuns(pts: [number, number][], ground: RiverGround): [number, number][][] {
  const runs: [number, number][][] = []
  let run: [number, number][] = []
  for (const p of pts) {
    if (ground.isExploredLand(p[0], p[1])) run.push(p)
    else {
      if (run.length > 1) runs.push(run)
      run = []
    }
  }
  if (run.length > 1) runs.push(run)
  return runs
}

export function createRivers(rivers: River[] | undefined, ground: RiverGround) {
  const pos: number[] = []
  const across: number[] = []
  const along: number[] = []
  const slope: number[] = []
  const deep: number[] = []
  const halfW: number[] = []
  const index: number[] = []

  for (const river of rivers ?? []) {
    const hwKm = riverHalfWidthKm(river.rank)
    const hw = hwKm * UNITS_PER_KM
    const depth = channelDepth(hwKm)
    const deepness = river.rank === 1 ? 1 : river.rank === 2 ? 0.7 : 0.4
    for (const line of river.lines) {
      const world = chaikin(line, 3).map(([lon, lat]) => {
        const p = lonLatToWorld(lon, lat)
        return [p.x, p.z] as [number, number]
      })
      if (world.length < 2) continue
      for (let pts of landRuns(resample(world), ground)) {
        // Flow from the higher end to the lower end
        let bed = pts.map(([x, z]) => ground.heightAt(x, z))
        if (bed[0] < bed[bed.length - 1]) {
          pts = pts.slice().reverse()
          bed = bed.slice().reverse()
        }
        const n = pts.length
        // Water level: smoothed bed + a share of the channel depth, always kept inside the channel
        const level = bed.map((_, i) => {
          let sum = 0, cnt = 0
          for (let k = Math.max(0, i - LEVEL_SMOOTH); k <= Math.min(n - 1, i + LEVEL_SMOOTH); k++) {
            sum += bed[k]
            cnt++
          }
          const y = sum / cnt + depth * WATER_LEVEL
          return Math.min(bed[i] + depth * 0.85, Math.max(bed[i] + depth * 0.2, y))
        })
        const base = pos.length / 3
        let dist = 0
        for (let i = 0; i < n; i++) {
          const [x, z] = pts[i]
          const [px, pz] = pts[Math.max(0, i - 1)]
          const [nx, nz] = pts[Math.min(n - 1, i + 1)]
          let tx = nx - px, tz = nz - pz
          const tl = Math.hypot(tx, tz) || 1
          tx /= tl
          tz /= tl
          if (i > 0) dist += Math.hypot(x - px, z - pz)
          // Drop per unit downstream (rapids where the water runs down a ramp)
          const drop = Math.max(0, (level[Math.max(0, i - 1)] - level[Math.min(n - 1, i + 1)]) / (STEP * 2))
          const w = hw * WIDTH_FACTOR
          for (const side of [-1, 1]) {
            pos.push(x - tz * w * side, level[i], z + tx * w * side)
            across.push(side)
            along.push(dist)
            slope.push(drop)
            deep.push(deepness)
            halfW.push(w)
          }
          if (i < n - 1) {
            const a = base + i * 2
            index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) // counter-clockwise from above
          }
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geometry.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1))
  geometry.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1))
  geometry.setAttribute('aSlope', new THREE.Float32BufferAttribute(slope, 1))
  geometry.setAttribute('aDeep', new THREE.Float32BufferAttribute(deep, 1))
  geometry.setAttribute('aHalfW', new THREE.Float32BufferAttribute(halfW, 1))
  geometry.setIndex(index)
  geometry.computeBoundingSphere()

  const material = new THREE.ShaderMaterial({
    fog: true,
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
      varying float vAcross;
      varying float vAlong;
      varying float vSlope;
      varying float vDeep;
      varying float vHalfW;
      varying vec3 vWorld;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vAcross = aAcross;
        vAlong = aAlong;
        vSlope = aSlope;
        vDeep = aDeep;
        vHalfW = aHalfW;
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
        // a: 0 in the middle, 1 at the channel edge (the ribbon is WIDTH_FACTOR wider)
        float a = abs(vAcross) * ${WIDTH_FACTOR.toFixed(2)};
        float centre = 1.0 - a;                      // 1 in the middle, 0 at the edge
        float rapids = smoothstep(0.05, 0.14, vSlope);
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
        vec2 hp = mat2(0.7071, -0.7071, 0.7071, 0.7071) * vWorld.xz / 2.4;
        vec2 cell = fract(hp) - 0.5;
        float dotR = 0.42 * smoothstep(0.25, 1.0, centre) * vDeep;
        float d = length(cell);
        float dw = max(fwidth(d), 1e-4);
        float dots = 1.0 - smoothstep(dotR - dw, dotR + dw, d);
        float far = smoothstep(0.25, 0.6, fwidth(hp.x));
        dots = mix(dots, dotR * dotR * 2.5, far);
        col = mix(col, col * 0.72, dots * (1.0 - rapids));

        // 3) Current lines: short, thin, tapered comic "speed lines" on wavy lanes, drifting
        //    downstream at the river's own pace (big rivers slow and heavy, small ones quick)
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
        float streak = thin * keep * smoothstep(0.08, 0.3, centre) * (1.0 - far * 0.9);
        col = mix(col, uFoam, streak * 0.8);

        // 4) Rapids: blobs of white water where the river runs down a ramp
        float fn = vnoise(vec2((vAlong - uTime * speed * 0.6) * 0.22, v * 0.3));
        fn = 0.6 * fn + 0.4 * vnoise(vec2((vAlong - uTime * speed * 0.9) * 0.5, v * 0.7));
        float wb = band(mix(0.75, 0.45, rapids), fn);
        col = mix(col, uFoam, wb * rapids * 0.9);

        // 5) Foam line along the banks, wobbling with the current
        float wob = 0.05 * sin(vAlong * 0.35 - uTime * 3.0);
        float foam = band(0.86 + wob, a) * (1.0 - band(0.95 + wob, a));
        col = mix(col, uFoam, foam * 0.9);

        // 6) Sparkles: tiny highlights that blink frame by frame
        vec2 sp = floor(vWorld.xz / 3.0);
        float tw = hash21(sp + floor(uTime * 2.0));
        vec2 sc = fract(vWorld.xz / 3.0) - 0.5;
        float star = 1.0 - smoothstep(0.03, 0.09, abs(sc.x) + abs(sc.y));
        col = mix(col, uFoam, star * step(0.93, tw) * (1.0 - far) * smoothstep(0.2, 0.5, centre));

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
