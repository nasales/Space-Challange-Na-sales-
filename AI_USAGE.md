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
