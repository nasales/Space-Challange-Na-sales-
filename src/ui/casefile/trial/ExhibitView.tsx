// One exhibit opened on the easel: the exhibit itself on the left (tag, the lawyer's argument,
// what it shows), its hands-on task on the right, then the judge's ruling (admit / reject /
// insufficient). A wrong ruling draws an "Objection!" with a kind hint; the right one stamps the
// exhibit, may ask a follow-up question (e.g. how much weight it carries) and gives the clue
// that goes into the record (the notebook).
import { useEffect, useRef, useState } from 'react'
import type { TrialExhibit, TrialRuling, TutorialData } from '../../../shared/tutorial'
import { fixText } from '../format'
import { Burst } from '../board/tasks'
import { Lawyer } from './art'
import { RULING_BUTTON, RULING_STAMP, RULINGS, SIDE_LABEL } from './labels'
import { TrialTaskView } from './tasks'
import { L } from '../../../shared/i18n'

interface Props {
  exhibit: TrialExhibit
  letter: string
  data: TutorialData
  claim?: string
  /** task solved earlier (re-opened exhibit) */
  solved: boolean
  /** ruled and entered into the record earlier: everything shows in its final state */
  entered: boolean
  onSolved: () => void
  /** The right ruling (and follow-up) is done and the judge enters it into the record */
  onEnter: () => void
  onClose: () => void
}

