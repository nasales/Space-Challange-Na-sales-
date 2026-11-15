# Overnight report — evidence board (Filomena + Córdoba)

For Diego, night of 2026-11-15. Plan: `docs/evidence_board.md`. Everything on `diego_dev`, **no PR**.

## Decisions taken (main session)
1. **Cut to 5 cases** done in one place: `TUTORIAL_CASE_IDS` in `src/shared/tutorial.ts` now lists
   dana_valencia, filomena_madrid, cordoba_heat, aneto_glacier, donana; the other 5 are in
   `PARKED_CASE_IDS`. The game draws markers only for active cases (one filter line in
   `src/game/GameView.tsx`). Nothing deleted: Ivan's 10 levels, all scripts and data stay. Restore
   = move an id back. FYI note to Ivan added in AGENTS.md.
2. **Witnesses** (fictional adults, defined in `src/shared/witness.ts`):
   - Filomena: **Pilar**, newspaper kiosk owner in Madrid (her kiosk ties in with the newspaper
     clippings on the board); curly grey hair, beret, glasses, red top, apron.
   - Córdoba: **Rafael**, olive farmer in the Guadalquivir valley; straw hat, beard, white shirt.
3. **Board format** in the shared types (`EvidenceBoard`, `EvidenceItem`, 6 task types:
   click_point, fit_line, order_cards, slider_window, tally, compare). A case with `board` shows the
   corkboard; the DANA keeps its quiz steps.
4. Desktop only (as agreed): no phone screenshots or layout work.

## Work done
### Filomena script (story agent) — `data/tutorials/filomena_madrid.json`
- Pilar's scene: 14 lines with moods (opens "¡Buenos días, detective!", lived the snow at her
  kiosk for 40 years, skis on Gran Vía, ice and broken trees, "Mira, hijo…"). Claim: *"We had the
  biggest snowfall in fifty years, so global warming is a lie."* Verdict: **wrong** (she is right
  that it was the coldest January this century, but one cold month is weather; Madrid ~1.7 °C
  warmer since 1980).
- Board "Is Madrid really not warming?", 5 items, 5 task types: snow clipping + every-January rain
  (compare, neutral), click the coldest January since 2001 = 2021 (supports), order 5 Januaries
  coldest→warmest (neutral), ruler on all-months anomalies (contradicts), slider on start years:
  fewer years = wider range (contradicts). No tally (this case has no threshold counts).
- Agent decisions: avoided near-tied years in the cards; "coldest of this century" instead of
  "coldest ever" (1992 vs 1985 differ by 0.009 °C); slider teaches uncertainty, not cherry-picking,
  because Ivan's Filomena level already covers the zoom trap.
### Córdoba script (story agent) — `data/tutorials/cordoba_heat.json`
- Rafael's scene: 14 lines (olive grove, work from 6 am, ~47 °C in August 2021, grandfather's
  trees, "No, hombre… Every summer is hotter than the one before!"). Verdict: **partly** (summers
  ~2 °C warmer since 1980, hot months far more common; but 2018 was ~1.9 °C cooler than 2017).
- Board "Is every summer hotter than the last?", 5 items, 5 task types: 47 °C clipping vs monthly
  chart (compare, neutral), order 6 summer polaroids hottest→coolest (supports), click the 2018 drop
  in 2014-2026 (contradicts), ruler on summers ±0.3 °C/decade (supports), tally months above 28 °C:
  1980s = 5, 2016-25 = 19 (supports).
- Agent decisions: the claim is split in two parts (warming vs "every summer"), which explains the
  relations and the "partly" verdict; click range limited to 2014-2026 so 2018 is the unique answer.
### Evidence board (interface agent) — `src/ui/casefile/EvidenceBoard.tsx`, `src/ui/casefile/board/`
- Cork board with the witness polaroid and the claim card in the centre, 5 cards pinned around
  (face down with a handwritten teaser), notebook docked on the right, "x / 5 linked" progress.
- Opening a card zooms it: text + chart / newspaper clipping / typed data card + the task. All 6
  task types work: click a point (snaps to the nearest point), drag a ruler (two handles, arrow
  keys too; then the real trend line is drawn and both slopes compared), drag polaroids into order
  (values revealed only when right), slider over start years, tally boxes with −/+, multiple choice.
  Wrong tries give the hint; right ones a small celebration.
- "Link it to the claim": supports / contradicts / says nothing; wrong -> the explanation as a hint;
  right -> red string animated from the card's pin to the claim, card flips face up with a coloured
  tag, clue stamped into the notebook. All linked -> summary card -> conclusion -> Ivan's level ->
  CASE CLOSED. The DANA keeps its old step format.
- My fixes after review: Córdoba's polaroid task used a ranking chart that printed every value
  (answer given away) -> now the summers chart; both ruler cards said the real trend before the
  task -> moved to the success message; side-accent borders replaced by full comic frames.
### Witnesses on the map (game agent) — `src/game/witness/`
- **Pilar** stands on the plaza by the Puerta de Alcalá with a small green **newspaper kiosk**;
  **Rafael** in the Patio de los Naranjos of the Mezquita with **olive crates**. Talk icon and
  ground arrows like Vicent; Vicent unchanged.
- Fixed generic dialogue-camera bugs that only showed outside Valencia: talking through the
  Retiro fence, the detective stuck on the arcade wall, trees covering the bubbles, camera drift.
- New trimmed beard (the old one looked like a black hole) and a proper shop apron for Pilar.
- Known leftovers: in Córdoba an orange tree can fill the left edge of the frame from some
  approach angles; from the Mezquita roof Rafael is hidden (only his "…" bubble shows).
### Tests
- Both agents wrote a board validator; I kept the Filomena one (generic) and checked the Córdoba
  script passes it (recount of the tally included). 340 pipeline/stats tests pass.

## Open questions for Diego
(filled in at the end)
