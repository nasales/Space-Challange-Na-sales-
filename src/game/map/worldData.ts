// Carga los datos del mundo sin explorar (generados por scripts/fetch-world-data.mjs).
import type { Bounds } from './mapData'

/** Cada polígono = [anillo exterior, ...agujeros]; cada anillo = [[lon, lat], ...] */
export type Polygon = [number, number][][]

export interface Country {
  id: string // código de 3 letras, p. ej. "ESP"
  name: string
  polygons: Polygon[]
}

export interface WorldData {
  bounds: Bounds
  heights: Int16Array
  gridWidth: number
  gridHeight: number
  countries: Country[]
}

const BASE = '/maps/'

export async function loadWorldData(): Promise<WorldData> {
  const [meta, countriesJson] = await Promise.all([
    fetch(`${BASE}world-map.json`).then((r) => r.json()),
    fetch(`${BASE}world-countries.json`).then((r) => r.json()),
  ])
  const buffer = await fetch(BASE + meta.height.file).then((r) => r.arrayBuffer())
  return {
    bounds: meta.bounds,
    heights: new Int16Array(buffer),
    gridWidth: meta.height.width,
    gridHeight: meta.height.height,
    countries: countriesJson.countries,
  }
}
