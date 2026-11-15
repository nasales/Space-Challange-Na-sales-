// Airfields of the travel map (M): places the detective can fly to that are not monuments.
// The Canary Islands have no monument and no sea joins them to the mainland, so the plane is the
// only way there (and back: pick any mainland monument on the map).
// Read by the travel map (src/ui/travelmap) for its badges and by the game (GameView.tsx), which
// lands on the free ground nearest to each point. Ids must not repeat a landmark id (landmarks.json).

export interface TravelSpot {
  id: string
  /** Shown in bold on the map label */
  name: string
  /** Second line of the label */
  city: string
  /** Real coordinates (degrees) */
  lat: number
  lon: number
}

export const TRAVEL_SPOTS: TravelSpot[] = [
  { id: 'airfield-tenerife', name: 'Tenerife', city: 'Santa Cruz de Tenerife', lat: 28.4682, lon: -16.2546 },
  { id: 'airfield-gran-canaria', name: 'Gran Canaria', city: 'Las Palmas de Gran Canaria', lat: 28.1018, lon: -15.4157 },
]
