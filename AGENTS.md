# AGENTS.md — Instructions for every coding agent on this team

Read this file fully at the start of every session. Then read your area file in `docs/agents/`.

## Project in one paragraph
Team project for NASA Space Apps Challenge 2026, challenge "Be An Earth System Trend Detective!".
A detective game: the player drives a police car over a tilted 3D world map, stops at a place,
picks a variable (temperature, water, wind…), sees a "Sherlock" screen with charts that do NOT
give the conclusion, writes their own conclusion, and an AI checks it against the statistical
result (trend slope + significance test such as Mann-Kendall).

## Team and areas
| Area | Human owner | Agent | Area file |
|---|---|---|---|
| Interface | Yeipi | Interface agent | `docs/agents/interface.md` |
| Game (3D map, car) | Person 2 | Game agent | `docs/agents/game.md` |
| Data + statistics | Person 3 | Data agent | `docs/agents/data.md` |
| Backend + AI checker + integration | Perry | QA agent | `docs/agents/qa.md` |
| Product, submission, pitch | Person 5 | — | — |

If you do not know which area you belong to, ask the human before doing anything.

## Hard rules (never break these)
1. **Never commit or push directly to `main`.** Work on a branch named `<area>/<short-task>` and open a PR. Each person merges their own PR into `main`.
2. **Only edit files inside your area's folders** (listed in your area file). For any other file, stop and ask.
3. **Agents edit `tests/stats/` only when the human owner explicitly asks for it in that session, and the human reviews the tests before commit. Never change an existing test to make it pass.**
4. **Never change the data contract** (`docs/contract.md`) without explicit approval from Person 3 and Yeipi.
5. **Everything in English**: UI text, code comments, commit messages, docs.
6. **No NASA logos, insignia, flags or mission patches**, and never generate or modify NASA branding. Credit data in text: "Data: NASA MERRA-2".
7. **Do not invent the product concept or new features.** Implement what the humans asked for. If something is unclear, ask.
8. **Log your work in `AI_USAGE.md`** (one line per task: date, agent, area, what you did). AI use must be declared to the judges.
9. **Credit third-party code, data, fonts and images in `REFERENCES.md`** with their license. Only use open-source or public material.
10. **Featured cases must work offline** from `data/cache/`. Never make the demo depend on a live NASA API call.
11. No personal data, no images of people under 18, no commercial promotion.

## SYNC CHECK — run it every time the repo is updated
**When:** at the start of every session, after any `git pull` / merge / rebase, and after switching branches.

**Steps:**
1. `git status`: if there are uncommitted changes, stop and tell the human before continuing.
2. `git log --oneline ORIG_HEAD..HEAD` (or the last 10 commits if that fails): see what came in.
3. Check whether `docs/contract.md` or anything in `data/cache/` changed. If it did, verify that your area still matches the contract.
4. Read the section 'Open requests between areas' at the end of this file and list in your report every open request addressed to your area or your human.
5. Run `./scripts/check.sh`.
6. Run the extra checks listed in your area file.
7. **Do not fix anything outside your area.** If something in another area fails, write a bug line (format below) for the human to post.
8. Report exactly in this format:

```
SYNC CHECK — <area> — <date time>
New commits: <N> — <one-line summary of each that matters>
Contract changed: yes / no
check.sh: PASS / FAIL (<failing step>)
Area checks: PASS / FAIL (<details>)
Affects my area: <what and why, or "nothing">
Bugs for other areas: <bug lines or "none">
Open requests for me: <list or 'none'>
Next action: <what you propose to do>
```

## Definition of done
A task is done only when:
- it works on another teammate's machine, not only yours;
- it does not break the demo path (featured case → variable → chart → conclusion → AI check);
- `./scripts/check.sh` passes;
- everything is in English;
- `AI_USAGE.md` is updated (and `REFERENCES.md`, if needed).

## Bug format (GitHub Issues, one line)
`[CRITICAL|MEDIUM|MINOR] what happens — steps to reproduce`
- CRITICAL: breaks the demo, fix now.
- MEDIUM: visible but avoidable, fix if there is time.
- MINOR: cosmetic, fix after the freeze or never.

