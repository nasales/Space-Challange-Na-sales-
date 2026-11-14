// All UI text of the Valencia DANA level (English, AGENTS.md rule 5). Shared texts: ../common/strings.ts.

export const S = {
  kicker: 'Case file: Valencia DANA',
  intro:
    'On 29 October 2024 a DANA storm dropped months of rain on the Valencia region in a few hours and killed more than 220 people. Does one record storm mean a rain trend?',
  rainChart: 'Monthly precipitation anomaly in Valencia',
  tempChart: 'Monthly air temperature anomaly in Valencia',
  rainAxis: 'mm/day vs normal',
  tempAxis: '°C vs normal',
  floodLabel: 'Oct 2024',
  floodAria: 'October 2024: the DANA flood',
  pickAria: (month: string) => `Your pick: ${month}`,

  // Phase 1
  phase1Kicker: 'Phase 1 of 2',
  phase1Title: 'Find the flood',
  phase1Help:
    'Each point is one month: how much more (or less) rain fell than normal for that time of year. Click the month you think is October 2024, or use the slider.',
  pickSlider: 'Month',
  noPick: 'No month picked yet',
  confirmPick: 'This is the flood',
  found: (month: string) => `Your pick: ${month}. Spot on!`,
  close: (month: string, n: number) =>
    `Your pick: ${month}, ${n} month${n === 1 ? '' : 's'} away. Close enough!`,
  far: (month: string, n: number) =>
    `Your pick: ${month}, ${n} months away${n >= 18 ? ` (about ${Math.round(n / 12)} years)` : ''}.`,
  reveal: (value: string, unit: string, normal: string, rank: number, total: number) =>
    `October 2024 averaged ${value} ${unit} at this point (a normal October: ${normal} ${unit}). It is only number ${rank} of ${total} months.`,
  revealWhy: (wettest: string) =>
    `The wettest month here was ${wettest}. A storm of a few hours hardly moves a monthly average, and the worst rain fell inland, west of the city.`,
  q1: 'After this record, is there a significant trend in rain?',
  q1Answers: { up: 'Yes, more rain', no: 'No significant trend', down: 'Yes, less rain' },
  withFlood: 'All months',
  withoutFlood: 'Without October 2024',
  fb1Right: (p1: string, p2: string) =>
    `Right: no significant trend, with the flood (p = ${p1}) or without it (p = ${p2}). One record event is not a trend.`,
  fb1Wrong: (p1: string, p2: string) =>
    `Not quite: there is no significant trend, with the flood (p = ${p1}) or without it (p = ${p2}). One record event is not a trend.`,
  next: 'Next',

  // Phase 2
  phase2Kicker: 'Phase 2 of 2',
  phase2Title: 'The warm background',
  phase2Help: 'Same place, a different clue: monthly air temperature near the ground. The red line is the trend.',
  q2: 'Is the air around Valencia warming?',
  q2Answers: { yes: 'Yes', no: 'No', unsure: 'Cannot tell' },
  tempPanel: 'Air temperature, full record',
  fb2: (change: string, gain: string) =>
    `The air warmed about ${change} °C over the record. Warmer air can hold about 7% more water per °C (here about ${gain}% more), which can make heavy rain more intense. The data show the warming, not the cause of this one storm.`,
  right: 'Right!',
  wrong: 'Not quite.',
  finish: 'See the summary',

  // Summary
  summaryKicker: 'Case closed',
  summaryTitle: 'What the data say',
  key1: (slope: string, unit: string, p: string) =>
    `Rain shows no significant trend: ${slope} ${unit} per decade (p = ${p}), even after the record flood.`,
  key2: (slope: string, p: string) =>
    `The air is warming: ${slope} °C per decade (p ${p.startsWith('<') ? p : `= ${p}`}).`,
  key3: 'A record event is not a trend; a warming background is.',
  score: (n: number, max: number) => `Score: ${n} / ${max}`,
  factsRain: 'Statistical facts: precipitation',
  factsTemp: 'Statistical facts: air temperature',
  exit: 'Back to the map',
  credit:
    'Data: NASA GPM IMERG (GPM_3IMERGM v07), monthly precipitation; NASA MERRA-2 (M2TMNXSLV v5.12.4), monthly 2 m air temperature.',
}
