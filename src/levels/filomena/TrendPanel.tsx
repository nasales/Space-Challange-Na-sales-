// Official numbers of a trend (from filomena_level.json), or the "too short" message.
import { fmtP, fmtSlope, type TrendResult } from './data'
import { S } from './strings'

export default function TrendPanel({ title, result, testId }: { title: string; result: TrendResult; testId?: string }) {
  return (
    <div className="flm-panel lvl-panel" data-testid={testId} aria-live="polite">
      <p className="flm-panel__title">{title}</p>
      {result.too_short ? (
        <p className="flm-panel__short">{S.tooShort}</p>
      ) : (
        <dl className="flm-panel__numbers">
          <dt>{S.slope}</dt>
          <dd data-testid={testId && `${testId}-slope`}>
            {fmtSlope(result.slope_decade)} {S.perDecade}
          </dd>
          <dt>{S.ci}</dt>
          <dd>
            {fmtSlope(result.ci_decade[0])} to {fmtSlope(result.ci_decade[1])}
          </dd>
          <dt>{S.pValue}</dt>
          <dd>{fmtP(result.p_value)}</dd>
          <dt className="flm-visually-hidden">Result</dt>
          <dd className={result.significant ? 'flm-badge flm-badge--yes' : 'flm-badge'}>
            {result.significant ? S.significant : S.notSignificant}
          </dd>
        </dl>
      )}
    </div>
  )
}
