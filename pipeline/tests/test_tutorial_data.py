"""Tests for pipeline/tutorial_data.py (shape of src/shared/tutorial.ts TutorialData)."""

import json
import math
from pathlib import Path

import numpy as np
import pytest

from pipeline.trend import analyze_trend
from pipeline.tutorial_data import (
    ANNUAL_T_OFFSET,
    CASE_THRESHOLDS,
    build_series,
    build_tutorial,
    centred_running_mean,
    cumulative_anomaly,
    main,
    nice_bin_edges,
    season_means,
    standardise,
    threshold_counts,
    write_tutorial,
    yearly_trend,
)

ROOT = Path(__file__).resolve().parents[2]
SEASON = [10, 11, 13, 15, 18, 22, 25, 25, 22, 18, 14, 11]
SLOPE = 0.05  # units per year


def _dates(y0, m0, n):
    out = []
    for k in range(n):
        idx = y0 * 12 + (m0 - 1) + k
        out.append(f"{idx // 12}-{idx % 12 + 1:02d}")
    return out


def _case(dates, values, variable="T2M"):
    r = analyze_trend(dates, values)
    return {"place": "Test", "lat": 40.0, "lon": -3.0, "variable": variable, "units": "°C",
            "dataset": "NASA TEST v1", "dates": dates, "values": values, "slope": r["slope"],
            "p_value": r["p_value"], "significant": r["significant"], "test": r["test"]}


@pytest.fixture
def synthetic():
    # Starts in July 2000 (partial first year), ends March 2020 (partial last year).
    dates = _dates(2000, 7, 237)
    rng = np.random.default_rng(1)
    values = []
    for d in dates:
        y, m = int(d[:4]), int(d[5:])
        t = y + (m - 1) / 12
        values.append(SEASON[m - 1] + SLOPE * (t - 2010) + float(rng.normal(0, 0.1)))
    values[50] = None          # 2004-09: gap, so 2004 is not a complete year
    return dates, values


def test_climatology_and_anomalies(synthetic):
    dates, values = synthetic
    s = build_series(_case(dates, values))
    assert len(s["climatology"]) == 12
    # Seasonal cycle recovered (trend averages out to ~0 over a centred period)
    assert np.allclose(s["climatology"], SEASON, atol=0.15)
    # Anomalies have ~zero mean for each calendar month
    for m in range(1, 13):
        a = [v for d, v in zip(s["anomaly"]["dates"], s["anomaly"]["values"])
             if v is not None and int(d[5:]) == m]
        assert abs(sum(a) / len(a)) < 1e-4


def test_gaps_are_null(synthetic):
    dates, values = synthetic
    s = build_series(_case(dates, values))
    assert s["monthly"]["values"][50] is None
    assert s["anomaly"]["values"][50] is None
    assert s["monthly"]["dates"] == dates == s["anomaly"]["dates"]
    assert len(s["monthly"]["values"]) == len(s["anomaly"]["values"]) == len(dates)


def test_annual_only_complete_years(synthetic):
    dates, values = synthetic
    s = build_series(_case(dates, values))
    years = s["annual"]["years"]
    assert years == [y for y in range(2001, 2020) if y != 2004]
    i = years.index(2010)
    expected = np.mean([v for d, v in zip(dates, values) if d.startswith("2010-")])
    assert s["annual"]["values"][i] == pytest.approx(expected, rel=1e-5)


def test_max(synthetic):
    dates, values = synthetic
    values = list(values)
    values[100] = 99.0
    s = build_series(_case(dates, values))
    assert s["max"] == {"date": dates[100], "value": 99.0}