export default function ExhibitView({ exhibit, letter, data, claim, solved, entered, onSolved, onEnter, onClose }: Props) {
  const [pick, setPick] = useState<{ r: TrialRuling; n: number } | null>(entered ? { r: exhibit.ruling, n: 0 } : null)
  const right = pick?.r === exhibit.ruling
  const fu = exhibit.follow_up
  const fuRight = fu ? fu.options.findIndex((o) => o.correct) : -1
  const [fuPick, setFuPick] = useState<{ i: number; n: number } | null>(entered && fu ? { i: fuRight, n: 0 } : null)
  const fuDone = !fu || fuPick?.i === fuRight
  const headingRef = useRef<HTMLHeadingElement>(null)
  const rulingRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])
  // when the task is solved, bring the ruling into view
  const [wasSolved] = useState(solved)
  useEffect(() => {
    if (solved && !wasSolved) {
      const t = window.setTimeout(() => rulingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 450)
      return () => window.clearTimeout(t)
    }
  }, [solved, wasSolved])

  const missing = exhibit.kind === 'missing'
  const other = exhibit.side === 'prosecution' ? 'defence' : 'prosecution'

  return (
    <div className={`trexhibit trexhibit--${exhibit.side}`} role="dialog" aria-modal="true" aria-labelledby={`trexhibit-${exhibit.id}`}>
      <div className="trexhibit__card">
        <button type="button" className="evfocus__close" onClick={onClose}>
          {L('Back to the court', 'Volver a la sala')} <kbd>Esc</kbd>
        </button>

        <div className="trexhibit__item">
          <p className={`trtag trtag--${exhibit.side}`}>
            <span className="trtag__hole" aria-hidden="true" />
            {L(`Exhibit ${letter}`, `Prueba ${letter}`)}
            <small>{SIDE_LABEL[exhibit.side]}</small>
          </p>
          <h2 id={`trexhibit-${exhibit.id}`} className="evfocus__title" ref={headingRef} tabIndex={-1}>
            {fixText(exhibit.title)}
          </h2>
          <figure className="trargument">
            <span className="trargument__who" aria-hidden="true">
              <Lawyer side={exhibit.side} crop="head" />
            </span>
            <blockquote>&ldquo;{fixText(exhibit.argument)}&rdquo;</blockquote>
            <figcaption>{SIDE_LABEL[exhibit.side]}</figcaption>
          </figure>
          <div className={missing ? 'trnote trnote--missing' : 'evnote'}>
            <p className="evfocus__text">{fixText(exhibit.text)}</p>
          </div>
        </div>

        <div className="evfocus__task">
          <TrialTaskView exhibit={exhibit} data={data} done={solved} onSolved={onSolved} />

          {solved && (
            <div className="trruling" ref={rulingRef}>
              <h3 className="trruling__title">{L('Your ruling, Your Honour', 'Su decisión, señoría')}</h3>
              {claim && (
                <p className="evlink__claim">
                  {L('The charge:', 'La acusación:')} &ldquo;{claim}&rdquo;
                </p>
              )}
              <p className="evlink__ask">
                {L(
                  `Does Exhibit ${letter} show what the ${SIDE_LABEL[exhibit.side].toLowerCase()} says?`,
                  `¿La prueba ${letter} demuestra lo que dice la ${SIDE_LABEL[exhibit.side].toLowerCase()}?`,
                )}
              </p>
              <div className="trruling__choices" role="group" aria-label={L('Your ruling', 'Tu decisión')}>
                {RULINGS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`trruling__choice trruling__choice--${r}${pick?.r === r ? (right ? ' is-right' : ' is-wrong') : ''}`}
                    aria-pressed={pick?.r === r}
                    disabled={right && r !== exhibit.ruling}
                    onClick={() => !right && setPick((p) => ({ r, n: (p?.n ?? 0) + 1 }))}
                  >
                    <b>{RULING_BUTTON[r].label}</b>
                    <small>{RULING_BUTTON[r].help}</small>
                  </button>
                ))}
              </div>
              <div aria-live="polite">
                {pick && !right && (
                  <div key={pick.n} className={`trobjection trobjection--${other}`}>
                    <span className="trobjection__burst" aria-hidden="true">
                      {L('Objection!', '¡Protesto!')}
                    </span>
                    <p>{fixText(exhibit.objection)}</p>
                  </div>
                )}
                {right && (
                  <div className="trruling__done">
                    <p className="evtask__feedback evtask__feedback--right">
                      {!entered && <Burst />}
                      <span className={`trstamp trstamp--${exhibit.ruling}`}>{RULING_STAMP[exhibit.ruling]}</span>
                      {fixText(exhibit.ruling_feedback)}
                    </p>
                  </div>
                )}
              </div>
              {right && fu && (
                <fieldset className="evoptions trfollow">
                  <legend className="evoptions__prompt">{fixText(fu.prompt)}</legend>
                  {fu.options.map((o, i) => {
                    const state = fuPick?.i === i ? (o.correct ? 'right' : 'wrong') : undefined
                    return (
                      <button
                        key={o.text}
                        type="button"
                        className={`casefile__option${state ? ` is-${state}` : ''}`}
                        aria-pressed={fuPick?.i === i}
                        disabled={fuDone && !o.correct}
                        onClick={() => !fuDone && setFuPick((p) => ({ i, n: (p?.n ?? 0) + 1 }))}
                      >
                        <span className="casefile__option-letter" aria-hidden="true">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {fixText(o.text)}
                      </button>
                    )
                  })}
                  <div aria-live="polite">
                    {fuPick && !fuDone && (
                      <p key={fuPick.n} className="evtask__feedback evtask__feedback--wrong">
                        <b>{L('Think again.', 'Piénsalo otra vez.')}</b> {fixText(fu.hint)}
                      </p>
                    )}
                    {fuDone && <p className="evtask__feedback evtask__feedback--right">{fixText(fu.feedback)}</p>}
                  </div>
                </fieldset>
              )}
              {right && fuDone && (
                <div className="evlink__done">
                  <p className="evlink__clue">
                    <span>{L('Into the record', 'Al acta')}</span> {fixText(exhibit.clue)}
                  </p>
                  <button type="button" className="evbtn evbtn--primary evbtn--big" onClick={entered ? onClose : onEnter} autoFocus>
                    {entered ? L('Back to the court', 'Volver a la sala') : L('Enter it into the record', 'Que conste en acta')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
