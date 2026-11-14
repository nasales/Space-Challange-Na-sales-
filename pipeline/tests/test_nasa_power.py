"""Tests for pipeline.nasa_power.parse on a tiny fake POWER response."""

from pipeline.nasa_power import parse


def fake_power(param="T2M", values=None, units="C"):
    """Two years of POWER-shaped monthly data, keys YYYYMM plus the annual month 13."""
    values = values or {}
    data = {}
    for year in (2000, 2001):
        for month in range(1, 14):
            key = f"{year}{month:02d}"
            data[key] = values.get(key, float(month))
    return {
        "header": {"fill_value": -999.0},
        "parameters": {param: {"units": units, "longname": "test"}},
        "properties": {"parameter": {param: data}},
    }


def test_parse_drops_annual_and_converts_dates():
    dates, values, units = parse(fake_power(), "T2M")
    assert len(dates) == 24
    assert dates[:2] == ["2000-01", "2000-02"]
    assert dates[11:13] == ["2000-12", "2001-01"]
    assert dates[-1] == "2001-12"
    assert 13.0 not in values  # annual values dropped
    assert units == "°C"


def test_parse_fill_value_becomes_none():
    dates, values, _ = parse(fake_power(values={"200003": -999.0}), "T2M")
    assert values[dates.index("2000-03")] is None
    assert values[dates.index("2000-04")] == 4.0


def test_display_units():
    assert parse(fake_power(param="GWETTOP", units="1"), "GWETTOP")[2] == "fraction (0-1)"
    assert parse(fake_power(param="PRECTOTCORR", units="mm/day"), "PRECTOTCORR")[2] == "mm/day"
    assert parse(fake_power(units="W/m^2"), "T2M")[2] == "W/m^2"  # unknown units kept
