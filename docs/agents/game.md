# Game agent — owner: Person 2

## Scope (only edit these)
- `src/game/` — 3D tilted world map, police car, controls, stops, featured-case markers
- `src/game/assets/`
(TODO: adjust paths once the stack is chosen)

## Extra checks in every SYNC CHECK
1. Drive to every featured case and stop: the correct place and coordinates are passed to the interface.
2. Stopping at the ocean, a pole or the date line does not crash anything (it shows "no data" if needed).
3. The game runs smoothly on the weakest team laptop (no visible freezes).
4. All 3D models and textures are credited in `REFERENCES.md` with an open license. No branded vehicles or logos.
5. The game loads without internet once its assets are local.
