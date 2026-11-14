"""Tests for pipeline/series.py (Diego, block 1)."""

import math

import pytest

from pipeline.series import (
    Series,
    format_month,
    from_start_month,
    next_month,
    parse_month,
)

META = dict(
    place="Salamanca",
    lat=40.97,
    lon=-5.66,
    variable="tair",
    units="°C",
    dataset="GLDAS-2.1 Noah",
)


def make_series(**overrides) -> Series:
    fields = dict(META, dates=["2000-01", "2000-02", "2000-03"], values=[1.0, 2.0, 3.0])
    fields.update(overrides)
    return Series(**fields)


# ---------- from_start_month ----------


def test_builds_25_years_of_monthly_dates():
    values = [10.0 + i * 0.01 for i in range(300)]
    s = from_start_month("2000-01", values, **META)
    assert len(s.dates) == 300
    assert s.dates[0] == "2000-01"
    assert s.dates[11] == "2000-12"
    assert s.dates[12] == "2001-01"
    assert s.dates[-1] == "2024-12"
    assert s.values == values


def test_start_month_in_the_middle_of_a_year():
    s = from_start_month("1998-11", [1.0, 2.0, 3.0], **META)
    assert s.dates == ["1998-11", "1998-12", "1999-01"]


def test_gaps_stay_none():
    s = from_start_month("2000-01", [1.0, None, 3.0], **META)
    assert s.values == [1.0, None, 3.0]


@pytest.mark.parametrize("code", [-999, -999.0, -9999, -99999.0])
def test_fill_codes_become_none(code):
    s = from_start_month("2000-01", [1.0, code, 3.0], **META)
    assert s.values == [1.0, None, 3.0]


@pytest.mark.parametrize("bad", [math.nan, math.inf, -math.inf])
def test_nan_and_infinity_become_none(bad):
    s = from_start_month("2000-01", [1.0, bad, 3.0], **META)
    assert s.values == [1.0, None, 3.0]


def test_integers_become_floats():
    s = from_start_month("2000-01", [1, 2, 3], **META)
    assert s.values == [1.0, 2.0, 3.0]
    assert all(isinstance(v, float) for v in s.values)


def test_negative_real_values_are_kept():
    # -12.5 °C is a real temperature, not a fill code
    s = from_start_month("2000-01", [-12.5, -0.1, -998.9], **META)
    assert s.values == [-12.5, -0.1, -998.9]


def test_all_gaps_is_still_a_valid_series():
    # Too few points for a trend is analyze_trend's job to reject, not Series'
    s = from_start_month("2000-01", [None, None], **META)
    assert s.values == [None, None]


@pytest.mark.parametrize("bad", ["12.3", True, [1.0], {"v": 1}])
def test_non_numeric_value_raises(bad):
    with pytest.raises(ValueError, match="not a number"):
        from_start_month("2000-01", [1.0, bad], **META)


@pytest.mark.parametrize("bad", ["2000-1", "2000/01", "2000-13", "2000-00", "2000-01-15", "", None, 200001])
def test_malformed_start_month_raises(bad):
    with pytest.raises(ValueError):
        from_start_month(bad, [1.0], **META)


def test_empty_values_raises():
    with pytest.raises(ValueError, match="empty"):
        from_start_month("2000-01", [], **META)


def test_bad_metadata_raises():
    with pytest.raises(ValueError, match="lat"):
        from_start_month("2000-01", [1.0], **dict(META, lat=95.0))
    with pytest.raises(ValueError, match="place"):
        from_start_month("2000-01", [1.0], **dict(META, place="  "))


# ---------- validate ----------


def test_valid_series_passes_and_returns_self():
    s = make_series()
    assert s.validate() is s


def test_length_mismatch_raises():
    with pytest.raises(ValueError, match="length"):
        make_series(values=[1.0, 2.0]).validate()


def test_unsorted_dates_raise():
    with pytest.raises(ValueError, match="consecutive"):
        make_series(dates=["2000-02", "2000-01", "2000-03"]).validate()


def test_duplicated_dates_raise():
    with pytest.raises(ValueError, match="consecutive"):
        make_series(dates=["2000-01", "2000-01", "2000-02"]).validate()


def test_missing_month_raises():
    # Gaps must be None values, never a skipped date
    with pytest.raises(ValueError, match="consecutive"):
        make_series(dates=["2000-01", "2000-02", "2000-04"]).validate()


def test_malformed_date_raises():
    with pytest.raises(ValueError, match="malformed"):
        make_series(dates=["2000-01", "2000-02", "March 2000"]).validate()


def test_nan_in_values_raises():
    with pytest.raises(ValueError, match="NaN"):
        make_series(values=[1.0, math.nan, 3.0]).validate()


def test_fill_code_in_values_raises():
    with pytest.raises(ValueError, match="fill code"):
        make_series(values=[1.0, -999.0, 3.0]).validate()


@pytest.mark.parametrize("field,bad", [("lat", -91.0), ("lon", 181.0), ("lat", math.nan), ("lon", "5")])
def test_bad_coordinates_raise(field, bad):
    with pytest.raises(ValueError, match=field):
        make_series(**{field: bad}).validate()


# ---------- month helpers ----------


def test_month_helpers():
    assert parse_month("2024-02") == (2024, 2)
    assert format_month((2024, 2)) == "2024-02"
    assert next_month((2024, 12)) == (2025, 1)
    assert next_month((2024, 5)) == (2024, 6)