def test_trend_lines(synthetic):
    dates, values = synthetic
    s = build_series(_case(dates, values))
    tr = s["trend"]
    t0 = 2000 + 6 / 12
    t1 = int(dates[-1][:4]) + (int(dates[-1][5:]) - 1) / 12
    slope = tr["slope_per_year"]
    assert slope == pytest.approx(SLOPE, abs=0.005)
    a0, a1 = tr["anomaly_line"]
    assert (a1 - a0) / (t1 - t0) == pytest.approx(slope, rel=1e-4)
    clim_mean = sum(s["climatology"]) / 12
    m0, m1 = tr["monthly_line"]
    assert m0 - a0 == pytest.approx(clim_mean, rel=1e-5)
    assert m1 - a1 == pytest.approx(clim_mean, rel=1e-5)
    y0, y1 = s["annual"]["years"][0], s["annual"]["years"][-1]
    n0, n1 = tr["annual_line"]
    assert (n1 - n0) / (y1 - y0) == pytest.approx(slope, rel=1e-4)
    # Annual line is the monthly line evaluated at the mean time of the year
    assert n0 == pytest.approx(m0 + slope * (y0 + ANNUAL_T_OFFSET - t0), abs=1e-4)
    # The line sits on the data: annual means scatter around it
    resid = [v - (n0 + slope * (y - y0)) for y, v in zip(s["annual"]["years"], s["annual"]["values"])]
    assert abs(float(np.mean(resid))) < 0.05


def test_mismatch_with_case_file_fails(synthetic):
    dates, values = synthetic
    case = _case(dates, values)
    case["slope"] += 1e-6
    with pytest.raises(ValueError, match="differs from the case file"):
        build_series(case)


def test_rounding_and_deterministic_output(synthetic, tmp_path):
    dates, values = synthetic
    s = build_series(_case(dates, values))
    for v in s["anomaly"]["values"]:
        if v is not None:
            assert v == float(f"{v:.6g}")
    data = {"case_id": "x", "place": "Test", "lat": 40.0, "lon": -3.0, "variables": {"T2M": s}}
    p = write_tutorial(data, tmp_path)
    first = p.read_bytes()
    write_tutorial(data, tmp_path)
    assert p.read_bytes() == first
    assert first.endswith(b"\n") and "°C".encode("utf-8") in first


# --- real featured case --------------------------------------------------------------------

SERIES_KEYS = {"variable", "name", "units", "dataset", "monthly", "climatology", "anomaly",
               "annual", "max", "trend", "extras"}
TREND_KEYS = {"slope_per_year", "ci_low", "ci_high", "p_value", "significant", "test",
              "anomaly_line", "monthly_line", "annual_line"}


def test_real_dana_file_matches_type_and_case_files():
    path = ROOT / "data" / "tutorial_data" / "dana_valencia.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    assert set(data) == {"case_id", "place", "lat", "lon", "variables"}
    assert data["case_id"] == "dana_valencia"
    assert set(data["variables"]) == {"PRECIP", "T2M"}
    # The committed file is up to date with the generator
    assert data == json.loads(json.dumps(build_tutorial("dana_valencia")))
    for var, s in data["variables"].items():
        case = json.loads((ROOT / "data" / "cache" / f"case_dana_valencia_{var}.json")
                          .read_text(encoding="utf-8"))
        assert set(s) == SERIES_KEYS and set(s["trend"]) == TREND_KEYS
        assert s["variable"] == var and s["units"] == case["units"] and s["dataset"] == case["dataset"]
        assert isinstance(s["name"], str) and s["name"] != var
        assert s["monthly"]["dates"] == case["dates"] == s["anomaly"]["dates"]
        assert len(s["monthly"]["values"]) == len(s["anomaly"]["values"]) == len(case["dates"])
        assert len(s["climatology"]) == 12
        assert len(s["annual"]["years"]) == len(s["annual"]["values"]) > 0
        assert s["max"]["date"] in case["dates"]
        assert s["max"]["value"] == max(v for v in s["monthly"]["values"] if v is not None)
        tr = s["trend"]
        assert abs(tr["slope_per_year"] - case["slope"]) <= 1e-9
        assert abs(tr["p_value"] - case["p_value"]) <= 1e-9
        assert tr["significant"] == case["significant"] and tr["test"] == case["test"]
        assert tr["ci_low"] <= tr["slope_per_year"] <= tr["ci_high"]
        for key in ("anomaly_line", "monthly_line", "annual_line"):
            assert len(tr[key]) == 2 and all(math.isfinite(v) for v in tr[key])


