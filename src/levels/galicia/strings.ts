// All UI text of the Galicia fires level (English, AGENTS.md rule 5). Shared texts: ../common/strings.ts.

export const S = {
  kicker: 'Case file: Galicia fires',
  intro:
    'Ourense (Galicia) is green and wet, yet it burned badly in 2017 and again in August 2025. Sierra de la Culebra (Zamora), about 140 km east, burned in June 2022. Two forests, two soil records.',
  galiciaName: 'Ourense (Galicia)',
  culebraName: 'Sierra de la Culebra',
  soilChart: (place: string) => `Monthly topsoil moisture anomaly in ${place}`,
  tempChart: 'Monthly air temperature anomaly in Ourense (Galicia)',
  soilAxis: 'kg/m² vs normal',
  tempAxis: '°C vs normal',
  soilVar: 'Topsoil moisture (0-10 cm)',
  tempVar: 'Air temperature (2 m)',
  fullRecord: 'Full record',
  next: 'Next',
  right: 'Right!',
  wrong: 'Not quite.',

  // Phase 1
  phase1Kicker: 'Phase 1 of 3',
  phase1Title: 'Twin forests',
  phase1Help: 'Same variable, same NASA product, same years. The red lines are the Sen trend lines.',
  q1: 'Which one has a significant drying trend?',
  q1Answers: { galicia: 'Galicia', culebra: 'Culebra', both: 'Both', neither: 'Neither' },
  fb1: (gs: string, gp: string, cs: string, cp: string, unit: string) =>
    `Galicia's soil trend is ${gs} ${unit} per decade (p = ${gp}); Culebra's is ${cs} (p = ${cp}). Only Culebra is below 0.05.`,
  fb1Note: 'The lines look almost the same, yet only one passes the test.',

  // Phase 2
  phase2Kicker: 'Phase 2 of 3',
  phase2Title: 'Why the difference?',
  phase2Help:
    'The test weighs the size of the trend against the ups and downs around it (noise: how far the months scatter around the trend line) and the number of months.',
  compareTitle: 'Galicia vs Culebra, topsoil moisture',
  rowSlope: 'Drying trend (per decade)',
  rowNoise: 'Noise (spread around the line)',
  rowData: 'Valid months',
  q2: 'Why is Galicia not significant?',
  q2Answers: { slope: 'A smaller slope', noise: 'More year-to-year noise', data: 'Fewer data' },
  cmp: (factor: number, bigger: string, smaller: string) =>
    Math.abs(factor - 1) <= 0.05 ? 'about the same as' : factor > 1 ? bigger : smaller,
  fbSlope: (cmp: string, gs: string, cs: string, unit: string) =>
    `Galicia's drying is ${cmp} Culebra's (${gs} vs ${cs} ${unit} per decade).`,
  fbNoise: (cmp: string, gn: string, cn: string, unit: string) =>
    `Its noise is ${cmp} Culebra's (${gn} vs ${cn} ${unit}).`,
  fbData: (cmp: string, gm: number, cm: number) => `It has ${cmp} months of data (${gm} vs ${cm}).`,
  fbAnswer: (reason: string) => `So the main handicap is: ${reason.toLowerCase()}.`,
  fbRho: (gr: string, cr: string) =>
    `Galicia's months are also a bit more persistent (autocorrelation ${gr} vs ${cr}), which the test takes into account.`,
  fbLesson: (gp: string, cp: string) =>
    `A modest difference in slope turned into a big difference in p (${gp} vs ${cp}). The p-value measures how sure we are, not how big the change is.`,

  // Phase 3
  phase3Kicker: 'Phase 3 of 3',
  phase3Title: 'The other clue',
  phase3Help: 'The soil is not clear in Galicia. What about the air? Monthly 2 m air temperature since 1980.',
  q3: 'Is the air in Ourense getting significantly warmer?',
  q3Answers: { yes: 'Yes, significantly', weak: 'Warmer, but not significant', no: 'No warming' },
  fb3: (slope: string, p: string) =>
    `Air temperature rises ${slope} °C per decade (p ${p.startsWith('<') ? p : `= ${p}`}): a clear, significant warming.`,
  finish: 'See the summary',

  // Summary
  summaryKicker: 'Case closed',
  summaryTitle: 'What the data say',
  key1: (slope: string, p: string) =>
    `Ourense is warming: ${slope} °C per decade (p ${p.startsWith('<') ? p : `= ${p}`}), significant.`,
  key2: (gs: string, gp: string, unit: string) =>
    `Its topsoil moisture trend is ${gs} ${unit} per decade, but p = ${gp}: not significant. No clear evidence of change is not proof that nothing changed.`,
  key3: (cs: string, cp: string, unit: string) =>
    `Culebra's soil trend is ${cs} ${unit} per decade, with p = ${cp}: a similar change, much stronger evidence.`,
  key4: 'The p-value is not the size of the change: it says how clearly the data show it.',
  score: (n: number) => `Score: ${n} / 3`,
  factsTemp: 'Statistical facts: air temperature',
  factsSoil: 'Statistical facts: soil moisture',
  exit: 'Back to the map',
  credit: (t2mDataset: string, soilDataset: string) =>
    `Data: NASA MERRA-2 (${t2mDataset.replace(/^NASA /, '')}), monthly 2 m air temperature; NASA GLDAS Noah (${soilDataset.replace(/^NASA /, '')}), monthly soil moisture 0-10 cm.`,
}
