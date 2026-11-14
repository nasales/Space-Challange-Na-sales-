"""Tests for pipeline/dry_run.py (Diego). Small runs only; the full run takes about 5 minutes."""

import json

import pytest

pytest.importorskip("pipeline.trend")  # needs Ivan's analyze_trend and its libraries

from pipeline.dry_run import format_report, make_export, months_until_end, run  # noqa: E402
from pipeline.sources.supabase_export import load_series  # noqa: E402


def test_series_lengths_match_perrys_load():
    assert months_until_end("2000-01-01") == 319  # Salamanca tair 2000-01 -> 2026-07
    assert months_until_end("1998-01-01") == 343
    assert months_until_end("1980-01-01") == 559


def test_synthetic_export_is_readable_by_the_adapter(tmp_path):
    truth = make_export(tmp_path / "export", n_cells=3, seed=1)
    assert len(truth) == 3 * 6
    cell_id = next(iter(truth))[0]
    s = load_series(tmp_path / "export", cell_id, "t2m_long")
    assert s.dates[0] == "1980-01" and s.dates[-1] == "2026-07"


def test_small_run_reports_every_variable(tmp_path):
    result = run(tmp_path / "dry", n_cells=6, seed=3)
    assert result["series"] == 36
    assert result["rows"] + result["skipped"] == 36
    assert set(result["by_variable"]) == {"tair", "wind", "soilmoist", "evap", "precip", "t2m_long"}
    for m in result["by_variable"].values():
        assert 0 <= m["ci_coverage"] <= 1
    rows = json.loads((tmp_path / "dry" / "trends_rows.json").read_text(encoding="utf-8"))
    assert len(rows) == result["rows"]
    assert "false pos" in format_report(result)


def test_run_refuses_non_empty_folder(tmp_path):
    (tmp_path / "x.txt").write_text("x")
    with pytest.raises(FileExistsError):
        run(tmp_path, n_cells=1)
