// Busca la población más cercana a una posición (lon/lat) y a cuántos km está.
import type { Place } from '../map/mapData'

const KM_PER_DEG = 111.2

/** Distancia aproximada en km (suficiente para distancias de un país). */
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const x = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180))
  const y = lat2 - lat1
  return Math.hypot(x, y) * KM_PER_DEG
}

export function nearestPlace(places: Place[], lat: number, lon: number) {
  let best: Place | null = null
  let bestKm = Infinity
  for (const p of places) {
    const d = distanceKm(lat, lon, p.lat, p.lon)
    if (d < bestKm) {
      bestKm = d
      best = p
    }
  }
  return best ? { place: best, km: bestKm } : null
}
