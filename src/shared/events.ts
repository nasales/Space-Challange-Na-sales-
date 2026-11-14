// Bridge between the game (src/game) and the interface (src/ui).
// The game never imports from src/ui and the UI never imports from src/game:
// both only import these types. Changing this file needs agreement from both areas.

/** Where the detective is right now. */
export interface LocationInfo {
  lat: number
  lon: number
  place: string
  region: string
  /** Distance to the nearest town, in km */
  km: number
  landmark: { name: string; city: string; description: string } | null
}

/** Live state the game sends to the HUD a few times per second. */
export interface HudState {
  location: LocationInfo
  kmh: number
  turbo: boolean
  /** 0 to 1: intensity of the speed lines */
  rush: number
}

export type GameStatus = 'loading' | 'ready' | 'error'

/** Sent when the player stops at a place to investigate (not emitted yet). */
export interface GameStop {
  place: string
  lat: number
  lon: number
}

/** Callbacks the game view accepts from the app shell. */
export interface GameCallbacks {
  onStatus?: (status: GameStatus) => void
  onHud?: (hud: HudState) => void
  onStop?: (stop: GameStop) => void
  /** Featured-case marker the car is close to (id from src/shared/tutorial.ts), or null when it leaves */
  onCaseNear?: (caseId: string | null) => void
  /** The player opened a featured case (Enter near the marker, or click on it) */
  onCaseOpen?: (caseId: string) => void
  /** true while a UI overlay is open: the game must ignore driving keys */
  paused?: boolean
}
