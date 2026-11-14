// TEMPORARY dev preview: open the site with ?casefile=<case_id> (e.g. ?casefile=dana_valencia)
// to see the case file alone, without the game. Renders nothing without the parameter.
// Remove this file and its line in src/App.tsx when the game opens cases by itself.
import { useState } from 'react'
import CaseFile from './CaseFile'
import CaseHint from './CaseHint'

const PARAM = new URLSearchParams(window.location.search).get('casefile')

export default function CaseFilePreview() {
  const [open, setOpen] = useState(true)
  if (!PARAM) return null
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
        </>
      )}
    </div>
  )
}
