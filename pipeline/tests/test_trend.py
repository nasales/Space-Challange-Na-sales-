"""Synthetic tests for pipeline.trend.analyze_trend (block 1 of pipeline/README.md)."""

import numpy as np
import pytest

from pipeline.trend import analyze_trend

KEYS = {
    "slope", "p_value", "significant", "test", "slope_ci_low", "slope_ci_high",
    "mk_tau", "n_points", "start", "end", "total_change", "direction", "warnings",
}


def _make_series(years=20, start=2000, trend=0.0, amp=10.0, noise_sd=0.3, phi=0.0, seed=0):
    """Monthly series: seasonal sine (amplitude `amp`) + linear trend (units/year) + AR(1) noise."""
    rng = np.random.default_rng(seed)
    n = years * 12
    t = np.arange(n) / 12
    noise = np.empty(n)
    noise[0] = rng.normal(0, noise_sd)
    for k in range(1, n):
        noise[k] = phi * noise[k - 1] + rng.normal(0, noise_sd)
    values = amp * np.sin(2 * np.pi * t) + trend * t + noise
    dates = [f"{start + k // 12}-{k % 12 + 1:02d}" for k in range(n)]
    return dates, [float(v) for v in values]


def _false_positive_rate(phi, n_seeds=200):
    hits = 0
    for seed in range(n_seeds):
        dates, values = _make_series(amp=0.0, noise_sd=1.0, phi=phi, seed=1000 + seed)
        hits += analyze_trend(dates, values)["significant"]
    return hits / n_seeds


def test_known_positive_trend():
    r = analyze_trend(*_make_series(trend=0.03, seed=1))
    assert r["slope"] == pytest.approx(0.03, abs=0.01)
    assert r["significant"] is True
    assert r["direction"] == "increasing"
    assert r["slope_ci_low"] <= 0.03 <= r["slope_ci_high"]


def test_known_negative_trend():
    r = analyze_trend(*_make_series(trend=-0.05, seed=2))
    assert r["slope"] < 0
    assert r["significant"] is True
    assert r["direction"] == "decreasing"


def test_seasonal_no_trend():
    r = analyze_trend(*_make_series(trend=0.0, seed=3))
    assert r["significant"] is False
    assert r["direction"] == "no trend"


def test_white_noise_false_positive_rate():
    assert _false_positive_rate(phi=0.0) <= 0.10


def test_ar1_false_positive_rate():
    assert _false_positive_rate(phi=0.6) <= 0.15


def test_gaps_known_trend():
    dates, values = _make_series(trend=0.03, seed=1)
    rng = np.random.default_rng(4)
    for k in rng.choice(len(values), size=len(values) // 10, replace=False):
        values[k] = None
    r = analyze_trend(dates, values)
    assert r["n_points"] == 240 - 24
    assert r["slope"] == pytest.approx(0.03, abs=0.01)
    assert r["significant"] is True


def test_too_few_months():
    dates, values = _make_series(years=10)
    values[0] = None  # 119 non-null months
    with pytest.raises(ValueError, match="120"):
        analyze_trend(dates, values)


def test_mismatched_lengths():
    dates, values = _make_series()
    with pytest.raises(ValueError, match="lengths"):
        analyze_trend(dates, values[:-1])


def test_unsorted_dates():
    dates, values = _make_series()
    dates[10], dates[11] = dates[11], dates[10]
    with pytest.raises(ValueError, match="sorted"):
        analyze_trend(dates, values)


def test_duplicated_dates():
    dates, values = _make_series()
    dates[11] = dates[10]
    with pytest.raises(ValueError, match="duplicates"):
        analyze_trend(dates, values)


@pytest.mark.parametrize("kwargs", [
    {"trend": 0.03, "seed": 1},
    {"trend": -0.05, "seed": 2},
    {"trend": 0.0, "seed": 3},
    {"trend": 0.0, "phi": 0.6, "noise_sd": 1.0, "seed": 5},
    {"trend": 0.1, "noise_sd": 2.0, "seed": 6},
])
def test_ci_contains_slope(kwargs):
    r = analyze_trend(*_make_series(**kwargs))
    assert r["slope_ci_low"] <= r["slope"] <= r["slope_ci_high"]


def test_output_types():
    r = analyze_trend(*_make_series(trend=0.03, seed=1))
    assert set(r) == KEYS
    assert type(r["slope"]) is float
    assert type(r["p_value"]) is float
    assert type(r["significant"]) is bool
    assert 0 <= r["p_value"] <= 1
    assert r["test"] == "mann-kendall-prewhitening-yue-wang-2002"
    assert (r["start"], r["end"], r["n_points"]) == ("2000-01", "2019-12", 240)


def test_warnings_empty_on_clean_series():
    assert analyze_trend(*_make_series(trend=0.03, seed=1))["warnings"] == []


def test_warning_many_gaps():
    dates, values = _make_series(trend=0.03, seed=1)
    clean = analyze_trend(dates, values)
    rng = np.random.default_rng(9)
    inner = np.arange(1, len(values) - 1)  # keep first and last month so start/end do not move
    for k in rng.choice(inner, size=int(len(values) * 0.3), replace=False):
        values[k] = None
    r = analyze_trend(dates, values)
    assert "many gaps" in r["warnings"]
    assert "long gap" not in r["warnings"]
    assert r["slope"] == pytest.approx(0.03, abs=0.01)
    assert clean["warnings"] == []


def test_warning_long_gap():
    dates, values = _make_series(trend=0.03, seed=1)
    values[100:118] = [None] * 18
    r = analyze_trend(dates, values)
    assert "long gap" in r["warnings"]
    assert "many gaps" not in r["warnings"]

