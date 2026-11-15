// Sound settings and subtle sound effects.
//
// - Two volumes the player sets in the menu (and the pause panel): music and effects, 0 to 1,
//   saved in this browser (localStorage). src/shared/music.ts follows the music volume.
// - All effects are synthesised with the Web Audio API (no audio files, nothing to credit):
//   short, quiet clicks and swishes for the interface, and a wind that rises when the detective
//   moves fast. The audio context starts on the first click or key press (browsers block sound
//   before that); until then every call is a silent no-op.
// - installUiSounds() adds one click sound to every button of the app (mouse and keyboard), plus a
//   very soft tick on hover. A button can pick another sound with data-sfx="<name>" or stay
//   silent with data-sfx="off".
import { useSyncExternalStore } from 'react'

// ---------------------------------------------------------------- settings

export interface SoundSettings {
  /** Music volume, 0 to 1 */
  music: number
  /** Sound effects volume, 0 to 1 */
  sfx: number
}

const STORAGE_KEY = 'etd.sound.v1'
const DEFAULTS: SoundSettings = { music: 0.7, sfx: 0.7 }

function clamp01(v: unknown, fallback: number) {
  const n = typeof v === 'number' ? v : Number.NaN
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback
}

function load(): SoundSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<SoundSettings> | null
    if (raw) return { music: clamp01(raw.music, DEFAULTS.music), sfx: clamp01(raw.sfx, DEFAULTS.sfx) }
  } catch {
    /* private mode or bad JSON: defaults */
  }
  return { ...DEFAULTS }
}

let settings = load()
const listeners = new Set<() => void>()

export function getSoundSettings(): SoundSettings {
  return settings
}

export function setSoundSettings(patch: Partial<SoundSettings>) {
  settings = {
    music: clamp01(patch.music ?? settings.music, settings.music),
    sfx: clamp01(patch.sfx ?? settings.sfx, settings.sfx),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* not saved, still applied */
  }
  applySfxVolume()
  listeners.forEach((l) => l())
}

export function subscribeSoundSettings(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** React hook: the current sound settings, re-rendering on change. */
export function useSoundSettings(): SoundSettings {
  return useSyncExternalStore(subscribeSoundSettings, getSoundSettings, getSoundSettings)
}

// ---------------------------------------------------------------- audio graph

/** Overall level of the effects at 100 %: they stay under the music and never get in the way. */
const SFX_MAX = 0.55

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null

function applySfxVolume() {
  if (!ctx || !master) return
  // Perceived loudness is roughly logarithmic: square the slider so low values are really quiet
  master.gain.setTargetAtTime(settings.sfx * settings.sfx * SFX_MAX, ctx.currentTime, 0.03)
}

/** Creates (or resumes) the audio context. Only works inside a user gesture the first time. */
function unlock() {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    try {
      ctx = new Ctor()
    } catch {
      return
    }
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    // 2 s of white noise, reused by every noisy sound and the wind
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    applySfxVolume()
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
}

function ready(): AudioContext | null {
  return ctx && master && ctx.state === 'running' && settings.sfx > 0 ? ctx : null
}

const jitter = (amount: number) => 1 + (Math.random() * 2 - 1) * amount

interface ToneOptions {
  freq: number
  /** Frequency at the end (glide) */
  to?: number
  dur: number
  gain: number
  type?: OscillatorType
  delay?: number
  attack?: number
}

function tone(ac: AudioContext, o: ToneOptions) {
  const t0 = ac.currentTime + (o.delay ?? 0)
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, t0)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur)
  const attack = o.attack ?? 0.004
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
  osc.connect(g).connect(master!)
  osc.start(t0)
  osc.stop(t0 + o.dur + 0.02)
}

interface NoiseOptions {
  dur: number
  gain: number
  /** Band-pass centre at the start and the end (Hz) */
  from: number
  to?: number
  q?: number
  delay?: number
  attack?: number
}

