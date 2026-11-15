// Where the roadside bulls stand: big black bull silhouettes on hills next to the main roads, as
// seen along Spanish highways. To add one, append a spot here; to remove one, delete its line.
// Each spot was checked in the game (DEV: window.__game.bulls.check()): explored land, off the
// road, away from rivers, houses and monuments, on fairly flat ground a little above the road.

export interface BullSpot {
  id: string
  /** Where it is (for people reading this list) */
  place: string
  lat: number
  lon: number
  /**
   * Direction the flat side faces, in degrees (0 = south, +Z of the world, as landmarks; 90 = east).
   * Point it at the nearest road so drivers see the whole silhouette.
   */
  heading: number
  /** Size multiplier (default 1). */
  scale?: number
}

export const BULL_SPOTS: BullSpot[] = [
  { id: 'madrid-southeast', place: 'Comunidad de Madrid, by the North-South Road south-east of Madrid', lat: 40.2695, lon: -3.1545, heading: -83 },
  { id: 'toledo-hills', place: "Castilla-La Mancha, Montes de Toledo, by the Detective's Road", lat: 39.5177, lon: -4.3516, heading: -10 },
  { id: 'granada-altiplano', place: 'Andalucía, Granada highlands, by the Andalusian Road', lat: 37.4424, lon: -2.5504, heading: -47 },
  { id: 'caceres-east', place: "Extremadura, eastern Cáceres, by the Detective's Road", lat: 39.3062, lon: -5.3374, heading: 42 },
  { id: 'burgos-south', place: "Castilla y León, southern Burgos, by the Detective's Road", lat: 41.946, lon: -3.4766, heading: 10 },
  { id: 'zaragoza-east', place: "Aragón, east of Zaragoza, by the Detective's Road", lat: 41.6463, lon: -0.2957, heading: -49 },
]
