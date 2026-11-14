// Descarga UNA VEZ los datos detallados de un país y los guarda en public/maps/countries/<ID>/.
// Así la web funciona sin depender de ninguna API en tiempo de ejecución.
//
//   node scripts/fetch-map-data.mjs ESP
//   node scripts/fetch-map-data.mjs ESP --solo-lugares   (solo las poblaciones, sin el relieve)
//
// Requiere haber ejecutado antes scripts/fetch-world-data.mjs (usa las fronteras de los países).
//
// Un país puede tener varias ZONAS (patches) separadas: p. ej. España = Península+Baleares
// y Canarias. Las zonas se detectan solas agrupando los polígonos del país que están cerca.
// Por cada zona se generan:
//   - zone-N-satellite.jpg : imagen de satélite NASA Blue Marble (GIBS), sin nubes.
//   - zone-N-height.bin    : alturas en metros (Int16, fila a fila, de norte a sur).
// Y para el país: meta.json con los límites y tamaños, places.json con sus poblaciones
// (GeoNames, CC BY 4.0) y se actualiza countries/index.json.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { decodePng } from './lib/png.mjs'
import { readZipEntry } from './lib/unzip.mjs'

const id = process.argv[2]?.toUpperCase()
if (!id) throw new Error('Uso: node scripts/fetch-map-data.mjs <CÓDIGO>, p. ej. ESP')
const placesOnly = process.argv.includes('--solo-lugares')

const CELL_KM = 0.6 // tamaño objetivo de cada celda de altura (≈ 600 m)
const MAX_GRID = 2048 // límite de la rejilla, para que países enormes no pesen demasiado
const MAX_SAT = 4096 // tamaño de textura seguro en casi cualquier GPU
const MARGIN_DEG = 0.4 // margen alrededor del país (para la franja de mar de color)
const CLUSTER_DEG = 2 // polígonos a menos de esta distancia van en la misma zona
// Misma escala que la web (src/map/projection.ts): grados de longitud medidos en la latitud 40º
const KM_PER_DEG_LON = 111.32 * Math.cos((40 * Math.PI) / 180)
const KM_PER_DEG_LAT = 110.57

const BASE_DIR = 'public/maps/countries'
const OUT_DIR = `${BASE_DIR}/${id}`

// ---------- Zonas del país ----------
const { countries } = JSON.parse(readFileSync('public/maps/world-countries.json', 'utf8'))
const country = countries.find((c) => c.id === id)
if (!country) throw new Error(`No existe el país ${id} en world-countries.json`)

function ringBounds(ring) {
  const b = { west: Infinity, east: -Infinity, south: Infinity, north: -Infinity }
  for (const [lon, lat] of ring) {
    b.west = Math.min(b.west, lon)
    b.east = Math.max(b.east, lon)
    b.south = Math.min(b.south, lat)
    b.north = Math.max(b.north, lat)
  }
  return b
}
const near = (a, b, d) =>
  a.west - d <= b.east && b.west - d <= a.east && a.south - d <= b.north && b.south - d <= a.north
const union = (a, b) => ({
  west: Math.min(a.west, b.west),
  east: Math.max(a.east, b.east),
  south: Math.min(a.south, b.south),
  north: Math.max(a.north, b.north),
})

// Agrupar: cada polígono empieza solo y se van fusionando los grupos cercanos
let zones = country.polygons.map((poly) => ringBounds(poly[0]))
let merged = true
while (merged) {
  merged = false
  outer: for (let i = 0; i < zones.length; i++) {
    for (let j = i + 1; j < zones.length; j++) {
      if (near(zones[i], zones[j], CLUSTER_DEG)) {
        zones[i] = union(zones[i], zones[j])
        zones.splice(j, 1)
        merged = true
        break outer
      }
    }
  }
}
const area = (b) => (b.east - b.west) * (b.north - b.south)
zones = zones
  .map((b) => ({
    west: +(b.west - MARGIN_DEG).toFixed(3),
    east: +(b.east + MARGIN_DEG).toFixed(3),
    south: +(b.south - MARGIN_DEG).toFixed(3),
    north: +(b.north + MARGIN_DEG).toFixed(3),
  }))
  .sort((a, b) => area(b) - area(a)) // la zona principal (la más grande) primero
console.log(`${country.name}: ${zones.length} zona(s)`)

mkdirSync(OUT_DIR, { recursive: true })

