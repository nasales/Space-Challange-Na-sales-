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
| 2026-11-14 | Claude Code (Interface agent) | Game (approved by Yeipi) | Made landmarks climbable like house roofs (baked height map per monument, removed invisible wall) and kept the chase camera in front of tall monuments |
