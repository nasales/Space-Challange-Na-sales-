// Last screen of a featured case, after the final challenge: a "CASE CLOSED" rubber stamp, the
// verdict on the witness's claim (reveal.claim_verdict + claim_text), the player's conclusion, the
// clues from the notebook and what the statistics say. This is the only place the full statistical
// result of the case file is shown (the case file itself hands over to the final challenge).
import { useEffect, useRef } from 'react'
import type { Witness } from '../../shared/witness'
import { Header, StatsReveal } from './CaseFile'
import type { LoadedTutorial } from './loader'
import Notebook, { type NotebookClue } from './Notebook'
import './CaseFile.css'
import './CaseClosed.css'

export interface LevelResult {
  correct: boolean
  score?: number
}

interface Props {
  tutorial: LoadedTutorial
  witness?: Witness
  conclusion: string
  clues: NotebookClue[]
  /** null: the final challenge was left without a result */
  result: LevelResult | null
  onClose: () => void
}

const VERDICT_TEXT = {
  right: 'The witness was right',
  wrong: 'The witness was wrong',
  partly: 'The witness was partly right',
} as const

export default function CaseClosed({ tutorial, witness, conclusion, clues, result, onClose }: Props) {
  const { script, data } = tutorial
  const claim = script.scene?.claim
  const verdict = script.reveal.claim_verdict
  const witnessName = witness?.name ?? 'The witness'

  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    headingRef.current?.focus({ preventScroll: true })
    return () => {
      if (dialog?.open) dialog.close()
    }
  }, [])

  return (
    <dialog ref={dialogRef} className="casefile caseclosed" aria-labelledby="caseclosed-title" onCancel={(e) => e.preventDefault()}>
      <div className="casefile__sheet">
        <Header label={`Case closed · ${script.title}`} onClose={onClose} />
        <div className="casefile__body">
          <section className="casefile__screen">
            <div className="caseclosed__hero">
              <h2 id="caseclosed-title" className="caseclosed__stamp" ref={headingRef} tabIndex={-1}>
                <span>Case closed</span>
              </h2>
              {verdict && (
                <p className={`caseclosed__verdict caseclosed__verdict--${verdict}`}>{VERDICT_TEXT[verdict]}</p>
              )}
            </div>

            {claim && (
              <div className="caseclosed__claim">
                <figure className="caseclosed__quote">
                  <span className="caseclosed__pin" aria-hidden="true" />
                  <p className="caseclosed__label">{witnessName} said</p>
                  <blockquote>&ldquo;{claim}&rdquo;</blockquote>
                </figure>
                {script.reveal.claim_text && (
                  <div className="caseclosed__answer">
                    <p className="caseclosed__label">The detective&rsquo;s answer</p>
                    <p>{script.reveal.claim_text}</p>
                  </div>
                )}
              </div>
            )}

            <p className={`caseclosed__challenge${result?.correct ? ' is-solved' : ''}`} role="status">
              {result?.correct
                ? 'Final test passed: the case marker turns green on the map.'
                : result
                  ? 'Final test not passed yet: come back to this marker and try again to turn it green.'
                  : 'You left the final test before the end: come back to this marker to finish it.'}
            </p>

            {conclusion && (
              <blockquote className="casefile__yours">
                <p className="casefile__note-label">Your conclusion</p>
                <p className="casefile__yours-text">{conclusion}</p>
              </blockquote>
            )}

            {clues.length > 0 && <Notebook variant="closed" clues={clues} total={script.steps.length} />}

            <h3 className="caseclosed__section">What the statistics say</h3>
            {/*
              TODO(ai-checker): the AI checker verdict on the player's conclusion goes here.
              Call it with { case_id: script.case_id, variable: script.conclusion.variable,
              conclusion } and show its verdict. If it fails or takes more than 8 s, show nothing
              extra: the statistics below are the fallback (docs/agents/interface.md, check 5).
            */}
            <StatsReveal script={script} data={data} />

            <div className="casefile__nav casefile__nav--end">
              <button type="button" className="casefile__btn casefile__btn--primary" onClick={onClose}>
                Back to the map
              </button>
            </div>
          </section>
        </div>
      </div>
    </dialog>
  )
}