def test_cli_writes_file(tmp_path):
    assert main(["--case", "dana_valencia", "--out-dir", str(tmp_path)]) == 0
    assert (tmp_path / "dana_valencia.json").exists()


# --- technique data (extras) ---------------------------------------------------------------

def _months(dates):
    return [(int(d[:4]), int(d[5:])) for d in dates]


def test_seasons_only_complete_and_djf_year(synthetic):
    dates, values = synthetic            # 2000-07 .. 2020-03, gap at 2004-09
    months = _months(dates)
    years, means = season_means(months, values, "DJF")
    # First DJF needs Dec 2000 -> labelled 2001; last: Dec 2019 + Jan, Feb 2020 -> 2020
    assert years[0] == 2001 and years[-1] == 2020
    lookup = dict(zip(dates, values))
    i = years.index(2010)
    assert means[i] == pytest.approx((lookup["2009-12"] + lookup["2010-01"] + lookup["2010-02"]) / 3)
    son_years, _ = season_means(months, values, "SON")
    assert 2004 not in son_years and 2003 in son_years and 2000 in son_years
    jjas_years, _ = season_means(months, values, "JJAS")
    assert 2000 not in jjas_years          # June 2000 missing (series starts in July)
    assert 2004 not in jjas_years and 2019 in jjas_years and 2020 not in jjas_years
    s = build_series(_case(dates, values))
    for sid in ("DJF", "MAM", "JJA", "SON", "JJAS"):
        ys = s["extras"]["seasons"][sid]
        assert len(ys["years"]) == len(ys["values"]) == len(set(ys["years"]))
    assert s["extras"]["seasons"]["DJF"]["years"] == years


def test_same_month_lengths(synthetic):
    dates, values = synthetic
    sm = build_series(_case(dates, values))["extras"]["same_month"]
    assert len(sm) == 12
    for m in range(1, 13):
        expected = [int(d[:4]) for d, v in zip(dates, values) if int(d[5:]) == m and v is not None]
        assert sm[m - 1]["years"] == expected
        assert len(sm[m - 1]["values"]) == len(expected)
    assert 2004 not in sm[8]["years"]      # the September gap
    assert sm[0]["years"][0] == 2001 and sm[6]["years"][0] == 2000


def test_yearly_trend_perfect_line():
    years = list(range(1990, 2020))
    values = [2.0 + 0.3 * (y - 1990) for y in years]
    tr = yearly_trend(years, values)
    assert tr["slope_per_year"] == pytest.approx(0.3)
    assert tr["ci_low"] == pytest.approx(0.3) and tr["ci_high"] == pytest.approx(0.3)
    assert tr["p_value"] < 1e-6 and tr["significant"] is True
    assert tr["test"] == "mann-kendall"
    assert tr["line"] == [pytest.approx(2.0), pytest.approx(2.0 + 0.3 * 29)]


def test_yearly_trend_noise():
    rng = np.random.default_rng(3)
    years = list(range(1980, 2025))
    tr = yearly_trend(years, list(rng.normal(0, 1, len(years))))
    assert tr["ci_low"] <= tr["slope_per_year"] <= tr["ci_high"]
    assert tr["significant"] is (tr["p_value"] < 0.05)


def test_threshold_counts_known_input():
    dates = _dates(2000, 1, 42)       # 3 full years + 6 months of 2003
    values = ([-1.0] * 3 + [5.0] * 9) + ([-2.0, 0.0] + [5.0] * 10) + [5.0] * 12 + [-9.0] * 6
    out = threshold_counts(_months(dates), values,
                           [{"id": "below_0", "label": "x", "op": "below", "value": 0.0},
                            {"id": "above_4", "label": "y", "op": "above", "value": 4.0}])
    assert out[0]["years"] == [2000, 2001, 2002]           # partial 2003 left out
    assert out[0]["counts"] == [3, 1, 0]                   # 0.0 is not below 0 (strict)
    assert out[1]["counts"] == [9, 10, 12]
    assert out[0]["op"] == "below" and out[0]["value"] == 0.0
    assert set(out[0]["trend"]) == {"slope_per_year", "ci_low", "ci_high", "p_value",
                                    "significant", "test", "line"}


