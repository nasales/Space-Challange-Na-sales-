"""Tests for pipeline/sources/supabase_export.py (Diego, block 4).

The fake export below copies the layout of `export_json()` in archivos_preSupabase/etl_espana.py.
"""

import json
from pathlib import Path

import pytest

from pipeline.build_case import build_case
from pipeline.sources.supabase_export import (
    cell_center,
    cell_id_for,
    find_cell,
    iter_series,
    load_series,
    load_trend,
    load_variables,
)

SALAMANCA = 753817  # from Perry's brief: centre 40.875, -5.625

VARIABLES = {
    "tair": {"name_en": "Air temperature (near surface)", "unit": "°C",
             "source": "NASA GLDAS_NOAH025_M v2.1", "definition_en": "How warm the air is."},
    "precip": {"name_en": "Precipitation", "unit": "mm/day",
               "source": "NASA GPM_3IMERGM v07", "definition_en": "Rain and snow."},
}

TREND_ROW = {
    "cell_id": SALAMANCA, "var_id": "tair",
    "period_start": "2000-01-01", "period_end": "2024-12-01",
    "n_months": 299, "mean_value": 12.1, "slope_per_decade": 0.42,
    "slope_ci_low": 0.21, "slope_ci_high": 0.63, "mk_tau": 0.11,
    "p_value": 0.004, "significant": True, "direction": "increasing",
}


def tair_values(n=300):
    vals = [round(12 + 8 * ((i % 12) - 5.5) / 5.5 + 0.004 * i, 4) for i in range(n)]
    vals[7] = None
    return vals


def write_cell(root: Path, cell_id: int, region: str = "peninsula_baleares", trend=None, vars_=None):
    lat, lon = cell_center(cell_id)
    vars_ = vars_ or {
        "tair": {"start_month": "2000-01-01", "values": tair_values(), "trend": trend},
        "precip": {"start_month": "1998-01-01", "values": [1.5] * 324, "trend": None},
    }
    data = {"cell_id": cell_id, "lat": lat, "lon": lon, "region": region, "vars": {}}
    for var_id, v in vars_.items():
        data["vars"][var_id] = {"cell_id": cell_id, "var_id": var_id, "climatology": [0.0] * 12, **v}
    (root / "cells").mkdir(parents=True, exist_ok=True)
    (root / "cells" / f"{cell_id}.json").write_text(json.dumps(data), encoding="utf-8")


@pytest.fixture
def export(tmp_path):
    root = tmp_path / "export"
    (root / "cells").mkdir(parents=True)
    (root / "variables.json").write_text(json.dumps(VARIABLES, ensure_ascii=False), encoding="utf-8")
    write_cell(root, SALAMANCA, trend=TREND_ROW)
    write_cell(root, SALAMANCA + 1)  # neighbour to the east, no trends yet
    return root


# ---------- grid ----------


def test_cell_id_for_salamanca_matches_perrys_brief():
    assert cell_id_for(40.96, -5.66) == SALAMANCA
    assert cell_center(SALAMANCA) == (40.875, -5.625)


def test_cell_id_round_trips_through_centre():
    for cid in (SALAMANCA, 700000, 650123):
        assert cell_id_for(*cell_center(cid)) == cid


def test_cell_id_for_rejects_bad_coordinates():
    with pytest.raises(ValueError):
        cell_id_for(95, 0)


def test_find_cell_exact_and_nearby(export):
    assert find_cell(export, 40.96, -5.66) == SALAMANCA
    # a point in a cell that is not in the export (sea / not land) falls back to the nearest one
    lat, lon = cell_center(SALAMANCA + 1440)  # one row north, missing from the export
    assert find_cell(export, lat, lon) in (SALAMANCA, SALAMANCA + 1)


def test_find_cell_far_away_raises(export):
    with pytest.raises(LookupError):
        find_cell(export, 43.5, -9.9)


# ---------- series ----------


def test_load_series_for_salamanca(export):
    s = load_series(export, SALAMANCA, "tair", place="Salamanca")
    assert s.place == "Salamanca"
    assert (s.lat, s.lon) == (40.875, -5.625)
    assert s.variable == "tair"
    assert s.units == "°C"
    assert s.dataset == "NASA GLDAS_NOAH025_M v2.1"
    assert s.dates[0] == "2000-01" and s.dates[-1] == "2024-12"
    assert s.values[7] is None
    assert len(s.dates) == 300


def test_load_series_default_place(export):
    assert load_series(export, SALAMANCA, "precip").place == f"Cell {SALAMANCA}"


def test_precip_starts_in_1998(export):
    s = load_series(export, SALAMANCA, "precip")
    assert s.dates[0] == "1998-01"


def test_unknown_variable_raises(export):
    with pytest.raises(ValueError, match="unknown variable"):
        load_series(export, SALAMANCA, "wind")


def test_variable_missing_in_cell_raises(export):
    write_cell(export, SALAMANCA + 2, vars_={"precip": {"start_month": "1998-01-01", "values": [1.0] * 30}})
    with pytest.raises(ValueError, match="no variable"):
        load_series(export, SALAMANCA + 2, "tair")


def test_missing_cell_raises(export):
    with pytest.raises(FileNotFoundError):
        load_series(export, 1, "tair")


def test_variables_json_written_as_cp1252_is_still_read(tmp_path):
    # export_json() uses Path.write_text() without encoding: cp1252 on Windows
    root = tmp_path / "export"
    root.mkdir()
    (root / "variables.json").write_bytes(json.dumps(VARIABLES, ensure_ascii=False).encode("cp1252"))
    write_cell(root, SALAMANCA)
    assert load_variables(root)["tair"]["unit"] == "°C"
    assert load_series(root, SALAMANCA, "tair").units == "°C"


# ---------- trends ----------


def test_load_trend_converts_to_per_year(export):
    trend = load_trend(export, SALAMANCA, "tair")
    assert trend["slope"] == pytest.approx(0.042)
    assert trend["significant"] is True
    assert trend["start"] == "2000-01"


def test_load_trend_is_none_while_trends_table_is_empty(export):
    assert load_trend(export, SALAMANCA, "precip") is None
    assert load_trend(export, SALAMANCA + 1, "tair") is None


def test_end_to_end_export_to_contract_case(export):
    series = load_series(export, SALAMANCA, "tair", place="Salamanca")
    case = build_case(series, load_trend(export, SALAMANCA, "tair"))
    assert case["place"] == "Salamanca"
    assert case["slope"] == pytest.approx(0.042)
    assert case["units"] == "°C"


# ---------- iteration ----------


def test_iter_series_visits_every_cell_and_variable(export):
    seen = [(cid, var) for cid, var, _ in iter_series(export)]
    assert seen == [
        (SALAMANCA, "precip"), (SALAMANCA, "tair"),
        (SALAMANCA + 1, "precip"), (SALAMANCA + 1, "tair"),
    ]


def test_iter_series_filters_variables(export):
    seen = {var for _, var, _ in iter_series(export, var_ids=["tair"])}
    assert seen == {"tair"}


def test_iter_series_without_cells_folder_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        list(iter_series(tmp_path))
