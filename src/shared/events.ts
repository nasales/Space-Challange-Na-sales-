// Bridge between the game (src/game) and the interface (src/ui).
// The game never imports from src/ui and the UI never imports from src/game:
// both only import these types. Changing this file needs agreement from both areas.
import type { Outfit } from './outfit'

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
  /** Featured case whose trigger zone the detective stands in (case id), or null */
  caseZone: string | null
}

/** 'intro': the map is drawn and the camera is swooping down to the detective (no control, no HUD yet). */
export type GameStatus = 'loading' | 'intro' | 'ready' | 'error'

/** Sent when the player stops at a place to investigate (not emitted yet). */
export interface GameStop {
  place: string
  lat: number
  lon: number
}

/**
 * Camera flight into the detective's hand lens:
 * - 'in': the camera has arrived. The lens glass is centred on screen and its diameter is
 *   LENS_SCREEN_DIAMETER, so the UI glass drawn on top matches it exactly.
 * - 'out': the camera is back on the normal chase view and the player can move again.
 */
export type LensFocusState = 'in' | 'out'

/** On-screen diameter of the hand lens glass once the camera is in (CSS length; game and UI must agree). */
export const LENS_SCREEN_DIAMETER = 'min(72vh, 72vw)'
/** The same size as a fraction of min(viewport width, viewport height), for the 3D camera. */
export const LENS_SCREEN_FRACTION = 0.72

/** Callbacks the game view accepts from the app shell. */
export interface GameCallbacks {
  onStatus?: (status: GameStatus) => void
  onHud?: (hud: HudState) => void
  onStop?: (stop: GameStop) => void
  /** The camera flight into (or out of) the hand lens has finished */
  onLensFocus?: (state: LensFocusState) => void
  /** Map loading progress, 0 to 1 (1 just before status 'ready'), for the loading bar */
  onProgress?: (progress: number) => void
  /** Fast travel (M map): the plane trip has started ('flying') or he is back on his feet ('landed') */
  onTravel?: (state: TravelState) => void
}

/** Props of the game view: the callbacks plus what the app shell tells the game. */
export interface GameViewProps extends GameCallbacks {
  /**
   * true: fly the camera into the hand lens (the detective holds it up); false: fly back out.
   * While true, and until 'out' is reported, the game ignores keyboard input and the detective stays still.
   */
  focusLens?: boolean
  /** Detective clothes picked in the Wardrobe; changing it recolors him live (the map is not rebuilt). */
  outfit?: Outfit
  /** true while the pause panel or a featured case level is open: the game ignores driving input */
  paused?: boolean
  /** Featured case ids already solved (their markers are drawn green) */
  completedCases?: readonly string[]
  /** Fast travel (M map): fly the detective to this landmark; a new `seq` starts a new trip */
  travelTo?: TravelRequest | null
}

// ---- Fast travel (M map) ----
/** A trip asked for from the travel map: landmark id (as in landmarks.json) and a counter, so the same place can be asked twice. */
export interface TravelRequest {
  landmarkId: string
  seq: number
}

/** 'flying': the trip has started (no control until 'landed'); 'landed': he stands on the plaza again. */
export type TravelState = 'flying' | 'landed'
