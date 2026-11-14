// Public interface of a featured case level (src/levels/, Ivan).
// Integration in the game = render <CaseLevel caseId=... onExit=... /> from App.tsx.

export interface CaseLevelProps {
  /** Case id from data/cases_index.json, e.g. "dana_valencia" */
  caseId: string
  /** Called when the player leaves the level */
  onExit: () => void
  /** Called when the player finishes the level */
  onResult?: (r: { caseId: string; correct: boolean; score?: number }) => void
}
