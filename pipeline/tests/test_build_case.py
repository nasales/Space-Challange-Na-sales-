"""Tests for pipeline/build_case.py (Diego, block 2)."""

import importlib.util
import json
from pathlib import Path

import pytest

from pipeline.build_case import (
    CONTRACT_FIELDS,
    DB_TEST,
    build_case,
    case_id,
    case_path,
    get_analyze_trend,
    stub_analyze_trend,
    trend_from_db,
    write_case,
)
from pipeline.series import from_start_month

REPO = Path(__file__).resolve().parents[2]

META = dict(place="Salamanca", lat=40.97, lon=-5.66, variable="tair", units="°C", dataset="GLDAS-2.1 Noah")

SIGNIFICANT = {"slope": 0.04, "p_value": 0.003, "significant": True, "test": "mann-kendall"}
NOT_SIGNIFICANT = {"slope": 0.01, "p_value": 0.41, "significant": False, "test": "mann-kendall"}

DB_ROW = {
    "period_start": "2000-01-01",  # Supabase `date` columns
    "period_end": "2024-12-01",
    "n_months": 298,
    "mean_value": 12.3,
    "slope_per_decade": 0.45,
    "slope_ci_low": 0.2,
    "slope_ci_high": 0.7,
    "mk_tau": 0.12,
    "p_value": 0.002,
    "significant": True,
    "direction": "increasing",
}


@pytest.fixture
def series():
    values = [12.0 + (i % 12) - 6 + i * 0.004 for i in range(300)]
    values[5] = None
    return from_start_month("2000-01", values, **META)