def test_threshold_configs_give_non_zero_counts():
    for case_id, by_var in CASE_THRESHOLDS.items():
        data = build_tutorial(case_id)
        for var, configs in by_var.items():
            got = data["variables"][var]["extras"]["threshold_counts"]
            assert [c["id"] for c in got] == [c["id"] for c in configs]
            for c in got:
                assert sum(c["counts"]) > 0
                assert len(c["years"]) == len(c["counts"])
    assert build_tutorial("donana")["variables"]["SOILM"]["extras"]["threshold_counts"] == []


def test_zscore_has_unit_std_before_smoothing(synthetic):
    dates, values = synthetic
    s = build_series(_case(dates, values))
    z = standardise(s["anomaly"]["values"])
    zz = [v for v in z if v is not None]
    assert float(np.std(zz)) == pytest.approx(1.0, rel=1e-4)
    smooth = s["extras"]["zscore_smooth12"]
    assert smooth["dates"] == dates
    assert smooth["values"][:6] == [None] * 6 and smooth["values"][-5:] == [None] * 5
    assert smooth["values"][6] == pytest.approx(sum(z[0:12]) / 12, abs=1e-4)
    # every window that contains the 2004-09 gap (index 50) is null
    assert all(smooth["values"][i] is None for i in range(45, 57))
    assert smooth["values"][44] is not None and smooth["values"][57] is not None


def test_cumulative_is_cumsum(synthetic):
    dates, values = synthetic
    s = build_series(_case(dates, values))
    anom = s["anomaly"]["values"]
    cum = s["extras"]["cumulative_anomaly"]["values"]
    assert cum[50] is None
    total = 0.0
    for a, c in zip(anom, cum):
        if a is not None:
            total += a
            assert c == pytest.approx(total, abs=1e-3)
    assert cumulative_anomaly([1.0, None, 2.0, -0.5]) == [1.0, None, 3.0, 2.5]


def test_running_mean_centring():
    vals = [float(i) for i in range(100)]
    rm12 = centred_running_mean(vals, 12)
    # month i uses i - 6 .. i + 5 -> mean = i - 0.5 for a linear series
    assert rm12[:6] == [None] * 6 and rm12[-5:] == [None] * 5
    assert rm12[6] == pytest.approx(5.5) and rm12[50] == pytest.approx(49.5)
    rm60 = centred_running_mean(vals, 60)
    assert rm60[29] is None and rm60[30] == pytest.approx(29.5) and rm60[70] == pytest.approx(69.5)
    assert rm60[71] is None
    gap = list(vals)
    gap[40] = None
    rmg = centred_running_mean(gap, 12)
    assert rmg[34] is not None and all(rmg[i] is None for i in range(35, 47)) and rmg[47] is not None
    assert centred_running_mean([1.0, 2.0, 3.0], 3) == [None, 2.0, None]


def test_running_mean_in_series(synthetic):
    dates, values = synthetic
    rm = build_series(_case(dates, values))["extras"]["running_mean"]
    assert set(rm) == {"12", "60"}
    assert len(rm["12"]) == len(rm["60"]) == len(dates)


def test_periods(synthetic):
    dates, values = synthetic        # 2000-07 .. 2020-03: middle 2010-05 -> split 2010-01
    p = build_series(_case(dates, values))["extras"]["periods"]
    assert p["split"] == "2010-01"
    assert p["before"]["from"] == "2000-07" and p["before"]["to"] == "2009-12"
    assert p["after"]["from"] == "2010-01" and p["after"]["to"] == "2020-03"
    n_valid = sum(v is not None for v in values)
    assert p["before"]["n"] + p["after"]["n"] == n_valid
    assert sum(p["before_counts"]) == p["before"]["n"]
    assert sum(p["after_counts"]) == p["after"]["n"]
    edges = p["bin_edges"]
    assert len(edges) == len(p["before_counts"]) + 1 == len(p["after_counts"]) + 1
    steps = np.diff(edges)
    assert np.allclose(steps, steps[0])
    assert p["after"]["mean"] > p["before"]["mean"]   # warming synthetic series


