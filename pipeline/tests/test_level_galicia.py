"""Tests for pipeline.level_galicia (data of the Galicia fires level)."""

import json

import pytest

from pipeline.level_galicia import (
    CULEBRA_SOILM_PATH,
    GALICIA_SOILM_PATH,
    GALICIA_T2M_PATH,
    OUT_PATH,
    build,
    noise_stats,
    twins_answer,
    warming_answer,
    why_comparison,
)
from pipeline.trend import analyze_trend


@pytest.fixture(scope="module")
def data():
    return build()


def _case(path):
    return json.loads(path.read_text(encoding="utf-8"))


@pytest.mark.parametrize(
    "key,path",
    [("galicia_soilm", GALICIA_SOILM_PATH), ("culebra_soilm", CULEBRA_SOILM_PATH), ("galicia_t2m", GALICIA_T2M_PATH)],
)
def test_trends_match_analyze_trend_and_case_files(data, key, path):
    case = _case(path)
    t = analyze_trend(case["dates"], case["values"])
    r = data["trends"][key]
    assert r["slope_decade"] == pytest.approx(t["slope"] * 10, abs=1e-4)
    assert r["ci_decade"] == pytest.approx([t["slope_ci_low"] * 10, t["slope_ci_high"] * 10], abs=1e-4)
    assert r["p_value"] == pytest.approx(t["p_value"], abs=1e-4)
    assert r["significant"] == t["significant"] == case["significant"]
    assert r["n_months"] == t["n_points"]


def test_key_numbers_of_the_lesson(data):
    tr = data["trends"]
    assert tr["galicia_soilm"]["slope_decade"] == pytest.approx(-0.44, abs=0.005)
    assert tr["galicia_soilm"]["p_value"] == pytest.approx(0.11, abs=0.005)
    assert not tr["galicia_soilm"]["significant"]
    assert tr["culebra_soilm"]["slope_decade"] == pytest.approx(-0.53, abs=0.005)
    assert tr["culebra_soilm"]["significant"]
    assert tr["galicia_t2m"]["slope_decade"] == pytest.approx(0.26, abs=0.005)
    assert tr["galicia_t2m"]["significant"]


def test_answers_follow_the_data(data):
    assert data["twins"]["answer"] == "culebra"
    assert data["warming"]["answer"] == "yes"
    why = data["why"]
    f = why["factors"]
    assert why["answer"] == min(f, key=f.get)
    assert why["answer"] == "slope"  # only the slope handicaps Galicia: same months, slightly less noise
    assert f["data"] == 1.0 and f["noise"] > 1 and f["slope"] < 1


def test_noise_stats_are_consistent(data):
    for key, path in (("galicia", GALICIA_SOILM_PATH), ("culebra", CULEBRA_SOILM_PATH)):
        case = _case(path)
        n = data["why"][key]
        assert n == noise_stats(case["dates"], case["values"])
        assert n["n_months"] == sum(v is not None for v in case["values"])
        assert n["residual_sd"] > 0 and 0 < n["rho"] < 1


def test_answer_rules_on_toy_inputs():
    sig = {"slope_decade": -1.0, "significant": True}
    not_sig = {"slope_decade": -1.0, "significant": False}
    wet = {"slope_decade": 1.0, "significant": True}
    assert twins_answer(sig, sig) == "both"
    assert twins_answer(not_sig, sig) == "culebra"
    assert twins_answer(sig, wet) == "galicia"
    assert twins_answer({"too_short": True}, not_sig) == "neither"
    assert warming_answer({"slope_decade": 0.3, "significant": False}) == "weak"
    assert warming_answer({"slope_decade": -0.1, "significant": True}) == "no"
    noisy = why_comparison(sig, sig, {"residual_sd": 4.0, "n_months": 300}, {"residual_sd": 2.0, "n_months": 300})
    assert noisy["answer"] == "noise"
    short = why_comparison(sig, sig, {"residual_sd": 2.0, "n_months": 150}, {"residual_sd": 2.0, "n_months": 300})
    assert short["answer"] == "data"


def test_series_are_the_case_anomalies(data):
    for key, path in (("galicia_soilm", GALICIA_SOILM_PATH), ("culebra_soilm", CULEBRA_SOILM_PATH), ("galicia_t2m", GALICIA_T2M_PATH)):
        case = _case(path)
        s = data[key]
        assert s["dataset"] == case["dataset"] and s["units"] == case["units"]
        assert s["anomalies"]["dates"] == case["dates"]
        assert len(s["anomalies"]["values"]) == len(case["values"])


def test_build_is_reproducible(data):
    assert build() == data


def test_committed_json_is_current(data):
    committed = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    assert committed == data
    assert OUT_PATH.stat().st_size < 80_000
