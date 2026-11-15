// Day/night cycle: a time-of-day clock (0..1) and a keyframed palette (sun, lights, sky, fog,
// clouds, screen tint) interpolated smoothly. No rendering here: createSky, createLighting,
// createClouds and createInkOutline read the palette every frame.
//
// Time of day: 0 = midnight, 0.25 = early morning, 0.5 = noon, 0.75 = late afternoon.
//
// How the night is made: the toon shading (toonGradient.ts) decides "lit or in shadow" from how
// much light a pixel gets, so dimming the lights would turn the whole picture into flat shadow.
// The lights therefore keep the same brightness all day and only change hue and direction (the
// moon takes over from the sun); the darkness comes from a screen tint (TINT/LIFT below) applied
// in the existing ink pass. Only at sunrise and sunset the direct light dips for a few seconds
// (shadowless twilight), which also hides the switch between sun and moon.
import * as THREE from 'three'

// ---------------------------------------------------------------------------------------------
// Tweakable constants
// ---------------------------------------------------------------------------------------------

/** Seconds a full day lasts (override for testing with ?daylen=30). */
export const DAY_LENGTH_SECONDS = 240
/** Time of day when the game starts (mid-morning, full daylight; override with ?time=0.75). */
export const START_TIME = 0.4
/** Time of day when the sun crosses the horizon. */
export const SUNRISE = 0.2
export const SUNSET = 0.8
/** Highest point of the sun and the moon above the horizon (degrees); both pass to the south. */
const SUN_TOP_ELEVATION = 55
const MOON_TOP_ELEVATION = 62
/** The shadow-casting light never goes lower than this (unit-vector height), or shadows get endless. */
const MIN_LIGHT_HEIGHT = 0.24
/** Daytime light intensities (the values the game had before the cycle). */
const SUN_INTENSITY = 2.1
const HEMI_INTENSITY = 1.4

interface Look {
  /** Direct light (sun or moon): colour, and strength relative to daytime (1 = same brightness). */
  light: number
  lightStrength: number
  /** Ambient hemisphere light: colour from the sky, colour from the ground, relative strength. */
  hemiSky: number
  hemiGround: number
  hemiStrength: number
  /** Sky gradient, glow around the sun near the horizon (black = none), colour of the sun disc. */
  skyTop: number
  skyHorizon: number
  skyGlow: number
  sunDisc: number
  /** Clouds: lit colour and the colour of their shaded side. */
  cloud: number
  cloudShade: number
  /** Screen tint over everything except the sky (linear RGB): colour * tint + lift. */
  tint: [number, number, number]
  lift: [number, number, number]
  /** Star visibility, 0..1. */
  stars: number
  /** Night factor, 0 by day and 1 at night: fades the little lights of houses and landmarks. */
  night: number
}

const DAY: Look = {
  light: 0xffefcc, lightStrength: 1,
  hemiSky: 0x9cc4ff, hemiGround: 0xffc98a, hemiStrength: 1,
  skyTop: 0x1a7dff, skyHorizon: 0x92d6ff, skyGlow: 0x000000, sunDisc: 0xffffff,
  cloud: 0xffffff, cloudShade: 0x9fb4c8,
  tint: [1, 1, 1], lift: [0, 0, 0],
  stars: 0, night: 0,
}
const GOLDEN_HOUR: Look = {
  light: 0xffc98c, lightStrength: 1,
  hemiSky: 0xb4b4ee, hemiGround: 0xffb47c, hemiStrength: 1,
  skyTop: 0x3c6fd6, skyHorizon: 0xffc994, skyGlow: 0xff8a3c, sunDisc: 0xffdca8,
  cloud: 0xffe0c2, cloudShade: 0xb48c9c,
  tint: [1, 0.93, 0.85], lift: [0, 0, 0],
  stars: 0, night: 0,
}
const SUNSET_LOOK: Look = {
  light: 0xff9a6a, lightStrength: 0.15,
  hemiSky: 0x9a8ee0, hemiGround: 0xe09484, hemiStrength: 1,
  skyTop: 0x2c3f9c, skyHorizon: 0xff9468, skyGlow: 0xff4a2c, sunDisc: 0xff9258,
  cloud: 0xffb4a4, cloudShade: 0x8c6294,
  tint: [0.86, 0.72, 0.8], lift: [0.004, 0.003, 0.012],
  stars: 0.15, night: 0.45,
}
const NIGHT: Look = {
  light: 0xbcccff, lightStrength: 1,
  hemiSky: 0x93a4ff, hemiGround: 0x9a8cd8, hemiStrength: 1,
  skyTop: 0x0a0e36, skyHorizon: 0x2c2c72, skyGlow: 0x000000, sunDisc: 0xff9258,
  cloud: 0xd0d8ff, cloudShade: 0x6c72b4,
  tint: [0.26, 0.31, 0.58], lift: [0.01, 0.01, 0.032],
  stars: 1, night: 1,
}
const DAWN: Look = {
  light: 0xffa88a, lightStrength: 0.15,
  hemiSky: 0xa49ae4, hemiGround: 0xe4a498, hemiStrength: 1,
  skyTop: 0x3a4aaa, skyHorizon: 0xffb0a0, skyGlow: 0xff6a5c, sunDisc: 0xffa07c,
  cloud: 0xffc0c0, cloudShade: 0x9070a4,
  tint: [0.84, 0.74, 0.84], lift: [0.004, 0.003, 0.012],
  stars: 0.15, night: 0.45,
}
const MORNING: Look = {
  light: 0xffd6ac, lightStrength: 1,
  hemiSky: 0xacbcf4, hemiGround: 0xffc094, hemiStrength: 1,
  skyTop: 0x4684e6, skyHorizon: 0xffdcc0, skyGlow: 0xffa87c, sunDisc: 0xffe8c8,
  cloud: 0xffecdc, cloudShade: 0xb09cb4,
  tint: [1, 0.96, 0.91], lift: [0, 0, 0],
  stars: 0, night: 0,
}

