// TEMPORARY dev preview: open the site with ?casefile=<case_id> (e.g. ?casefile=dana_valencia)
// to see the case file alone, without the game. ?casefile alone (or an unknown id) lists every
// case that has a story script, so the team can test each one. Renders nothing without the parameter.
// Remove this file and its line in src/App.tsx when the game opens cases by itself.
import { useState } from 'react'
import CaseFile from './CaseFile'
import CaseHint from './CaseHint'
import { hasTutorial, listTutorials } from './loader'
import './CaseFile.css'

const PARAMS = new URLSearchParams(window.location.search)
const PARAM = PARAMS.get('casefile')

export default function CaseFilePreview() {
  const [open, setOpen] = useState(true)
  if (PARAM == null) return null
  if (!PARAM || !hasTutorial(PARAM)) return <CaseList unknown={PARAM || null} />
  return (
    <div className="casefile-preview">
      {open ? (
        <CaseFile caseId={PARAM} onClose={() => setOpen(false)} />
      ) : (
        <>
          <CaseHint caseId={PARAM} />
          <button type="button" className="casefile-preview__reopen" onClick={() => setOpen(true)}>
            Open the case file again
          </button>
          <a className="casefile-preview__all" href="?casefile">
            All case files
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
        <h1 className="casefile-list__title">Case files (preview)</h1>
        {unknown && <p className="casefile-list__msg">No case file called &ldquo;{unknown}&rdquo; is ready. Pick one below.</p>}
        {cases.length === 0 ? (
          <p className="casefile-list__msg">No case has a story script yet (data/tutorials/).</p>
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
                {!c.hasData && <em> (chart data not ready)</em>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
