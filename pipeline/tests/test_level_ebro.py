"""Tests for pipeline.level_ebro (data of the Ebro Delta level)."""

import json

import pytest

from pipeline.level_ebro import OUT_PATH, PRECIP_PATH, T2M_PATH, build, climatology, total_change
from pipeline.trend import _anomalies, analyze_trend


@pytest.fixture(scope="module")
def data():
    return build()


@pytest.fixture(scope="module")
def t2m():
    return json.loads(T2M_PATH.read_text(encoding="utf-8"))


def test_full_record_equals_the_case_files(data):
    for key, path in (("t2m", T2M_PATH), ("precip", PRECIP_PATH)):
        case = json.loads(path.read_text(encoding="utf-8"))
        full = data["full"][key]
        assert full["slope_decade"] == pytest.approx(case["slope"] * 10, abs=1e-4)
        assert full["p_value"] == pytest.approx(case["p_value"], abs=1e-4)
        assert full["significant"] == case["significant"]
    # the level's answers rely on these
    assert data["full"]["t2m"]["significant"] and data["full"]["t2m"]["slope_decade"] > 0
    assert not data["full"]["precip"]["significant"]


def test_typical_year_is_the_climatology_of_trend_py(data, t2m):
    """raw - typical year (by calendar month) == the anomalies analyze_trend uses."""
    clim = data["t2m"]["typical_year"]
    assert len(clim) == 12
    months = [(int(d[:4]), int(d[5:7])) for d in t2m["dates"]]
    official = _anomalies(months, t2m["values"])
    for (_, m), v, a in zip(months, t2m["values"], official):
        assert v - clim[m - 1] == pytest.approx(a, abs=1e-3)
    # and the plotted anomalies are the same numbers
    for a, shown in zip(official, data["t2m"]["anomalies"]["values"]):
        assert shown == pytest.approx(a, abs=1e-4)


def test_typical_year_has_a_big_seasonal_cycle(data):
    clim = data["t2m"]["typical_year"]
    assert max(clim) - min(clim) > 10  # summer vs winter, far bigger than the trend
    assert clim.index(max(clim)) in (6, 7)  # July or August


def test_anomalies_have_no_seasonal_cycle(data):
    dates = data["t2m"]["anomalies"]["dates"]
    values = data["t2m"]["anomalies"]["values"]
    months = [(int(d[:4]), int(d[5:7])) for d in dates]
    assert climatology(dates, values) == pytest.approx([0.0] * 12, abs=1e-3)
    # the trend is the same on the anomalies (it removes the same climatology again: no change)
    assert analyze_trend(dates, values)["slope"] * 10 == pytest.approx(data["full"]["t2m"]["slope_decade"], abs=1e-3)
    assert len(months) == len(data["t2m"]["raw"]["values"])


def test_totals_are_slope_times_decades(data, t2m):
    tot = data["total"]
    full = data["full"]["t2m"]
    assert (tot["first"], tot["last"]) == (t2m["dates"][0], t2m["dates"][-1])
    assert tot["decades"] == pytest.approx(4.6667, abs=1e-4)  # 1980-01 to 2026-09
    assert tot["change"] == pytest.approx(full["slope_decade"] * tot["decades"], abs=1e-3)
    assert tot["ci"][0] == pytest.approx(full["ci_decade"][0] * tot["decades"], abs=1e-3)
    assert tot["ci"][1] == pytest.approx(full["ci_decade"][1] * tot["decades"], abs=1e-3)
    assert tot["ci"][0] < tot["change"] < tot["ci"][1]
    # same as trend.py total_change
    t = analyze_trend(t2m["dates"], t2m["values"])
    assert tot["change"] == pytest.approx(t["total_change"], abs=1e-3)


def test_total_change_ignores_missing_ends():
    dates = [f"{y}-{m:02d}" for y in range(2000, 2012) for m in range(1, 13)]
    values = [0.01 * i + (1 if i % 12 < 6 else -1) for i in range(len(dates))]
    values[0] = None
    values[-1] = None
    out = total_change(dates, values)
    assert (out["first"], out["last"]) == ("2000-02", "2011-11")
    assert out["change"] == pytest.approx(0.12 * out["decades"] * 10, abs=1e-3)


def test_committed_json_is_current(data):
    committed = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    assert committed == data
    assert OUT_PATH.stat().st_size < 40_000


def test_build_is_reproducible(data):
    assert build() == data
