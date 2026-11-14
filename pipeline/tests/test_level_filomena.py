"""Tests for pipeline.level_filomena (data of the Filomena level)."""

import json

import pytest

from pipeline.level_filomena import CASE_PATH, OUT_PATH, build, trend_summary, windows


def test_full_window_matches_the_case_file():
    case = json.loads(CASE_PATH.read_text(encoding="utf-8"))
    data = build()
    full = data["windows"]["1980-2026"]
    assert full["slope_decade"] == pytest.approx(case["slope"] * 10, abs=1e-4)
    assert full["p_value"] == pytest.approx(case["p_value"], abs=1e-4)
    assert full["significant"] == case["significant"]
    assert data["filomena"]["with"] == {k: v for k, v in full.items()}
    assert data["filomena"]["without"]["n_months"] == full["n_months"] - 1


def test_too_short_below_120_months():
    dates = [f"{y}-{m:02d}" for y in range(2000, 2010) for m in range(1, 13)]  # exactly 120 months
    values = [float(i % 12) + 0.01 * i for i in range(120)]
    assert not trend_summary(dates, values).get("too_short")
    assert trend_summary(dates[:119], values[:119]) == {"too_short": True}
    gappy = list(values)
    gappy[5] = None  # 119 valid months
    assert trend_summary(dates, gappy) == {"too_short": True}
    w = windows(dates, values, 2000, 2009)
    assert w["2000-2009"]["n_months"] == 120 and w["2000-2008"] == {"too_short": True}
    assert len(w) == 10 * 11 // 2


def test_committed_level_json_is_current_and_small():
    committed = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    assert committed == build()
    assert OUT_PATH.stat().st_size < 150_000
    w = committed["windows"]
    assert len(w) == 47 * 48 // 2  # every start 1980..2026 and end >= start
    assert w["2018-2021"] == {"too_short": True}
    assert committed["anomalies"]["dates"][0] == "1980-01" and len(committed["anomalies"]["values"]) == 561
    assert all(v is None or round(v, 4) == v for v in committed["anomalies"]["values"])
