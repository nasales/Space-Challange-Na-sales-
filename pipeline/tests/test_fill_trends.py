"""Tests for pipeline/fill_trends.py (Diego, block 5).

Ivan's analyze_trend is replaced by a fake with the same signature, so these tests check the
plumbing (iteration, skipping, units, row format, SQL), not the statistics.
"""

import json
import sqlite3

import pytest

from pipeline.build_case import stub_analyze_trend
from pipeline.fill_trends import TREND_COLUMNS, fill_trends, trend_to_db_row, write_sql
from pipeline.series import from_start_month
from pipeline.sources.supabase_export import load_trend
from pipeline.tests.test_sources import SALAMANCA, VARIABLES, write_cell


def fake_analyze(dates, values, alpha=0.05):
    if len(dates) > 400:
        raise ValueError("fake: series too long")
    return {
        "slope": 0.03, "p_value": 0.01, "significant": True, "test": "fake",
        "slope_ci_low": 0.01, "slope_ci_high": 0.05, "mk_tau": 0.2,
        "n_points": sum(v is not None for v in values), "mean_value": 12.0,
        "direction": "increasing",
    }


@pytest.fixture
def export(tmp_path):
    root = tmp_path / "export"
    (root / "cells").mkdir(parents=True)
    (root / "variables.json").write_text(json.dumps(VARIABLES, ensure_ascii=False), encoding="utf-8")
    write_cell(root, SALAMANCA)  # tair 300 months, precip 324 months
    write_cell(root, SALAMANCA + 1, vars_={
        "tair": {"start_month": "2000-01-01", "values": [10.0] * 100 + [None] * 200},  # 100 valid
        "precip": {"start_month": "1980-01-01", "values": [1.0] * 500},  # fake_analyze rejects it
    })
    return root


def series(n=300):
    return from_start_month("2000-01-01", [10.0] * n, place="X", lat=40.0, lon=-5.0,
                            variable="tair", units="°C", dataset="d")


# ---------- trend_to_db_row ----------


def test_row_has_schema_columns_and_per_decade_units():
    row = trend_to_db_row(fake_analyze([], [1.0] * 300), series(), SALAMANCA, "tair")
    assert tuple(row) == TREND_COLUMNS
    assert row["slope_per_decade"] == pytest.approx(0.3)
    assert row["slope_ci_low"] == pytest.approx(0.1)
    assert row["slope_ci_high"] == pytest.approx(0.5)
    assert row["period_start"] == "2000-01-01"
    assert row["period_end"] == "2024-12-01"
    assert row["n_months"] == 300


def test_row_fills_defaults_when_trend_has_only_contract_keys():
    trend = {"slope": -0.02, "p_value": 0.3, "significant": False, "test": "x"}
    row = trend_to_db_row(trend, series(), 1, "tair")
    assert row["direction"] == "no trend"
    assert row["mean_value"] == 10.0
    assert row["slope_ci_low"] is None and row["mk_tau"] is None


def test_row_refuses_stub():
    with pytest.raises(ValueError, match="stub"):
        trend_to_db_row(stub_analyze_trend([], []), series(), 1, "tair")


def test_row_refuses_inconsistent_significance():
    with pytest.raises(ValueError, match="does not match"):
        trend_to_db_row(dict(fake_analyze([], []), p_value=0.2), series(), 1, "tair")


def test_row_refuses_nan_slope():
    with pytest.raises(ValueError, match="slope"):
        trend_to_db_row(dict(fake_analyze([], []), slope=float("nan")), series(), 1, "tair")


# ---------- fill_trends ----------


def test_fill_trends_rows_and_skips(export, tmp_path):
    out = tmp_path / "rows.json"
    summary = fill_trends(export, out, analyze=fake_analyze)
    rows = json.loads(out.read_text(encoding="utf-8"))
    assert summary["rows"] == len(rows) == 2
    assert {(r["cell_id"], r["var_id"]) for r in rows} == {(SALAMANCA, "tair"), (SALAMANCA, "precip")}
    reasons = {(s["cell_id"], s["var_id"]): s["reason"] for s in summary["skipped"]}
    assert "100 valid months" in reasons[(SALAMANCA + 1, "tair")]
    assert "analyze_trend: fake" in reasons[(SALAMANCA + 1, "precip")]
    assert summary["by_variable"] == {"precip": 1, "tair": 1}


def test_fill_trends_refuses_to_run_with_stub(export, tmp_path):
    with pytest.raises(RuntimeError, match="stub"):
        fill_trends(export, tmp_path / "rows.json", analyze=stub_analyze_trend)


def test_fill_trends_does_not_hide_code_errors(export, tmp_path):
    def broken(dates, values, alpha=0.05):
        raise TypeError("bug")
    with pytest.raises(TypeError):
        fill_trends(export, tmp_path / "rows.json", analyze=broken)


def test_fill_trends_only_some_variables(export, tmp_path):
    summary = fill_trends(export, tmp_path / "rows.json", analyze=fake_analyze, var_ids=["tair"])
    assert summary["by_variable"] == {"tair": 1}


def test_update_export_puts_trends_back_for_load_trend(export, tmp_path):
    fill_trends(export, tmp_path / "rows.json", analyze=fake_analyze, update_export=True)
    trend = load_trend(export, SALAMANCA, "tair")
    assert trend["slope"] == pytest.approx(0.03)  # per decade in the file, per year again when read
    assert load_trend(export, SALAMANCA + 1, "tair") is None  # skipped series keep no trend
    assert len(json.loads((export / "trends.json").read_text())) == 2


# ---------- SQL ----------

SCHEMA = """
create table trends (
  cell_id integer, var_id text, period_start date not null, period_end date not null,
  n_months integer not null, mean_value real, slope_per_decade real, slope_ci_low real,
  slope_ci_high real, mk_tau real, p_value real, significant boolean, direction text,
  primary key (cell_id, var_id));
"""


def test_sql_upsert_runs_and_is_idempotent(export, tmp_path):
    sql = tmp_path / "upsert.sql"
    fill_trends(export, tmp_path / "rows.json", analyze=fake_analyze, sql_path=sql)
    script = sql.read_text(encoding="utf-8")
    db = sqlite3.connect(":memory:")  # SQLite understands the same upsert syntax as Postgres
    db.executescript(SCHEMA)
    db.executescript(script)
    db.executescript(script)  # running it twice must not duplicate rows
    assert db.execute("select count(*) from trends").fetchone()[0] == 2
    slope = db.execute("select slope_per_decade from trends where var_id = 'tair'").fetchone()[0]
    assert slope == pytest.approx(0.3)


def test_sql_escapes_quotes_and_nulls(tmp_path):
    row = {c: None for c in TREND_COLUMNS}
    row.update(cell_id=1, var_id="o'brien", period_start="2000-01-01", period_end="2000-02-01",
               n_months=2, significant=False, p_value=0.5, slope_per_decade=0.0)
    path = tmp_path / "x.sql"
    write_sql([row], path)
    text = path.read_text(encoding="utf-8")
    assert "'o''brien'" in text
    assert "null" in text and "false" in text
    db = sqlite3.connect(":memory:")
    db.executescript(SCHEMA)
    db.executescript(text)
    assert db.execute("select var_id from trends").fetchone()[0] == "o'brien"
