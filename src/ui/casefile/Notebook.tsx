// The detective's notebook next to the case file: the witness's claim pinned at the top, then one
// clue per solved step (its `clue`, or its takeaway when the script has none). A new clue lands
// with a small ink-stamp animation. On phones it folds into a bar above the case file.
import { useState } from 'react'
import './Notebook.css'

export interface NotebookClue {
  /** step id */
  id: string
  /** 1-based step number */
  n: number
  text: string
}

interface Props {
  claim?: string
  witnessName?: string
  clues: NotebookClue[]
  /** Total number of steps, for "3 of 8" */
  total: number
  /** Static copy on the case-closed screen (no folding, no animation) */
  variant?: 'side' | 'closed'
}

export default function Notebook({ claim, witnessName, clues, total, variant = 'side' }: Props) {
  const [open, setOpen] = useState(false)
  const side = variant === 'side'
  return (
    <aside className={`notebook notebook--${variant}${open ? ' is-open' : ''}`} aria-label="Detective's notebook">
      {side && (
        <button
          type="button"
          className="notebook__toggle"
          aria-expanded={open}
          aria-controls="notebook-pages"
          onClick={() => setOpen((o) => !o)}
        >
          <span>Notebook</span>
          {/* key: the badge pops again each time a clue is added */}
          <span key={clues.length} className="notebook__badge">
            {clues.length} / {total} clues
          </span>
          <span className="notebook__chev" aria-hidden="true">
            ▾
          </span>
        </button>
      )}
      <div className="notebook__pages" id={side ? 'notebook-pages' : undefined}>
        <span className="notebook__rings" aria-hidden="true" />
        <h2 className="notebook__title">{side ? "Detective's notebook" : 'From the notebook'}</h2>
        {claim && (
          <figure className="notebook__claim">
            <span className="notebook__pin" aria-hidden="true" />
            <p className="notebook__claim-label">Witness says:</p>
            <blockquote className="notebook__claim-text">&ldquo;{claim}&rdquo;</blockquote>
            {witnessName && <figcaption className="notebook__claim-who">— {witnessName}</figcaption>}
          </figure>
        )}
        <div aria-live="polite">
          {clues.length === 0 ? (
            <p className="notebook__empty">Solve each step to note a clue here.</p>
          ) : (
            <ol className="notebook__clues">
              {clues.map((c) => (
                <li key={c.id} className="notebook__clue">
                  <span className="notebook__stamp" aria-hidden="true">
                    Clue {c.n}
                  </span>
                  <span className="notebook__clue-text">
                    <span className="notebook__sr">Clue {c.n}: </span>
                    {c.text}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </aside>
  )
}
