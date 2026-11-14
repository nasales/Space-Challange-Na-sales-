// All UI text of the Sierra de la Culebra level (English, AGENTS.md rule 5). Shared texts: ../common/strings.ts.

export const S = {
  kicker: 'Case file: Sierra de la Culebra fire',
  intro:
    'In June 2022 about 25,000 hectares burned in Sierra de la Culebra (Zamora), one of the largest wildfires in Spain. Was the land getting hotter and drier before it?',
  tempChart: 'Monthly air temperature anomaly in Sierra de la Culebra',
  soilChart: 'Monthly topsoil moisture anomaly in Sierra de la Culebra',
  tempAxis: '°C vs normal',
  soilAxis: 'kg/m² vs normal',
  tempName: 'Air temperature (2 m)',
  soilName: 'Topsoil moisture (0-10 cm)',
  fireLabel: 'Jun 2022',
  fireAria: 'June 2022: the Sierra de la Culebra fire',
  preFire: (last: string) => `Before the fire (up to ${last})`,

  // Phase 1
  phase1Kicker: 'Phase 1 of 2',
  phase1Title: 'Two clues',
  phase1Help:
    'Two independent NASA products. The red lines are the trends of the months before the fire (the fire is marked).',
  q1: 'Do both point to drier, hotter conditions before the 2022 fire?',
  q1Answers: { yes: 'Yes, both', onlyOne: 'Only one of them', no: 'No' },
  fb1Right: (tp: string, sp: string) =>
    `Right: temperature went up (p = ${tp}) and topsoil moisture went down (p = ${sp}), both significant.`,
  fb1Wrong: (tp: string, sp: string) =>
    `Not quite: both are significant. Temperature went up (p = ${tp}) and topsoil moisture went down (p = ${sp}).`,
  fb1Note: 'A trend shows a rising risk; it does not prove the cause of one particular fire.',
  next: 'Next',

  // Phase 2
  phase2Kicker: 'Phase 2 of 2',
  phase2Title: 'Signal vs noise',
  phase2Help: (runs: number) =>
    `We built fake soil-moisture series: the real trend (red line) plus random ups and downs as big as the real ones. Then we tested ${runs} of them with the same method as the real data.`,
  exampleChart: (factor: string) => `Example fake series with ${factor} the real noise`,
  q2: 'With twice the noise, will we still detect the trend?',
  q2Answers: { most: 'Yes, in most runs', few: 'Only in a few runs', same: 'As often as with real noise' },
  noiseLabel: 'Noise',
  factor: (f: number) => (f === 1 ? 'real noise' : `${f}× the real noise`),
  factorShort: (f: number) => `${f}×`,
  detected: (d: number, n: number, pct: string) => `Trend detected in ${d} of ${n} runs (${pct})`,
  ratesTitle: 'Share of runs where the trend was detected',
  fb2: (r1: string, r2: string) =>
    `With the real noise the trend was detected in ${r1} of the runs; with twice the noise, only in ${r2}. Same trend, more noise: it gets lost.`,
  fb2Help: 'Move the slider to see the other noise levels.',
  right: 'Right!',
  wrong: 'Not quite.',
  finish: 'See the summary',

  // Summary
  summaryKicker: 'Case closed',
  summaryTitle: 'What the data say',
  key1: (slope: string, p: string) =>
    `Temperature is rising: ${slope} °C per decade over the full record (p ${p.startsWith('<') ? p : `= ${p}`}).`,
  key2: (slope: string, unit: string, p: string) =>
    `Topsoil moisture is falling: ${slope} ${unit} per decade (p = ${p}). Significant, but not by much.`,
  key3: (r1: string) =>
    `A real trend can hide in noise: with noise like the real one, our test found the soil trend in only ${r1} of the fake series.`,
  key4: 'Hotter and drier means more fire risk, but a trend alone cannot prove what caused one fire.',
  score: (n: number) => `Score: ${n} / 2`,
  factsTemp: 'Statistical facts: air temperature',
  factsSoil: 'Statistical facts: soil moisture',
  exit: 'Back to the map',
  credit:
    'Data: NASA MERRA-2 (M2TMNXSLV v5.12.4), monthly 2 m air temperature; NASA GLDAS Noah v2.1 (GLDAS_NOAH025_M), monthly soil moisture 0-10 cm. Fake series: our own simulation (fixed seed).',
}