/** The day, in order (times 0..1, increasing). After the last one it blends back to the first. */
const KEYFRAMES: { time: number; look: Look }[] = [
  { time: 0, look: NIGHT },
  { time: 0.14, look: NIGHT },
  { time: SUNRISE, look: DAWN },
  { time: 0.25, look: MORNING },
  { time: 0.32, look: DAY },
  { time: 0.68, look: DAY },
  { time: 0.75, look: GOLDEN_HOUR },
  { time: SUNSET, look: SUNSET_LOOK },
  { time: 0.86, look: NIGHT },
]

// ---------------------------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------------------------

/** Everything the scene needs to know about the current time of day. One object, reused. */
export interface DayPalette {
  time: number
  /** Unit vectors toward the sun and the moon (they go below the horizon). */
  sunDirection: THREE.Vector3
  moonDirection: THREE.Vector3
  /** Unit vector toward whichever lights the scene now (never below MIN_LIGHT_HEIGHT). */
  lightDirection: THREE.Vector3
  lightColor: THREE.Color
  lightIntensity: number
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  hemiIntensity: number
  skyTop: THREE.Color
  skyHorizon: THREE.Color
  skyGlow: THREE.Color
  sunDisc: THREE.Color
  cloud: THREE.Color
  cloudShade: THREE.Color
  tint: THREE.Color
  lift: THREE.Color
  /** Fog colour: the horizon colour with the screen tint undone, so far land still meets the sky. */
  fog: THREE.Color
  stars: number
  /** 0 by day, 1 at night (house and landmark lights, see nightLights.ts). */
  night: number
}

const COLOR_KEYS = ['lightColor', 'hemiSky', 'hemiGround', 'skyTop', 'skyHorizon', 'skyGlow', 'sunDisc', 'cloud', 'cloudShade', 'tint', 'lift'] as const

/** Brightness of a colour as the toon shader measures it. */
const luma = (c: THREE.Color) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b

interface Compiled extends Pick<DayPalette, (typeof COLOR_KEYS)[number]> {
  time: number
  lightIntensity: number
  hemiIntensity: number
  stars: number
  night: number
}

const DAY_LIGHT_LUMA = luma(new THREE.Color(DAY.light))
const DAY_HEMI_LUMA = luma(new THREE.Color(DAY.hemiSky))

function compile(time: number, look: Look): Compiled {
  const lightColor = new THREE.Color(look.light)
  const hemiSky = new THREE.Color(look.hemiSky)
  return {
    time,
    lightColor,
    // Intensities compensate the hue: a blue moon is as bright (for the toon shading) as the sun
    lightIntensity: (SUN_INTENSITY * look.lightStrength * DAY_LIGHT_LUMA) / luma(lightColor),
    hemiSky,
    hemiGround: new THREE.Color(look.hemiGround),
    hemiIntensity: (HEMI_INTENSITY * look.hemiStrength * DAY_HEMI_LUMA) / luma(hemiSky),
    skyTop: new THREE.Color(look.skyTop),
    skyHorizon: new THREE.Color(look.skyHorizon),
    skyGlow: new THREE.Color(look.skyGlow),
    sunDisc: new THREE.Color(look.sunDisc),
    cloud: new THREE.Color(look.cloud),
    cloudShade: new THREE.Color(look.cloudShade),
    tint: new THREE.Color(...look.tint),
    lift: new THREE.Color(...look.lift),
    stars: look.stars,
    night: look.night,
  }
}

const FRAMES = KEYFRAMES.map((k) => compile(k.time, k.look))

