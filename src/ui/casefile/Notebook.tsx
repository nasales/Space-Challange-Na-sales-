// The detective's notebook next to the case file: the witness's claim pinned at the top, then one
// clue per solved step (its `clue`, or its takeaway when the script has none). A new clue lands
// with a small ink-stamp animation. On phones it folds into a bar above the case file.
import { useState } from 'react'
import { L } from '../../shared/i18n'
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
  /** Shown while no clue is noted yet */
  emptyText?: string
}

export default function Notebook({ claim, witnessName, clues, total, variant = 'side', emptyText = L('Solve each step to note a clue here.', 'Resuelve cada paso para anotar aquí una pista.') }: Props) {
  const [open, setOpen] = useState(false)
  const side = variant === 'side'
  return (
    <aside className={`notebook notebook--${variant}${open ? ' is-open' : ''}`} aria-label={L("Detective's notebook", 'Libreta del detective')}>
      {side && (
        <button
          type="button"
          className="notebook__toggle"
          aria-expanded={open}
          aria-controls="notebook-pages"
          onClick={() => setOpen((o) => !o)}
        >
          <span>{L('Notebook', 'Libreta')}</span>
          {/* key: the badge pops again each time a clue is added */}
          <span key={clues.length} className="notebook__badge">
            {L(`${clues.length} / ${total} clues`, `${clues.length} / ${total} pistas`)}
          </span>
          <span className="notebook__chev" aria-hidden="true">
            ▾
          </span>
        </button>
      )}
      <div className="notebook__pages" id={side ? 'notebook-pages' : undefined}>
        <span className="notebook__rings" aria-hidden="true" />
        <h2 className="notebook__title">{side ? L("Detective's notebook", 'Libreta del detective') : L('From the notebook', 'De la libreta')}</h2>
        {claim && (
          <figure className="notebook__claim">
            <span className="notebook__pin" aria-hidden="true" />
            <p className="notebook__claim-label">{L('Witness says:', 'El testigo dice:')}</p>
            <blockquote className="notebook__claim-text">&ldquo;{claim}&rdquo;</blockquote>
            {witnessName && <figcaption className="notebook__claim-who">— {witnessName}</figcaption>}
          </figure>
        )}
        <div aria-live="polite">
          {clues.length === 0 ? (
            <p className="notebook__empty">{emptyText}</p>
          ) : (
            <ol className="notebook__clues">
              {clues.map((c) => (
                <li key={c.id} className="notebook__clue">
                  <span className="notebook__stamp" aria-hidden="true">
                    {L(`Clue ${c.n}`, `Pista ${c.n}`)}
                  </span>
                  <span className="notebook__clue-text">
                    <span className="notebook__sr">{L(`Clue ${c.n}: `, `Pista ${c.n}: `)}</span>
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
