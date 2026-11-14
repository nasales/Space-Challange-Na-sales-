// Main roads as comic toy roads: a ribbon that lies on the terrain (same technique as the river
// water in scene/createRivers.ts) painted by a shader with flat colour bands, crisp anti-aliased
// lines, soft Ben-Day halftone shading near the kerbs and, on motorways, rare comic "speed
// glints" sliding along the lanes, stepped "on twos" (12 fps) like the rivers.
// - Motorways (rank 1): two carriageways with a grass median, white edge lines and dashed lanes.
// - Primary roads (rank 2): one carriageway with a dashed white centre line.
// - Each side has a skirt: an earthy embankment where the road is raised over the terrain, and
//   the stone fascia of the deck slab on a bridge.
// - Bridges get white parapets with red posts and stone piers standing in the river bed.
// The road also answers placement and walking queries: nearRoad (houses, trees) and surfaceAt
// (the detective walks on the deck and over bridges).
import * as THREE from 'three'
import { toonMaterial } from '../scene/toonGradient'
import type { Road } from './roadData'
import { layoutRoads, validateRoads, isClosed, tangent, STEP, SLAB, type RoadGround, type RoadRun } from './layoutRoads'

/** Animation frame rate: comic "on twos" stepping, as the rivers. */
const ANIM_FPS = 12
/** Longest piece of road in one geometry chunk (cross sections) and the culling tile (world units). */
const PIECE = 160
const TILE = 1600
/** Skirts lean outward by this share of their height (embankment slope), up to EMBANK_MAX units. */
const EMBANK_SLOPE = 0.7
const EMBANK_MAX = 3.5
/** Bridge parts (world units). */
const PARAPET_H = 1.1
const PARAPET_W = 0.55
const POST_EVERY = 3 // cross sections between two parapet posts
const PIER_EVERY = 26 // world units between two piers on long bridges
const COLORS = {
  parapet: 0xfaf6ee,
  post: 0xe2483b,
  pier: 0xd9ccae,
}
/** Grid cell (world units) of the road lookup used by nearRoad / surfaceAt. */
const LOOKUP_CELL = 24

export interface Roads {
  group: THREE.Group
  /** Height of the road deck at (x, z), or -Infinity off the roads. */
  surfaceAt: (x: number, z: number) => number
  /** true if (x, z) is on a road or within `margin` world units of its edge. */
  nearRoad: (x: number, z: number, margin: number) => boolean
  /** Every laid-out run (debug and tests). */
  runs: RoadRun[]
  update: (dt: number) => void
  dispose: () => void
}

