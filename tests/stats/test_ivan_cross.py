"""Block 3 cross tests: Diego tests Ivan's code (pipeline/trend.py, analyze_trend).

Written by an agent at Diego's explicit request and reviewed by Diego before commit (AGENTS.md rule 3).
Synthetic series with fixed seeds, so the results are deterministic.
"""

import numpy as np
import pytest

from pipeline.trend import analyze_trend

N_MONTHS = 300  # 25 years, like the GLDAS series in the database


def _dates(n=N_MONTHS, start_year=2000):
    return [f"{start_year + i // 12}-{i % 12 + 1:02d}" for i in range(n)]


def _ar1(rng, n, phi, sd):
    """Red noise: each month remembers a share `phi` of the previous one (like real monthly anomalies)."""
    noise = rng.normal(0, sd * np.sqrt(1 - phi**2), n)
    x = np.empty(n)
    x[0] = rng.normal(0, sd)
    for i in range(1, n):
        x[i] = phi * x[i - 1] + noise[i]
    return x


def _series(rng, slope_per_year, n=N_MONTHS, mean=12.0, amplitude=8.0, phi=0.3, sd=0.5):
    months = np.arange(n)
    season = amplitude * np.sin(2 * np.pi * (months % 12) / 12)
    return mean + season + slope_per_year * months / 12 + _ar1(rng, n, phi, sd)


def test_recovers_a_known_trend_in_units_per_year():
    # +0.3 °C per decade = +0.03 °C per year, hidden under an 8 °C seasonal cycle and red noise
    rng = np.random.default_rng(101)
    true_slope = 0.03
    values = _series(rng, true_slope).tolist()

    r = analyze_trend(_dates(), values)

    assert r["slope_ci_low"] <= true_slope <= r["slope_ci_high"]
    assert r["slope"] == pytest.approx(true_slope, abs=0.01)  # per year, not per decade (that would be ~0.3)
    assert r["significant"] is True
    assert r["direction"] == "increasing"
    assert r["n_points"] == N_MONTHS
    years_spanned = (N_MONTHS - 1) / 12
    assert r["total_change"] == pytest.approx(r["slope"] * years_spanned, rel=0.01)


def test_symmetry_flip_and_shift():
    # Flipping the series (x -> -x) must flip the slope and its CI and keep the p-value;
    # adding a constant (e.g. °C -> K) must change nothing.
    rng = np.random.default_rng(202)
    values = _series(rng, 0.02)
    base = analyze_trend(_dates(), values.tolist())
    flipped = analyze_trend(_dates(), (-values).tolist())
    kelvin = analyze_trend(_dates(), (values + 273.15).tolist())

    assert flipped["slope"] == pytest.approx(-base["slope"], rel=1e-6)
    assert flipped["p_value"] == pytest.approx(base["p_value"], rel=1e-6)
    assert flipped["significant"] == base["significant"]
    # The CI is symmetric only up to ONE rank of the ~45,000 sorted pairwise slopes: _gilbert_ci rounds
    # lo down and hi up (conservative, and identical to the database script), so the mirrored bounds can
    # differ by one neighbouring slope. That is ~0.02 % of the CI width, so allow 0.1 % of the width.
    width_tol = 1e-3 * (base["slope_ci_high"] - base["slope_ci_low"])
    assert flipped["slope_ci_low"] == pytest.approx(-base["slope_ci_high"], abs=width_tol)
    assert flipped["slope_ci_high"] == pytest.approx(-base["slope_ci_low"], abs=width_tol)

    assert kelvin["slope"] == pytest.approx(base["slope"], rel=1e-6)
    assert kelvin["p_value"] == pytest.approx(base["p_value"], rel=1e-6)
    assert kelvin["significant"] == base["significant"]


def test_no_trend_red_noise_is_not_reported_as_a_trend_too_often():
    # 200 series with NO trend but strongly autocorrelated noise (phi = 0.5).
    # The plain Mann-Kendall test flags far more than 5 % of these; pre-whitening must keep the
    # false-positive rate near 5 %. Expected about 10 of 200; 20 (10 %) is more than 3 sd away.
    rng = np.random.default_rng(303)
    flagged = 0
    for _ in range(200):
        values = _series(rng, 0.0, phi=0.5, sd=1.0).tolist()
        flagged += analyze_trend(_dates(), values)["significant"]
    assert flagged <= 20, f"{flagged} of 200 no-trend series were significant"
