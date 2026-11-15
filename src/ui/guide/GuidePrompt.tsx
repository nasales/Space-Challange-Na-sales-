// Tutorial offer: a comic panel shown once the map is drawn, the first time the player enters the
// game in this browser. "Start tutorial" calls the guide robot; "Skip" goes straight to the game.
// The app shell pauses the game while it is open. Keys: Enter = focused button, Esc = Skip,
// arrows / Tab move between the two buttons.
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { GUIDE_NAME } from './guideSteps'
import RobotFace from './RobotFace'
import './Guide.css'

interface Props {
  onStart: () => void
  onSkip: () => void
}

export default function GuidePrompt({ onStart, onSkip }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const startButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    startButton.current?.focus()
  }, [])

  // Esc skips. Capture phase and marked as handled, so the pause panel does not also open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape' || e.repeat) return
      e.preventDefault()
      onSkip()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onSkip])

  // Focus trap + arrow keys between the buttons (Enter/Space press the focused button natively)
  const onPanelKey = (e: ReactKeyboardEvent) => {
    const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    if (buttons.length === 0) return
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement)
    let next: number
    if (e.key === 'Tab') next = e.shiftKey ? i - 1 : i + 1
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = i + 1
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = i - 1
    else return
    e.preventDefault()
    buttons[(next + buttons.length) % buttons.length].focus()
  }

  return (
    <div className="guide-prompt">
      <div
        ref={panel}
        className="guide-prompt__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-prompt-title"
        aria-describedby="guide-prompt-text"
        onKeyDown={onPanelKey}
      >
        <p className="guide-prompt__label">New on the case?</p>
        <RobotFace className="guide-prompt__robot" />
        <h2 id="guide-prompt-title" className="guide-prompt__title">
          Tutorial
        </h2>
        <p id="guide-prompt-text" className="guide-prompt__text">
          {GUIDE_NAME} the robot can show you how the game works: how to move, the monuments, the magnifier and the
          featured cases. It takes about one minute.
        </p>
        <div className="guide-prompt__actions">
          <button ref={startButton} type="button" className="guide-button guide-button--main" onClick={onStart}>
            Start tutorial
          </button>
          <button type="button" className="guide-button" onClick={onSkip}>
            Skip
          </button>
        </div>
        <p className="guide-prompt__hint">You can also start it later from the pause menu (Esc).</p>
      </div>
    </div>
  )
}
