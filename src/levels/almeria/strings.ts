// All UI text of the Almeria-Murcia level (English, AGENTS.md rule 5). Shared texts: ../common/strings.ts.

export const S = {
  kicker: 'Case file: Almería-Murcia drylands',
  intro:
    'The south-east is the driest corner of mainland Europe, home to the Tabernas desert and a sea of greenhouses. Is it becoming even drier?',
  soilChart: 'Monthly topsoil moisture anomaly in Almería-Murcia, with its trend line',
  soilAxis: 'kg/m² vs normal',
  soilName: 'topsoil moisture',
  rainName: 'precipitation',

  // Phase 1
  phase1Kicker: 'Phase 1 of 2',
  phase1Title: 'Negative but not proven',
  phase1Help:
    'Each wiggle is one month of topsoil moisture (0-10 cm) compared with its normal for that month. The red line is the trend.',
  q1: 'Is the soil drying?',
  q1Answers: { yes: 'Yes', no: 'No', cant: "We can't claim it" },
  panelTitle: 'Official trend, full record',
  fb1Right: (p: string) =>
    `Right. The line goes down, but p = ${p} is far above 0.05 and the 95% range includes zero: drying is possible, but not proven.`,
  fb1Yes: (p: string) =>
    `Not quite. The line goes down, but p = ${p} and the 95% range includes zero: a slope this size could be chance. We can't claim it.`,
  fb1No:
    "Not quite. 'Not significant' does not mean 'not drying': the range also includes real drying. We simply can't claim either way.",
  fb1Sig: (p: string) => `The trend is significant (p = ${p}), so the data do support a claim here.`,
  next: 'Next',
  right: 'Right!',
  wrong: 'Not quite.',

  // Phase 2
  phase2Kicker: 'Phase 2 of 2',
  phase2Title: 'Shuffle the years',
  phase2Help:
    'Shuffle the years like a deck of cards: each month keeps its value and its calendar month, but lands in a random year. A shuffled series has no trend by design, so its slope is pure chance.',
  round: (k: number, name: string) => `Round ${k} of 2: ${name}`,
  q2: 'Will the real slope stand out from chance?',
  q2Answers: { yes: 'Yes, it will stand out', no: 'No, it will hide in the cloud' },
  shuffleAfter: 'Answer first, then shuffle.',
  shuffleOne: 'Shuffle',
  shuffleMany: (n: number) => `Shuffle ×${n}`,
  shuffleAll: (n: number) => `Shuffle all ${n}`,
  histogram: (name: string) => `Slopes of the shuffled ${name} series, with the real slope marked`,
  realLabel: 'Real slope',
  axis: (unit: string) => `trend, ${unit} per decade`,
  counter: (n: number, total: number, steep: number) =>
    `${n} of ${total} shuffles: ${steep} (gold dots) as steep as the real slope or steeper.`,
  fb2Inside: (pct: string, steep: number, total: number) =>
    `${steep} of ${total} shuffles (${pct}%) are as steep as the real slope or steeper. The real slope hides inside the cloud of chance.`,
  fb2Out: (pct: string, steep: number, total: number) =>
    `Only ${steep} of ${total} shuffles (${pct}%) are as steep as the real slope: it stands out from chance.`,
  fb2Note: 'Shuffling is a picture of chance, not the official test; the official p-value is in Phase 1.',
  nextRound: 'Next round: precipitation',
  finish: 'See the summary',

  // Summary
  summaryKicker: 'Case closed',
  summaryTitle: 'What the data say',
  key1: (slope: string, unit: string, p: string) =>
    `Topsoil moisture trends down (${slope} ${unit} per decade), but p = ${p} and the 95% range includes zero: not significant.`,
  key2: (pRain: string) =>
    `Precipitation shows no significant trend either (p = ${pRain}). In both, the real slope sits inside the cloud of shuffled years.`,
  key3: 'Absence of evidence is not evidence of absence: the south-east may be drying, but these data cannot prove it yet.',
  score: (n: number) => `Score: ${n} / 3`,
  factsSoil: 'Statistical facts: soil moisture',
  factsRain: 'Statistical facts: precipitation',
  exit: 'Back to the map',
  credit:
    'Data: NASA GLDAS Noah v2.1 (GLDAS_NOAH025_M), monthly soil moisture 0-10 cm; NASA GPM IMERG v07 (GPM_3IMERGM), monthly precipitation.',
}
