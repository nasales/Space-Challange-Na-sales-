// All UI text of the Aneto glacier level (English, AGENTS.md rule 5). Shared texts: ../common/strings.ts.

export const S = {
  kicker: 'Case file: Aneto glacier',
  t2mChart: 'Monthly air temperature anomaly at Aneto',
  rainChart: 'Monthly precipitation anomaly at Aneto',
  t2mAxis: '°C vs normal',
  rainAxis: 'mm/day vs normal',
  t2mName: 'Air temperature (2 m)',
  rainName: 'Precipitation',
  fullRecord: (first: string, last: string) => `Full record, ${first} to ${last}`,
  right: 'Right!',
  wrong: 'Not quite.',
  next: 'Next',

  // Phase 1
  phase1Kicker: 'Phase 1 of 2',
  phase1Title: 'Heat or rain?',
  phase1Help:
    'A glacier shrinks when it melts faster or gets less snow. Here are the two suspects, with their official trends (red line).',
  q1: "Which variable can explain the glacier's loss?",
  q1Answers: { temperature: 'Temperature', rain: 'Rain', both: 'Both' },
  fb1Right: (slope: string, rainP: string) =>
    `Temperature rises ${slope} °C per decade and the trend is significant; rain shows no significant trend (p = ${rainP}). The suspect is heat, not rain.`,
  fb1Rain: (rainP: string) =>
    `Rain shows no significant trend (p = ${rainP}), so a change in rain cannot explain the loss. Temperature has a clear, significant rise.`,
  fb1Both: (rainP: string) =>
    `Only temperature has a significant trend. Rain shows none (p = ${rainP}): no clear evidence of change, so it cannot explain a steady loss.`,

  // Phase 2
  phase2Kicker: 'Phase 2 of 2',
  phase2Title: 'Is Aneto the fastest?',
  phase2Help: (n: number) =>
    `These ${n} case files all have an air temperature record for the same years. Drag them into order: fastest warming first. You can also use the arrow buttons.`,
  rankList: 'Your order, fastest warming first',
  moveUp: (name: string) => `Move ${name} up`,
  moveDown: (name: string) => `Move ${name} down`,
  reveal: 'Reveal the trends',
  raceChart: 'Warming trend of each case with its 95% range, in °C per decade',
  raceAxis: '°C per decade',
  yourRank: (n: number) => `your #${n}`,
  rankFeedback: (hits: number, n: number, anetoPos: number) =>
    `By the central estimate you placed ${hits} of ${n} cases in the right spot, and Aneto at #${anetoPos}.`,
  raceHelp:
    'Dot = trend. Bar = its 95% range. The shaded band is Aneto’s range: every bar that touches it could really be as fast as Aneto.',
  q2: 'Is Aneto clearly faster than the rest?',
  q2Answers: {
    clearly: 'Yes, clearly faster',
    notClearly: 'Fastest estimate, but not clearly',
    slower: 'No, others are faster',
  },
  fb2NotClearly: (lo: string, hi: string, overlapping: number, others: number) =>
    `Aneto has the highest estimate, but its 95% range (${lo} to ${hi} °C per decade) overlaps ${overlapping} of the other ${others} ranges. The order at the top is not settled.`,
  fb2Clearly: (lo: string, hi: string) =>
    `Aneto’s 95% range (${lo} to ${hi} °C per decade) is above every other range: it is clearly the fastest.`,
  fb2Slower: 'Another case has a higher estimate than Aneto, so Aneto is not the fastest.',
  finish: 'See the summary',

  // Summary
  summaryKicker: 'Case closed',
  summaryTitle: 'What the data say',
  key1: (slope: string, highest: boolean) =>
    `Air temperature at Aneto is rising ${slope} °C per decade, a significant trend` +
    (highest ? ': the highest estimate of all the cases.' : '.'),
  key2: (rainP: string) =>
    `Precipitation shows no significant trend (p = ${rainP}): the evidence points to heat, not rain.`,
  key3: 'The 95% ranges of the cases overlap, so "fastest" is not proven: to compare trends, compare their ranges, not only the numbers.',
  score: (n: number) => `Score: ${n} / 2`,
  factsT2m: 'Statistical facts: air temperature',
  factsRain: 'Statistical facts: precipitation',
  exit: 'Back to the map',
  credit:
    'Data: NASA MERRA-2 (M2TMNXSLV), monthly air temperature at 2 m; NASA GPM IMERG v07 (GPM_3IMERGM), monthly precipitation.',
}
