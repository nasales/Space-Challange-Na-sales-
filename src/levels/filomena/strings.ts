// All UI text of the Filomena level (English, AGENTS.md rule 5).

export const S = {
  kicker: 'Case file: Storm Filomena',
  title: 'Madrid, January 2021',
  intro:
    'Storm Filomena buried Madrid under its heaviest snowfall in about 50 years. Some people said: "So much for global warming!" Let\'s check the data.',

  // Phase 1
  phase1Kicker: 'Phase 1 of 2',
  phase1Title: 'The zoom trap',
  phase1Help:
    'The chart shows how much warmer or colder each month was than normal for that month. Drag the two handles to choose which years you look at.',
  chartLabel: 'Monthly temperature anomaly in Madrid',
  axisUnit: '°C vs normal',
  rangeLabel: 'Years shown',
  startHandle: 'Start year',
  endHandle: 'End year',
  years: (n: number) => `${n} year${n === 1 ? '' : 's'}`,
  panelTitle: 'Official trend for these years',
  slope: 'Trend',
  perDecade: '°C per decade',
  ci: '95% range',
  pValue: 'p-value',
  significant: 'Significant',
  notSignificant: 'Not significant',
  tooShort: 'Too short: we need at least 10 years',
  question: 'Is Madrid warming?',
  answers: { yes: 'Yes', no: 'No', cant: "Can't tell" },
  answeredWith: (years: string) => `You answered looking at ${years}.`,
  fbShort: (n: number) =>
    `Careful: you only looked at ${n} years. With a short window you can make the data say almost anything; picking the years that fit a story is called cherry-picking. Climate trends need at least 30 years.`,
  fbYesLong: 'Correct. Over a long period the temperature in Madrid clearly goes up.',
  fbYesLongWeak:
    'Correct direction, but note that in the years you chose the test is not significant. Over the full record (1980-2026) the warming is significant.',
  fbNoLong:
    'Look again: over a long period the trend line goes up. One cold winter does not cancel decades of warming.',
  fbCantLong:
    'With 30 or more years we can tell: over the full record (1980-2026) the warming is statistically significant.',
  next: 'Next',

  // Phase 2
  phase2Kicker: 'Phase 2 of 2',
  phase2Title: 'Does Filomena break the trend?',
  phase2Help: (anomaly: string) =>
    `The snowflake marks January 2021, the month of Filomena (${anomaly} °C compared with a normal January).`,
  filomenaLabel: 'Filomena, January 2021',
  predict: 'If we remove Filomena, the trend will…',
  predictions: { lot: 'Change a lot', barely: 'Barely change' },
  remove: 'Remove Filomena',
  restore: 'Put Filomena back',
  withF: 'With Filomena',
  withoutF: 'Without Filomena',
  fbPredictRight: 'Good prediction!',
  fbPredictWrong: 'Surprise!',
  fbMedian: (a: string, b: string) =>
    `The trend goes from ${a} to ${b} °C per decade: it barely moves. The trend line uses medians (the Sen slope), so one extreme month cannot pull it much. A monthly average also dilutes a storm that lasted a few days.`,
  finish: 'See the summary',

  // Summary
  summaryKicker: 'Case closed',
  summaryTitle: 'What the data say',
  key1: (slope: string) =>
    `Since 1980 Madrid has warmed by about ${slope} °C per decade, and the trend is statistically significant.`,
  key2: 'One record cold event like Filomena is weather, not climate: it does not refute a long warming trend.',
  score: (n: number) => `Score: ${n} / 2`,
  factsTitle: 'The statistical facts',
  exit: 'Back to the map',
  credit: (dataset: string) => `Data: ${dataset}`,
}