## Key times
- Sunday 13:00: **feature freeze**. After this, only CRITICAL fixes.
- Sunday 23:59: submission closes. Pitch on Sunday at 17:30.

## Open requests between areas
Append-only. Format: `- [ ] YYYY-MM-DD From -> To: request`. The receiver ticks `[x]` and adds a short answer when done. Never delete lines.
- [x] 2026-11-14 Ivan -> Manuel (Perry): add `__pycache__/` to `.gitignore`. — Perry: done.
- [x] 2026-11-14 Ivan -> Manuel (Perry): run `archivos_preSupabase/etl_espana.py` with `--with-trends` when generating the export; without it every `trend` is null and `pipeline/compare_db.py` has nothing to compare. — Perry: the full load runs without it (series only). The ETL trends can be recomputed offline from the export with `trend_stats()` (no new NASA download), so Ivan's reference copy is still possible.
- [x] 2026-11-14 Ivan -> Manuel (Perry): `explain(trend, series)` is in `pipeline/explain.py` (plain-English facts for the AI checker, one per line). Confirm the format works for the checker, and say when the database export will be ready. — Perry: full load started 2026-11-14 12:50, expected around 15:30. The AI checker is not built yet; I will confirm the `explain` format when I build it.
- [x] 2026-11-14 Ivan -> Diego: the real `analyze_trend` is in main (`from pipeline.trend import analyze_trend`); replace the stub. It needs >= 120 valid months and returns slope per year (not per decade). — Diego: done. `get_analyze_trend()` in `build_case.py` picks the real one automatically (stub only if `trend.py` is missing); checked end to end with `fill_trends`. Database rows now use your `TEST_NAME`. Note: `mean_value` is not returned; `fill_trends` computes it as a fallback.
- [x] 2026-11-14 Ivan -> Diego: the annual mode of block 2 was dropped (pre-whitening on ~20 annual means removes most of the trend); strike it from `pipeline/README.md`. — Diego: done.
- [x] 2026-11-14 Ivan -> Diego: when will the featured cases be in `data/cache/`, and is `pipeline/series.py` in main? Ivan needs them for block 5 and the block 3 cross tests. — Diego: `series.py`, `build_case.py`, `sources/supabase_export.py` and `fill_trends.py` are in main (PR #7). Featured cases need Perry's real export; they come right after it (block 6).
- [ ] 2026-11-14 Ivan -> all: rule 3 changed; agents may write tests/stats/ when the human asks and reviews them. Object here if you disagree. — Diego: OK.
- [x] 2026-11-14 Ivan -> Manuel (Perry): FYI, with Ivan's OK, PR #11 edited scripts/check.sh (python3 falls back to python on Windows) and docs/agents/qa.md (rule 3 wording). Tick if OK. — Perry: OK.
- [x] 2026-11-14 Ivan -> Diego: FYI, PR #11 edited pipeline/README.md (rule 3 wording only). Tick if OK. — Diego: OK.
- [x] 2026-11-14 Ivan -> Manuel (Perry): compare_db.py is only meaningful against trend rows computed by etl_espana.py (--with-trends). If the trends table is filled with fill_trends.py (which uses analyze_trend), keep a copy of the ETL export with trends so the check is independent. — Perry: OK, see the --with-trends answer above.
- [x] 2026-11-14 Perry -> Diego: no new code needed (`fill_trends.py` is already in main); wait for the export. The real Supabase load (6 variables, 1184 cells) finishes around 15:30 today. I will share the `export/` folder (same layout as `pipeline/README.md`). Then: (1) run `fill_trends.py` on it and tell me if it runs clean, (2) build the featured cases in `data/cache/` (block 6). I run the final `fill_trends` and upload the rows to `trends` myself; you never need the DB password. — Diego: (2) cancelled by v4. (1) pending your export; ready to run `fill_trends` + the new `pipeline/check_trends.py` (exit 0 = safe to upload) as soon as you share it. — Perry: received (check_trends: 7090 rows, 0 errors, 0 warnings); trends_upsert.sql run as is on 2026-11-14. `trends` has 7090 rows (4250 significant), keys match `series` exactly; `get_cell` returns the trends.
- [x] 2026-11-14 Perry -> Ivan: same export at ~15:30. Block 6a (`analyze_trend` vs `trend_stats()` on real cells) can use it directly; `trend_stats()` is in `archivos_preSupabase/etl_espana.py` (now in English). — Perry: cancelled, no task for Ivan from the database side for now.
- [ ] 2026-11-14 Perry -> all: `archivos_preSupabase/` (brief, schema, ETL) is now in English (AGENTS.md rule 5); the brief has the current status and test results.
- [x] 2026-11-14 Ivan -> Diego, Manuel: Ivan now owns the 6-7 featured case studies (e.g. Valencia DANA). Confirm who writes their JSON in data/cache/ (Ivan proposes: Ivan), and update the README ownership table if you agree. — Perry: agreed, Ivan owns them; README updated (v4). Diego to tick. — Diego: agreed.
- [ ] 2026-11-14 Ivan -> Diego, Yeipi: the 7 featured case studies are in data/cache/case_<id>_<var>.json (13 files, contract format), built from NASA POWER point data 1981-2024 (raw in data/raw/power/), not from the Supabase export. Case list and coordinates in pipeline/cases.py. — Diego: read.
- [x] 2026-11-14 Perry -> Diego, Ivan: work split clarified (pipeline/README.md v4). Diego = generic analysis (any point of the map): run `fill_trends.py` on my export and tell me it runs clean; point (2) of my earlier request (featured cases) is cancelled. Ivan = about 10 featured cases marked in the game, in `data/cache/case_*.json`. Both: merge `main` into your branch now. Tick when read. — Ivan: read, main merged into ivan_dev. — Diego: read, main merged into diego_dev.
- [ ] 2026-11-14 Ivan -> Yeipi: featured case texts (question shown first, context below) and file list are in data/cases_index.json.
- [x] 2026-11-14 Diego -> Ivan: please add the full-scale dry run to the "Validation" section of `docs/methods.md`. `py -m pipeline.dry_run` runs `fill_trends` + your `analyze_trend` on 7104 synthetic series (1184 cells x 6 variables, real lengths, seasonal cycle, AR(1) noise, gaps, 50 % with no trend). Results (seed 2026): false positives 4.7-5.6 % (precip 6.8 %), 95 % CI coverage 93.9-95.8 %, slope bias within +/-3 %, strong trends always detected; 6 min, 57 MB. Table and definitions in `pipeline/README.md`, Interface 5. Also FYI from the block 3 cross tests (`tests/stats/test_ivan_cross.py`): the Gilbert CI is symmetric only up to one rank (lo floored, hi ceiled); intended and matches the database, just so you can answer if asked. — Ivan: done, added to the Validation section of docs/methods.md (precip 6.8 % noted as slightly above nominal; CI asymmetry explained).
- [ ] 2026-11-14 Ivan -> Yeipi: the backend serves data/cache/case_*.json, but each featured case's question, context and facts (for the AI checker) are in data/cases_index.json. Please read it (or tell me the format you want and I will adapt it).
- [ ] 2026-11-14 Ivan -> Manuel (Perry): export/ is git-ignored and not shared; please share the export folder (zip link) so Ivan can run compare_db --recompute-db as a real-data check.
- [x] 2026-11-14 Ivan -> Manuel (Perry): data needed for the 10 featured cases is in docs/case_data_request.md. Ivan runs the analyses and fills the rest. — Perry: priority 1 done (T2M -> `t2m_long`, PRECIP -> `precip`, SOILM -> `soilmoist`; 10 cases, 19 series), zip sent by WhatsApp. Agreed with Ivan: each case is a single point (lat/lon from `pipeline/cases.py`), value = native pixel containing it (no box average), same units as the grid database. New table `case_series` in the same Supabase project (`archivos_preSupabase/case_series_schema.sql`, loaded by `etl_cases.py`). NDVI/LST/SNOW (MODIS) come later. When your `data/cache/case_*.json` are in main, Perry runs `pipeline/upload_cases.py`.
- [ ] 2026-11-14 Yeipi -> Manuel (Perry): PR #29 adds `.github/workflows/vercel-deploy.yml` (outside Interface, written at Yeipi's request). Vercel blocks every main commit (private repo + Hobby); the workflow calls a Vercel Deploy Hook on each push to main. Please review; the `nasales` owner must create the hook and the repo secret `VERCEL_DEPLOY_HOOK_URL` (setup in the file header).
- [x] 2026-11-14 Ivan -> Manuel (Perry): OK to your flow. build_cases.py --source case_export reads the zip; expected layout is in pipeline/build_cases.py docstring. Send the zip when ready. — Perry: zip sent and used (PR #35).
- [x] 2026-11-14 Ivan -> Manuel (Perry): data/cache/case_*.json rebuilt from your case_export (19 series) and merged; you can run python -m pipeline.upload_cases. — Perry: done 2026-11-14. Supabase `cases` has the 19 files (10 significant) and `case_series` the 19 raw series; values match between both tables. Uploaded with SUPABASE_DB_URL (same upsert as upload_cases.py, no service key needed).
- [ ] 2026-11-14 Ivan -> Ezequiel: the 10 featured cases are described in docs/featured_cases.md (data, results, how to edit question/context). Write the stories there or send them to Ivan.
- [ ] 2026-11-14 Ivan -> Yeipi/Perry: src/levels/ (Ivan-only) adds levels.html as a second Vite entry and tests/e2e/levels.spec.ts; the main app (App.tsx) is untouched. Integration later = one line in App.tsx.
- [ ] 2026-11-14 Perry -> Diego: FYI, resolving the conflict in PR #29 (merge of main at 16:59) dropped Ivan's lines from AGENTS.md and AI_USAGE.md; restored in Perry's next PR. When resolving conflicts in these two files, keep both sides.
- [ ] 2026-11-14 Perry -> Yeipi: with your OK, added a temporary database test page: open the site with `?dbtest` (src/ui/dbtest/, 10 lines in src/App.tsx; the game is unchanged without the parameter). New backend endpoint `/api/cell?lat=&lon=` and `fetchCell()` in src/shared/api.ts give any map point (6 variables + trend). Vercel needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in its environment variables.
- [ ] 2026-11-14 Yeipi -> Person 2 (Game): FYI, with the human owner's OK, the menu PR edits src/game/detective/createDetective.ts (optional `outfit` argument + `setOutfit()`, default look unchanged, `createDetective()` still works) and DetectiveShowcase.tsx (new "investigate" loop, `mode="turntable"` for the Wardrobe). New shared file src/shared/outfit.ts (detective colors). Next step (not done yet): GameView passes the saved outfit to createDetective so the colors show in the game. Tick if OK.
- [ ] 2026-11-14 Perry -> Yeipi, Person 2: the site is hosted on Cloudflare Workers (static), so `/api` (Python) does not run there. The browser now reads Supabase directly, read only, with the publishable key (`src/shared/supabase.ts`: `fetchCell`, `fetchCases`, `fetchCase`). Build variables on Cloudflare: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (never the secret key). New small badge top-left (src/ui/status/DbStatus.tsx, mounted in src/App.tsx): database status + build version (v0.1.0 · commit · build time). Tell Perry if it gets in the way.
- [ ] 2026-11-14 Perry -> all: INCIDENT. The Supabase secret key was set by mistake in the Cloudflare build variable `VITE_SUPABASE_PUBLISHABLE_KEY` and was published in the site JavaScript (build 00cb9d4). It is being revoked and replaced; the variable now holds the publishable key. Rule: a `VITE_` variable always ends up public in the browser, so only the publishable key may go there. Never put `sb_secret_...` in Cloudflare build variables.
- [ ] 2026-11-14 Ivan -> Person 2 (Game): [MEDIUM] tests/e2e/demo.spec.ts fails in headless Playwright: the map stays on "Drawing the map…" and no canvas appears ("game loads with the map and the HUD", "the detective moves and the speedometer reacts"). Already failing at ac31e9f, not caused by src/levels. Repro: npx playwright test tests/e2e/demo.spec.ts
- [ ] 2026-11-14 Ivan -> Yeipi, Ezequiel: all 10 featured-case levels are in src/levels (ivan_dev). To open them from the case intro: in App.tsx onStart, if getLevel(caseId) exists show <CaseLevel caseId={caseId} onExit={...} onResult={...} /> (new screen 'level'), else the 3D game. Tell Ivan when the intro is in main and he will send the one-line change for your review.
- [x] 2026-11-14 Yeipi -> Manuel (Perry): FYI, the database badge (src/ui/status/DbStatus.css) moved from top-left to bottom-center, compact on phones: top-left covered the new menu title and the Wardrobe Back tag. Same content, still pointer-events: none. Tick if OK. — Perry: OK.
- [ ] 2026-11-14 Perry -> Yeipi: for the magnifying glass (Space + 6 variables): `fetchPointAnalysis(lat, lon, place)` in `src/shared/pointAnalysis.ts` returns the six variables of any map point (`variables[i].name`, `.definition`, `.data` = CaseData ready for the Sherlock charts, null if no trend -> disable that variable; `.extra` = CI and direction, reveal only after the conclusion). Returns null on sea / outside the map. One request per stop, cached per cell. Tell Perry if you want another shape.
- [ ] 2026-11-14 Perry -> Yeipi: a PROTOTYPE variable menu is in main so the team can test any point on the host: press Space in the game (src/ui/probe/PointProbe.tsx, mounted with one line in src/App.tsx). It is only a stand-in for your magnifying glass: to replace it, delete src/ui/probe/ and that line, and update the last test in tests/e2e/demo.spec.ts. Keep using fetchPointAnalysis for the data.
- [x] 2026-11-14 Yeipi -> Manuel (Perry): the magnifier variable picker (Space, while stopped) replaces your PointProbe prototype in src/App.tsx, as your comment said; src/ui/probe/PointProbe.tsx and src/shared/pointAnalysis.ts are left in place (not imported) so the any-point analysis can be wired into the magnifier clue buttons, which are disabled for now. — Perry: OK. src/ui/probe/ deleted and its e2e test replaced by a magnifier test (stopped -> Space -> 6 clues -> Esc); src/shared/pointAnalysis.ts stays for the clue buttons.
- [ ] 2026-11-14 Perry -> Yeipi: at Perry's request the magnifier clues are now live: VariablePicker loads the point when the lens opens (new `location` prop from App.tsx), ClueRing gets `data` + `onPick` (stamp shows Wait / No data / Offline only when a clue cannot open), and a new ClueResult.tsx sheet shows the chart and, on request, the result. Restyle or move it freely; keep the e2e test in tests/e2e/demo.spec.ts passing.
- [ ] 2026-11-15 Perry -> Yeipi: at Perry's request the magnifier evidence sheet (src/ui/magnifier/ClueResult.tsx + new src/ui/magnifier/analysis/) now shows the full trend analysis from the start (direct mode: verdict, monthly series, anomalies with Sen trend line and 95 % band, seasonal cycle, annual means, method and data). The hidden-until-conclusion rule still applies to the Sherlock screen with the AI checker. Restyle freely; keep the magnifier e2e test passing.
- [ ] 2026-11-15 Perry -> Yeipi, Person 2: background music is in (team choice): "Investigation" (Umplix, CC0) loops by default from the menu on, starting on the first click or key press (browsers block sound before that). "Jazz (Saxophone)" (Pro Sensory, CC0) is ready as the alternative. All in src/shared/music.ts (DEFAULT_TRACK; try ?music=jazz-saxophone or ?music=off), files in public/music/, one line in src/App.tsx. No mute button yet: say if you want one in the HUD or menu.
- [ ] 2026-11-14 Perry -> Person 2 (Game): at Perry's request, the detective can now row a small boat on a band of lighter, shallow water (16 km) along the whole coast and on the whole sea between the mainland and the Balearic Islands. New: src/game/map/shallowSea.ts (band width, enclosed seas) and src/game/boat/createRowBoat.ts (it poses `detective.parts` after `detective.update()`; createDetective.ts only has a comment changed). Edits: map/exploredRegion.ts (`COASTAL_SEA_KM` 20 -> 28; new `neighbours` argument: dry ground outside every country outline, which showed as holes at the coast, now goes to the nearest country), map/rasterizeCountry.ts (accepts several countries), map/buildToyMap.ts, map/palette.ts (`SEA.ford`), scene/createTerrain.ts (`isFord`, `neighbours`), GameView.tsx (`isDrivable`, boat update, no dust or footprints while rowing). `isExploredLand` now also covers that recovered coastal ground. Tick if OK.
- [ ] 2026-11-15 Ivan -> Game owner, Yeipi: PR adds case markers/zones (src/game/cases), Peñafiel Castle (landmarks: per-landmark plaza/blend/clearance + spacing()), day/night cycle (src/game/scene/dayCycle.ts + sky/lighting/clouds/ink outline), night lights on houses/landmarks (src/game/towns, landmarks, scene/nightLights.ts), zone hint in App.tsx. Please review; restyle freely.
- [ ] 2026-11-14 Diego -> Ivan: FYI, with Diego's OK (and the Discord mentor's advice: detailed methods for the jury, plain language for players), `docs/methods.md` got three new sections at the end: "Results on the map" (real 7090-series run, `check_trends` 0 errors / 0 warnings, tair vs t2m_long cross-check), "Limitations" and a full "References" list (Mann, Kendall, Theil, Sen, Benjamini-Hochberg, Wilks, GLDAS, IMERG, MERRA-2). Your text and the generated RESULTS block are unchanged. Same citations added to `REFERENCES.md`. Also: after your case_export rebuild, your summary sentence under the RESULTS block ("...no significant trend, except a small increase in precipitation at Aneto") no longer matches the table (Aneto PRECIP p = 0.717, not significant; SOILM significant at Tablas de Daimiel p = 0.047, Sierra de la Culebra p = 0.026 and Donana p = 0.050; T2M now +0.26 to +0.39 °C per decade); not touched, please update. Tick if OK.
- [ ] 2026-11-14 Diego -> Yeipi: `docs/methods_plain.md` is a plain-language "How the detective checks the data" page for players (data sources, 3 steps, how to read the result, limits, data credits), as the Discord mentor recommended. Could the game show it (e.g. an "About the data" or help screen)? Text can be shortened as you need.
- [ ] 2026-11-14 Diego -> Yeipi: FYI, with your OK, featured-case tutorials added new Interface files in `src/ui/casefile/` (case-file overlay: intro, steps with charts and questions, conclusion, reveal; near-case hint; temporary `?casefile=dana_valencia` preview) and a few lines in `src/App.tsx`. Formats in `docs/case_tutorials.md` and `src/shared/tutorial.ts`. The reveal screen has a `TODO(ai-checker)` hook. It picks up your `--font-*` theme variables once they are in main. Tick if OK.
- [ ] 2026-11-14 Diego -> Ivan: FYI, diego_dev merged your ivan_dev (case markers + levels). Agreed with Diego: when the player opens a case, first Diego's part runs (3D witness next to your "!" tells the detective the context in speech bubbles, then the tutorial in `src/ui/casefile/` that teaches how to read the series), and then your level (`CaseLevel`) as the final challenge; your green marker on a correct answer stays. Integration in `src/App.tsx`; witness model in `src/game/witness/`. Tell Diego if you disagree.
- [ ] 2026-11-15 Diego -> Ivan: FYI, the team keeps 5 featured cases (dana_valencia, filomena_madrid, cordoba_heat, aneto_glacier, donana). On diego_dev the game draws markers only for `TUTORIAL_CASE_IDS` (src/shared/tutorial.ts, one filter line in src/game/GameView.tsx); your 10 levels, data and the levels preview are untouched. Parked: daimiel, almeria_murcia, ebro_delta, galicia_fires, sierra_culebra (move an id back to restore). Also on diego_dev: `positionOf(caseId)` added to createCaseMarkers.ts; your DANA level ends with its own "Case closed" screen right before ours (maybe rename yours "Final test complete"?).
- [ ] 2026-11-15 Diego -> Ivan: FYI, on diego_dev your level (`CaseLevel`) is no longer opened from the featured-case flow: it was a stand-in, and Diego's tutorial/evidence board replaces it. Flow now: witness -> tutorial or board -> conclusion -> CASE CLOSED; the marker turns green when the case is solved (`markCompleted`, your green state unchanged). Case zones open when the case has a tutorial script. src/levels/ and levels.html are untouched.
