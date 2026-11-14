# AI usage log

AI tools were used only to help implement the team's own idea, not to come up with it.
Every agent adds one line per task.

| Date | Tool / agent | Area | What it did |
|---|---|---|---|
| 2026-11-14 | Claude Code (Opus 5.5) | Data | Updated AGENTS.md rule 1 and docs/agents/qa.md: each person merges their own PR into main (team decision) |
| 2026-11-14 | Claude Code (Data agent, Diego) | Data | Updated `pipeline/README.md` to v2: aligned work split and trend method with the chosen GLDAS/IMERG/MERRA-2 dataset |
| 2026-11-14 | Claude Code (Data agent, Diego) | Data | Renamed Diego's working branch to `diego_dev` in `pipeline/README.md` |
| 2026-11-14 | Claude Code (Opus 5.5) | Team docs (Perry) | Set Perry as owner of Backend + AI checker + integration (was "Person 4") in AGENTS.md and docs/agents/qa.md |
| 2026-11-14 | Claude Code (Data agent, Diego) | Data | Block 1: `Series`, `validate()` and `from_start_month()` in `pipeline/series.py` with 40 tests in `pipeline/tests/test_series.py` |
| 2026-11-14 | Claude Code (Data agent, Diego) | Data | Block 2: `build_case`, `write_case`, `trend_from_db`, stub `analyze_trend` in `pipeline/build_case.py` with 36 tests (incl. contract validator check) |
| 2026-11-14 | Claude Code (Data agent, Diego) | Data | Accept database dates `YYYY-MM-01` in `from_start_month`/`trend_from_db`; `pipeline/README.md` v3 (statistics fills `trends`, new fill-trends block) |
| 2026-11-14 | Claude Code (Data agent, Diego) | Data | Block 4: Supabase JSON export adapter `pipeline/sources/supabase_export.py` with 18 tests on a fake export copying the ETL layout |
| 2026-11-14 | Claude Code (Data agent, Diego) | Data | Block 5: `pipeline/fill_trends.py` (trends rows as JSON + idempotent SQL upsert, optional export update) with 12 tests, SQL checked on SQLite |
| 2026-11-14 | Claude Code (Data agent, Diego) | Data | QA follow-ups: `--update-export` merges into trends.json instead of overwriting; `trend_from_db` fixes float32 p-value rounding at 0.05 (6 tests) |
| 2026-11-14 | Claude Code (Data agent, Diego) | Data | Checked fill_trends end to end with Ivan's real `analyze_trend`; aligned the database trend label with `trend.py` `TEST_NAME` |
| 2026-11-14 | Claude Code (Data agent, Diego) | Data | Answered Ivan's open requests in AGENTS.md; struck the dropped annual mode from `pipeline/README.md` |
| 2026-11-14 | Claude Code (Opus 5.5) | Data | Block 3: tests/stats/test_diego_cross.py (Ivan asked and reviewed, AGENTS.md rule 3 changed accordingly; docs/agents/data.md, docs/agents/qa.md, pipeline/README.md aligned); scripts/check.sh falls back to python when python3 is the Windows Store alias |