const vertexShader = /* glsl */ `
  attribute float aAcross;
  attribute float aAlong;
  attribute float aRank;
  attribute float aSkirt;
  attribute float aBridge;
  varying float vAcross;
  varying float vAlong;
  varying float vRank;
  varying float vSkirt;
  varying float vBridge;
  varying vec3 vWorld;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vAcross = aAcross;
    vAlong = aAlong;
    vRank = aRank;
    vSkirt = aSkirt;
    vBridge = aBridge;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uAsphalt;
  uniform vec3 uAsphaltLight;
  uniform vec3 uKerb;
  uniform vec3 uLine;
  uniform vec3 uMedian;
  uniform vec3 uBank;
  uniform vec3 uBankDark;
  uniform vec3 uStone;
  uniform vec3 uStoneDark;
  varying float vAcross;
  varying float vAlong;
  varying float vRank;
  varying float vSkirt;
  varying float vBridge;
  varying vec3 vWorld;
  #include <common>
  #include <fog_pars_fragment>

  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // crisp but anti-aliased step (same as the rivers)
  float band(float edge, float v) { float w = max(fwidth(v), 1e-4); return smoothstep(edge - w, edge + w, v); }
  // a crisp stripe of half width w around c (in the units of v)
  float stripe(float v, float c, float w) { return band(c - w, v) * (1.0 - band(c + w, v)); }

  void main() {
    mat2 rot = mat2(0.7071, -0.7071, 0.7071, 0.7071);
    vec2 hp = rot * vWorld.xz / 1.6;
    float far = smoothstep(0.25, 0.6, fwidth(hp.x)); // 1 when the details get smaller than a pixel
    vec3 col;

    if (vSkirt > 0.5) {
      // ---- Side skirt: earthy embankment, or the stone fascia of a bridge slab ----
      float t = clamp(vAcross, 0.0, 1.0); // 0 at the deck edge, 1 at the bottom
      vec3 bank = mix(uBank, uBankDark, band(0.55, t));
      float joint = stripe(fract(vAlong / 6.0), 0.5, 0.025) * (1.0 - far); // panel joints
      vec3 stone = mix(uStone, uStoneDark, max(band(0.72, t), joint * 0.8));
      col = mix(bank, stone, vBridge);
      col = mix(col, uKerb, 1.0 - band(0.1, t)); // dark lip under the deck edge
      // halftone dots darken the lower part (comic print shading)
      vec2 cell = fract(hp) - 0.5;
      float dotR = 0.4 * smoothstep(0.2, 1.0, t);
      float d = length(cell);
      float dw = max(fwidth(d), 1e-4);
      float dots = mix(1.0 - smoothstep(dotR - dw, dotR + dw, d), dotR * dotR * 2.5, far);
      col = mix(col, col * 0.78, dots);
    } else {
      float a = vAcross;           // -1 .. 1 across the deck
      float aa = abs(a);
      bool motorway = vRank < 1.5;

      // 1) Flat asphalt with a lighter worn band in the middle of each carriageway
      col = uAsphalt;
      float worn = motorway ? stripe(aa, 0.5, 0.2) : (1.0 - band(0.55, aa));
      col = mix(col, uAsphaltLight, worn * 0.55);

      // 2) Halftone dots: soft comic shading toward the kerbs
      vec2 cell = fract(hp) - 0.5;
      float dotR = 0.36 * smoothstep(0.55, 0.95, aa);
      float d = length(cell);
      float dw = max(fwidth(d), 1e-4);
      float dots = mix(1.0 - smoothstep(dotR - dw, dotR + dw, d), dotR * dotR * 2.5, far);
      col = mix(col, col * 0.8, dots);

      // 3) Painted lines (crisp, anti-aliased), faded out when they get thinner than a pixel
      float lines = 0.0;
      float dashLen = motorway ? 7.0 : 6.0;
      float dash = band(0.22, abs(fract(vAlong / dashLen) - 0.5)); // triangle wave: no seam at the wrap
      if (motorway) {
        lines = max(lines, stripe(aa, 0.84, 0.025));                      // edge lines
        lines = max(lines, stripe(aa, 0.155, 0.022));                     // median edge lines
        lines = max(lines, stripe(aa, 0.5, 0.022) * dash);                // lane separators
      } else {
        lines = max(lines, stripe(aa, 0.82, 0.035));                      // edge lines
        lines = max(lines, (1.0 - band(0.045, aa)) * dash);               // dashed centre line
      }
      col = mix(col, uLine, lines * (1.0 - far * 0.7));

      // 4) Motorway median: a strip of grass with a darker crisp border
      if (motorway) {
        float med = 1.0 - band(0.12, aa);
        col = mix(col, uMedian, med);
        col = mix(col, uMedian * 0.7, stripe(aa, 0.12, 0.012) * (1.0 - far));
      }

      // 5) Kerb: a dark crisp band along both edges (reads as the road outline)
      col = mix(col, uKerb, band(0.93, aa));

      // 6) Speed glints (motorways only): rare short white comic streaks sliding along the lanes,
      //    each carriageway in its own direction, stepped on twos by uTime
      if (motorway) {
        float dir = sign(a);
        float lanePos = fract((aa - 0.2) / 0.6 * 2.0);        // two lanes per carriageway
        float laneId = floor((aa - 0.2) / 0.6 * 2.0) + (dir > 0.0 ? 2.0 : 0.0);
        float s = (vAlong * dir - uTime * 70.0) / 46.0 + laneId * 7.31;
        float seg = floor(s);
        float on = step(0.86, hash21(vec2(seg, laneId)));
        float fs = fract(s);
        float body = smoothstep(0.0, 0.08, fs) * (1.0 - smoothstep(0.12, 0.2, fs)); // tapered streak
        float thick = 0.09 * body;
        float lv = abs(lanePos - 0.5);
        float glint = (1.0 - smoothstep(thick, thick + max(fwidth(lanePos) * 1.2, 0.02), lv))
                    * on * step(0.2, aa) * step(aa, 0.8) * (1.0 - far);
        col = mix(col, vec3(1.0), glint * 0.9);
      }
    }

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
    gl_FragColor.a = 0.0; // marks it as ground for the ink pass (light outlines only)
  }
`

