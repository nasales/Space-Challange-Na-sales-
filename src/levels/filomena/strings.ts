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
  // Phase 1 feedback: the right answer is the one the selected window supports
  // (significant increase -> Yes, significant decrease -> No, not significant or too short -> Can't tell).
  fbWrong: 'Not quite.',
  fbYesSig: 'Right: in these years the warming is statistically significant (p < 0.05), so the data support "Yes".',
  fbNoSig: 'Right: in these years the cooling is statistically significant (p < 0.05), so the data support "No". Now look at the full record.',
  fbCantNotSig: 'Right: this window alone is not enough evidence. Try the full record.',
  fbCantTooShort: (n: number) =>
    `Right: ${n} year${n === 1 ? ' is' : 's are'} too short to judge a trend. With a short window you can make the data say almost anything (cherry-picking). Try the full record.`,
  fbYesNotSig: (p: string) =>
    `The slope in these years is positive, but the p-value is ${p} (not below 0.05), so the warming could be chance and we cannot claim it from this window alone.`,
  fbYesDownNotSig: (p: string) =>
    `In these years the line even goes down, and the p-value is ${p} (not below 0.05): this window cannot show warming.`,
  fbNoNotSig: (p: string) =>
    `The p-value is ${p} (not below 0.05), so this window cannot show cooling either: the honest answer is "Can't tell".`,
  fbTooShortClaim: (n: number) =>
    `${n} year${n === 1 ? ' is' : 's are'} too short to claim any trend: the honest answer is "Can't tell". Picking a short window that fits a story is called cherry-picking.`,
  fbMissedSigUp: 'Here the evidence is clear: the slope is positive and p < 0.05, so the data support "Yes".',
  fbMissedSigDown: 'Here the slope is negative and p < 0.05, so the data support "No".',
  showFull: 'Show 1980-2026',
  retryPrompt: 'Second try (half a point): look at the full record and answer again.',
  retryRight: (n: number) => `Now with ${n} years the evidence is clear.`,
  retryAnswered: (years: string) => `Second try, looking at ${years}.`,
  next: 'Next',

  // Phase 2
  phase2Kicker: 'Phase 2 of 2',
  phase2Title: 'Does Filomena break the trend?',
  phase2Help: (anomaly: string) =>
    `The snowflake marks January 2021, the month of Filomena (${anomaly} °C compared with a normal January).`,
  filomenaLabel: 'Filomena, January 2021',
  filomenaShort: 'Jan 2021',
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
  credit: (dataset: string) => `Data: NASA MERRA-2 (${dataset.replace(/^NASA /, '')}), monthly 2 m air temperature`,
}
