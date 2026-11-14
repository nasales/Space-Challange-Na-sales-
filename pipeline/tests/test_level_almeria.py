"""Tests for pipeline.level_almeria (data of the Almeria-Murcia level)."""

import json

import pytest

from pipeline.level_almeria import (
    N_SHUFFLES,
    OUT_PATH,
    PRECIP_PATH,
    SOILM_PATH,
    build,
    real_slope,
    year_shuffle_slopes,
)


@pytest.fixture(scope="module")
def data():
    return build()


@pytest.mark.parametrize("var,path", [("soilm", SOILM_PATH), ("precip", PRECIP_PATH)])
def test_full_record_matches_the_case_file(data, var, path):
    case = json.loads(path.read_text(encoding="utf-8"))
    full = data["full"][var]
    assert full["slope_decade"] == pytest.approx(case["slope"] * 10, abs=1e-4)
    assert full["p_value"] == pytest.approx(case["p_value"], abs=1e-4)
    assert full["significant"] is case["significant"] is False  # the project's non-significant case


def test_soilm_is_negative_but_not_proven(data):
    full = data["full"]["soilm"]
    assert full["slope_decade"] < 0
    lo, hi = full["ci_decade"]
    assert lo < 0 < hi  # the 95 % range includes zero
    assert 0.1 < full["p_value"] < 0.2


@pytest.mark.parametrize("var", ["soilm", "precip"])
def test_real_slope_equals_analyze_trend_and_sits_inside_the_shuffles(data, var):
    s = data["shuffles"][var]
    assert s["real_decade"] == data["full"][var]["slope_decade"]
    assert len(s["slopes_decade"]) == N_SHUFFLES == data["shuffles"]["n"]
    assert min(s["slopes_decade"]) < s["real_decade"] < max(s["slopes_decade"])
    share = sum(abs(x) >= abs(s["real_decade"]) for x in s["slopes_decade"]) / N_SHUFFLES
    assert s["share_as_steep"] == pytest.approx(share, abs=1e-4)
    assert s["share_as_steep"] > 0.05 and s["stands_out"] is False


def test_shuffles_are_reproducible_and_keep_the_values():
    case = json.loads(SOILM_PATH.read_text(encoding="utf-8"))
    a = year_shuffle_slopes(case["dates"], case["values"], n=5, seed=1)
    b = year_shuffle_slopes(case["dates"], case["values"], n=5, seed=1)
    c = year_shuffle_slopes(case["dates"], case["values"], n=5, seed=2)
    assert a == b and a != c
    assert len(set(a)) == 5  # different shuffles, different slopes
    assert real_slope(case["dates"], case["values"]) == pytest.approx(case["slope"], abs=1e-9)


def test_committed_json_is_current(data):
    committed = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    assert committed == data
    assert OUT_PATH.stat().st_size < 40_000
