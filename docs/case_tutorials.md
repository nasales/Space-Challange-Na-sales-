# Featured-case tutorials

Featured cases (`data/cases_index.json`) double as tutorials: they teach the player how to
read a time series using a case that is already studied. First case: **Valencia DANA**
(`dana_valencia`). Asked by Diego, 2026-11-14.

## Player flow
1. A "!" marker stands on the map at the case coordinates (`lat`, `lon` in `data/cases_index.json`).
   Only cases listed in `TUTORIAL_CASE_IDS` (`src/shared/tutorial.ts`) get a marker.
2. When the car is close, a hint appears ("Press Enter to open the case file"). Enter, or a
   click on the marker, opens the case.
3. **Intro screen**: context about the case, written for this case (no charts, no conclusion).
4. **Steps**: one chart + short text per step. Most steps ask one multiple-choice question;
   a wrong answer shows its feedback (a hint) and the player tries again; the right answer
   shows the takeaway and unlocks "Next".
5. **Conclusion**: the player writes their own conclusion about the case question.
6. **Reveal**: what the statistics say (from `reveal`), shown only after the conclusion.
   When the AI checker exists, its verdict goes here.

While the case is open the game is paused (driving keys ignored).

## Files and owners
| File | Written by | Read by |
|---|---|---|
| `src/shared/tutorial.ts` | shared types (Data + Interface + Game agree) | everyone |
| `data/tutorials/<case_id>.json` (`TutorialScript`) | story agent (Data area, Diego) | UI |
| `pipeline/tutorial_data.py` -> `data/tutorial_data/<case_id>.json` (`TutorialData`) | data agent (Data area, Diego) | UI |
| `src/game/cases/` (markers, proximity, open event) | game agent (Game area, with Person 2's OK) | — |
| `src/ui/casefile/` (intro, steps, charts, conclusion, reveal) | interface agent (Interface area, with Yeipi's OK) | — |
| `src/App.tsx` (wiring, a few lines) | integration | — |

## Rules for the content
- Everything in English, plain words, for a teenager or adult with no statistics background.
- The intro gives context and the question; it never gives the answer.
- No number in the script that the data does not back up. Trend numbers come from
  `data/tutorial_data/<case_id>.json`, which matches `data/cache/case_<id>_<var>.json`.
- A non-significant trend is a valid result, never presented as a failure.
- Credit data in text: "Data: NASA ..." (dataset name from the data file). No NASA logos.
- Lessons the DANA case should teach (one or two per step):
  1. What a monthly time series is (one point per month, years on the x axis).
  2. Seasonality: the same cycle repeats every year; compare like with like.
  3. Anomalies: removing the seasonal cycle to see what is unusual.
  4. One extreme event (the October 2024 DANA) is not a trend; and a storm of a few hours can look small in a monthly mean at one pixel (October 2024 is not the record month at this point).
  5. Trend line and noise: the slope summarises decades, single points do not.
  6. Significance in plain words: could this slope appear by chance? (p-value, confidence range)
  7. Compare variables: rain shows no clear trend, temperature rises clearly.

## One technique per case (agreed with Diego, 2026-11-14)
Every case opens with one short recap step (what a monthly series and a trend are, told with
that case), then teaches its own way of analysing a time series (5-7 steps in total).

| Case | Variables | Technique (main views) | Lesson |
|---|---|---|---|
| `dana_valencia` | PRECIP, T2M | anomalies, extreme vs trend (`anomaly`, `annual`) | One extreme event is not a trend; monthly means hide a storm of a few hours |
| `filomena_madrid` | T2M, PRECIP | same month across the years (`same_month`, month 1) | A cold January exists, yet Januaries are warming: weather is not climate |
| `cordoba_heat` | T2M | records and ranking (`ranking`, `season` JJA) | With a trend, records pile up at the end |
| `aneto_glacier` | T2M, PRECIP | seasons separately + physical threshold (`season` DJF/JJA, `threshold_count` below 0 °C) | A yearly mean hides what each season does |
| `donana` | SOILM, PRECIP | two clues on one scale (`zscore_pair`) | Compare different units; what satellites cannot see (the aquifer); p right at 0.05 |
| `daimiel` | SOILM, PRECIP | cumulative anomaly (`cumulative`) | A wetland responds to accumulated totals, not to single months |
| `almeria_murcia` | PRECIP, SOILM | running means (`running_mean` 12 and 60) | Smoothing shows multi-year swings but can fool you; no significant trend |
| `ebro_delta` | PRECIP, T2M | before vs after (`periods`) | Temperature shifts the whole distribution, rain does not; storm Gloria was a sea storm these variables cannot measure |
| `galicia_fires` | T2M, SOILM | season of risk + compound conditions (`season` JJAS, `season_scatter`) | Look at the season that matters; hot and dry together |
| `sierra_culebra` | T2M, SOILM | does the answer depend on the window? (`window_trends`) | Uncertainty, record length, reading a confidence interval; weak evidence |
