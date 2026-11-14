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
  /** True while the detective stands still with the magnifier out (the "paused" moment) */
  stopped: boolean
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
}

/** Props of the game view: the callbacks plus what the app shell tells the game. */
export interface GameViewProps extends GameCallbacks {
  /** While true (e.g. an overlay is open) the game ignores keyboard input and the detective stays still */
  paused?: boolean
}
