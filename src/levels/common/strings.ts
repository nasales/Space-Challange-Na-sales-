// UI text shared by the statistics levels (English, AGENTS.md rule 5).

export const C = {
  rangeLabel: 'Years shown',
  startHandle: 'Start year',
  endHandle: 'End year',
  years: (n: number) => `${n} year${n === 1 ? '' : 's'}`,
  slope: 'Trend',
  perDecade: (unit: string) => `${unit} per decade`,
  ci: '95% range',
  pValue: 'p-value',
  significant: 'Significant',
  notSignificant: 'Not significant',
  tooShort: 'Too short: we need at least 10 years',
  meterLabel: 'p-value meter: below the red line at 0.05 the trend counts as significant',
  meterThreshold: '0.05',
  meterSignificantSide: 'significant',
  meterNotSignificantSide: 'not significant',
}
