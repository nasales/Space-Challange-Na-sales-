// All UI text of the Córdoba heat level (English, AGENTS.md rule 5). Shared texts: ../common/strings.ts.

export const S = {
  kicker: 'Case file: Córdoba heat',
  intro:
    'Córdoba keeps breaking heat records. In a stable climate, records get rarer every year: the longer the history, the harder it is to beat. Is that what happens here?',
  chart: 'Monthly air temperature anomaly in Córdoba, 1980 to 2026, with record warm and record cold months marked',
  axis: '°C vs normal',
  history: 'history only',

  // Phase 1
  phase1Kicker: 'Phase 1 of 2',
  phase1Title: 'Record hunters',
  phase1Help: (first: number) =>
    `A month is a record warm month when it is hotter than the same calendar month in every earlier year (a record cold month: colder than all of them). We count records from ${first} on; the 1980s only build the history.`,
  q1: 'Which decade had the most warm records?',
  partialNote: (label: string, last: string) => `The ${label} are a partial decade: data run only to ${last}.`,
  recordsShown: (warm: number, cold: number) => `On the chart: ${warm} record warm months (red) and ${cold} record cold months (blue).`,
  bars1: 'Warm and cold records per decade in Córdoba',
  warmLabel: 'Warm records',
  coldLabel: 'Cold records',
  fb1Tie: (labels: string) => `It's a tie: ${labels} share the most warm records.`,
  fb1Top: (label: string) => `The ${label} had the most warm records.`,
  fb1Partial: (label: string, n: number) => `The ${label} got ${n} in less than seven years.`,
  fb1Cold: (first: number, last: number) =>
    `Cold records almost vanished: ${first} in the 1990s, ${last} in the 2020s.`,
  next: 'Next',
  right: 'Right!',
  wrong: 'Not quite.',

  // Phase 2
  phase2Kicker: 'Phase 2 of 2',
  phase2Title: 'Without a trend?',
  phase2Help: (n: number, slope: string) =>
    `We removed Córdoba's warming trend (${slope} °C per decade) and shuffled the years ${n} times, like a deck of cards: each month keeps its calendar month, the months of one year stay together, and the order of the years is random. That is Córdoba with the same ups and downs but no trend. Then we counted its records.`,
  q2: "Are Córdoba's warm records more than chance?",
  q2Answers: { yes: 'Yes, more than chance', no: 'No, chance explains them' },
  bars2: 'Observed records per decade compared with the records expected without a trend',
  warmExpected: 'Warm, expected without trend',
  coldExpected: 'Cold, expected without trend',
  chance: (n: number, mean: string, p95: string, obs: number) =>
    `In ${n} trend-free runs there were ${mean} warm records on average, and more than ${p95} in only 5% of runs. Córdoba has ${obs}.`,
  fb2Yes: (pct: string) =>
    `Córdoba's warm records are above what 95% of the trend-free runs give (only ${pct}% reach as many). Without a trend, warm and cold records would be about equal and both would fade like 1/n.`,
  fb2No: (pct: string) =>
    `Córdoba's warm records stay inside the range of chance (${pct}% of trend-free runs reach as many).`,
  fb2Note: 'The simulation is a picture of chance, not the official test; the official p-value is in the summary.',
  finish: 'See the summary',

  // Summary
  summaryKicker: 'Case closed',
  summaryTitle: 'What the data say',
  key1: (warm: number, cold: number, first: number) =>
    `Since ${first}, Córdoba set ${warm} record warm months and only ${cold} record cold months.`,
  key2: (obs: number, mean: string) =>
    `Without a trend we would expect about ${mean} warm records, as many as cold ones, and fewer each decade. Córdoba has ${obs}, piling up in the 2010s and 2020s.`,
  key3: (slope: string, p: string) =>
    `The official trend is ${slope} °C per decade (p ${p}, significant). In a warming climate, warm records outnumber cold records.`,
  score: (n: number, total: number) => `Score: ${n} / ${total}`,
  facts: 'Statistical facts: air temperature',
  exit: 'Back to the map',
  credit: 'Data: NASA MERRA-2 (M2TMNXSLV v5.12.4), monthly 2-metre air temperature.',
}
