// Dev preview page of the featured case levels (rendered by preview.tsx at /levels.html).
import { useState } from 'react'
import CaseLevel from './CaseLevel'
import { CASES } from './data'

export default function PreviewApp() {
  const [caseId, setCaseId] = useState('')
  const [lastResult, setLastResult] = useState('')

  return (
    <main className="lvl-preview">
      <header className="lvl-preview__bar lvl-panel">
        <label htmlFor="lvl-case">Featured case</label>
        <select id="lvl-case" data-testid="case-select" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
          <option value="">Pick a case…</option>
          {CASES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <span className="lvl-preview__count">{CASES.length} cases</span>
        {lastResult && <span className="lvl-preview__result">{lastResult}</span>}
      </header>

      {caseId ? (
        <CaseLevel
          caseId={caseId}
          onExit={() => setCaseId('')}
          onResult={(r) => setLastResult(`${r.caseId}: ${r.correct ? 'correct' : 'wrong'}`)}
        />
      ) : (
        <ul className="lvl-preview__list" data-testid="case-list">
          {CASES.map((c) => (
            <li key={c.id}>
              <button type="button" className="lvl-preview__link" onClick={() => setCaseId(c.id)}>
                {c.title}
              </button>{' '}
              — {c.place}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