function noise(ac: AudioContext, o: NoiseOptions) {
  const t0 = ac.currentTime + (o.delay ?? 0)
  const src = ac.createBufferSource()
  src.buffer = noiseBuffer
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = o.q ?? 1.2
  filter.frequency.setValueAtTime(o.from, t0)
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t0 + o.dur)
  const g = ac.createGain()
  const attack = o.attack ?? 0.01
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(o.gain, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
  src.connect(filter).connect(g).connect(master!)
  src.start(t0, Math.random() * 1.5)
  src.stop(t0 + o.dur + 0.02)
}

// ---------------------------------------------------------------- effects

const EFFECTS = {
  /** Button press: a soft paper tick */
  click(ac: AudioContext) {
    const k = jitter(0.05)
    tone(ac, { freq: 1500 * k, to: 1000 * k, dur: 0.045, gain: 0.16, type: 'triangle' })
    noise(ac, { from: 4200, dur: 0.03, gain: 0.05, q: 0.8, attack: 0.002 })
  },
  /** Pointer over a button, or keyboard focus moving: barely there */
  hover(ac: AudioContext) {
    tone(ac, { freq: 2600 * jitter(0.04), dur: 0.025, gain: 0.03, type: 'sine', attack: 0.002 })
  },
  /** Starting something (Play): two rising notes */
  confirm(ac: AudioContext) {
    tone(ac, { freq: 660, dur: 0.14, gain: 0.09, type: 'triangle' })
    tone(ac, { freq: 990, dur: 0.22, gain: 0.08, type: 'triangle', delay: 0.07 })
    noise(ac, { from: 900, to: 3200, dur: 0.2, gain: 0.03 })
  },
  /** A panel or file opens: paper swish up */
  open(ac: AudioContext) {
    noise(ac, { from: 700, to: 2600, dur: 0.2, gain: 0.07, q: 0.9, attack: 0.04 })
    tone(ac, { freq: 520, to: 700, dur: 0.12, gain: 0.03 })
  },
  /** A panel closes: paper swish down */
  close(ac: AudioContext) {
    noise(ac, { from: 2400, to: 600, dur: 0.18, gain: 0.06, q: 0.9, attack: 0.02 })
  },
  /** The hand lens comes up: a glassy shimmer */
  lens(ac: AudioContext) {
    ;[1320, 1760, 2640].forEach((f, i) => tone(ac, { freq: f, dur: 0.35, gain: 0.035, type: 'sine', delay: i * 0.05, attack: 0.02 }))
    noise(ac, { from: 1500, to: 5000, dur: 0.3, gain: 0.025, attack: 0.08 })
  },
  /** Entering a featured case zone: a small bell */
  zone(ac: AudioContext) {
    tone(ac, { freq: 880, dur: 0.7, gain: 0.06, type: 'sine', attack: 0.005 })
    tone(ac, { freq: 1320, dur: 0.45, gain: 0.025, type: 'sine', attack: 0.005 })
    tone(ac, { freq: 1175, dur: 0.6, gain: 0.04, type: 'sine', delay: 0.12 })
  },
  /** Case solved: a short bright arpeggio */
  success(ac: AudioContext) {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(ac, { freq: f, dur: 0.3, gain: 0.07, type: 'triangle', delay: i * 0.08 }))
  },
  /** Turbo starts: a short rush of air */
  boost(ac: AudioContext) {
    noise(ac, { from: 300, to: 1800, dur: 0.45, gain: 0.08, q: 0.7, attack: 0.08 })
  },
  /** Volume slider moved: a tick at the new level (so the player hears it) */
  tick(ac: AudioContext) {
    tone(ac, { freq: 1200, dur: 0.04, gain: 0.08, type: 'triangle' })
  },
} as const

export type SfxName = keyof typeof EFFECTS

function isSfx(name: string | undefined | null): name is SfxName {
  return !!name && Object.prototype.hasOwnProperty.call(EFFECTS, name)
}