const rgbHex = (h: string) => new THREE.Color(h) // hex colours are sRGB; three converts them

/** Builds the ribbon (deck + skirts) of one piece of a run [s, e]. */
function buildRibbon(run: RoadRun, s: number, e: number, out: RibbonBuffers) {
  const { pts, y, bottom, bridge, hw } = run
  const rank = run.rank
  let vc = out.pos.length / 3
  const vertex = (x: number, yy: number, z: number, across: number, along: number, skirt: number, br: number) => {
    out.pos.push(x, yy, z)
    out.across.push(across)
    out.along.push(along)
    out.rank.push(rank)
    out.skirt.push(skirt)
    out.bridge.push(br)
    return vc++
  }
  // distance along the run (so dashes stay continuous across pieces)
  const dist = (i: number) => i * STEP
  let prev: number[] | null = null
  for (let i = s; i <= e; i++) {
    const [x, z] = pts[i]
    const [tx, tz] = tangent(pts, i)
    const nx = -tz, nz = tx // left normal
    const yi = y[i]
    // A bridge flag that blends over one section at each end, so the fascia does not pop
    const br = bridge[i]
    const drop = yi - bottom[i]
    const lean = br ? 0 : Math.min(EMBANK_MAX, drop * EMBANK_SLOPE)
    const lx = x + nx * hw, lz = z + nz * hw
    const rx = x - nx * hw, rz = z - nz * hw
    const al = dist(i)
    const ids = [
      vertex(lx, yi, lz, -1, al, 0, br), // 0 deck left
      vertex(rx, yi, rz, 1, al, 0, br), // 1 deck right
      vertex(lx, yi, lz, 0, al, 1, br), // 2 skirt left top
      vertex(lx + nx * lean, bottom[i], lz + nz * lean, 1, al, 1, br), // 3 skirt left bottom
      vertex(rx, yi, rz, 0, al, 1, br), // 4 skirt right top
      vertex(rx - nx * lean, bottom[i], rz - nz * lean, 1, al, 1, br), // 5 skirt right bottom
    ]
    if (prev) {
      const p = prev
      out.index.push(p[0], p[1], ids[0], p[1], ids[1], ids[0])
      out.index.push(p[2], ids[2], p[3], p[3], ids[2], ids[3])
      out.index.push(p[4], p[5], ids[4], p[5], ids[5], ids[4])
    }
    prev = ids
  }
  // Squared ends of the run: close the skirt across the end so no hole shows
  for (const end of [s, e]) {
    if ((end !== 0 && end !== pts.length - 1) || isClosed(pts)) continue // a closed loop has no ends
    const [x, z] = pts[end]
    const [tx, tz] = tangent(pts, end)
    const nx = -tz, nz = tx
    const al = dist(end)
    const a = vertex(x + nx * hw, y[end], z + nz * hw, 0, al, 1, bridge[end])
    const b = vertex(x - nx * hw, y[end], z - nz * hw, 0, al, 1, bridge[end])
    const c = vertex(x - nx * hw, bottom[end], z - nz * hw, 1, al, 1, bridge[end])
    const d = vertex(x + nx * hw, bottom[end], z + nz * hw, 1, al, 1, bridge[end])
    out.index.push(a, b, c, a, c, d)
  }
}

