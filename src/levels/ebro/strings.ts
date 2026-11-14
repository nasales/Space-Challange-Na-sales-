// All UI text of the Ebro Delta level (English, AGENTS.md rule 5). Shared texts: ../common/strings.ts.

export const S = {
  kicker: 'Case file: Ebro Delta',
  intro:
    'In January 2020 storm Gloria pushed the sea kilometres inland over the rice fields of the Ebro Delta. One storm is weather. Is the climate of the delta changing too?',
  rawChart: 'Monthly air temperature in the Ebro Delta, in degrees Celsius',
  rawAxis: '°C',
  anomalyChart: 'Monthly air temperature anomaly in the Ebro Delta (typical year removed)',
  anomalyAxis: '°C vs normal',

  // Phase 1
  phase1Kicker: 'Phase 1 of 2',
  phase1Title: 'Remove the seasons',
  phase1Help: (from: string, to: string) =>
    `Every month of air temperature from ${from} to ${to}. Each wave is one year: hot summers, cool winters.`,
  q0: 'Can you see a trend?',
  q0Answers: { yes: 'Yes', no: 'No', notSure: 'Not sure' },
  q0Note: 'Just a first impression: this guess is not scored.',
  buildHelp: 'The seasons hide everything else. Let us find out what a normal year looks like.',
  build: 'Build the typical year',
  typicalHelp: (cold: string, coldT: string, hot: string, hotT: string) =>
    `The typical year (gold line) is the average of each calendar month over the whole record: from ${coldT} °C in ${cold} to ${hotT} °C in ${hot}. Now take it away from every month.`,
  subtract: 'Subtract',
  subtracting: 'Subtracting the typical year…',
  anomalyHelp:
    'What is left is the anomaly: how much warmer or colder each month was than a normal month of the same name. The red line is the trend.',
  q1: 'And now?',
  q1Answers: { warming: 'Yes, a warming trend', cooling: 'Yes, a cooling trend', none: 'Still no trend' },
  before: {
    yes: 'Before, you said you could see a trend.',
    no: 'Before, you said you could not see a trend.',
    notSure: 'Before, you were not sure.',
  },
  fb1Right: (slope: string, swing: string) =>
    `Right: about ${slope} °C per decade, small next to the ${swing} °C swing of the seasons. That is why the trend only shows once they are removed.`,
  fb1Wrong: (slope: string, swing: string) =>
    `Not quite: the anomalies rise by about ${slope} °C per decade, significant. It is small next to the ${swing} °C swing of the seasons, which hid it.`,
  panelTitle: (from: string, to: string) => `Air temperature, ${from} to ${to}`,
  next: 'Next',

  // Phase 2
  phase2Kicker: 'Phase 2 of 2',
  phase2Title: 'How much in total?',
  phase2Help: (slope: string, from: string, to: string, decades: string) =>
    `The trend is a rate: ${slope} °C per decade. From ${from} to ${to} is ${decades} decades.`,
  q2: (from: string, to: string) => `How much warmer is the Ebro Delta in total, from ${from} to ${to}?`,
  guessLabel: 'Your estimate',
  guessValue: (v: string) => `${v} °C`,
  lock: 'Lock my estimate',
  scaleAria: (guess: string, lo: string, hi: string) =>
    `Your estimate ${guess} °C; 95% range of the total from ${lo} to ${hi} °C`,
  scaleGuess: 'You',
  scaleRange: '95% range',
  totalLine: (slope: string, decades: string, total: string) => `${slope} °C per decade × ${decades} decades = ${total} °C`,
  rangeLine: (lo: string, hi: string) =>
    `95% range: ${lo} to ${hi} °C (the lowest and highest likely rates, times the same decades).`,
  fb2Right: (guess: string) => `Right: your ${guess} °C is inside the likely range.`,
  fb2Wrong: (guess: string) => `Not quite: your ${guess} °C is outside the likely range.`,
  fb2Help: 'A small rate adds up: a few tenths per decade become more than a degree in a lifetime.',
  precipLine: (p: string, from: string, to: string, ds: string) =>
    `And the rain? Precipitation (${ds}, ${from} to ${to}) shows no significant trend (p = ${p}).`,
  right: 'Right!',
  wrong: 'Not quite.',
  finish: 'See the summary',

  // Summary
  summaryKicker: 'Case closed',
  summaryTitle: 'What the data say',
  key1: (swing: string) =>
    `The seasons swing by about ${swing} °C. Removing the typical year (the mean of each calendar month) reveals the trend.`,
  key2: (slope: string, p: string) =>
    `Air temperature is rising: ${slope} °C per decade (p ${p.startsWith('<') ? p : `= ${p}`}).`,
  key3: (total: string, lo: string, hi: string, from: string, to: string) =>
    `In total about ${total} °C warmer from ${from} to ${to} (95% range ${lo} to ${hi} °C).`,
  key4: (p: string) => `Precipitation: no significant trend (p = ${p}). One storm like Gloria is not a trend.`,
  score: (n: number) => `Score: ${n} / 2`,
  factsTemp: 'Statistical facts: air temperature',
  factsRain: 'Statistical facts: precipitation',
  exit: 'Back to the map',
  credit: (t2m: string, precip: string) =>
    `Data: NASA MERRA-2 (${t2m}), monthly 2 m air temperature; NASA GPM IMERG (${precip}), monthly precipitation.`,
}
