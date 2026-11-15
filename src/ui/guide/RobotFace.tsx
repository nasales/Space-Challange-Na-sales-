// The guide robot's face as a small inline drawing (same shapes and colors as the 3D robot in
// src/game/guide/createGuideBot.ts): dome, dark visor, two glowing eyes, ear caps and an antenna.
// talking: the eyes and the antenna bulb pulse (CSS, see Guide.css).

export default function RobotFace({ className = '', talking = false }: { className?: string; talking?: boolean }) {
  return (
    <svg
      className={`robot-face${talking ? ' is-talking' : ''} ${className}`}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Guide robot"
    >
      <line x1="32" y1="6" x2="32" y2="17" stroke="#161b2e" strokeWidth="3" strokeLinecap="round" />
      <circle className="robot-face__bulb" cx="32" cy="6" r="4.5" fill="#ff5a4f" stroke="#161b2e" strokeWidth="2.5" />
      <rect x="3" y="30" width="8" height="14" rx="3" fill="#2bb3c0" stroke="#161b2e" strokeWidth="2.5" />
      <rect x="53" y="30" width="8" height="14" rx="3" fill="#2bb3c0" stroke="#161b2e" strokeWidth="2.5" />
      <rect x="9" y="16" width="46" height="42" rx="19" fill="#f6f1e4" stroke="#161b2e" strokeWidth="3" />
      <rect x="15" y="27" width="34" height="19" rx="9.5" fill="#1b2140" stroke="#161b2e" strokeWidth="2.5" />
      <circle className="robot-face__eye" cx="25" cy="36.5" r="4" fill="#7df9ff" />
      <circle className="robot-face__eye" cx="39" cy="36.5" r="4" fill="#7df9ff" />
    </svg>
  )
}
