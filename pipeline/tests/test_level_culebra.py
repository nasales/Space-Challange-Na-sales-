"""Tests for pipeline.level_culebra (data of the Sierra de la Culebra level)."""

import json

import numpy as np
import pytest

from pipeline.level_culebra import NOISE_FACTORS, OUT_PATH, RUNS, SOILM_PATH, T2M_PATH, build, noise_experiment
from pipeline.trend import analyze_trend


@pytest.fixture(scope="module")
def data():
    return build()


def test_full_record_equals_the_case_files(data):
    for key, path in (("t2m", T2M_PATH), ("soilm", SOILM_PATH)):
        case = json.loads(path.read_text(encoding="utf-8"))
        full = data["full"][key]
        assert full["slope_decade"] == pytest.approx(case["slope"] * 10, abs=1e-4)
        assert full["p_value"] == pytest.approx(case["p_value"], abs=1e-4)
        assert full["significant"] == case["significant"]


def test_pre_fire_window_ends_before_june_2022(data):
    fire = data["fire"]
    assert (fire["month"], fire["pre_last"]) == ("2022-06", "2022-05")
    soil = json.loads(SOILM_PATH.read_text(encoding="utf-8"))
    n_pre = sum(d <= "2022-05" and v is not None for d, v in zip(soil["dates"], soil["values"]))
    assert fire["soilm"]["n_months"] == n_pre
    # the level's phase 1 answer ("both point to hotter, drier") relies on these
    assert fire["t2m"]["significant"] and fire["t2m"]["slope_decade"] > 0
    assert fire["soilm"]["significant"] and fire["soilm"]["slope_decade"] < 0


def test_noise_experiment_shape_and_signal(data):
    n = data["noise"]
    assert n["runs"] == RUNS and n["seed"] == 2026
    assert [lv["factor"] for lv in n["levels"]] == list(NOISE_FACTORS)
    assert n["slope_decade"] == pytest.approx(data["full"]["soilm"]["slope_decade"], abs=1e-4)
    assert 0 < n["rho"] < 1 and n["residual_sd"] > 0
    for lv in n["levels"]:
        assert 0 <= lv["detected"] <= RUNS
        assert lv["rate"] == pytest.approx(lv["detected"] / RUNS, abs=1e-4)
        assert len(lv["example"]) == len(n["dates"])


def test_example_is_run_zero_and_its_detection_counts(data):
    """The example drawn in the level is a real run: analyze_trend on it gives a counted result."""
    n = data["noise"]
    low, high = n["levels"][0], n["levels"][-1]
    assert analyze_trend(n["dates"], low["example"])["significant"]  # 0.5x: all 20 runs detected
    assert low["detected"] == RUNS
    # same random shape at every level: examples differ only by the scaled noise
    d_low = np.array(low["example"]) - np.array(n["levels"][1]["example"])
    d_high = np.array(high["example"]) - np.array(n["levels"][1]["example"])
    assert np.corrcoef(d_low, d_high)[0, 1] == pytest.approx(-1, abs=1e-3)


def test_more_noise_detects_less(data):
    rates = [lv["rate"] for lv in data["noise"]["levels"]]
    assert rates[0] > rates[1] > rates[-1]


def test_pure_signal_is_always_detected():
    soil = json.loads(SOILM_PATH.read_text(encoding="utf-8"))
    out = noise_experiment(soil["dates"], soil["values"], factors=(0.0,), runs=2)
    assert out["levels"][0]["detected"] == 2


def test_experiment_is_reproducible():
    soil = json.loads(SOILM_PATH.read_text(encoding="utf-8"))
    a = noise_experiment(soil["dates"], soil["values"], factors=(2.0,), runs=3)
    b = noise_experiment(soil["dates"], soil["values"], factors=(2.0,), runs=3)
    assert a == b


def test_committed_json_is_current(data):
    committed = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    assert committed == data
    assert OUT_PATH.stat().st_size < 80_000
