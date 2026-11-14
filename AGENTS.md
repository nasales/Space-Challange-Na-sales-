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
3. **Never edit `tests/stats/`.** Those tests are written by humans. If they fail, report it; do not change the test to make it pass.
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
- [ ] 2026-11-14 Ivan -> Manuel (Perry): add `__pycache__/` to `.gitignore`.
- [ ] 2026-11-14 Ivan -> Manuel (Perry): run `archivos_preSupabase/etl_espana.py` with `--with-trends` when generating the export; without it every `trend` is null and `pipeline/compare_db.py` has nothing to compare.
- [ ] 2026-11-14 Ivan -> Manuel (Perry): `explain(trend, series)` is in `pipeline/explain.py` (plain-English facts for the AI checker, one per line). Confirm the format works for the checker, and say when the database export will be ready.
- [x] 2026-11-14 Ivan -> Diego: the real `analyze_trend` is in main (`from pipeline.trend import analyze_trend`); replace the stub. It needs >= 120 valid months and returns slope per year (not per decade). — Diego: done. `get_analyze_trend()` in `build_case.py` picks the real one automatically (stub only if `trend.py` is missing); checked end to end with `fill_trends`. Database rows now use your `TEST_NAME`. Note: `mean_value` is not returned; `fill_trends` computes it as a fallback.
- [x] 2026-11-14 Ivan -> Diego: the annual mode of block 2 was dropped (pre-whitening on ~20 annual means removes most of the trend); strike it from `pipeline/README.md`. — Diego: done.
- [x] 2026-11-14 Ivan -> Diego: when will the featured cases be in `data/cache/`, and is `pipeline/series.py` in main? Ivan needs them for block 5 and the block 3 cross tests. — Diego: `series.py`, `build_case.py`, `sources/supabase_export.py` and `fill_trends.py` are in main (PR #7). Featured cases need Perry's real export; they come right after it (block 6).
