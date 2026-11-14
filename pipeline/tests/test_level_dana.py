"""Tests for pipeline.level_dana (data of the Valencia DANA level)."""

import json

import pytest

from pipeline.level_dana import FLOOD_MONTH, OUT_PATH, PRECIP_PATH, T2M_PATH, build, flood_facts, warming, without_month
from pipeline.trend import analyze_trend


@pytest.fixture(scope="module")
def data():
    return build()


def _case(path):
    return json.loads(path.read_text(encoding="utf-8"))


def test_full_records_equal_the_case_files(data):
    for result, path in ((data["precip_trend"]["with_flood"], PRECIP_PATH), (data["t2m_trend"]["full"], T2M_PATH)):
        case = _case(path)
        assert result["slope_decade"] == pytest.approx(case["slope"] * 10, abs=1e-4)
        assert result["p_value"] == pytest.approx(case["p_value"], abs=1e-4)
        assert result["significant"] == case["significant"]


def test_level_answers_hold(data):
    """The level's correct answers: no rain trend (with or without the flood), significant warming."""
    p = data["precip_trend"]
    assert not p["with_flood"]["significant"] and not p["without_flood"]["significant"]
    t = data["t2m_trend"]["full"]
    assert t["significant"] and t["slope_decade"] > 0


def test_without_flood_matches_analyze_trend(data):
    case = _case(PRECIP_PATH)
    values = without_month(case["dates"], case["values"])
    assert sum(v is None for v in values) == 1
    t = analyze_trend(case["dates"], values)
    w = data["precip_trend"]["without_flood"]
    assert w["slope_decade"] == pytest.approx(t["slope"] * 10, abs=1e-4)
    assert w["p_value"] == pytest.approx(t["p_value"], abs=1e-4)
    assert w["n_months"] == data["precip_trend"]["with_flood"]["n_months"] - 1


def test_flood_facts(data):
    case = _case(PRECIP_PATH)
    f = data["flood"]
    assert f["month"] == FLOOD_MONTH == case["dates"][f["index"]]
    assert f["value"] == pytest.approx(case["values"][f["index"]], abs=1e-4)
    valid = [v for v in case["values"] if v is not None]
    assert f["rank"] == 1 + sum(v > f["value"] for v in valid)
    assert f["wettest_value"] == pytest.approx(max(valid), abs=1e-4)
    assert data["precip"]["anomalies"]["values"][f["index"]] == f["anomaly"]
    assert f["value"] > f["same_month_mean"]


def test_flood_facts_on_a_toy_series():
    dates = ["2000-10", "2001-10", "2002-10"]
    f = flood_facts(dates, [1.0, 5.0, 3.0], month="2002-10")
    assert (f["rank"], f["wettest_month"], f["same_month_mean"]) == (2, "2001-10", 3.0)


def test_warming_total_change(data):
    case = _case(T2M_PATH)
    w = warming(case["dates"], case["values"])
    assert w["total_change"] == pytest.approx(case["slope"] * w["years"], abs=1e-3)
    assert w["water_capacity_gain"] == pytest.approx(1.07 ** w["total_change"] - 1, abs=1e-4)
    assert data["t2m_trend"]["total_change"] == w["total_change"]


def test_build_is_reproducible():
    assert build() == build()


def test_committed_json_is_current(data):
    committed = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    assert committed == data
    assert OUT_PATH.stat().st_size < 60_000
