"""Tests for pipeline.compare_db against trends computed by the database script."""

import csv
import importlib.util
import io
import json
import sys
from pathlib import Path

import numpy as np
import pytest

pytest.importorskip("xarray")  # etl_espana.py imports xarray at module level

from pipeline.compare_db import compare_export, main, monthly_dates, summary
from pipeline.tests.test_trend import _make_series

ETL_PATH = Path(__file__).resolve().parents[2] / "archivos_preSupabase" / "etl_espana.py"
TREND_KEYS = ("n_months", "mean_value", "slope_per_decade", "slope_ci_low", "slope_ci_high",
              "mk_tau", "p_value", "significant", "direction")


@pytest.fixture(scope="module")
def etl():
    spec = importlib.util.spec_from_file_location("etl_espana", ETL_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module  # its @dataclass needs the module registered
    spec.loader.exec_module(module)
    yield module
    sys.modules.pop(spec.name, None)


def _var_entry(etl, dates, values, with_trend=True):
    """One vars[var_id] entry shaped like build_rows() + export_json() in etl_espana.py."""
    v = np.array([np.nan if x is None else x for x in values], dtype=float)
    months = np.array(dates, dtype="datetime64[M]")
    entry = {
        "start_month": str(months[0].astype("datetime64[D]")),
        "values": [None if np.isnan(x) else round(float(x), 4) for x in v],
        "climatology": [],
        "trend": None,
    }
    if with_trend:
        st = etl.trend_stats(v, months)
        entry["trend"] = {"period_start": entry["start_month"], **{k: st[k] for k in TREND_KEYS}}
    return entry


@pytest.fixture
def export_dir(tmp_path, etl):
    cells = {
        101: {"tair": _var_entry(etl, *_make_series(trend=0.03, seed=1)),
              "wind": _var_entry(etl, *_make_series(trend=0.0, seed=3))},
        102: {"tair": _var_entry(etl, *_make_series(trend=-0.05, seed=2)),
              "precip": _var_entry(etl, *_make_series(trend=0.0, phi=0.6, noise_sd=1.0, seed=5))},
        103: {"tair": _var_entry(etl, *_make_series(trend=0.03, seed=7), with_trend=False)},
    }
    (tmp_path / "cells").mkdir()
    for cid, vars_ in cells.items():
        cell = {"cell_id": cid, "lat": 40.0 + cid / 1000, "lon": -5.0, "region": "peninsula", "vars": vars_}
        (tmp_path / "cells" / f"{cid}.json").write_text(json.dumps(cell))
    return tmp_path


def _tamper(export_dir, cid, var_id, key, value):
    path = export_dir / "cells" / f"{cid}.json"
    cell = json.loads(path.read_text())
    cell["vars"][var_id]["trend"][key] = value
    path.write_text(json.dumps(cell))


def test_monthly_dates():
    assert monthly_dates("1999-11-01", 3) == ["1999-11", "1999-12", "2000-01"]


def test_matches_db_and_skips_null_trend(export_dir):
    rows = compare_export(export_dir, progress_every=0)
    assert len(rows) == 4  # cell 103 has trend null
    assert {r["cell_id"] for r in rows} == {101, 102}
    assert [r["status"] for r in rows] == ["ok"] * 4


def test_tampered_values_are_reported(export_dir):
    _tamper(export_dir, 101, "wind", "p_value", 0.5)  # real p ~ 1.0; still non-significant
    _tamper(export_dir, 102, "tair", "significant", False)
    rows = {(r["cell_id"], r["var_id"]): r for r in compare_export(export_dir, progress_every=0)}
    assert rows[(101, "wind")]["status"] == "numeric"
    assert rows[(102, "tair")]["status"] == "significance"
    assert rows[(101, "tair")]["status"] == rows[(102, "precip")]["status"] == "ok"
    text = summary(list(rows.values()))
    assert "Numeric mismatches (rel tol 0.001): 1" in text
    assert "Significance/direction mismatches: 1" in text


def test_value_error_is_a_mismatch(export_dir):
    path = export_dir / "cells" / "101.json"
    cell = json.loads(path.read_text())
    cell["vars"]["tair"]["values"] = cell["vars"]["tair"]["values"][:119]
    path.write_text(json.dumps(cell))
    rows = {(r["cell_id"], r["var_id"]): r for r in compare_export(export_dir, progress_every=0)}
    assert rows[(101, "tair")]["status"] == "error"
    assert "120" in rows[(101, "tair")]["error"]


def test_vars_and_limit_filters(export_dir):
    rows = compare_export(export_dir, variables=["tair"], limit=1, progress_every=0)
    assert [(r["cell_id"], r["var_id"]) for r in rows] == [(101, "tair")]


def test_cli_writes_csv(export_dir, tmp_path, capsys):
    out = tmp_path / "report.csv"
    assert main([str(export_dir), "--out", str(out)]) == 0
    assert "Compared: 4 series" in capsys.readouterr().out
    with open(out, newline="", encoding="utf-8") as f:
        assert len(list(csv.DictReader(f))) == 4
