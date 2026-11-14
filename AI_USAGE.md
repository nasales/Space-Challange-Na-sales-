# AI usage log

AI tools were used only to help implement the team's own idea, not to come up with it.
Every agent adds one line per task.

| Date | Tool / agent | Area | What it did |
|---|---|---|---|
| 2026-11-14 | Claude Code (Opus 5.5) | Data | Updated AGENTS.md rule 1 and docs/agents/qa.md: each person merges their own PR into main (team decision) |
| 2026-11-14 | Claude Code (Data agent, Diego) | Data | Updated `pipeline/README.md` to v2: aligned work split and trend method with the chosen GLDAS/IMERG/MERRA-2 dataset |
| 2026-11-14 | Claude Code (Data agent, Diego) | Data | Renamed Diego's working branch to `diego_dev` in `pipeline/README.md` |
| 2026-11-14 | Claude Code (Opus 5.5) | Team docs (Perry) | Set Perry as owner of Backend + AI checker + integration (was "Person 4") in AGENTS.md and docs/agents/qa.md |
| 2026-11-14 | Claude Code (Opus 5.5) | Data | Translated docs/stats-data.md (stats data spec from database teammate) to English and committed it |
| 2026-11-14 | Claude Code (Opus 5.5) | Data | Block 1: analyze_trend in pipeline/trend.py (anomalies, Sen slope, pre-whitened Mann-Kendall, Gilbert CI), tests in pipeline/tests/test_trend.py, pinned pipeline/requirements.txt |
| 2026-11-14 | Claude Code (Opus 5.5) | Data | Block 1b: aligned analyze_trend CI (rho, var(S), ranks, z=1.96) with trend_stats in etl_espana.py; added pipeline/tests/test_trend_matches_db.py |
| 2026-11-14 | Claude Code (Opus 5.5) | Data | Block 2 (partial): gap warnings ("many gaps", "long gap") in analyze_trend output; annual mode dropped (plain pre-whitening has low power on 20 annual means) |
| 2026-11-14 | Claude Code (Opus 5.5) | Data | Block 4: explain(trend, series) in pipeline/explain.py (deterministic plain-English facts for the AI checker), tests in pipeline/tests/test_explain.py |
