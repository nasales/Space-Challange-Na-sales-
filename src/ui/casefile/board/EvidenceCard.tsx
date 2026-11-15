// One evidence item opened from the board: the item itself on the left (typed note, newspaper
// clipping or data card), its hands-on task on the right, then "Link it to the claim".
import { useEffect, useRef, useState } from 'react'
import type { EvidenceItem, EvidenceRelation, TutorialData } from '../../../shared/tutorial'
import { fixText } from '../format'
import { KIND_LABEL, RELATION_LABEL, RELATIONS } from './labels'
import { Burst, TaskView } from './tasks'
import { L } from '../../../shared/i18n'

interface Props {
  item: EvidenceItem
  /** 1-based number on the board */
  n: number
  data: TutorialData
  claim?: string
  solved: boolean
  linked: boolean
  onSolved: () => void
  /** The right relation was picked and the player pins it (closes the card) */
  onLink: () => void
  onClose: () => void
}

export default function EvidenceCard({ item, n, data, claim, solved, linked, onSolved, onLink, onClose }: Props) {
  const [pick, setPick] = useState<{ rel: EvidenceRelation; n: number } | null>(linked ? { rel: item.relation, n: 0 } : null)
  const right = pick?.rel === item.relation
  const headingRef = useRef<HTMLHeadingElement>(null)
  const linkRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])
  // when the task is solved, bring the link step into view
  const [wasSolved] = useState(solved)
  useEffect(() => {
    if (solved && !wasSolved) {
      const t = window.setTimeout(() => linkRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 450)
      return () => window.clearTimeout(t)
    }
  }, [solved, wasSolved])

  return (
    <div
      className={`evfocus evfocus--${item.kind}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`evfocus-title-${item.id}`}
    >
      <div className="evfocus__card">
        <span className="evpin evpin--focus" aria-hidden="true" />
        <button type="button" className="evfocus__close" onClick={onClose}>
          {L('Back to the board', 'Volver al tablón')} <kbd>Esc</kbd>
        </button>

        <div className="evfocus__item">
          <p className="evfocus__kind">
            {L(`Evidence ${n} · ${KIND_LABEL[item.kind]}`, `Prueba ${n} · ${KIND_LABEL[item.kind]}`)}
          </p>
          <h2 id={`evfocus-title-${item.id}`} className="evfocus__title" ref={headingRef} tabIndex={-1}>
            {item.title}
          </h2>
          {item.kind === 'clipping' && item.clipping && (
            <article className="evclipping">
              <p className="evclipping__mast">{L('Local paper', 'Diario local')}{item.clipping.date ? ` · ${item.clipping.date}` : ''}</p>
              <h3 className="evclipping__headline">{fixText(item.clipping.headline)}</h3>
              <p className="evclipping__body">{fixText(item.clipping.body)}</p>
            </article>
          )}
          <div className={item.kind === 'datacard' ? 'evdatacard' : 'evnote'}>
            {item.kind === 'datacard' && <p className="evdatacard__head">{L('Data card no.', 'Ficha de datos n.º')} {String(n).padStart(3, '0')}</p>}
            <p className="evfocus__text">{fixText(item.text)}</p>
          </div>
        </div>

        <div className="evfocus__task">
          <TaskView item={item} data={data} done={solved} onSolved={onSolved} />

          {solved && (
            <div className="evlink" ref={linkRef}>
              <h3 className="evlink__title">{L('Link it to the claim', 'Enlázala con la afirmación')}</h3>
              {claim && <p className="evlink__claim">&ldquo;{claim}&rdquo;</p>}
              <p className="evlink__ask">{L('Does this evidence support the claim, contradict it, or say nothing about it?', '¿Esta prueba apoya la afirmación, la contradice o no dice nada al respecto?')}</p>
              <div className="evlink__choices" role="group" aria-label={L('How this evidence relates to the claim', 'Relación de esta prueba con la afirmación')}>
                {RELATIONS.map((rel) => (
                  <button
                    key={rel}
                    type="button"
                    className={`evlink__choice evlink__choice--${rel}${pick?.rel === rel ? (right ? ' is-right' : ' is-wrong') : ''}`}
                    aria-pressed={pick?.rel === rel}
                    disabled={right && rel !== item.relation}
                    onClick={() => !right && setPick((p) => ({ rel, n: (p?.n ?? 0) + 1 }))}
                  >
                    {RELATION_LABEL[rel]}
                  </button>
                ))}
              </div>
              <div aria-live="polite">
                {pick && !right && (
                  <p key={pick.n} className="evtask__feedback evtask__feedback--wrong">
                    <b>{L('Think again.', 'Piénsalo otra vez.')}</b> {fixText(item.relation_feedback)}
                  </p>
                )}
                {right && (
                  <div className="evlink__done">
                    <p className="evtask__feedback evtask__feedback--right">
                      {!linked && <Burst />}
                      <b>{L('Linked!', '¡Enlazada!')}</b> {fixText(item.relation_feedback)}
                    </p>
                    <p className="evlink__clue">
                      <span>{L('Clue for the notebook', 'Pista para la libreta')}</span> {fixText(item.clue)}
                    </p>
                    <button type="button" className="evbtn evbtn--primary evbtn--big" onClick={linked ? onClose : onLink} autoFocus>
                      {linked ? L('Back to the board', 'Volver al tablón') : L('Pin it with red string', 'Clávala con hilo rojo')}
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
