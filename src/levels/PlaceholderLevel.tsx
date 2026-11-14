// Placeholder for a featured case without its own level yet: title, question and the first series.
import { useEffect, useState } from 'react'
import type { CaseData } from '../shared/contract'
import LineChart from './LineChart'
import { fileVariable, getCaseEntry, loadCaseFile } from './data'
import type { CaseLevelProps } from './types'

type SeriesState = { status: 'loading' } | { status: 'ready'; data: CaseData } | { status: 'error'; message: string }

export default function PlaceholderLevel({ caseId, onExit }: CaseLevelProps) {
  const entry = getCaseEntry(caseId)
  const firstFile = entry?.files[0]
  const [series, setSeries] = useState<SeriesState>({ status: 'loading' })

  useEffect(() => {
    if (!firstFile) return
    const controller = new AbortController()
    loadCaseFile(firstFile, controller.signal)
      .then((data) => setSeries({ status: 'ready', data }))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setSeries({ status: 'error', message: String(err) })
      })
    return () => controller.abort()
  }, [firstFile])

  if (!entry) {
    return (
      <section className="lvl-card lvl-panel" data-testid="case-level">
        <p className="lvl-card__question">Unknown case: {caseId}</p>
        <button type="button" className="lvl-button" onClick={onExit}>
          Exit
        </button>
      </section>
    )
  }

  return (
    <section className="lvl-card lvl-panel" data-testid="case-level">
      <p className="lvl-kicker">Case file</p>
      <h2 className="lvl-card__title">{entry.title}</h2>
      <p className="lvl-card__place">{entry.place}</p>
      <p className="lvl-card__question">{entry.question}</p>
      <p className="lvl-card__context">{entry.context}</p>

      {firstFile && (
        <figure className="lvl-card__figure">
          {series.status === 'loading' && <p>Loading data…</p>}
          {series.status === 'error' && <p role="alert">Could not load the data: {series.message}</p>}
          {series.status === 'ready' && (
            <>
              <LineChart
                dates={series.data.dates}
                values={series.data.values}
                label={`${fileVariable(firstFile)} (${series.data.units})`}
              />
              <figcaption>
                {fileVariable(firstFile)} ({series.data.units}), monthly. Data: {series.data.dataset}
              </figcaption>
            </>
          )}
        </figure>
      )}

      <p className="lvl-card__note">This level is not built yet.</p>
      <button type="button" className="lvl-button" onClick={onExit}>
        Exit
      </button>
    </section>
  )
}
