// Speed lines: streaks from the centre towards the screen edges.
// Their intensity (0 to 1) follows the speed; they only show with turbo.
import type { CSSProperties } from 'react'
import './SpeedLines.css'

const COUNT = 44
const LINES = Array.from({ length: COUNT }, (_, i) => ({
  angle: (i / COUNT) * 360 + ((i * 47) % 7), // spread in a circle, slightly irregular
  delay: ((i * 37) % 100) / 100, // each one starts at a different time
  length: 14 + ((i * 53) % 16), // vh
}))

export default function SpeedLines({ intensity }: { intensity: number }) {
  return (
    <div className="speed-lines" style={{ opacity: intensity }} aria-hidden="true">
      {LINES.map((l, i) => (
        <span
          key={i}
          className="speed-lines__line"
          style={
            {
              '--angle': `${l.angle}deg`,
              '--delay': `${-l.delay * 0.5}s`,
              '--length': `${l.length}vh`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
