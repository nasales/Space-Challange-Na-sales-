// Background music of the game. One looping track, started on the first click or key press
// (browsers block sound before the player interacts with the page).
//
// Default track: "Investigation" by Umplix (CC0). A second track, "Jazz (Saxophone)" by Pro Sensory
// (CC0), is ready as an alternative:
//   - to switch for everyone, change DEFAULT_TRACK below to 'jazz-saxophone';
//   - to try it without changing code, open the site with ?music=jazz-saxophone;
//   - ?music=off starts the game without music.
// Both tracks are credited in REFERENCES.md. Files live in public/music/.

export const MUSIC_TRACKS = {
  investigation: { title: 'Investigation', author: 'Umplix', src: '/music/investigation.mp3' },
  'jazz-saxophone': { title: 'Jazz (Saxophone)', author: 'Pro Sensory', src: '/music/jazz-saxophone.mp3' },
} as const

export type MusicTrackId = keyof typeof MUSIC_TRACKS

/** The track that plays by default. */
export const DEFAULT_TRACK: MusicTrackId = 'investigation'

/** Background level: low enough to keep the game sounds and the reading comfortable. */
const VOLUME = 0.46 // was 0.35, raised 30 % at the team's request (too quiet)

let audio: HTMLAudioElement | null = null

function isTrack(id: string | null): id is MusicTrackId {
  return !!id && Object.prototype.hasOwnProperty.call(MUSIC_TRACKS, id)
}

/** Track chosen by the URL (?music=<id> or ?music=off), else the default. null = no music. */
function chosenTrack(): MusicTrackId | null {
  const param = new URLSearchParams(window.location.search).get('music')
  if (param === 'off') return null
  return isTrack(param) ? param : DEFAULT_TRACK
}

/**
 * Starts the background music once. Safe to call more than once. If the browser blocks
 * playback, it waits for the first click, tap or key press and tries again.
 */
export function startBackgroundMusic() {
  if (audio) return
  const id = chosenTrack()
  if (!id) return
  audio = new Audio(MUSIC_TRACKS[id].src)
  audio.loop = true
  audio.volume = VOLUME
  const player = audio
  const events = ['pointerdown', 'keydown'] as const
  const tryPlay = () => {
    player
      .play()
      .then(() => events.forEach((e) => window.removeEventListener(e, tryPlay)))
      .catch(() => {
        /* still blocked: the next interaction tries again */
      })
  }
  events.forEach((e) => window.addEventListener(e, tryPlay))
  tryPlay()
}
