// Sen (Theil-Sen) line, for DRAWING only. The official numbers shown to the player come from
// filomena_level.json (pipeline/level_filomena.py -> analyze_trend), never from here.

export interface Line {
  slope: number
  intercept: number
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Median of the pairwise slopes; intercept = median(y) - slope * median(t), as scipy.stats.theilslopes. */
export function senLine(t: number[], y: number[]): Line | null {
  const n = t.length
  if (n < 2) return null
  const slopes: number[] = []
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      if (t[j] !== t[i]) slopes.push((y[j] - y[i]) / (t[j] - t[i]))
    }
  }
  if (slopes.length === 0) return null
  const slope = median(slopes)
  return { slope, intercept: median(y) - slope * median(t) }
}