/** fetch con reintentos: si la red falla un momento, espera y vuelve a probar. */
async function fetchRetry(url, tries = 4) {
  for (let k = 1; ; k++) {
    try {
      const res = await fetch(url)
      if (res.ok || k === tries) return res
    } catch (err) {
      if (k === tries) throw err
    }
    await new Promise((r) => setTimeout(r, 1000 * k))
  }
}

// ---------- Satélite: NASA GIBS (WMS) ----------
async function fetchSatellite(bounds, width, height, file) {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.3.0',
    LAYERS: 'BlueMarble_NextGeneration',
    STYLES: '',
    CRS: 'EPSG:4326',
    // En WMS 1.3.0 con EPSG:4326 el orden es lat,lon
    BBOX: `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`,
    WIDTH: String(width),
    HEIGHT: String(height),
    FORMAT: 'image/jpeg',
  })
  const res = await fetchRetry(`https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${params}`)
  const type = res.headers.get('content-type') ?? ''
  if (!res.ok || !type.startsWith('image/')) {
    throw new Error(`GIBS falló (${res.status} ${type}): ${await res.text()}`)
  }
  writeFileSync(`${OUT_DIR}/${file}`, Buffer.from(await res.arrayBuffer()))
}

// ---------- Alturas: teselas Terrarium (AWS Open Data, basadas en SRTM de la NASA) ----------
async function fetchHeights(bounds, width, height, file) {
  // Zoom mínimo cuyo píxel sea como mucho la mitad de una celda (en la latitud central)
  const midLat = (bounds.north + bounds.south) / 2
  let zoom = 1
  while (zoom < 11 && (156543 * Math.cos((midLat * Math.PI) / 180)) / 2 ** zoom > (CELL_KM * 1000) / 2) zoom++

  const worldSize = 256 * 2 ** zoom
  const lonToPx = (lon) => ((lon + 180) / 360) * worldSize
  const latToPx = (lat) => {
    const r = (lat * Math.PI) / 180
    return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * worldSize
  }

  const x0 = Math.floor(lonToPx(bounds.west) / 256), x1 = Math.floor(lonToPx(bounds.east) / 256)
  const y0 = Math.floor(latToPx(bounds.north) / 256), y1 = Math.floor(latToPx(bounds.south) / 256)
  const tiles = new Map()
  const coords = []
  for (let tx = x0; tx <= x1 + 1; tx++) for (let ty = y0; ty <= y1 + 1; ty++) coords.push([tx, ty])
  // De 16 en 16 para no saturar la conexión
  for (let k = 0; k < coords.length; k += 16) {
    await Promise.all(
      coords.slice(k, k + 16).map(async ([tx, ty]) => {
        const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${tx}/${ty}.png`
        const res = await fetchRetry(url)
        if (!res.ok) throw new Error(`Tesela ${zoom}/${tx}/${ty} falló: ${res.status}`)
        tiles.set(`${tx}/${ty}`, decodePng(Buffer.from(await res.arrayBuffer())))
      }),
    )
  }

  // Altura (m) en un píxel global Mercator. Terrarium: h = R*256 + G + B/256 - 32768
  const heightAtPx = (px, py) => {
    const tx = Math.floor(px / 256), ty = Math.floor(py / 256)
    const t = tiles.get(`${tx}/${ty}`)
    const i = ((py - ty * 256) * 256 + (px - tx * 256)) * t.bpp
    return t.pixels[i] * 256 + t.pixels[i + 1] + t.pixels[i + 2] / 256 - 32768
  }

  // Remuestreo bilineal de Mercator a nuestra rejilla lat/lon
  const lonSpan = bounds.east - bounds.west, latSpan = bounds.north - bounds.south
  const heights = new Int16Array(width * height)
  for (let row = 0; row < height; row++) {
    const py = latToPx(bounds.north - ((row + 0.5) / height) * latSpan) - 0.5
    for (let col = 0; col < width; col++) {
      const px = lonToPx(bounds.west + ((col + 0.5) / width) * lonSpan) - 0.5
      const fx = Math.floor(px), fy = Math.floor(py), dx = px - fx, dy = py - fy
      const h =
        heightAtPx(fx, fy) * (1 - dx) * (1 - dy) +
        heightAtPx(fx + 1, fy) * dx * (1 - dy) +
        heightAtPx(fx, fy + 1) * (1 - dx) * dy +
        heightAtPx(fx + 1, fy + 1) * dx * dy
      heights[row * width + col] = Math.round(h)
    }
  }
  writeFileSync(`${OUT_DIR}/${file}`, Buffer.from(heights.buffer))
  return { zoom, tiles: tiles.size }
}

// ---------- Poblaciones (GeoNames) ----------
// GeoNames mezcla idiomas en los nombres de región: los pasamos a castellano.
const REGION_NAMES_ES = {
  ES: {
    Andalusia: 'Andalucía',
    Aragon: 'Aragón',
    Catalunya: 'Cataluña',
    'Comunitat Valenciana': 'Comunidad Valenciana',
    'Comunitat Autònoma de les Illes Balears': 'Islas Baleares',
    'Canary Islands': 'Canarias',
    'Euskal Autonomia Erkidegoa': 'País Vasco',
    'Principality of Asturias': 'Asturias',
  },
}

// Archivo por país con todos los lugares; nos quedamos con las poblaciones de más de 1000 habitantes.
// Columnas: 1 nombre · 4 lat · 5 lon · 6 clase (P = población) · 7 tipo · 10 código de región · 14 habitantes
async function fetchPlaces() {
  const res = await fetchRetry(`https://download.geonames.org/export/dump/${country.iso2}.zip`)
  if (!res.ok) throw new Error(`GeoNames falló: ${res.status}`)
  const text = readZipEntry(Buffer.from(await res.arrayBuffer()), `${country.iso2}.txt`)
  const rows = text.split('\n').map((line) => line.split('\t'))
  // Nombres de las regiones (comunidades autónomas en España): filas de tipo ADM1
  const fix = REGION_NAMES_ES[country.iso2] ?? {}
  const regions = new Map(rows.filter((r) => r[7] === 'ADM1').map((r) => [r[10], fix[r[1]] ?? r[1]]))
  const places = rows
    .filter((r) => r[6] === 'P' && r[7] !== 'PPLX' && Number(r[14]) >= 1000) // PPLX = barrio, no pueblo
    .map((r) => ({
      name: r[1],
      region: regions.get(r[10]) ?? '',
      lat: +Number(r[4]).toFixed(4),
      lon: +Number(r[5]).toFixed(4),
      pop: Number(r[14]),
    }))
    .sort((a, b) => b.pop - a.pop)
  writeFileSync(
    `${OUT_DIR}/places.json`,
    JSON.stringify({ source: 'GeoNames (CC BY 4.0) – geonames.org', places }),
  )
  console.log(`✓ ${places.length} poblaciones (las 5 mayores: ${places.slice(0, 5).map((p) => p.name).join(', ')})`)
}
await fetchPlaces()
if (placesOnly) process.exit(0)

// ---------- Descargar cada zona ----------
const meta = { id, name: country.name, zones: [] }
for (const [n, bounds] of zones.entries()) {
  const widthKm = (bounds.east - bounds.west) * KM_PER_DEG_LON
  const heightKm = (bounds.north - bounds.south) * KM_PER_DEG_LAT
  const scale = Math.min(1, MAX_GRID / (widthKm / CELL_KM), MAX_GRID / (heightKm / CELL_KM))
  const gw = Math.round((widthKm / CELL_KM) * scale)
  const gh = Math.round((heightKm / CELL_KM) * scale)
  // Satélite: el doble que la rejilla (sin pasar de 4096), con las mismas proporciones
  const satScale = Math.min(2, MAX_SAT / gw, MAX_SAT / gh)
  const sw = Math.round(gw * satScale), sh = Math.round(gh * satScale)

  const heightFile = `zone-${n}-height.bin`, satFile = `zone-${n}-satellite.jpg`
  const [h] = await Promise.all([
    fetchHeights(bounds, gw, gh, heightFile),
    fetchSatellite(bounds, sw, sh, satFile),
  ])
  console.log(`✓ zona ${n}: alturas ${gw}x${gh} (zoom ${h.zoom}, ${h.tiles} teselas), satélite ${sw}x${sh}`)
  meta.zones.push({
    bounds,
    height: { file: heightFile, width: gw, height: gh, type: 'int16', units: 'm' },
    satellite: { file: satFile, width: sw, height: sh },
  })
}
meta.sources = {
  satellite: 'NASA GIBS – BlueMarble_NextGeneration',
  elevation: 'AWS Terrain Tiles (Terrarium, SRTM y otros)',
}
writeFileSync(`${OUT_DIR}/meta.json`, JSON.stringify(meta, null, 2) + '\n')

// ---------- Índice de países disponibles ----------
const indexFile = `${BASE_DIR}/index.json`
const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : { countries: [] }
index.countries = index.countries.filter((c) => c.id !== id)
index.countries.push({ id, name: country.name })
index.countries.sort((a, b) => a.name.localeCompare(b.name, 'es'))
writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n')
console.log(`✓ ${OUT_DIR}/meta.json y countries/index.json`)