interface RibbonBuffers {
  pos: number[]
  across: number[]
  along: number[]
  rank: number[]
  skirt: number[]
  bridge: number[]
  index: number[]
}

const newBuffers = (): RibbonBuffers => ({ pos: [], across: [], along: [], rank: [], skirt: [], bridge: [], index: [] })

/** Flat-shaded boxes and strips with vertex colours, for the bridge parts (one merged mesh). */
function createSolidBuilder() {
  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  const c = new THREE.Color()
  const quad = (p: THREE.Vector3[], color: number) => {
    const n = new THREE.Vector3().subVectors(p[1], p[0]).cross(new THREE.Vector3().subVectors(p[2], p[0])).normalize()
    c.setHex(color)
    for (const k of [0, 1, 2, 0, 2, 3]) {
      pos.push(p[k].x, p[k].y, p[k].z)
      nor.push(n.x, n.y, n.z)
      col.push(c.r, c.g, c.b)
    }
  }
  /** Box from a centre, half sizes and a horizontal direction (dx, dz) for its length axis. */
  const box = (cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, dx: number, dz: number, color: number) => {
    const ux = dx, uz = dz // length axis
    const vx = -dz, vz = dx // width axis
    const corner = (sx: number, sy: number, sz: number) =>
      new THREE.Vector3(cx + ux * hx * sx + vx * hz * sz, cy + hy * sy, cz + uz * hx * sx + vz * hz * sz)
    const P = [
      corner(-1, -1, -1), corner(1, -1, -1), corner(1, -1, 1), corner(-1, -1, 1),
      corner(-1, 1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(-1, 1, 1),
    ]
    quad([P[4], P[7], P[6], P[5]], color) // top
    quad([P[0], P[1], P[5], P[4]], color)
    quad([P[1], P[2], P[6], P[5]], color)
    quad([P[2], P[3], P[7], P[6]], color)
    quad([P[3], P[0], P[4], P[7]], color)
  }
  const build = () => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.computeBoundingSphere()
    return g
  }
  return { quad, box, build, empty: () => pos.length === 0 }
}

/** Parapets, posts and piers of every bridge of a run. */
function buildBridgeParts(run: RoadRun, solid: ReturnType<typeof createSolidBuilder>) {
  const { pts, y, hw, ground } = run
  for (const { a, b } of run.bridges) {
    // Parapets: a low wall just outside each deck edge, following the deck
    for (const side of [1, -1]) {
      const off = hw + PARAPET_W / 2
      const at = (i: number) => {
        const [tx, tz] = tangent(pts, i)
        return { x: pts[i][0] - tz * off * side, z: pts[i][1] + tx * off * side, tx, tz }
      }
      for (let i = a; i < b; i++) {
        const p = at(i), q = at(i + 1)
        const nx = -p.tz * side * (PARAPET_W / 2), nz = p.tx * side * (PARAPET_W / 2)
        const nqx = -q.tz * side * (PARAPET_W / 2), nqz = q.tx * side * (PARAPET_W / 2)
        const y0 = y[i] - 0.2, y1 = y[i + 1] - 0.2
        const t0 = y[i] + PARAPET_H, t1 = y[i + 1] + PARAPET_H
        const V = (x: number, yy: number, z: number) => new THREE.Vector3(x, yy, z)
        // outer face, inner face, top (winding does not matter much: the material is double sided)
        solid.quad([V(p.x + nx, y0, p.z + nz), V(q.x + nqx, y1, q.z + nqz), V(q.x + nqx, t1, q.z + nqz), V(p.x + nx, t0, p.z + nz)], COLORS.parapet)
        solid.quad([V(q.x - nqx, y1, q.z - nqz), V(p.x - nx, y0, p.z - nz), V(p.x - nx, t0, p.z - nz), V(q.x - nqx, t1, q.z - nqz)], COLORS.parapet)
        solid.quad([V(p.x - nx, t0, p.z - nz), V(p.x + nx, t0, p.z + nz), V(q.x + nqx, t1, q.z + nqz), V(q.x - nqx, t1, q.z - nqz)], COLORS.parapet)
      }
      // Posts: little red blocks along the parapet, and bigger ones at both ends of the bridge
      for (let i = a; i <= b; i++) {
        const endPost = i === a || i === b
        if (!endPost && (i - a) % POST_EVERY !== 0) continue
        const p = at(i)
        const s = endPost ? 0.75 : 0.45
        const h = endPost ? PARAPET_H + 0.7 : PARAPET_H + 0.25
        solid.box(p.x, y[i] - 0.2 + h / 2, p.z, s, h / 2, s, p.tx, p.tz, endPost ? COLORS.post : i % (POST_EVERY * 2) === 0 ? COLORS.post : COLORS.parapet)
      }
    }
    // Piers: stone blocks from under the slab down into the river bed, on longer bridges
    const span = (b - a) * STEP
    if (span < 22) continue
    const count = Math.max(1, Math.round(span / PIER_EVERY) - 1)
    for (let k = 1; k <= count; k++) {
      const i = Math.round(a + ((b - a) * k) / (count + 1))
      const [tx, tz] = tangent(pts, i)
      const top = y[i] - SLAB
      const bottomY = Math.min(ground[i], top) - 1.5
      if (top - bottomY < 0.8) continue
      solid.box(pts[i][0], (top + bottomY) / 2, pts[i][1], 1.1, (top - bottomY) / 2, hw * 0.8, tx, tz, COLORS.pier)
    }
  }
}

