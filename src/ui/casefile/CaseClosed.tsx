// Last screen of a featured case, after the tutorial: a "CASE CLOSED" rubber stamp, the
// verdict on the witness's claim (reveal.claim_verdict + claim_text), the
// clues from the notebook and what the statistics say. This is the only place the full statistical
// result of the case file is shown (the case file itself hands over to this screen).
import { useEffect, useRef } from 'react'
import type { Witness } from '../../shared/witness'
import { Header, StatsReveal } from './CaseFile'
import type { LoadedTutorial } from './loader'
import Notebook, { type NotebookClue } from './Notebook'
import { L } from '../../shared/i18n'
import './CaseFile.css'
import './CaseClosed.css'

interface Props {
  tutorial: LoadedTutorial
  witness?: Witness
  clues: NotebookClue[]
  onClose: () => void
}

const VERDICT_TEXT = {
  right: L('The witness was right', 'El testigo tenía razón'),
  wrong: L('The witness was wrong', 'El testigo se equivocaba'),
  partly: L('The witness was partly right', 'El testigo tenía razón en parte'),
} as const

export default function CaseClosed({ tutorial, witness, clues, onClose }: Props) {
  const { script, data } = tutorial
  const claim = script.scene?.claim
  const verdict = script.reveal.claim_verdict
  const witnessName = witness?.name ?? L('The witness', 'El testigo')

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
        <Header label={L(`Case closed · ${script.title}`, `Caso cerrado · ${script.title}`)} onClose={onClose} />
        <div className="casefile__body">
          <section className="casefile__screen">
            <div className="caseclosed__hero">
              <h2 id="caseclosed-title" className="caseclosed__stamp" ref={headingRef} tabIndex={-1}>
                <span>{L('Case closed', 'Caso cerrado')}</span>
              </h2>
              {verdict && (
                <p className={`caseclosed__verdict caseclosed__verdict--${verdict}`}>{VERDICT_TEXT[verdict]}</p>
              )}
            </div>

            {claim && (
              <div className="caseclosed__claim">
                <figure className="caseclosed__quote">
                  <span className="caseclosed__pin" aria-hidden="true" />
                  <p className="caseclosed__label">{L(`${witnessName} said`, `${witnessName} dijo`)}</p>
                  <blockquote>&ldquo;{claim}&rdquo;</blockquote>
                </figure>
                {script.reveal.claim_text && (
                  <div className="caseclosed__answer">
                    <p className="caseclosed__label">{L('The detective’s answer', 'La respuesta del detective')}</p>
                    <p>{script.reveal.claim_text}</p>
                  </div>
                )}
              </div>
            )}

            <p className="caseclosed__challenge is-solved" role="status">
              {L('Case solved: its marker turns green on the map.', 'Caso resuelto: su marcador se vuelve verde en el mapa.')}
            </p>

            {clues.length > 0 && <Notebook variant="closed" clues={clues} total={script.board?.items.length ?? script.interrogation?.evidence.length ?? script.steps.length} />}

            <h3 className="caseclosed__section">{L('What the statistics say', 'Lo que dice la estadística')}</h3>
            <StatsReveal script={script} data={data} />

            <div className="casefile__nav casefile__nav--end">
              <button type="button" className="casefile__btn casefile__btn--primary" onClick={onClose}>
                {L('Back to the map', 'Volver al mapa')}
              </button>
            </div>
          </section>
        </div>
      </div>
    </dialog>
  )
}
