// Small comic tag shown while the detective is in a featured case's trigger zone (HudState.caseZone).
// It only informs: the app shell listens for Space and opens the case flow.
import { getWitness } from '../../shared/witness'
import { caseTitle } from './loader'
import './CaseHint.css'

export default function CaseHint({ caseId, stopped = true }: { caseId: string | null; stopped?: boolean }) {
  if (!caseId) return null
  const witness = getWitness(caseId)
  const what = witness ? `talk to ${witness.name}` : 'open the case file'
  return (
    <div className={`case-hint${stopped ? ' is-ready' : ''}`} role="status">
      <span className="case-hint__mark" aria-hidden="true">
        !
      </span>
      <p className="case-hint__text">
        <span className="case-hint__label">Case: {caseTitle(caseId)}</span>
        <span className="case-hint__action">
          {stopped ? (
            <>
              Press <kbd>Space</kbd> to {what}
            </>
          ) : (
            <>Stop the car to {what}</>
          )}
        </span>
      </p>
    </div>
  )
}
