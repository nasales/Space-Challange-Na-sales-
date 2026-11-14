// All UI text of the Doñana level (English, AGENTS.md rule 5). Shared texts: ../common/strings.ts.

export const S = {
  kicker: 'Case file: Doñana wetlands',
  intro:
    'In 2023 Santa Olalla, the largest lagoon in Doñana, dried up completely. Is the topsoil of Doñana getting drier, and why?',
  soilChart: 'Monthly topsoil moisture anomaly in Doñana',
  rainChart: 'Monthly precipitation anomaly in Doñana',
  soilAxis: 'kg/m² vs normal',
  rainAxis: 'mm/day vs normal',
  soilName: 'Topsoil moisture (0-10 cm)',
  rainName: 'Precipitation',

  // Phase 1
  phase1Kicker: 'Phase 1 of 3',
  phase1Title: 'On the edge',
  phase1Help:
    'This is the full soil-moisture record. The needle shows the p-value: below the red line at 0.05 we call the trend significant.',
  task: 'Move the start or end by one or two years. Does the result survive?',
  panelTitle: 'Official trend for these years',
  counter: (n: number, sig: number, notSig: number, short: number, flips: number) =>
    `You tried ${n} window${n === 1 ? '' : 's'}: ${sig} significant, ${notSig} not significant` +
    (short ? `, ${short} too short` : '') +
    `. The conclusion flipped ${flips} time${flips === 1 ? '' : 's'}.`,
  q1: "How strong is the evidence that Doñana's soil is drying?",
  q1Answers: { strong: 'Strong', weak: 'Weak', none: 'None' },
  fb1Right: (p: string) =>
    `Right: weak. The full record is significant only by a hair (p = ${p}), and moving the years a little flips the result.`,
  fb1Strong: (p: string) =>
    `Not quite. The full record is significant only by a hair (p = ${p}), and moving the years a little flips the result: that is weak evidence, not strong.`,
  fb1None:
    'Not quite. The trend is downward and, for the full record, just under 0.05: there is some evidence, but it is weak.',
  next: 'Next',

  // Phase 2
  phase2Kicker: 'Phase 2 of 3',
  phase2Title: 'The confidence range',
  phase2Help:
    'The red line is the trend of the full record. The 95% range tells us which trends are still compatible with the data.',
  q2: 'Could the true trend be zero?',
  q2Answers: { yes: 'Yes', no: 'No' },
  rangeTitle: 'Full record, 95% range of the trend',
  fb2Includes: (lo: string, hi: string, unit: string) =>
    `The 95% range goes from ${lo} to ${hi} ${unit} per decade: it includes zero, so a flat trend cannot be ruled out.`,
  fb2Excludes: (lo: string, hi: string, unit: string) =>
    `The 95% range goes from ${lo} to ${hi} ${unit} per decade: it does not include zero.`,
  fb2Disagree:
    'Yet the p-value is just under 0.05: the Mann-Kendall test and the Sen confidence range are different tools, so near the border they can disagree.',
  right: 'Right!',
  wrong: 'Not quite.',

  // Phase 3
  phase3Kicker: 'Phase 3 of 3',
  phase3Title: 'Rain or something else?',
  phase3Help: 'Compare the two variables before blaming a cause.',
  fullRecord: 'Full record',
  commonNote: (first: string, last: string, soilP: string, rainP: string) =>
    `On the years both have (${first} to ${last}): soil moisture p = ${soilP}, precipitation p = ${rainP}. Same picture.`,
  q3: 'The soil is drying. Is less rain the explanation?',
  q3Answers: {
    rain: 'Yes, less rain',
    other: 'Rain alone does not explain it',
    wrongData: 'The data must be wrong',
  },
  fb3:
    'Rain shows no significant trend, so other factors (heat, evaporation, water use) may matter. The data alone cannot prove which one.',
  fb3WrongData:
    'Two independent NASA products disagreeing is not a sign of bad data: soil and rain can simply behave differently.',
  finish: 'See the summary',

  // Summary
  summaryKicker: 'Case closed',
  summaryTitle: 'What the data say',
  key1: (slope: string, unit: string, p: string) =>
    `Doñana's topsoil is getting drier (${slope} ${unit} per decade), but the evidence is weak: p = ${p}, just under 0.05.`,
  key2: 'The 95% range of the trend still includes zero, so a flat trend cannot be ruled out.',
  key3: 'Rain shows no significant trend, so something else (heat, evaporation, water use) may also matter.',
  score: (n: number) => `Score: ${n} / 3`,
  factsSoil: 'Statistical facts: soil moisture',
  factsRain: 'Statistical facts: precipitation',
  exit: 'Back to the map',
  credit:
    'Data: NASA GLDAS Noah v2.1 (GLDAS_NOAH025_M), monthly soil moisture 0-10 cm; NASA GPM IMERG v07 (GPM_3IMERGM), monthly precipitation.',
}