const wrap01 = (t: number) => ((t % 1) + 1) % 1
const lerp = (a: number, b: number, u: number) => a + (b - a) * u

/**
 * Position on a sky arc: rises in the east at `rise`, is up for `duration` (fraction of the day),
 * sets in the west, and spends the rest below the horizon.
 */
function arcDirection(out: THREE.Vector3, t: number, rise: number, duration: number, topElevation: number) {
  const p = wrap01(t - rise)
  const angle = p < duration ? (Math.PI * p) / duration : Math.PI * (1 + (p - duration) / (1 - duration))
  const top = (topElevation * Math.PI) / 180
  // x = east, y = up, z = south
  return out.set(Math.cos(angle), Math.sin(angle) * Math.sin(top), Math.sin(angle) * Math.cos(top))
}

export function createPalette(): DayPalette {
  const palette = {
    time: 0,
    sunDirection: new THREE.Vector3(),
    moonDirection: new THREE.Vector3(),
    lightDirection: new THREE.Vector3(),
    lightIntensity: 0,
    hemiIntensity: 0,
    fog: new THREE.Color(),
    stars: 0,
    night: 0,
  } as DayPalette
  for (const key of COLOR_KEYS) palette[key] = new THREE.Color()
  return palette
}

/** Fills `out` with the palette at time of day `time` (any number; it wraps). Allocates nothing. */
export function samplePalette(time: number, out: DayPalette): DayPalette {
  const t = wrap01(time)
  out.time = t

  // Keyframes around t (the last one blends into the first of the next day)
  let i = FRAMES.length - 1
  while (i > 0 && FRAMES[i].time > t) i--
  const a = FRAMES[i]
  const b = FRAMES[(i + 1) % FRAMES.length]
  const span = wrap01(b.time - a.time) || 1
  const x = Math.min(1, (t - a.time) / span)
  const u = x * x * (3 - 2 * x) // smoothstep: eases in and out of every keyframe

  for (const key of COLOR_KEYS) out[key].lerpColors(a[key], b[key], u)
  out.lightIntensity = lerp(a.lightIntensity, b.lightIntensity, u)
  out.hemiIntensity = lerp(a.hemiIntensity, b.hemiIntensity, u)
  out.stars = lerp(a.stars, b.stars, u)
  out.night = lerp(a.night, b.night, u)
  out.fog.setRGB(
    Math.min(1, Math.max(0, (out.skyHorizon.r - out.lift.r) / out.tint.r)),
    Math.min(1, Math.max(0, (out.skyHorizon.g - out.lift.g) / out.tint.g)),
    Math.min(1, Math.max(0, (out.skyHorizon.b - out.lift.b) / out.tint.b)),
  )

  const dayDuration = SUNSET - SUNRISE
  arcDirection(out.sunDirection, t, SUNRISE, dayDuration, SUN_TOP_ELEVATION)
  arcDirection(out.moonDirection, t, SUNSET, 1 - dayDuration, MOON_TOP_ELEVATION)
  const sunUp = t >= SUNRISE && t < SUNSET
  out.lightDirection.copy(sunUp ? out.sunDirection : out.moonDirection)
  out.lightDirection.y = Math.max(out.lightDirection.y, MIN_LIGHT_HEIGHT)
  out.lightDirection.normalize()
  return out
}

// ---------------------------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------------------------

export interface DayParams {
  /** Starting time of day, 0..1. */
  time?: number
  /** Seconds per full day. */
  dayLength?: number
}

/** Debug helpers from the URL: ?time=0.75 (start at that time of day) and ?daylen=30 (seconds per day). */
export function readDayParams(search: string): DayParams {
  const query = new URLSearchParams(search)
  const number = (name: string) => {
    const raw = query.get(name)
    const value = raw === null || raw.trim() === '' ? NaN : Number(raw)
    return Number.isFinite(value) ? value : undefined
  }
  const time = number('time')
  const dayLength = number('daylen')
  return {
    time: time === undefined ? undefined : wrap01(time),
    dayLength: dayLength !== undefined && dayLength > 0 ? dayLength : undefined,
  }
}

/** The clock of the day plus its current palette. Call advance(dt) once per frame. */
export function createDayCycle({ time = START_TIME, dayLength = DAY_LENGTH_SECONDS }: DayParams = {}) {
  const palette = samplePalette(time, createPalette())
  return {
    palette,
    /** Seconds per full day. */
    dayLength,
    get time() {
      return palette.time
    },
    /** Jumps to a time of day (0..1). */
    set time(value: number) {
      samplePalette(value, palette)
    },
    /** Moves the clock `dt` seconds forward (0 while paused) and returns the updated palette. */
    advance(dt: number): DayPalette {
      return samplePalette(palette.time + dt / dayLength, palette)
    },
  }
}