def load_contract_validator():
    spec = importlib.util.spec_from_file_location("validate_contract", REPO / "scripts" / "validate_contract.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# ---------- build_case ----------


def test_case_has_exactly_the_contract_fields(series):
    case = build_case(series, dict(SIGNIFICANT, slope_ci_low=0.01, n_points=299))
    assert tuple(case) == CONTRACT_FIELDS
    assert case["place"] == "Salamanca"
    assert case["slope"] == 0.04
    assert case["values"][5] is None
    assert len(case["dates"]) == len(case["values"]) == 300


def test_non_significant_case_is_valid(series):
    case = build_case(series, NOT_SIGNIFICANT)
    assert case["significant"] is False


@pytest.mark.parametrize("p_value,significant", [(0.01, False), (0.2, True), (0.05, True)])
def test_significant_must_match_p_value(series, p_value, significant):
    with pytest.raises(ValueError, match="does not match"):
        build_case(series, dict(SIGNIFICANT, p_value=p_value, significant=significant))


@pytest.mark.parametrize("p_value", [-0.1, 1.5, None, "0.01"])
def test_bad_p_value_raises(series, p_value):
    with pytest.raises(ValueError, match="p_value"):
        build_case(series, dict(NOT_SIGNIFICANT, p_value=p_value))


@pytest.mark.parametrize("slope", [float("nan"), float("inf"), None, "0.1", True])
def test_bad_slope_raises(series, slope):
    with pytest.raises(ValueError, match="slope"):
        build_case(series, dict(NOT_SIGNIFICANT, slope=slope))


def test_significant_must_be_bool(series):
    with pytest.raises(ValueError, match="significant"):
        build_case(series, dict(NOT_SIGNIFICANT, significant=0))


def test_missing_trend_key_raises(series):
    trend = dict(SIGNIFICANT)
    del trend["test"]
    with pytest.raises(ValueError, match="missing"):
        build_case(series, trend)


def test_too_short_series_raises():
    short = from_start_month("2000-01", [1.0] * 23, **META)
    with pytest.raises(ValueError, match="at least 24"):
        build_case(short, NOT_SIGNIFICANT)


def test_all_null_series_raises():
    empty = from_start_month("2000-01", [None] * 30, **META)
    with pytest.raises(ValueError, match="null"):
        build_case(empty, NOT_SIGNIFICANT)


def test_invalid_series_raises(series):
    series.dates[3] = series.dates[2]
    with pytest.raises(ValueError, match="consecutive"):
        build_case(series, NOT_SIGNIFICANT)


# ---------- write_case ----------


def test_written_file_passes_the_contract_validator(series, tmp_path):
    validator = load_contract_validator()
    for name, trend in (("sig", SIGNIFICANT), ("nosig", NOT_SIGNIFICANT)):
        path = tmp_path / f"{name}.json"
        write_case(build_case(series, trend), path)
        assert validator.check(str(path)) == []


def test_written_file_round_trips_with_unicode_and_nulls(series, tmp_path):
    path = tmp_path / "nested" / "case.json"
    case = build_case(series, SIGNIFICANT)
    write_case(case, path)
    text = path.read_text(encoding="utf-8")
    assert "°C" in text  # not escaped
    assert "NaN" not in text
    assert json.loads(text) == case


def test_write_refuses_stub_unless_allowed(series, tmp_path):
    case = build_case(series, stub_analyze_trend(series.dates, series.values))
    with pytest.raises(ValueError, match="stub"):
        write_case(case, tmp_path / "x.json")
    write_case(case, tmp_path / "x.json", allow_stub=True)
    assert (tmp_path / "x.json").exists()


def test_write_refuses_extra_fields(series, tmp_path):
    case = dict(build_case(series, SIGNIFICANT), climatology=[1] * 12)
    with pytest.raises(ValueError, match="not in the contract"):
        write_case(case, tmp_path / "x.json")


def test_write_refuses_nan(tmp_path, series):
    case = build_case(series, SIGNIFICANT)
    case["values"][0] = float("nan")
    with pytest.raises(ValueError):
        write_case(case, tmp_path / "x.json")


# ---------- ids and paths ----------


@pytest.mark.parametrize(
    "place,variable,expected",
    [
        ("Salamanca", "tair", "salamanca_tair"),
        ("Cádiz", "precip", "cadiz_precip"),
        ("Sierra de Gredos", "t2m_long", "sierra-de-gredos_t2m-long"),
        ("A Coruña!", "wind", "a-coruna_wind"),
    ],
)
def test_case_id(place, variable, expected):
    assert case_id(place, variable) == expected


def test_case_id_rejects_empty():
    with pytest.raises(ValueError):
        case_id("???", "tair")


def test_case_path_default_is_data_cache(series):
    path = case_path(build_case(series, SIGNIFICANT))
    assert path == REPO / "data" / "cache" / "salamanca_tair.json"


# ---------- trend sources ----------


def test_trend_from_db_converts_decade_to_year():
    trend = trend_from_db(DB_ROW)
    assert trend["slope"] == pytest.approx(0.045)
    assert trend["slope_ci_low"] == pytest.approx(0.02)
    assert trend["slope_ci_high"] == pytest.approx(0.07)
    assert trend["p_value"] == 0.002
    assert trend["significant"] is True
    assert trend["test"] == DB_TEST
    assert trend["n_points"] == 298
    assert trend["start"] == "2000-01" and trend["end"] == "2024-12"


def test_trend_from_db_feeds_build_case(series):
    case = build_case(series, trend_from_db(DB_ROW))
    assert case["slope"] == pytest.approx(0.045)
    assert "slope_ci_low" not in case  # extra fields stay out of the JSON


FLOAT32_005 = 0.05000000074505806  # 0.05 as stored in a Postgres `real` column


@pytest.mark.parametrize("p_value", [0.05, FLOAT32_005])
def test_trend_from_db_fixes_float32_rounding_at_threshold(series, p_value, tmp_path):
    # True p was 0.0499999..., significant=True, but `real` rounded p up to 0.05
    trend = trend_from_db(dict(DB_ROW, p_value=p_value, significant=True))
    assert trend["p_value"] < 0.05 and trend["p_value"] == pytest.approx(0.05)
    path = tmp_path / "edge.json"
    write_case(build_case(series, trend), path)
    assert load_contract_validator().check(str(path)) == []


def test_trend_from_db_keeps_consistent_threshold_value():
    trend = trend_from_db(dict(DB_ROW, p_value=0.05, significant=False))
    assert trend["p_value"] == 0.05


def test_trend_from_db_does_not_hide_real_mismatch(series):
    trend = trend_from_db(dict(DB_ROW, p_value=0.06, significant=True))
    assert trend["p_value"] == 0.06
    with pytest.raises(ValueError, match="does not match"):
        build_case(series, trend)


def test_trend_from_db_missing_slope_raises():
    with pytest.raises(ValueError, match="slope_per_decade"):
        trend_from_db(dict(DB_ROW, slope_per_decade=None))


def test_trend_from_db_bad_slope_raises():
    with pytest.raises(ValueError, match="finite"):
        trend_from_db(dict(DB_ROW, slope_per_decade=float("nan")))


def test_stub_has_analyze_trend_shape(series):
    result = stub_analyze_trend(series.dates, series.values)
    assert result == {"slope": 0.0, "p_value": 1.0, "significant": False, "test": "stub"}


def test_get_analyze_trend_falls_back_to_stub_only_if_trend_py_is_missing():
    func = get_analyze_trend()
    if (REPO / "pipeline" / "trend.py").exists():
        assert func is not stub_analyze_trend
    else:
        assert func is stub_analyze_trend
