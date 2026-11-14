"""Compute the trend of every cell × variable and produce rows for the Supabase `trends` table
(Interface 4 in pipeline/README.md).

Usage:
    py -m pipeline.fill_trends --export-dir export --out trends_rows.json --sql trends_upsert.sql
    py -m pipeline.fill_trends --export-dir export --out trends_rows.json --update-export

The SQL file is an idempotent upsert for the Supabase SQL editor (same columns as `upload()` in
archivos_preSupabase/etl_espana.py). Never put a database connection string in this repo.
"""

from __future__ import annotations

import argparse
import json
import math
from collections import Counter
from pathlib import Path
from typing import Callable

from pipeline.build_case import ALPHA, STUB_TEST, get_analyze_trend, stub_analyze_trend
from pipeline.series import Series
from pipeline.sources.supabase_export import iter_series, load_cell

MIN_MONTHS = 120  # same as the ETL and analyze_trend

# Column order of the `trends` table (supabase_schema.sql) and of the ETL upload.
TREND_COLUMNS = (
    "cell_id", "var_id", "period_start", "period_end", "n_months", "mean_value",
    "slope_per_decade", "slope_ci_low", "slope_ci_high", "mk_tau", "p_value",
    "significant", "direction",
)
SQL_BATCH = 500


# ---------- one row ----------


def trend_to_db_row(trend: dict, series: Series, cell_id: int, var_id: str) -> dict:
    """analyze_trend result (slope per year) -> `trends` row (slope per decade)."""
    if trend.get("test") == STUB_TEST:
        raise ValueError("refusing to build a trends row from the stub analyze_trend")
    for key in ("slope", "p_value", "significant"):
        if key not in trend:
            raise ValueError(f"trend is missing {key!r}")

    slope = _finite(trend["slope"], "slope")
    p_value = _finite(trend["p_value"], "p_value")
    significant = trend["significant"]
    if not isinstance(significant, bool) or significant != (p_value < ALPHA):
        raise ValueError(f"significant={significant!r} does not match p_value={p_value} < {ALPHA}")

    valid = [v for v in series.values if v is not None]
    direction = trend.get("direction") or (
        ("increasing" if slope > 0 else "decreasing") if significant else "no trend"
    )
    return {
        "cell_id": int(cell_id),
        "var_id": var_id,
        # Same period as the ETL: the whole series, as first-of-month dates.
        "period_start": f"{series.dates[0]}-01",
        "period_end": f"{series.dates[-1]}-01",
        "n_months": int(trend.get("n_points", len(valid))),
        "mean_value": _optional(trend.get("mean_value", sum(valid) / len(valid) if valid else None)),
        "slope_per_decade": slope * 10,
        "slope_ci_low": _per_decade(trend.get("slope_ci_low")),
        "slope_ci_high": _per_decade(trend.get("slope_ci_high")),
        "mk_tau": _optional(trend.get("mk_tau")),
        "p_value": p_value,
        "significant": significant,
        "direction": direction,
    }


# ---------- whole export ----------


