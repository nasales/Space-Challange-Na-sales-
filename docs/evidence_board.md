# Evidence board (featured cases, second format)

Agreed with Diego on 2026-11-15. Status: plan, to be built overnight on `diego_dev`.
**No PR to main** until Diego says so (hosting changes by Perry).

## Decisions
- Featured cases in the game: **5** — `dana_valencia`, `filomena_madrid`, `cordoba_heat`,
  `aneto_glacier`, `donana`. The other 5 (`daimiel`, `almeria_murcia`, `ebro_delta`,
  `galicia_fires`, `sierra_culebra`) are **parked, not deleted**: their scripts, data and levels
  stay in the repo; restoring one = adding its id back to the active lists.
- New cases tonight: **Filomena (Madrid)** and **Córdoba heat**, with a witness + dialogue exactly
  like the DANA (3D witness next to the "!", focus mode, mood emotes, notebook claim).
- After the dialogue, these cases use an **evidence board** (detective corkboard) instead of the
  DANA's 8 multiple-choice steps. The DANA keeps its format for now.
- Desktop only: no phone layout work (the game needs a keyboard).
- 2026-11-15 (Diego): Ivan's level is no longer part of the case flow (it was a stand-in). After the
  conclusion comes the "CASE CLOSED" stamp directly, and the marker turns green. Ivan owns the map
  markers and their green state; everything after opening a case is Diego's.

## Player flow
1. Walk into the case zone, Space: the detective walks to the witness, dialogue in speech bubbles,
   the witness ends with a **claim** (same as DANA).
2. **Evidence board**: the camera cuts to a cork board. Centre: a polaroid of the witness with the
   claim on a card. Around it, 4-6 pinned items face down: chart "photos", newspaper clippings,
   data cards. Each item, when opened, teaches one way to read the series through a **small
   hands-on task** (not a quiz), for example:
   - click the point (find January 2021 among all Januaries);
   - drag a ruler to fit the trend line, then compare with the real one;
   - order polaroids (summers from hottest to coolest);
   - drag a slider (add years and watch the uncertainty shrink);
   - tally (count hot months per decade);
   - compare a clipping with the chart (47 °C on one afternoon vs a monthly mean).
   Feedback is immediate and kind; a wrong try gives a hint and lets the player try again.
3. When an item is solved, the player **links it to the claim with red string** and says whether
   it **supports**, **contradicts** or **says nothing** about the claim (with a hint if wrong).
   The item gets pinned face up; its clue goes to the notebook.
4. When every item is linked, the board shows the overall picture; the player writes the
   conclusion; then "CASE CLOSED" with the verdict on the witness's claim.

## Witnesses (fictional adults, AGENTS.md rule 11)
| Case | Witness | Claim (idea) | Expected verdict |
|---|---|---|---|
| `filomena_madrid` | Madrid local, e.g. a retired street-sweeper / snowplough driver or a kiosk owner | "We had the biggest snowfall in 50 years, so global warming is a lie!" | wrong (one cold month inside a clearly warming series; January alone is noisier, p = 0.069) |
| `cordoba_heat` | Guadalquivir valley local, e.g. an olive farmer or a fan seller | "Every summer is hotter than the one before!" | partly (summers warm clearly, p = 0.00017, 6 of the top 10 in the last 10 years; but not every summer beats the last) |

Names, looks and lines are written by the story agents; numbers must match
`data/tutorial_data/<case>.json` (fact sheet in docs/case_tutorials.md tables and the data files).

## Shared format (to add to `src/shared/tutorial.ts`)
`TutorialScript.board?` — when present, the UI shows the evidence board instead of `steps`:
- `items[]`: `id`, `kind` (`chart` | `clipping` | `datacard`), `title`, `teaser` (face-down label),
  `task` (one of a fixed set of task types with parameters, e.g. `click_point`, `fit_line`,
  `order_cards`, `slider_window`, `tally`, `compare_clipping`), `text` (what it teaches, <= 80
  words), `chart` (a `ChartSpec`, reusing the existing views), `relation`
  (`supports` | `contradicts` | `neutral`), `relation_feedback`, `clue`.
- `layout` hints (optional positions on the board) — the UI may ignore them.

## Work plan (overnight)
0. Main session: add the `board` types; cut the active lists to 5 (tutorial ids + Ivan's marker
   list, with an AGENTS.md note to Ivan); witnesses for the two cases in `src/shared/witness.ts`.
1. In parallel: story agent Filomena, story agent Córdoba (scene + board script), interface agent
   (evidence board + task components), game agent (place the two witnesses next to the Madrid and
   Córdoba markers; check the dialogue camera frames them, buildings around).
2. Integrate on `diego_dev`; the interface agent re-tests against the real scripts.
3. QA agent on the full in-game flow of both cases + DANA not broken; fix; push `diego_dev`.
4. Morning report for Diego: what was done, decisions taken, open questions, screenshots.
