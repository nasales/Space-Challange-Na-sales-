# Game agent — owner: Person 2

## Scope (only edit these)
- `src/game/` — 3D tilted world map, player character, controls, stops, featured-case markers (`GameView.tsx`, `scene/`, `map/`, …)
- `public/maps/` and `scripts/fetch-*.mjs` — map data and the scripts that download it
- `src/game/assets/`
- Shared with Interface (change only with agreement): `src/shared/`, `src/App.tsx`
- Stack: Vite + React + TypeScript + three.js. The game never imports from `src/ui/`; it only uses the types in `src/shared/`.

## Extra checks in every SYNC CHECK
1. Drive to every featured case and stop: the correct place and coordinates are passed to the interface.
2. Stopping at the ocean, a pole or the date line does not crash anything (it shows "no data" if needed).
3. The game runs smoothly on the weakest team laptop (no visible freezes).
4. All 3D models and textures are credited in `REFERENCES.md` with an open license. No branded vehicles or logos.
5. The game loads without internet once its assets are local.
