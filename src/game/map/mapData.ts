// Carga los datos detallados de los países (generados por scripts/fetch-map-data.mjs <ID>).
// Un país tiene una o varias ZONAS separadas (p. ej. España: Península y Canarias).

export interface Bounds {
  west: number
  east: number
  south: number
  north: number
}

/** Datos de una zona de un país. */
export interface ZoneData {
  bounds: Bounds
  /** Alturas en metros, fila a fila de norte a sur. Negativo = mar. */
  heights: Int16Array
  heightWidth: number
  heightHeight: number
  /** Imagen de satélite: solo se usa como dato (saber si una zona es verde o seca). */
  satellite: HTMLImageElement
  /** Rivers that cross this zone (from rivers.json; empty if the country has none). */
  rivers?: River[]
}

/** A river (Natural Earth centerlines), as stored in rivers.json. */
export interface River {
  name: string
  /** 1 big, 2 medium, 3 small */
  rank: 1 | 2 | 3
  /** One or more polylines of [lon, lat] points. */
  lines: [number, number][][]
}

/** Una población del país (de GeoNames). */
export interface Place {
  name: string
  /** Región: comunidad autónoma en España */
  region: string
  lat: number
  lon: number
  pop: number
}

export interface CountryData {
  id: string
  name: string
  /** La primera zona es la principal (la más grande). */
  zones: ZoneData[]
  /** Poblaciones de más de 1000 habitantes, de mayor a menor. */
  places: Place[]
}

export interface CountryIndexEntry {
  id: string
  name: string
}

const BASE = '/maps/countries/'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    img.src = src
  })
}

/** Lista de países que tienen datos descargados. */
export async function loadCountryIndex(): Promise<CountryIndexEntry[]> {
  const index = await (await fetch(`${BASE}index.json`)).json()
  return index.countries
}

interface ZoneMeta {
  bounds: Bounds
  height: { file: string; width: number; height: number }
  satellite: { file: string }
}

/** Keeps the river lines that touch the given bounds. */
function riversInBounds(rivers: River[], b: Bounds): River[] {
  const inside = ([lon, lat]: [number, number]) => lon >= b.west && lon <= b.east && lat >= b.south && lat <= b.north
  return rivers
    .map((r) => ({ ...r, lines: r.lines.filter((line) => line.some(inside)) }))
    .filter((r) => r.lines.length > 0)
}

export async function loadCountryData(id: string): Promise<CountryData> {
  const dir = `${BASE}${id}/`
  const [meta, placesJson, riversJson] = await Promise.all([
    fetch(`${dir}meta.json`).then((r) => r.json()),
    fetch(`${dir}places.json`).then((r) => r.json()),
    // Optional: a country without rivers.json simply has no rivers
    fetch(`${dir}rivers.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ])
  const allRivers: River[] = riversJson?.rivers ?? []
  const zones = await Promise.all(
    (meta.zones as ZoneMeta[]).map(async (z) => {
      const [buffer, satellite] = await Promise.all([
        fetch(dir + z.height.file).then((r) => r.arrayBuffer()),
        loadImage(dir + z.satellite.file),
      ])
      return {
        bounds: z.bounds,
        heights: new Int16Array(buffer),
        heightWidth: z.height.width,
        heightHeight: z.height.height,
        satellite,
        rivers: riversInBounds(allRivers, z.bounds),
      }
    }),
  )
  return { id: meta.id, name: meta.name, zones, places: placesJson.places }
}
