// Official numbers of a trend (precomputed by pipeline/level_data.py), or the "too short" message.
import { fmtP, fmtSlope, type TrendResult } from './format'
import { C } from './strings'

interface TrendPanelProps {
  title: string
  result: TrendResult
  /** Units of the variable, e.g. "°C" */
  unit: string
  testId?: string
  /** Decimals of the slope and range (default 2) */
  digits?: number
  /** Decimals of the p-value (default 3) */
  pDigits?: number
}

export default function TrendPanel({ title, result, unit, testId, digits = 2, pDigits = 3 }: TrendPanelProps) {
  return (
    <div className="lvc-panel lvl-panel" data-testid={testId} aria-live="polite">
      <p className="lvc-panel__title">{title}</p>
      {result.too_short ? (
        <p className="lvc-panel__short">{C.tooShort}</p>
      ) : (
        <dl className="lvc-panel__numbers">
          <dt>{C.slope}</dt>
          <dd data-testid={testId && `${testId}-slope`}>
            {fmtSlope(result.slope_decade, digits)} {C.perDecade(unit)}
          </dd>
          <dt>{C.ci}</dt>
          <dd data-testid={testId && `${testId}-ci`}>
            {fmtSlope(result.ci_decade[0], digits)} to {fmtSlope(result.ci_decade[1], digits)}
          </dd>
          <dt>{C.pValue}</dt>
          <dd data-testid={testId && `${testId}-p`}>{fmtP(result.p_value, pDigits)}</dd>
          <dt className="lvc-visually-hidden">Result</dt>
          <dd className={result.significant ? 'lvc-badge lvc-badge--yes' : 'lvc-badge'}>
            {result.significant ? C.significant : C.notSignificant}
          </dd>
        </dl>
      )}
    </div>
  )
}
