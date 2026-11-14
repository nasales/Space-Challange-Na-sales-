"""Tests for pipeline.level_daimiel (data of the Tablas de Daimiel level)."""

import json

import pytest

from pipeline.level_daimiel import (
    ALPHA,
    OUT_PATH,
    PRECIP_PATH,
    RUNS,
    SOILM_PATH,
    build,
    fast_p_value,
    featured_files,
    noise_run,
    series_lengths,
    simulate,
)
from pipeline.trend import analyze_trend


@pytest.fixture(scope="module")
def data():
    return build()


def test_full_record_equals_the_case_files(data):
    for key, path in (("soilm", SOILM_PATH), ("precip", PRECIP_PATH)):
        case = json.loads(path.read_text(encoding="utf-8"))
        full = data["full"][key]
        assert full["slope_decade"] == pytest.approx(case["slope"] * 10, abs=1e-4)
        assert full["p_value"] == pytest.approx(case["p_value"], abs=1e-4)
        assert full["significant"] == case["significant"]
    # phase 1 answer: soil significant but only just (0.01 <= p < 0.05), rain not significant
    assert data["full"]["soilm"]["significant"] and data["full"]["soilm"]["slope_decade"] < 0
    assert not data["full"]["precip"]["significant"]
    assert data["full"]["evidence"] == "weak"


def test_the_19_p_values_match_analyze_trend(data):
    files = featured_files()
    assert len(files) == len(data["tests"]) == 19
    for t, (entry, path) in zip(data["tests"], files):
        case = json.loads(path.read_text(encoding="utf-8"))
        p = analyze_trend(case["dates"], case["values"])["p_value"]
        assert t["id"] == path.stem and t["case_id"] == entry["id"]
        assert t["p_value"] == pytest.approx(p, rel=1e-3)
        assert t["significant"] == (p < ALPHA) == case["significant"]
        assert t["bonferroni"] == (p < ALPHA / 19)


def test_bonferroni_survivors(data):
    assert data["bonferroni_threshold"] == pytest.approx(0.05 / 19, abs=1e-6)
    by_id = {t["id"]: t for t in data["tests"]}
    for t in data["tests"]:
        if t["variable"] == "T2M":
            assert t["bonferroni"], t["id"]
    for soil in ("case_daimiel_SOILM", "case_donana_SOILM", "case_sierra_culebra_SOILM"):
        assert by_id[soil]["significant"] and not by_id[soil]["bonferroni"]
    assert data["bonferroni_survivors"] == sum(t["bonferroni"] for t in data["tests"])
    assert data["real_significant"] == sum(t["significant"] for t in data["tests"])


def test_fast_p_value_equals_analyze_trend_on_noise():
    """The simulation's faster test gives the same p-values and verdicts as analyze_trend (runs 0-2)."""
    lengths = series_lengths()
    for run in range(3):
        fast = noise_run(lengths, run)
        slow = noise_run(lengths, run, p_value=lambda d, v: analyze_trend(d, v)["p_value"])
        assert fast == pytest.approx(slow, abs=1e-9)
        assert [p < ALPHA for p in fast] == [p < ALPHA for p in slow]


def test_fast_p_value_equals_the_case_files():
    for _, path in featured_files():
        case = json.loads(path.read_text(encoding="utf-8"))
        assert fast_p_value(case["dates"], case["values"]) == pytest.approx(case["p_value"], abs=1e-9)


def test_simulation_shape_and_chance_level(data):
    sim = data["simulation"]
    assert sim["runs"] == RUNS and sim["seed"] == 2026 and sim["n_series"] == 19
    assert len(sim["counts"]) == RUNS and sum(sim["histogram"]) == RUNS
    assert sim["histogram"] == [sim["counts"].count(k) for k in range(sim["max"] + 1)]
    assert sim["expected"] == pytest.approx(0.95)
    # pure noise: about 19 x 0.05 = 0.95 false positives per run (standard error about 0.04)
    assert sim["mean"] == pytest.approx(0.95, abs=0.2)
    assert sim["typical"] == 1 and sim["answer"] == "one"
    opt = next(o for o in sim["options"] if o["id"] == sim["answer"])
    assert opt["lo"] <= sim["typical"] <= opt["hi"]
    assert data["real_significant"] > sim["max"]  # the real data beat every noise run


def test_simulation_is_deterministic():
    lengths = series_lengths()
    assert simulate(lengths, runs=5) == simulate(lengths, runs=5)
    assert noise_run(lengths, 7) == noise_run(lengths, 7)
    assert noise_run(lengths, 7) != noise_run(lengths, 8)


def test_committed_json_is_current(data):
    committed = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    assert committed == data
    assert OUT_PATH.stat().st_size < 40_000
