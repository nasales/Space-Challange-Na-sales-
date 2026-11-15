// A "case file" comic panel shown over the menu, with a caption-box header. Uses the native <dialog> element, so the browser
// keeps focus inside it and Escape closes it. A click on the backdrop also closes it.
import { useEffect, useRef, type ReactNode } from 'react'
import { L } from '../../shared/i18n'

interface CaseFileDialogProps {
  label: string
  title: string
  onClose: () => void
  children: ReactNode
}

export default function CaseFileDialog({ label, title, onClose, children }: CaseFileDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = `case-file-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      className="case-file"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // The dialog box is fully covered by its sheet, so a click whose target is the
        // dialog itself landed on the backdrop.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="case-file__sheet">
        <div className="case-file__head">
          <p className="case-file__label">{label}</p>
          <button type="button" className="case-file__close" onClick={onClose} autoFocus>
            <svg className="case-file__close-icon" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 4l12 12M16 4L4 16" />
            </svg>
            {L('Close', 'Cerrar')}
          </button>
        </div>
        <h2 id={titleId} className="case-file__title">
          {title}
        </h2>
        <div className="case-file__body">{children}</div>
      </div>
    </dialog>
  )
}
