"""Tests for pipeline/tutorial_data.py (shape of src/shared/tutorial.ts TutorialData)."""

import json
import math
from pathlib import Path

import numpy as np
import pytest

from pipeline.trend import analyze_trend
from pipeline.tutorial_data import ANNUAL_T_OFFSET, build_series, build_tutorial, main, write_tutorial

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
               "annual", "max", "trend"}
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