def fill_trends(
    export_dir: str | Path,
    out_path: str | Path,
    *,
    sql_path: str | Path | None = None,
    update_export: bool = False,
    var_ids: list[str] | None = None,
    analyze: Callable[..., dict] | None = None,
) -> dict:
    """Run analyze_trend on every series of the export and write the rows. Returns a summary."""
    analyze = analyze or get_analyze_trend()
    if analyze is stub_analyze_trend:
        raise RuntimeError(
            "pipeline/trend.py (Ivan's analyze_trend) is not available; refusing to fill trends with the stub"
        )

    rows: list[dict] = []
    skipped: list[dict] = []
    for cell_id, var_id, series in iter_series(export_dir, var_ids):
        n_valid = sum(v is not None for v in series.values)
        if n_valid < MIN_MONTHS:
            skipped.append({"cell_id": cell_id, "var_id": var_id,
                            "reason": f"only {n_valid} valid months (< {MIN_MONTHS})"})
            continue
        try:
            trend = analyze(series.dates, series.values)
        except ValueError as e:  # analyze_trend rejects this series; other errors are bugs and stop the run
            skipped.append({"cell_id": cell_id, "var_id": var_id, "reason": f"analyze_trend: {e}"})
            continue
        rows.append(trend_to_db_row(trend, series, cell_id, var_id))

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(rows, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    if sql_path:
        write_sql(rows, sql_path)
    if update_export:
        _update_export(export_dir, rows)

    return {
        "rows": len(rows),
        "skipped": skipped,
        "significant": sum(r["significant"] for r in rows),
        "by_variable": dict(sorted(Counter(r["var_id"] for r in rows).items())),
    }


# ---------- SQL ----------


def write_sql(rows: list[dict], path: str | Path) -> None:
    """Idempotent upsert into `trends`, in batches, inside one transaction."""
    cols = ", ".join(TREND_COLUMNS)
    updates = ", ".join(f"{c} = excluded.{c}" for c in TREND_COLUMNS[2:])
    parts = ["-- Generated by pipeline/fill_trends.py. Paste into Supabase SQL editor and run.", "begin;"]
    for i in range(0, len(rows), SQL_BATCH):
        values = ",\n".join(
            "(" + ", ".join(_sql_literal(r[c]) for c in TREND_COLUMNS) + ")" for r in rows[i:i + SQL_BATCH]
        )
        parts.append(
            f"insert into trends ({cols}) values\n{values}\n"
            f"on conflict (cell_id, var_id) do update set {updates};"
        )
    parts.append("commit;")
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(parts) + "\n", encoding="utf-8")


def _sql_literal(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError(f"cannot write {value} to SQL")
        return repr(value)
    return "'" + str(value).replace("'", "''") + "'"


# ---------- private ----------


def _update_export(export_dir: str | Path, rows: list[dict]) -> None:
    """Put each trend row inside its cell file (plan B JSON) and rewrite trends.json, like the ETL does."""
    export_dir = Path(export_dir)
    by_cell: dict[int, list[dict]] = {}
    for r in rows:
        by_cell.setdefault(r["cell_id"], []).append(r)
    for cell_id, cell_rows in by_cell.items():
        cell = load_cell(export_dir, cell_id)
        for r in cell_rows:
            cell["vars"][r["var_id"]]["trend"] = r
        (export_dir / "cells" / f"{cell_id}.json").write_text(json.dumps(cell), encoding="utf-8")
    (export_dir / "trends.json").write_text(json.dumps(rows), encoding="utf-8")


def _finite(value: object, name: str) -> float:
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number, got {value!r}")
    return float(value)


def _optional(value: object) -> float | None:
    if value is None or not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    return float(value) if math.isfinite(value) else None


def _per_decade(value: object) -> float | None:
    value = _optional(value)
    return None if value is None else value * 10


def main() -> None:
    ap = argparse.ArgumentParser(description="Fill the Supabase trends table from the ETL JSON export.")
    ap.add_argument("--export-dir", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path, help="JSON file with the trends rows")
    ap.add_argument("--sql", type=Path, help="also write an upsert SQL file for the Supabase SQL editor")
    ap.add_argument("--update-export", action="store_true", help="also write the trends into the export JSON")
    ap.add_argument("--only", nargs="*", help="variable ids to process")
    args = ap.parse_args()

    summary = fill_trends(args.export_dir, args.out, sql_path=args.sql,
                          update_export=args.update_export, var_ids=args.only)
    print(f"Rows: {summary['rows']} ({summary['significant']} significant) {summary['by_variable']}")
    print(f"Skipped: {len(summary['skipped'])}")
    for s in summary["skipped"][:20]:
        print(f"  cell {s['cell_id']} {s['var_id']}: {s['reason']}")


if __name__ == "__main__":
    main()
