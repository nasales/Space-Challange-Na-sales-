// Pause panel on the map: Esc opens a comic panel with "Resume" and "Main menu"; Esc again resumes.
// The panel only listens; the app shell decides what pausing means (the game ignores driving input
// while open). Esc priority: the magnifier picker handles Esc first and marks it handled
// (preventDefault), so an Esc that closes the picker never opens this panel.
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import SoundSliders from '../settings/SoundSliders'
import './PauseMenu.css'

interface Props {
  open: boolean
  /** Esc may open the panel now (false while the magnifier is up or flying) */
  canOpen: boolean
  onOpenChange: (open: boolean) => void
  onMainMenu: () => void
  /** Start the map tutorial (the app shell closes this panel) */
  onTutorial?: () => void
}

export default function PauseMenu({ open, canOpen, onOpenChange, onMainMenu, onTutorial }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const resumeButton = useRef<HTMLButtonElement>(null)

  // Latest values for the window key handler, which is attached only once. Layout effect, so the
  // ref is current before the browser paints: an Esc right after the game becomes ready must see it
  const state = useRef({ open, canOpen, onOpenChange })
  useLayoutEffect(() => {
    state.current = { open, canOpen, onOpenChange }
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape' || e.repeat || e.defaultPrevented) return
      const { open, canOpen, onOpenChange } = state.current
      if (!open && !canOpen) return
      e.preventDefault()
      onOpenChange(!open)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Focus "Resume" on open; give focus back to where it was on close
  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    resumeButton.current?.focus()
    return () => before?.focus?.()
  }, [open])

  if (!open) return null

  // Focus trap + arrow keys between the buttons and sliders (Enter/Space press the focused button natively)
  const onPanelKey = (e: ReactKeyboardEvent) => {
    // Buttons and the volume sliders (the sliders keep their own arrow keys)
    const buttons = Array.from(panel.current?.querySelectorAll<HTMLElement>('button, input') ?? [])
    if (buttons.length === 0) return
    const i = buttons.indexOf(document.activeElement as HTMLElement)
    let next: number
    if (e.key === 'Tab') next = e.shiftKey ? i - 1 : i + 1
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = i + 1
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = i - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = buttons.length - 1
    else return
    e.preventDefault()
    buttons[(next + buttons.length) % buttons.length].focus()
  }

  return (
    <div
      className="pause-menu"
      onMouseDown={(e) => {
        // A click on the backdrop resumes, like the menu's case files
        if (e.target === e.currentTarget) onOpenChange(false)
      }}
    >
      <div
        ref={panel}
        className="pause-menu__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-menu-title"
        onKeyDown={onPanelKey}
      >
        <p className="pause-menu__label">Case on hold</p>
        <h2 id="pause-menu-title" className="pause-menu__title">
          Paused
        </h2>
        <div className="pause-menu__actions">
          <button
            ref={resumeButton}
            type="button"
            className="pause-menu__button pause-menu__button--resume"
            onClick={() => onOpenChange(false)}
            data-sfx="off" // the app shell plays the close sound for every way of resuming
          >
            Resume
          </button>
          <button type="button" className="pause-menu__button pause-menu__button--menu" onClick={onMainMenu}>
            Main menu
          </button>
          {onTutorial && (
            <button type="button" className="pause-menu__button pause-menu__button--menu" onClick={onTutorial}>
              Tutorial
            </button>
          )}
        </div>
        <SoundSliders className="pause-menu__sound" />
        <p className="pause-menu__hint">
          <kbd>Esc</kbd> to resume
        </p>
      </div>
    </div>
  )
}
