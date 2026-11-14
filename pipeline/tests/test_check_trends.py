"""Tests for pipeline/check_trends.py (Diego)."""

import copy
import json
import sys

import pytest

pytest.importorskip("pipeline.trend")  # the cross-check and the fixture use Ivan's analyze_trend

from pipeline import check_trends  # noqa: E402
from pipeline.check_trends import check, format_report  # noqa: E402
from pipeline.dry_run import make_export  # noqa: E402
from pipeline.fill_trends import fill_trends  # noqa: E402


@pytest.fixture(scope="module")
def computed(tmp_path_factory):
    root = tmp_path_factory.mktemp("check")
    make_export(root / "export", n_cells=8, seed=11)
    fill_trends(root / "export", root / "rows.json")
    rows = json.loads((root / "rows.json").read_text(encoding="utf-8"))
    return root, rows


def test_clean_rows_have_no_errors(computed):
    root, rows = computed
    result = check(root / "export", rows)
    assert result["errors"] == []
    assert set(result["summary"]) == {"tair", "wind", "soilmoist", "evap", "precip", "t2m_long"}
    assert result["rows"] + result["missing_short"] == result["series"] == 48
    assert result["temperature_cross_check"]["cells"] > 0
    assert "Summary per variable" in format_report(result)


def test_detects_significance_mismatch(computed):
    root, rows = computed
    bad = copy.deepcopy(rows)
    bad[0]["significant"] = not bad[0]["significant"]
    errors = check(root / "export", bad, compare=False)["errors"]
    assert any("significant does not match" in e for e in errors)


def test_detects_duplicates_and_missing_rows(computed):
    root, rows = computed
    errors = check(root / "export", rows + [rows[0]], compare=False)["errors"]
    assert any("duplicated" in e for e in errors)
    errors = check(root / "export", rows[1:], compare=False)["errors"]
    assert any("have no row" in e for e in errors)


def test_detects_nan_and_bad_direction(computed):
    root, rows = computed
    bad = copy.deepcopy(rows)
    bad[0]["slope_per_decade"] = float("nan")
    bad[1]["direction"] = "sideways"
    errors = check(root / "export", bad, compare=False)["errors"]
    assert any("NaN" in e for e in errors)
    assert any("direction" in e for e in errors)


def test_detects_slope_outside_ci(computed):
    root, rows = computed
    bad = copy.deepcopy(rows)
    bad[0]["slope_ci_high"] = bad[0]["slope_per_decade"] - 1
    errors = check(root / "export", bad, compare=False)["errors"]
    assert any("confidence interval" in e for e in errors)


def test_warns_on_kelvin(computed):
    root, rows = computed
    bad = copy.deepcopy(rows)
    for r in bad:
        if r["var_id"] == "tair":
            r["mean_value"] += 273.15
    warnings = check(root / "export", bad, compare=False)["warnings"]
    assert any("tair" in w and "units" in w for w in warnings)


def test_command_line_exit_codes(computed, tmp_path, monkeypatch):
    root, rows = computed
    report = tmp_path / "report.md"
    monkeypatch.setattr(sys, "argv", ["check_trends", "--export-dir", str(root / "export"),
                                      "--rows", str(root / "rows.json"), "--report", str(report),
                                      "--no-compare"])
    with pytest.raises(SystemExit) as ok:
        check_trends.main()
    assert ok.value.code == 0
    assert report.read_text(encoding="utf-8").startswith("# Trend check")

    bad = copy.deepcopy(rows)
    bad[0]["p_value"] = 2.0
    bad_path = tmp_path / "bad.json"
    bad_path.write_text(json.dumps(bad), encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["check_trends", "--export-dir", str(root / "export"),
                                      "--rows", str(bad_path), "--no-compare"])
    with pytest.raises(SystemExit) as fail:
        check_trends.main()
    assert fail.value.code == 1