/**
 * Lays out and builds the roads of one zone.
 * @param roads the roads of the zone (roadsInBounds)
 * @param ground terrain queries, the zone's drawn rivers and the monuments to avoid
 */
export function createRoads(roads: Road[], ground: RoadGround): Roads {
  const runs = layoutRoads(roads, ground)
  // Development check: the planned route must need no safety net (no water, sea or monuments)
  if (import.meta.env.DEV && runs.length) console.info('[roads]', validateRoads(runs, ground))
  const group = new THREE.Group()

  const material = new THREE.ShaderMaterial({
    fog: true,
    side: THREE.DoubleSide, // skirts and end caps are built without caring about winding
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uAsphalt: { value: rgbHex('#545A76') }, // cool slate-violet toy asphalt
        uAsphaltLight: { value: rgbHex('#6A7194') },
        uKerb: { value: rgbHex('#2E2F45') },
        uLine: { value: rgbHex('#FFFFFF') },
        uMedian: { value: rgbHex('#7CBA47') }, // palette.ts mid-zone green
        uBank: { value: rgbHex('#E2C07E') }, // sandy embankment
        uBankDark: { value: rgbHex('#C69A5C') },
        uStone: { value: rgbHex('#EFE6CF') }, // bridge fascia
        uStoneDark: { value: rgbHex('#C9BB98') },
      },
    ]),
    vertexShader,
    fragmentShader,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  })

  // Ribbons grouped by tile, so three.js can skip the ones out of view
  const tiles = new Map<string, RibbonBuffers>()
  for (const run of runs) {
    for (let s = 0; s < run.pts.length - 1; s += PIECE) {
      const e = Math.min(run.pts.length - 1, s + PIECE)
      const mid = run.pts[(s + e) >> 1]
      const key = `${Math.floor(mid[0] / TILE)},${Math.floor(mid[1] / TILE)}`
      let buf = tiles.get(key)
      if (!buf) tiles.set(key, (buf = newBuffers()))
      buildRibbon(run, s, e, buf)
    }
  }
  const geometries: THREE.BufferGeometry[] = []
  for (const buf of tiles.values()) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3))
    g.setAttribute('aAcross', new THREE.Float32BufferAttribute(buf.across, 1))
    g.setAttribute('aAlong', new THREE.Float32BufferAttribute(buf.along, 1))
    g.setAttribute('aRank', new THREE.Float32BufferAttribute(buf.rank, 1))
    g.setAttribute('aSkirt', new THREE.Float32BufferAttribute(buf.skirt, 1))
    g.setAttribute('aBridge', new THREE.Float32BufferAttribute(buf.bridge, 1))
    g.setIndex(buf.index)
    g.computeBoundingSphere()
    geometries.push(g)
    const mesh = new THREE.Mesh(g, material)
    mesh.renderOrder = 1
    group.add(mesh)
  }

  // Bridge parts: one merged toon mesh (full ink outlines, like the other objects)
  const solid = createSolidBuilder()
  for (const run of runs) buildBridgeParts(run, solid)
  const bridgeMaterial = toonMaterial(0xffffff, { vertexColors: true, side: THREE.DoubleSide })
  if (!solid.empty()) {
    const g = solid.build()
    geometries.push(g)
    const mesh = new THREE.Mesh(g, bridgeMaterial)
    mesh.castShadow = mesh.receiveShadow = true
    group.add(mesh)
  }

  // ---- Lookup grid of road segments (nearRoad / surfaceAt) ----
  interface Seg {
    run: RoadRun
    i: number
  }
  const lookup = new Map<string, Seg[]>()
  for (const run of runs) {
    for (let i = 0; i < run.pts.length - 1; i++) {
      const [ax, az] = run.pts[i], [bx, bz] = run.pts[i + 1]
      const r = run.hw
      const c0 = Math.floor((Math.min(ax, bx) - r) / LOOKUP_CELL), c1 = Math.floor((Math.max(ax, bx) + r) / LOOKUP_CELL)
      const r0 = Math.floor((Math.min(az, bz) - r) / LOOKUP_CELL), r1 = Math.floor((Math.max(az, bz) + r) / LOOKUP_CELL)
      for (let c = c0; c <= c1; c++) {
        for (let rr = r0; rr <= r1; rr++) {
          const key = `${c},${rr}`
          let list = lookup.get(key)
          if (!list) lookup.set(key, (list = []))
          list.push({ run, i })
        }
      }
    }
  }
  /** Calls fn(distance to centre line, deck y, half width) for each segment near (x, z). */
  const visit = (x: number, z: number, reach: number, fn: (d: number, y: number, hw: number) => boolean | void) => {
    const c0 = Math.floor((x - reach) / LOOKUP_CELL), c1 = Math.floor((x + reach) / LOOKUP_CELL)
    const r0 = Math.floor((z - reach) / LOOKUP_CELL), r1 = Math.floor((z + reach) / LOOKUP_CELL)
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        for (const { run, i } of lookup.get(`${c},${r}`) ?? []) {
          const [ax, az] = run.pts[i], [bx, bz] = run.pts[i + 1]
          const dx = bx - ax, dz = bz - az
          const len2 = dx * dx + dz * dz || 1e-9
          const t = Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len2))
          const d = Math.hypot(x - ax - dx * t, z - az - dz * t)
          if (fn(d, run.y[i] + (run.y[i + 1] - run.y[i]) * t, run.hw)) return
        }
      }
    }
  }

  const geometryAndMaterials = { geometries, material, bridgeMaterial }
  let clock = 0
  return {
    group,
    runs,
    surfaceAt(x, z) {
      let top = -Infinity
      visit(x, z, 0, (d, yy, hw) => {
        if (d <= hw && yy > top) top = yy
      })
      return top
    },
    nearRoad(x, z, margin) {
      let hit = false
      visit(x, z, margin, (d, _y, hw) => (hit = d <= hw + margin))
      return hit
    },
    update(dt) {
      clock += dt
      material.uniforms.uTime.value = Math.floor(clock * ANIM_FPS) / ANIM_FPS
    },
    dispose() {
      for (const g of geometryAndMaterials.geometries) g.dispose()
      geometryAndMaterials.material.dispose()
      geometryAndMaterials.bridgeMaterial.dispose()
    },
  }
}
