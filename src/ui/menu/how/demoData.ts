// Synthetic demo series for the "How it works" walkthrough. Every chart that uses these is
// labelled "Illustration": they are made-up numbers from a fixed seed, never real data and
// never the result of a featured case.

/** Small seeded random generator (mulberry32), so the drawings are the same on every load */
function makeRandom(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Roughly normal noise (sum of uniforms), mean 0, sd about 1 */
function makeNoise(seed: number) {
  const rand = makeRandom(seed)
  return () => (rand() + rand() + rand() + rand() - 2) * 1.7
}

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// ---- Step 1: seasons and anomalies (8 years of monthly "temperatures") ----
const YEARS = 8
const seasonNoise = makeNoise(7)

/** Raw monthly values: a big seasonal wave, a slow rise and some weather noise */
export const SEASONAL: number[] = Array.from({ length: YEARS * 12 }, (_, i) => {
  const month = i % 12
  return 15 - 8 * Math.cos(((month + 0.5) / 12) * 2 * Math.PI) + i * 0.02 + seasonNoise() * 0.7
})

const monthMeans = Array.from({ length: 12 }, (_, m) => mean(SEASONAL.filter((_, i) => i % 12 === m)))

/** Each value minus the mean of its calendar month */
export const ANOMALIES: number[] = SEASONAL.map((v, i) => v - monthMeans[i % 12])

// ---- Step 2: Sen slope on 16 yearly points with one odd year ----
const scatterNoise = makeNoise(21)
export const ODD_INDEX = 12

export const SCATTER: { x: number; y: number }[] = Array.from({ length: 16 }, (_, i) => ({
  x: i,
  y: 0.03 * i + scatterNoise() * 0.09 + (i === ODD_INDEX ? -0.6 : 0),
}))

/** Sen slope = median of the slopes between every pair of points; the line goes through the medians */
export const SEN = (() => {
  const slopes: number[] = []
  for (let i = 0; i < SCATTER.length; i++)
    for (let j = i + 1; j < SCATTER.length; j++)
      slopes.push((SCATTER[j].y - SCATTER[i].y) / (SCATTER[j].x - SCATTER[i].x))
  const slope = median(slopes)
  const intercept = median(SCATTER.map((p) => p.y - slope * p.x))
  return { slope, intercept }
})()

// ---- Step 3: sticky months (AR(1) noise with no trend) and the same noise pre-whitened ----
const N_STICKY = 72
const PHI = 0.85

function stickyFrom(seed: number) {
  const noise = makeNoise(seed)
  const white = Array.from({ length: N_STICKY }, () => noise())
  const sticky: number[] = []
  white.forEach((e, i) => sticky.push(i === 0 ? e : PHI * sticky[i - 1] + e))
  const drift = Math.abs(mean(sticky.slice(N_STICKY / 2)) - mean(sticky.slice(0, N_STICKY / 2)))
  return { white, sticky, drift }
}

/** Picks the seed whose sticky series drifts the most, to show how stickiness can look like a trend */
const STICKY_PICK = (() => {
  let best = stickyFrom(1)
  for (let seed = 2; seed <= 40; seed++) {
    const next = stickyFrom(seed)
    if (next.drift > best.drift) best = next
  }
  return best
})()

/** No trend at all, but each month leans on the one before */
export const STICKY: number[] = STICKY_PICK.sticky
/** The same series after removing the month-to-month stickiness */
export const WHITENED: number[] = STICKY_PICK.sticky.map((v, i, a) => (i === 0 ? v : v - PHI * a[i - 1]))
