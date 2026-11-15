// TEMPORARY dev preview: open the site with ?casefile=<case_id> (e.g. ?casefile=dana_valencia)
// to play a featured case alone, without the 3D game: witness scene (with stand-in figures),
// case file or evidence board + notebook, case closed. ?casefile alone (or an unknown id) lists every
// case that has a story script. ?casefile=<id>&hint shows the "in a case zone" tag first.
// Renders nothing without the parameter.
import { useState } from 'react'
import CaseFlow from './CaseFlow'
import CaseHint from './CaseHint'
import { hasTutorial, listTutorials } from './loader'
import { L } from '../../shared/i18n'
import './CaseFile.css'

const PARAMS = new URLSearchParams(window.location.search)
const PARAM = PARAMS.get('casefile')

export default function CaseFilePreview() {
  const [open, setOpen] = useState(!PARAMS.has('hint'))
  const [round, setRound] = useState(0)
  if (PARAM == null) return null
  if (!PARAM || !hasTutorial(PARAM)) return <CaseList unknown={PARAM || null} />
  return (
    <div className="casefile-preview">
      {open ? (
        <CaseFlow key={round} caseId={PARAM} onClose={() => setOpen(false)} />
      ) : (
        <>
          <CaseHint caseId={PARAM} />
          <button
            type="button"
            className="casefile-preview__reopen"
            onClick={() => {
              setRound((r) => r + 1)
              setOpen(true)
            }}
          >
            {L('Open the case again', 'Abrir el caso otra vez')}
          </button>
          <a className="casefile-preview__all" href="?casefile">
            {L('All case files', 'Todos los expedientes')}
          </a>
        </>
      )}
    </div>
  )
}

function CaseList({ unknown }: { unknown: string | null }) {
  const cases = listTutorials()
  return (
    <div className="casefile-preview casefile-preview--list">
      <section className="casefile-list">
        <h1 className="casefile-list__title">{L('Case files (preview)', 'Expedientes (vista previa)')}</h1>
        {unknown && (
          <p className="casefile-list__msg">
            {L(`No case file called “${unknown}” is ready. Pick one below.`, `No hay ningún expediente “${unknown}” listo. Elige uno de abajo.`)}
          </p>
        )}
        {cases.length === 0 ? (
          <p className="casefile-list__msg">{L('No case has a story script yet (data/tutorials/).', 'Ningún caso tiene guion todavía (data/tutorials/).')}</p>
        ) : (
          <ul className="casefile-list__items">
            {cases.map((c) => (
              <li key={c.id}>
                {c.hasData ? (
                  <a href={`?casefile=${encodeURIComponent(c.id)}`}>{c.title}</a>
                ) : (
                  <span>{c.title}</span>
                )}{' '}
                <code>{c.id}</code>
                {!c.hasData && <em> {L('(chart data not ready)', '(datos de la gráfica sin preparar)')}</em>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
