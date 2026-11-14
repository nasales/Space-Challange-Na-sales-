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
- [ ] 2026-11-14 Perry -> Diego: no new code needed (`fill_trends.py` is already in main); wait for the export. The real Supabase load (6 variables, 1184 cells) finishes around 15:30 today. I will share the `export/` folder (same layout as `pipeline/README.md`). Then: (1) run `fill_trends.py` on it and tell me if it runs clean, (2) build the featured cases in `data/cache/` (block 6). I run the final `fill_trends` and upload the rows to `trends` myself; you never need the DB password. — Diego: (2) cancelled by v4. (1) pending your export; ready to run `fill_trends` + the new `pipeline/check_trends.py` (exit 0 = safe to upload) as soon as you share it.
- [x] 2026-11-14 Perry -> Ivan: same export at ~15:30. Block 6a (`analyze_trend` vs `trend_stats()` on real cells) can use it directly; `trend_stats()` is in `archivos_preSupabase/etl_espana.py` (now in English). — Perry: cancelled, no task for Ivan from the database side for now.
- [ ] 2026-11-14 Perry -> all: `archivos_preSupabase/` (brief, schema, ETL) is now in English (AGENTS.md rule 5); the brief has the current status and test results.
- [x] 2026-11-14 Ivan -> Diego, Manuel: Ivan now owns the 6-7 featured case studies (e.g. Valencia DANA). Confirm who writes their JSON in data/cache/ (Ivan proposes: Ivan), and update the README ownership table if you agree. — Perry: agreed, Ivan owns them; README updated (v4). Diego to tick. — Diego: agreed.
- [ ] 2026-11-14 Ivan -> Diego, Yeipi: the 7 featured case studies are in data/cache/case_<id>_<var>.json (13 files, contract format), built from NASA POWER point data 1981-2024 (raw in data/raw/power/), not from the Supabase export. Case list and coordinates in pipeline/cases.py. — Diego: read.
- [x] 2026-11-14 Perry -> Diego, Ivan: work split clarified (pipeline/README.md v4). Diego = generic analysis (any point of the map): run `fill_trends.py` on my export and tell me it runs clean; point (2) of my earlier request (featured cases) is cancelled. Ivan = about 10 featured cases marked in the game, in `data/cache/case_*.json`. Both: merge `main` into your branch now. Tick when read. — Ivan: read, main merged into ivan_dev. — Diego: read, main merged into diego_dev.
- [ ] 2026-11-14 Ivan -> Yeipi: featured case texts (question shown first, context below) and file list are in data/cases_index.json.
- [ ] 2026-11-14 Diego -> Ivan: please add the full-scale dry run to the "Validation" section of `docs/methods.md`. `py -m pipeline.dry_run` runs `fill_trends` + your `analyze_trend` on 7104 synthetic series (1184 cells x 6 variables, real lengths, seasonal cycle, AR(1) noise, gaps, 50 % with no trend). Results (seed 2026): false positives 4.7-5.6 % (precip 6.8 %), 95 % CI coverage 93.9-95.8 %, slope bias within +/-3 %, strong trends always detected; 6 min, 57 MB. Table and definitions in `pipeline/README.md`, Interface 5. Also FYI from the block 3 cross tests (`tests/stats/test_ivan_cross.py`): the Gilbert CI is symmetric only up to one rank (lo floored, hi ceiled); intended and matches the database, just so you can answer if asked.
- [ ] 2026-11-14 Yeipi -> Manuel (Perry): PR #29 adds `.github/workflows/vercel-deploy.yml` (outside Interface, written at Yeipi's request). Vercel blocks every main commit (private repo + Hobby); the workflow calls a Vercel Deploy Hook on each push to main. Please review; the `nasales` owner must create the hook and the repo secret `VERCEL_DEPLOY_HOOK_URL` (setup in the file header).
- [ ] 2026-11-14 Ivan -> Manuel (Perry): OK to your flow. build_cases.py --source case_export reads the zip; expected layout is in pipeline/build_cases.py docstring. Send the zip when ready.
- [ ] 2026-11-14 Ivan -> Manuel (Perry): data/cache/case_*.json rebuilt from your case_export (19 series) and merged; you can run python -m pipeline.upload_cases.
- [ ] 2026-11-14 Ivan -> Ezequiel: the 10 featured cases are described in docs/featured_cases.md (data, results, how to edit question/context). Write the stories there or send them to Ivan.
- [ ] 2026-11-14 Ivan -> Yeipi/Perry: src/levels/ (Ivan-only) adds levels.html as a second Vite entry and tests/e2e/levels.spec.ts; the main app (App.tsx) is untouched. Integration later = one line in App.tsx.
