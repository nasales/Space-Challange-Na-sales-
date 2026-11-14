# AI usage log

AI tools were used only to help implement the team's own idea, not to come up with it.
Every agent adds one line per task.

| Date | Tool / agent | Area | What it did |
|---|---|---|---|
| 2026-11-14 | Claude Code (Interface agent) | Interface | Copied the existing prototype from Desktop/prueba2 (3D map, detective, HUD components, map data, fetch scripts) into the repo so the team can see it; added three.js dependency |
| 2026-11-14 | Claude Code (Interface agent) | Interface + Game (approved by Yeipi) | Restructured src/: 3D code and map into src/game/ (GameView, scene/, map/), HUD into src/ui/hud/, game-UI bridge types and contract types in src/shared/; updated area file paths |
| 2026-11-14 | Claude Code (Interface agent) | Team docs (approved by Yeipi) | QA is now done by every person on their own changes: updated AGENTS.md (team table, definition of done) and docs/agents/qa.md |
| 2026-11-14 | Claude Code (Interface agent) | Tests (approved by Yeipi) | Installed Playwright, added playwright.config.ts and tests/e2e/demo.spec.ts (game loads with map + HUD, speedometer reacts to W); credited three.js and Playwright in REFERENCES.md |
| 2026-11-14 | Claude Code (Interface agent) | Interface + Game data (approved by Yeipi) | Translated HUD text/comments (src/ui/hud) and landmark descriptions (landmarks.json) to English; credited map data sources (NASA GIBS, AWS Terrain Tiles, Natural Earth, GeoNames) in REFERENCES.md |
| 2026-11-14 | Claude Code (Interface agent) | Game (approved by Yeipi) | Added the low-poly Giralda (Seville) landmark model with its orange-tree plaza, plus reusable ornaments (horseshoe arch, sebka panel, balustrade, pinnacle, orange tree) |
| 2026-11-14 | Claude Code (Interface agent) | Backend skeleton (approved by Yeipi) | Added Vercel skeleton: vercel.json, FastAPI entrypoint api/index.py, backend/ (health + cases endpoints, Supabase client with data/cache fallback), supabase/schema.sql, pipeline/ stubs for the stats team, src/shared/api.ts, tests/api, docs/backend.md, Vite /api proxy |
| 2026-11-14 | Claude Code (Interface agent) | Game (approved by Yeipi) | Made landmarks climbable like house roofs (baked height map per monument, removed invisible wall) and kept the chase camera in front of tall monuments |
| 2026-11-14 | Claude Code (Interface agent) | Game (approved by Yeipi) | Added the six remaining Spain landmark models (Torre de Hércules, Catedral de Santiago, Guggenheim, Ciudad de las Artes y las Ciencias, Mezquita de Córdoba, Alhambra) with their own bases, new shared ornaments, and scales that keep neighbouring landmarks apart |
| 2026-11-14 | Claude Code (Interface agent) | Interface + Game (approved by Yeipi) | Added the main menu (src/ui/menu: title + Play button, comic sunburst stage) shown before the map; new src/game/detective/DetectiveShowcase.tsx renders the 3D detective looping a hero animation (turbo sprint, twisting backflip, magnifier pose that follows the mouse); App.tsx switches menu -> game; e2e tests press Play first and cover the menu |
| 2026-11-14 | Claude Code (Interface agent) | Game (approved by Yeipi) | Cartoon restyle of the landmarks (chunky bevelled kit, tapered towers, onion domes, scallop shell, Mezquita arch forest, curved Guggenheim sails); landmark physics: thin details solid + gap closing; camera never enters monuments; detective restyled as classic noir with a cloth-like scarf |
