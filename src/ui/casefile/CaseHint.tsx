// Small comic tag shown while the car is next to a featured-case marker (onCaseNear).
// It only informs: Enter is handled by the game, which then emits onCaseOpen.
import { caseTitle } from './loader'
import './CaseHint.css'

export default function CaseHint({ caseId }: { caseId: string | null }) {
  if (!caseId) return null
  return (
    <div className="case-hint" role="status">
      <span className="case-hint__mark" aria-hidden="true">
        !
      </span>
      <p className="case-hint__text">
        <span className="case-hint__label">Case file:</span> <b>{caseTitle(caseId)}</b>
        <span className="case-hint__action">
          {' '}
          — press <kbd>Enter</kbd> to open
        </span>
      </p>
    </div>
  )
}
