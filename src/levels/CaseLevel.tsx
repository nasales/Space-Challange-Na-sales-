// Entry point of a featured case level. Integration in the game (later, one line in App.tsx):
//   <CaseLevel caseId={id} onExit={...} onResult={...} />
import { createElement } from 'react'
import PlaceholderLevel from './PlaceholderLevel'
import { LEVELS } from './registry'
import type { CaseLevelProps } from './types'
import './theme.css'
import './levels.css'

export default function CaseLevel(props: CaseLevelProps) {
  // key: a new case starts from a fresh state
  const level = LEVELS[props.caseId]
  return level ? createElement(level, { key: props.caseId, ...props }) : <PlaceholderLevel key={props.caseId} {...props} />
}
