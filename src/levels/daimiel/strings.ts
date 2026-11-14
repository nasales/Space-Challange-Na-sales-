// All UI text of the Tablas de Daimiel level (English, AGENTS.md rule 5). Shared texts: ../common/strings.ts.

export const S = {
  kicker: 'Case file: Tablas de Daimiel',
  intro:
    'In 2009 the Tablas de Daimiel wetland almost dried up completely, and the peat under it caught fire. Is the land around it getting drier?',
  soilChart: 'Monthly topsoil moisture anomaly in Tablas de Daimiel',
  rainChart: 'Monthly precipitation anomaly in Tablas de Daimiel',
  soilAxis: 'kg/m² vs normal',
  rainAxis: 'mm/day vs normal',
  soilName: 'Topsoil moisture (0-10 cm)',
  rainName: 'Precipitation',
  fullRecord: 'Official trend, full record',

  // Phase 1
  phase1Kicker: 'Phase 1 of 3',
  phase1Title: 'Dry wetland',
  phase1Help:
    'Two independent NASA products. The red lines are the trends; below each chart are the official numbers. Below p = 0.05 a trend counts as significant.',
  q1: 'Is the soil drying?',
  q1Answers: { strong: 'Strong evidence', weak: 'Weak evidence', none: 'No evidence' },
  fb1Right: (p: string) =>
    `Right: weak evidence. The soil trend is downward and significant, but only just (p = ${p}, barely under 0.05).`,
  fb1Strong: (p: string, ciZero: boolean) =>
    `Not quite. p = ${p} is barely under 0.05${ciZero ? ', and the 95% range of the trend still includes zero' : ''}: that is weak evidence, not strong.`,
  fb1None: (p: string) =>
    `Not quite. The trend is downward and p = ${p} is under 0.05, so there is some evidence. It is weak, though.`,
  fb1Rain: (p: string) => `Rain shows no significant trend (p = ${p}).`,
  next: 'Next',

  // Phase 2
  phase2Kicker: 'Phase 2 of 3',
  phase2Title: '19 tests',
  phase2Help: (n: number, sig: number) =>
    `Our game tests ${n} series of its featured cases. ${sig} of them come out "significant" (p < 0.05, gold).`,
  gridLabel: 'p-values of the featured series',
  sigTag: 'p < 0.05',
  q2: (n: number) =>
    `If none of the ${n} series had any real trend (pure noise), how many "significant" results would chance alone give?`,
  q2Answers: { none: '0', one: 'About 1', five: 'About 5', ten: 'About 10' },
  histTitle: (runs: number, n: number) => `${runs} simulated runs of ${n} pure-noise series`,
  histAria: (runs: number, mean: string) =>
    `Histogram: number of "significant" results in each of ${runs} pure-noise runs; average ${mean}`,
  histAxis: 'Number of "significant" results in one run',
  histLegend: (mean: string) => `Dashed line: the average, ${mean} per run.`,
  realLabel: (n: number) => `Real data: ${n}`,
  fb2: (mean: string, share: string, real: number) =>
    `Chance alone gives about ${mean} "significant" result per run, and at least one in ${share} of the runs. The real data give ${real}: most are real, but which ones?`,
  right: 'Right!',
  wrong: 'Not quite.',

  // Phase 3
  phase3Kicker: 'Phase 3 of 3',
  phase3Title: 'A stricter bar',
  phase3Help: (n: number, thr: string, share: string) =>
    `With ${n} tests, a stricter bar is 0.05 / ${n} = ${thr} (the Bonferroni correction). In our pure-noise runs, chance passed it in only ${share} of the runs.`,
  q3: "Does Daimiel's soil result survive the stricter threshold?",
  q3Answers: { yes: 'Yes', no: 'No' },
  survives: 'survives',
  fails: 'does not survive',
  fb3: (survivors: number, real: number) =>
    `${survivors} of the ${real} significant results survive. Strong results (all the temperatures) stay strong; borderline ones, like Daimiel's soil, need more evidence.`,
  finish: 'See the summary',

  // Summary
  summaryKicker: 'Case closed',
  summaryTitle: 'What the data say',
  key1: (slope: string, unit: string, p: string) =>
    `Daimiel's topsoil is getting drier (${slope} ${unit} per decade), but the evidence is weak: p = ${p}, just under 0.05.`,
  key2: (p: string) => `Rain shows no significant trend (p = ${p}), so the sky alone does not explain it.`,
  key3: (mean: string, n: number) =>
    `Test many things and some will look significant by chance: about ${mean} in ${n} pure-noise tests.`,
  key4: (thr: string) =>
    `With the stricter bar (${thr}) the temperature trends survive, Daimiel's soil does not: it needs more evidence.`,
  score: (n: number) => `Score: ${n} / 3`,
  factsSoil: 'Statistical facts: soil moisture',
  factsRain: 'Statistical facts: precipitation',
  exit: 'Back to the map',
  credit:
    'Data: NASA GLDAS Noah v2.1 (GLDAS_NOAH025_M), monthly soil moisture 0-10 cm; NASA GPM IMERG v07 (GPM_3IMERGM), monthly precipitation; NASA MERRA-2 (M2TMNXSLV v5.12.4), monthly 2 m air temperature. Noise series: our own simulation (fixed seed).',
}

export const VARIABLE_NAMES: Record<string, string> = {
  T2M: 'temperature',
  SOILM: 'soil moisture',
  PRECIP: 'rain',
}
