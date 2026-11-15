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
(filled in as agents finish)

## Open questions for Diego
(filled in at the end)
