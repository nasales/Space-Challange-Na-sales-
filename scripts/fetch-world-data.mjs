// Descarga UNA VEZ los datos del mundo "sin explorar" y los guarda en public/maps/.
//
//   node scripts/fetch-world-data.mjs
//
// Genera:
//   - world-height.bin    : alturas del mundo entero a baja resolución (Int16, m, de norte a sur).
//   - world-map.json      : límites y tamaño de la rejilla.
//   - world-countries.json: fronteras de todos los países (Natural Earth 1:50m), simplificadas.
//                           Sirven para recortar el país explorado y, más adelante, para elegir país.

import { mkdirSync, writeFileSync } from 'node:fs'
import { decodePng } from './lib/png.mjs'

const OUT_DIR = 'public/maps'
const BOUNDS = { west: -180, east: 180, south: -85, north: 85 } // Mercator no llega a los polos
const GRID_WIDTH = 1440 // 0,25º por celda (≈ 25 km): de sobra para un mundo gris
const ZOOM = 3 // 8x8 teselas = 2048 px de ancho

mkdirSync(OUT_DIR, { recursive: true })

// ---------- 1) Alturas del mundo ----------
async function fetchWorldHeights() {
  const n = 2 ** ZOOM
  const tiles = new Map()
  await Promise.all(
    Array.from({ length: n * n }, async (_, k) => {
      const tx = k % n, ty = Math.floor(k / n)
      const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZOOM}/${tx}/${ty}.png`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Tesela ${tx}/${ty} falló: ${res.status}`)
      tiles.set(`${tx}/${ty}`, decodePng(Buffer.from(await res.arrayBuffer())))
    }),
  )
  console.log(`✓ ${tiles.size} teselas de altura del mundo`)

  const worldSize = 256 * n
  const heightAtPx = (px, py) => {
    px = ((px % worldSize) + worldSize) % worldSize // el mundo da la vuelta en longitud
    py = Math.min(worldSize - 1, Math.max(0, py))
    const tx = Math.floor(px / 256), ty = Math.floor(py / 256)
    const t = tiles.get(`${tx}/${ty}`)
    const i = ((py - ty * 256) * 256 + (px - tx * 256)) * t.bpp
    return t.pixels[i] * 256 + t.pixels[i + 1] + t.pixels[i + 2] / 256 - 32768
  }

  const lonSpan = BOUNDS.east - BOUNDS.west, latSpan = BOUNDS.north - BOUNDS.south
  const gridHeight = Math.round((GRID_WIDTH * latSpan) / lonSpan)
  const heights = new Int16Array(GRID_WIDTH * gridHeight)
  for (let row = 0; row < gridHeight; row++) {
    const lat = BOUNDS.north - ((row + 0.5) / gridHeight) * latSpan
    const r = (lat * Math.PI) / 180
    const py = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * worldSize - 0.5
    for (let col = 0; col < GRID_WIDTH; col++) {
      const lon = BOUNDS.west + ((col + 0.5) / GRID_WIDTH) * lonSpan
      const px = ((lon + 180) / 360) * worldSize - 0.5
      const fx = Math.floor(px), fy = Math.floor(py), dx = px - fx, dy = py - fy
      const h =
        heightAtPx(fx, fy) * (1 - dx) * (1 - dy) +
        heightAtPx(fx + 1, fy) * dx * (1 - dy) +
        heightAtPx(fx, fy + 1) * (1 - dx) * dy +
        heightAtPx(fx + 1, fy + 1) * dx * dy
      heights[row * GRID_WIDTH + col] = Math.round(h)
    }
  }
  writeFileSync(`${OUT_DIR}/world-height.bin`, Buffer.from(heights.buffer))
  writeFileSync(
    `${OUT_DIR}/world-map.json`,
    JSON.stringify(
      {
        bounds: BOUNDS,
        height: { file: 'world-height.bin', width: GRID_WIDTH, height: gridHeight, type: 'int16', units: 'm' },
        source: 'AWS Terrain Tiles (Terrarium, SRTM y otros)',
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`✓ alturas del mundo ${GRID_WIDTH}x${gridHeight}`)
}

// ---------- 2) Fronteras de los países ----------
async function fetchCountries() {
  const url =
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'
  const geo = await (await fetch(url)).json()
  const round = (ring) => ring.map(([lon, lat]) => [+lon.toFixed(3), +lat.toFixed(3)])
  const countries = geo.features.map((f) => {
    const p = f.properties
    const g = f.geometry
    // Siempre como lista de polígonos; cada polígono = [anillo exterior, ...agujeros]
    const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
    return {
      id: p.ADM0_A3, // código de 3 letras, p. ej. "ESP"
      iso2: p.ISO_A2_EH, // código de 2 letras, p. ej. "ES" (lo usa GeoNames)
      name: p.NAME_ES || p.NAME,
      polygons: polygons.map((poly) => poly.map(round)),
    }
  })
  const json = JSON.stringify({ source: 'Natural Earth 1:50m (dominio público)', countries })
  writeFileSync(`${OUT_DIR}/world-countries.json`, json)
  console.log(`✓ ${countries.length} países (${(json.length / 1e6).toFixed(1)} MB)`)
}

await Promise.all([fetchWorldHeights(), fetchCountries()])