const lastPlayed: Partial<Record<SfxName, number>> = {}
/** Shortest gap between two plays of the same sound (ms): no machine-gun clicks */
const MIN_GAP: Partial<Record<SfxName, number>> = { hover: 70, tick: 60, click: 40 }

/** Plays one effect at the effects volume. Silent until the first click or key press. */
export function playSfx(name: SfxName) {
  const ac = ready()
  if (!ac) return
  const now = performance.now()
  if (now - (lastPlayed[name] ?? -1e9) < (MIN_GAP[name] ?? 30)) return
  lastPlayed[name] = now
  try {
    EFFECTS[name](ac)
  } catch {
    /* never let a sound break the game */
  }
}

// ---------------------------------------------------------------- wind

let wind: { gain: GainNode; filter: BiquadFilterNode } | null = null

function startWind(ac: AudioContext) {
  const src = ac.createBufferSource()
  src.buffer = noiseBuffer
  src.loop = true
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 0.6
  filter.frequency.value = 500
  const low = ac.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = 2400
  const gain = ac.createGain()
  gain.gain.value = 0
  // Slow gusts: an LFO sways the band so the wind whistles a little instead of hissing
  const lfo = ac.createOscillator()
  lfo.frequency.value = 0.21
  const lfoDepth = ac.createGain()
  lfoDepth.gain.value = 160
  lfo.connect(lfoDepth).connect(filter.frequency)
  src.connect(filter).connect(low).connect(gain).connect(master!)
  src.start()
  lfo.start()
  wind = { gain, filter }
}

/**
 * Wind level, 0 (still air) to 1 (full speed). Call it as often as you like: it glides there.
 * Uses the effects volume.
 */
export function setWind(intensity: number) {
  const level = Math.min(1, Math.max(0, intensity))
  const ac = ctx && master && ctx.state === 'running' ? ctx : null
  if (!ac) return
  if (!wind) {
    if (level <= 0) return
    startWind(ac)
  }
  const t = ac.currentTime
  wind!.gain.gain.setTargetAtTime(0.32 * Math.pow(level, 1.4), t, level > 0 ? 0.35 : 0.5)
  wind!.filter.frequency.setTargetAtTime(380 + 1100 * level, t, 0.4)
}

// ---------------------------------------------------------------- interface sounds

const CLICKABLE = 'button, a[href], [role="button"], [role="tab"], [role="menuitem"], summary'

let installed = false

/**
 * Starts the audio on the first click or key press and gives every button a click sound
 * (and a soft hover tick). Safe to call more than once.
 */
export function installUiSounds() {
  if (installed) return
  installed = true

  const onGesture = () => unlock()
  window.addEventListener('pointerdown', onGesture, true)
  window.addEventListener('keydown', onGesture, true)

  // 'click' fires for the mouse, touch, Enter and Space alike (and never on disabled buttons)
  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as Element | null)?.closest?.(CLICKABLE) as HTMLElement | null
      if (!el) return
      const choice = el.dataset.sfx
      if (choice === 'off') return
      playSfx(isSfx(choice) ? choice : 'click')
    },
    true,
  )

  document.addEventListener(
    'pointerover',
    (e) => {
      if (e.pointerType === 'touch') return
      const el = (e.target as Element | null)?.closest?.(CLICKABLE) as HTMLElement | null
      if (!el || el.dataset.sfx === 'off' || (el as HTMLButtonElement).disabled) return
      // Only on entering the button, not when moving between its children
      const from = e.relatedTarget as Node | null
      if (from && el.contains(from)) return
      playSfx('hover')
    },
    true,
  )

  // Keyboard navigation (Tab, arrows) gets the same soft tick as the mouse
  let lastKey = 0
  window.addEventListener('keydown', () => (lastKey = performance.now()), true)
  document.addEventListener(
    'focusin',
    (e) => {
      if (performance.now() - lastKey > 300) return
      const el = (e.target as Element | null)?.closest?.(CLICKABLE) as HTMLElement | null
      if (el && el.dataset.sfx !== 'off') playSfx('hover')
    },
    true,
  )
}
