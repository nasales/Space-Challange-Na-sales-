// Small comic tag shown while the detective is in a featured case's trigger zone (HudState.caseZone).
// It only informs: the app shell listens for Space and opens the case flow.
// With a witness it names them, shows their portrait and says where to look (they stand by the
// case marker). hidden: fades out when the case opens (dialogue focus).
import { getWitness } from '../../shared/witness'
import { WitnessFigure } from './Figure'
import { caseTitle } from './loader'
import './CaseHint.css'

interface Props {
  caseId: string | null
  /** The detective stands still (Space works) */
  stopped?: boolean
  hidden?: boolean
}

export default function CaseHint({ caseId, stopped = true, hidden = false }: Props) {
  if (!caseId) return null
  const witness = getWitness(caseId)
  const what = witness ? `talk to ${witness.name}` : 'open the case file'
  return (
    <div className={`case-hint${stopped ? ' is-ready' : ''}${hidden ? ' is-hidden' : ''}`} role="status" aria-hidden={hidden || undefined}>
      {witness ? (
        <span className="case-hint__face" aria-hidden="true">
          <WitnessFigure look={witness.look} crop="head" />
        </span>
      ) : (
        <span className="case-hint__mark" aria-hidden="true">
          !
        </span>
      )}
      <p className="case-hint__text">
        <span className="case-hint__label">Case: {caseTitle(caseId)}</span>
        <span className="case-hint__action">
          {stopped ? (
            <>
              Press <kbd>Space</kbd> to {what}
            </>
          ) : (
            <>Stand still to {what}</>
          )}
        </span>
        {witness && (
          <span className="case-hint__where">
            Look for {witness.name}, the {lowerFirst(witness.role.split(',')[0])} by the case marker.
          </span>
        )}
      </p>
    </div>
  )
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
