"""Tests for pipeline.level_cordoba (data of the Córdoba heat level)."""

import json

import numpy as np
import pytest

from pipeline.level_cordoba import (
    DECADES,
    N_RUNS,
    OUT_PATH,
    T2M_PATH,
    build,
    count_records,
    per_decade,
    simulate_records,
)


@pytest.fixture(scope="module")
def data():
    return build()


def test_full_record_matches_the_case_file(data):
    case = json.loads(T2M_PATH.read_text(encoding="utf-8"))
    full = data["full"]
    assert full["slope_decade"] == pytest.approx(case["slope"] * 10, abs=1e-4)
    assert full["significant"] is case["significant"] is True
    assert data["simulation"]["slope_removed_decade"] == full["slope_decade"]


def test_records_on_a_tiny_hand_made_series():
    # January and July only, so the expected records can be read by eye.
    dates = ["2000-01", "2000-07", "2001-01", "2001-07", "2002-01", "2002-07", "2003-01", "2003-07"]
    values = [5.0, 20.0, 6.0, 19.0, 6.0, 21.0, 4.0, None]
    # Counting from the first year: Jan 2001 warm (6 > 5), Jul 2001 cold (19 < 20), Jan 2002 equal
    # to the best (6) so not a record, Jul 2002 warm (21 > 20), Jan 2003 cold (4 < 5), Jul 2003 gap.
    assert count_records(dates, values, first_year=2000) == {"warm": [2, 5], "cold": [3, 6]}
    # Counting from 2002: 2000-2001 only build the history.
    assert count_records(dates, values, first_year=2002) == {"warm": [5], "cold": [6]}
    assert per_decade(dates, [2, 5, 6], decades=(1990, 2000)) == [0, 3]


def test_observed_records_follow_the_definition(data):
    case = json.loads(T2M_PATH.read_text(encoding="utf-8"))
    dates, values = case["dates"], case["values"]
    rec = data["records"]
    for i in rec["warm_idx"]:
        earlier = [values[j] for j in range(i % 12, i, 12)]
        assert int(dates[i][:4]) >= rec["first_year"] and values[i] > max(earlier)
    for i in rec["cold_idx"]:
        earlier = [values[j] for j in range(i % 12, i, 12)]
        assert values[i] < min(earlier)
    assert rec["warm"] == per_decade(dates, rec["warm_idx"])
    assert rec["cold"] == per_decade(dates, rec["cold_idx"])
    assert sum(rec["warm"]) == len(rec["warm_idx"]) and sum(rec["cold"]) == len(rec["cold_idx"])
    shares = [w / (w + c) for w, c in zip(rec["warm"], rec["cold"])]
    assert rec["warm_share"] == pytest.approx(shares, abs=1e-4)
    # a single right answer in phase 1: the 2020s, 8 warm and 0 cold records
    assert rec["top_share_decades"] == [2020]
    assert (rec["warm"][-1], rec["cold"][-1]) == (8, 0)


def test_warming_gives_more_warm_than_cold_records(data):
    rec, sim = data["records"], data["simulation"]
    assert sum(rec["warm"]) > 2 * sum(rec["cold"])
    # the last two decades beat chance clearly
    assert rec["warm"][2] > sim["expected_warm"][2] and rec["warm"][3] > sim["expected_warm"][3]


def test_verdict_is_decided_from_the_percentile(data):
    sim = data["simulation"]
    assert sim["n"] == N_RUNS
    assert sim["observed_total_warm"] == sum(data["records"]["warm"])
    assert sim["more_than_chance"] is (sim["observed_total_warm"] > sim["total_warm_p95"])
    assert sim["more_than_chance"] is True
    assert sim["total_warm_mean"] == pytest.approx(sum(sim["expected_warm"]), abs=1e-3)


def test_simulation_is_deterministic_with_the_seed():
    case = json.loads(T2M_PATH.read_text(encoding="utf-8"))
    args = (case["dates"], case["values"], case["slope"])
    a = simulate_records(*args, n=20, seed=7)
    b = simulate_records(*args, n=20, seed=7)
    c = simulate_records(*args, n=20, seed=8)
    assert np.array_equal(a["warm"], b["warm"]) and np.array_equal(a["cold"], b["cold"])
    assert not np.array_equal(a["warm"], c["warm"])


def test_expected_records_follow_one_over_n_without_a_trend():
    # 40 years (1980-2019) of white noise: records from 1990 on, i.e. years k = 11..40 of history.
    rng = np.random.default_rng(1)
    dates = [f"{y}-{m:02d}" for y in range(1980, 2020) for m in range(1, 13)]
    values = list(rng.normal(size=len(dates)))
    sim = simulate_records(dates, values, slope=0.0, n=600, seed=3)
    theory = [12 * sum(1 / k for k in range(dec - 1980 + 1, dec - 1980 + 11)) for dec in DECADES]
    theory[3] = 0.0  # no 2020s in this series
    warm, cold = sim["warm"].mean(axis=0), sim["cold"].mean(axis=0)
    assert warm == pytest.approx(theory, abs=0.5)
    assert cold == pytest.approx(theory, abs=0.5)
    assert warm[0] > warm[1] > warm[2]  # falling like 1/n


def test_committed_json_is_current(data):
    committed = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    assert committed == data
    assert OUT_PATH.stat().st_size < 40_000
