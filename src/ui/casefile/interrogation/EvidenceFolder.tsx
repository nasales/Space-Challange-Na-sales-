// One evidence folder opened on the interrogation table: the typed note and the suspect it is
// meant for on the left, the hands-on task on the right, then "Confront the suspect": does this
// evidence break the alibi, back it, or leave reasonable doubt? A wrong pick gives a kind hint;
// the right one shows the evidence's feedback, its notebook clue and "File it".
import { useEffect, useRef, useState } from 'react'
import type { AlibiVerdict, InterrogationEvidence, Suspect, TutorialData } from '../../../shared/tutorial'
import { Burst } from '../board/tasks'
import { fixText } from '../format'
import { VERDICTS, VERDICT_LABEL, verdictHint } from './labels'
import SuspectArt from './SuspectArt'
import { InterrogationTaskView } from './tasks'
import { L } from '../../../shared/i18n'

interface Props {
  evidence: InterrogationEvidence
  /** 1-based folder number */
  n: number
  suspect: Suspect
  /** 1-based number of the suspect in the line-up */
  suspectN: number
  data: TutorialData
  solved: boolean
  confronted: boolean
  onSolved: () => void
  /** The right verdict was picked and the player files the folder (closes it) */
  onConfront: () => void
  onClose: () => void
}

export default function EvidenceFolder({ evidence, n, suspect, suspectN, data, solved, confronted, onSolved, onConfront, onClose }: Props) {
  const [pick, setPick] = useState<{ v: AlibiVerdict; n: number } | null>(confronted ? { v: evidence.verdict, n: 0 } : null)
  const right = pick?.v === evidence.verdict
  const headingRef = useRef<HTMLHeadingElement>(null)
  const confrontRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])
  // when the task is solved, bring the confrontation into view
  const [wasSolved] = useState(solved)
  useEffect(() => {
    if (solved && !wasSolved) {
      const t = window.setTimeout(() => confrontRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 450)
      return () => window.clearTimeout(t)
    }
  }, [solved, wasSolved])

  return (
    <div className="ixfolder" role="dialog" aria-modal="true" aria-labelledby={`ixfolder-title-${evidence.id}`}>
      <div className="ixfolder__sheet">
        <span className="ixfolder__tab" aria-hidden="true">
          {L(`Evidence ${n}`, `Prueba ${n}`)}
        </span>
        <button type="button" className="ixfolder__close" onClick={onClose}>
          {L('Back to the table', 'Volver a la mesa')} <kbd>Esc</kbd>
        </button>

        <div className="ixfolder__side">
          <p className="ixfolder__kind">
            {L(`Folder ${n} · to put to ${suspect.name}`, `Carpeta ${n} · para presentar a ${suspect.name}`)}
          </p>
          <h2 id={`ixfolder-title-${evidence.id}`} className="ixfolder__title" ref={headingRef} tabIndex={-1}>
            {evidence.title}
          </h2>
          <div className="evnote">
            <p className="evfocus__text">{fixText(evidence.text)}</p>
          </div>
          <figure className="ixmugshot">
            <div className="ixmugshot__pic">
              <SuspectArt look={suspect.look} n={suspectN} crop="head" />
            </div>
            <figcaption>
              <b>{suspect.name}</b>
              <span>
                {L('Alibi:', 'Coartada:')} &ldquo;{fixText(suspect.alibi)}&rdquo;
              </span>
            </figcaption>
          </figure>
        </div>

        <div className="ixfolder__task">
          <InterrogationTaskView evidence={evidence} data={data} done={solved} onSolved={onSolved} />

          {solved && (
            <div className="ixconfront" ref={confrontRef}>
              <h3 className="ixconfront__title">{L(`Confront ${suspect.name}`, `Enfréntate a ${suspect.name}`)}</h3>
              <p className="ixconfront__alibi">
                <span>{L(`${suspect.name} says:`, `${suspect.name} dice:`)}</span> &ldquo;{fixText(suspect.alibi)}&rdquo;
              </p>
              <p className="ixconfront__ask">{L('What does this evidence do to the alibi?', '¿Qué le hace esta prueba a la coartada?')}</p>
              <div className="ixconfront__choices" role="group" aria-label={L('What this evidence does to the alibi', 'Qué le hace esta prueba a la coartada')}>
                {VERDICTS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`ixconfront__choice ixconfront__choice--${v}${pick?.v === v ? (right ? ' is-right' : ' is-wrong') : ''}`}
                    aria-pressed={pick?.v === v}
                    disabled={right && v !== evidence.verdict}
                    onClick={() => !right && setPick((p) => ({ v, n: (p?.n ?? 0) + 1 }))}
                  >
                    {VERDICT_LABEL[v]}
                  </button>
                ))}
              </div>
              <div aria-live="polite">
                {pick && !right && (
                  <p key={pick.n} className="evtask__feedback evtask__feedback--wrong">
                    <b>{L(`${suspect.name} smiles.`, `${suspect.name} sonríe.`)}</b> {verdictHint(pick.v, evidence.verdict)} {L('Try again.', 'Inténtalo de nuevo.')}
                  </p>
                )}
                {right && (
                  <div className="ixconfront__done">
                    <p className="evtask__feedback evtask__feedback--right">
                      {!confronted && <Burst />}
                      <b>{L('Right call.', 'Bien visto.')}</b> {fixText(evidence.verdict_feedback)}
                    </p>
                    <p className="evlink__clue">
                      <span>{L('Clue for the notebook', 'Pista para la libreta')}</span> {fixText(evidence.clue)}
                    </p>
                    <button type="button" className="evbtn evbtn--primary evbtn--big" onClick={confronted ? onClose : onConfront} autoFocus>
                      {confronted ? L('Back to the table', 'Volver a la mesa') : L('File it', 'Archivarla')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
