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
| 2026-11-14 | Claude Code (Opus 5.5) | Data | AGENTS.md open requests: FYI to Perry and Diego about PR #11 edits, and note to Perry on keeping an independent ETL export for compare_db |
| 2026-11-14 | Claude Code (Opus 5.5, QA/backend agent, Perry) | Backend | Ran the Supabase ETL against NASA (tests for GLDAS, IMERG and MERRA-2; full load started), fixed the per-file memory growth in `etl_espana.py`, translated `archivos_preSupabase/` to English, answered the open requests for Perry in AGENTS.md, closed decision "how trend rows reach Supabase" in `pipeline/README.md` |
| 2026-11-14 | Claude Code (Opus 5.5) | Data | compare_db.py: --recompute-db option (DB side recomputed with trend_stats() of etl_espana.py when the export has no trends), one new test |
| 2026-11-14 | Claude Code (Opus 5.5) | Data | pipeline/README.md ownership: compare_db.py, test_compare_db.py and tests/stats/test_diego_cross.py to Ivan; AGENTS.md open request on featured case studies ownership |
| 2026-11-14 | Claude Code (Opus 5.5) | Data | Featured case studies: pipeline/cases.py, pipeline/nasa_power.py (NASA POWER monthly download/parse), pipeline/build_cases.py (13 contract files in data/cache/, raw JSON in data/raw/power/), tests; explain() no longer repeats "NASA" in the credit |
| 2026-11-14 | Claude Code (Opus 5.5) | Data | nasa_power.py: display units (°C, fraction (0-1)); regenerated data/cache/case_*.json; AGENTS.md open request to Diego and Yeipi about the featured cases |
| 2026-11-14 | Claude Code (Opus 5.5) | Team docs (Perry) | Clarified data work split in pipeline/README.md (v4, block 6: Diego generic analysis, Ivan featured cases) and AGENTS.md open requests |
| 2026-11-14 | Claude Code (Opus 5.5) | Data | Featured cases: question and context in pipeline/cases.py (case texts: options drafted by AI, chosen and edited by Ivan); data/cases_index.json written by build_cases.py, with a test; AGENTS.md open request to Yeipi |
| 2026-11-14 | Claude Code (Data agent, Diego) | Data | `pipeline/dry_run.py` (full-size synthetic validation of fill_trends + analyze_trend) and `pipeline/check_trends.py` (pre-upload checks and tair vs t2m_long cross-check) with 11 tests; README: multiple-comparisons decision |
| 2026-11-14 | Claude Code (Data agent, Diego) | Data | Merged main (README v4, cases_index); answered Perry's and Ivan's open requests to Diego in AGENTS.md; check_trends reports null p_value/n_months instead of crashing |
| 2026-11-14 | Claude Code (Opus 5.5) | Data | 3 more featured cases (cordoba_heat, aneto_glacier, daimiel; texts by Ivan): NASA POWER raw files, 5 case files, cases_index.json (10 cases), test for 10 cases with at least one non-significant |
| 2026-11-14 | Claude Code (Opus 5.5) | Data | data/cases_index.json gets "facts" (explain() per variable); docs/methods.md (method, validation, NASA data, results table) with pipeline/results_table.py to regenerate the table; tests |