def test_nice_bin_edges():
    e = nice_bin_edges(-3.2, 4.1)
    step = e[1] - e[0]
    assert e[0] <= -3.2 and e[-1] >= 4.1
    assert 12 <= len(e) - 1 <= 16
    assert any(abs(step - m * 10 ** k) < 1e-9 for m in (1, 2, 2.5, 5) for k in range(-3, 3))


def test_window_trends_first_entry_is_full_trend():
    dates = _dates(1990, 1, 30 * 12)
    rng = np.random.default_rng(7)
    values = [SEASON[int(d[5:]) - 1] + 0.03 * (int(d[:4]) - 1990) + float(rng.normal(0, 0.5))
              for d in dates]
    wt = build_series(_case(dates, values))["extras"]["window_trends"]
    assert [w["start_year"] for w in wt] == [1990, 1995, 2000, 2005]   # 2010: < 180 months
    full = analyze_trend(dates, values)
    assert wt[0]["slope_per_year"] == pytest.approx(full["slope"], rel=1e-5)
    assert wt[0]["p_value"] == pytest.approx(full["p_value"], rel=1e-5)
    assert wt[0]["ci_low"] == pytest.approx(full["slope_ci_low"], rel=1e-5)
    assert wt[0]["significant"] == full["significant"]
    i0 = dates.index("2000-01")
    r = analyze_trend(dates[i0:], values[i0:])
    assert wt[2]["slope_per_year"] == pytest.approx(r["slope"], rel=1e-5)


def test_window_trends_start_at_first_complete_year(synthetic):
    dates, values = synthetic        # 2000 partial, 2001 complete; 237 months
    wt = build_series(_case(dates, values))["extras"]["window_trends"]
    assert [w["start_year"] for w in wt] == [2001]     # 2006-01 .. 2020-03 is 171 months


# --- all 10 committed files ----------------------------------------------------------------

INDEX = json.loads((ROOT / "data" / "cases_index.json").read_text(encoding="utf-8"))
CASE_IDS = [c["id"] for c in INDEX]
EXTRAS_KEYS = {"same_month", "seasons", "threshold_counts", "zscore_smooth12",
               "cumulative_anomaly", "running_mean", "periods", "window_trends"}


def test_ten_cases():
    assert len(CASE_IDS) == 10


@pytest.mark.parametrize("case_id", CASE_IDS)
def test_committed_file_up_to_date(case_id):
    path = ROOT / "data" / "tutorial_data" / f"{case_id}.json"
    assert path.exists(), f"run py -m pipeline.tutorial_data --all ({path} missing)"
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data == json.loads(json.dumps(build_tutorial(case_id)))
    entry = next(c for c in INDEX if c["id"] == case_id)
    assert len(data["variables"]) == len(entry["files"])
    for s in data["variables"].values():
        assert set(s) == SERIES_KEYS
        ex = s["extras"]
        assert set(ex) == EXTRAS_KEYS
        n = len(s["monthly"]["dates"])
        assert len(ex["same_month"]) == 12
        assert set(ex["seasons"]) == {"DJF", "MAM", "JJA", "SON", "JJAS"}
        assert ex["zscore_smooth12"]["dates"] == s["monthly"]["dates"]
        assert len(ex["zscore_smooth12"]["values"]) == len(ex["cumulative_anomaly"]["values"]) == n
        assert len(ex["running_mean"]["12"]) == len(ex["running_mean"]["60"]) == n
        p = ex["periods"]
        assert sum(p["before_counts"]) == p["before"]["n"]
        assert sum(p["after_counts"]) == p["after"]["n"]
        assert ex["window_trends"]
        wt0 = ex["window_trends"][0]
        assert wt0["slope_per_year"] == pytest.approx(s["trend"]["slope_per_year"], rel=1e-5)
        assert wt0["significant"] == s["trend"]["significant"]
