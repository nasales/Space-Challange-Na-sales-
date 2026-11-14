"""Compare analyze_trend with the database trends in a JSON export (block 5a of pipeline/README.md).

Input: the export directory written by export_json() in archivos_preSupabase/etl_espana.py,
with cells/<cell_id>.json = {cell_id, lat, lon, region, vars: {var_id: {start_month, values,
climatology, trend | null}}}.

Usage:
    python -m pipeline.compare_db <export_dir> [--vars tair precip] [--limit N] [--out report.csv]
                                  [--recompute-db]

--recompute-db ignores the "trend" stored in the export and computes the database side with
trend_stats() of archivos_preSupabase/etl_espana.py on the same exported values. Use it when the
export was made without --with-trends. It is a weaker check: both sides see the same rounded values.
"""

from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import math
import sys
from pathlib import Path

import numpy as np

from pipeline.trend import analyze_trend

# Export values are rounded to 4 decimals while the database computed its trends on the
# unrounded values, so the numbers cannot match to machine precision. A field matches if it is
# within REL_TOL (relative), or within an absolute tolerance per field: near zero a relative
# tolerance is meaningless (a no-trend slope of -0.000421 vs -0.000420 is 0.3 % apart).
REL_TOL = 1e-3
ABS_TOL = 1e-6
ABS_TOL_P = 5e-3     # p_value and mk_tau: rounding can move S by a few units
ABS_TOL_TAU = 1e-3
CI_WIDTH_SHARE = 0.01  # slope and CI bounds: 1 % of the database CI width (scale-free)

# (our key, database key, factor applied to the database value)
NUMERIC_FIELDS = [
    ("slope", "slope_per_decade", 0.1),
    ("slope_ci_low", "slope_ci_low", 0.1),
    ("slope_ci_high", "slope_ci_high", 0.1),
    ("p_value", "p_value", 1.0),
    ("mk_tau", "mk_tau", 1.0),
]
EXACT_FIELDS = ["significant", "direction"]

ETL_PATH = Path(__file__).resolve().parent.parent / "archivos_preSupabase" / "etl_espana.py"

CSV_COLUMNS = (
    ["cell_id", "var_id", "lat", "lon", "status", "max_rel_diff", "error"]
    + [f"{k}_{side}" for k, _, _ in NUMERIC_FIELDS for side in ("ours", "db")]
    + [f"{k}_{side}" for k in EXACT_FIELDS for side in ("ours", "db")]
)


def monthly_dates(start_month: str, n: int) -> list[str]:
    """n consecutive "YYYY-MM" dates starting at start_month ("YYYY-MM" or "YYYY-MM-DD")."""
    year, month = int(start_month[:4]), int(start_month[5:7])
    first = year * 12 + month - 1
    return [f"{k // 12}-{k % 12 + 1:02d}" for k in range(first, first + n)]


def load_etl(path: str | Path = ETL_PATH):
    """Load etl_espana.py by path (it is not a package). Needs xarray, which it imports at top level."""
    spec = importlib.util.spec_from_file_location("etl_espana", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module  # its @dataclass needs the module registered
    spec.loader.exec_module(module)
    return module


def recompute_db_trend(etl, var: dict) -> dict | None:
    """Database-side trend from trend_stats() on the exported values (None if < 120 months)."""
    values = np.array([np.nan if v is None else v for v in var["values"]], dtype=float)
    months = np.array(monthly_dates(var["start_month"], len(values)), dtype="datetime64[M]")
    return etl.trend_stats(values, months)


def _abs_tolerances(row: dict) -> dict:
    """Absolute tolerance per numeric field (see the constants at the top)."""
    low, high = row["slope_ci_low_db"], row["slope_ci_high_db"]
    width = abs(high - low) if low is not None and high is not None else 0.0
    slope_tol = max(CI_WIDTH_SHARE * width, ABS_TOL)
    return {"slope": slope_tol, "slope_ci_low": slope_tol, "slope_ci_high": slope_tol,
            "p_value": ABS_TOL_P, "mk_tau": ABS_TOL_TAU}


def _rel_diff(ours: float, db: float) -> float:
    return abs(ours - db) / max(abs(db), ABS_TOL)


def compare_series(cell: dict, var_id: str, var: dict) -> dict:
    """One CSV row comparing analyze_trend with the database trend of one (cell, var)."""
    db = var["trend"]
    row = {"cell_id": cell["cell_id"], "var_id": var_id, "lat": cell.get("lat"),
           "lon": cell.get("lon"), "error": ""}
    for key, db_key, factor in NUMERIC_FIELDS:
        row[f"{key}_db"] = None if db.get(db_key) is None else db[db_key] * factor
    for key in EXACT_FIELDS:
        row[f"{key}_db"] = db.get(key)

    try:
        ours = analyze_trend(monthly_dates(var["start_month"], len(var["values"])), var["values"])
    except ValueError as exc:
        row.update(status="error", max_rel_diff=None, error=str(exc))
        return row

    abs_tol = _abs_tolerances(row)
    numeric_mismatch = False
    max_rel = 0.0
    for key, _, _ in NUMERIC_FIELDS:
        a, b = ours[key], row[f"{key}_db"]
        row[f"{key}_ours"] = a
        if b is None or not (math.isclose(a, b, rel_tol=REL_TOL, abs_tol=ABS_TOL)
                             or abs(a - b) <= abs_tol[key]):
            numeric_mismatch = True
        if b is not None:
            max_rel = max(max_rel, _rel_diff(a, b))
    exact_mismatch = False
    for key in EXACT_FIELDS:
        row[f"{key}_ours"] = ours[key]
        if ours[key] != row[f"{key}_db"]:
            exact_mismatch = True

    row["max_rel_diff"] = max_rel
    row["status"] = "significance" if exact_mismatch else "numeric" if numeric_mismatch else "ok"
    return row


def compare_export(export_dir: str | Path, variables: list[str] | None = None,
                   limit: int | None = None, progress_every: int = 100, out=sys.stdout,
                   recompute_db: bool = False) -> list[dict]:
    """Compare every (cell, var) with a non-null trend. `limit` caps the number of cells read.

    With recompute_db=True the stored trend is ignored and recomputed with trend_stats().
    """
    etl = load_etl() if recompute_db else None
    files = sorted(Path(export_dir, "cells").glob("*.json"), key=lambda p: int(p.stem))
    if limit is not None:
        files = files[:limit]
    rows = []
    for path in files:
        cell = json.loads(path.read_text(encoding="utf-8"))
        for var_id, var in sorted(cell.get("vars", {}).items()):
            if variables and var_id not in variables:
                continue
            if recompute_db:
                var = {**var, "trend": recompute_db_trend(etl, var)}
            if var.get("trend") is None:
                continue
            rows.append(compare_series(cell, var_id, var))
            if progress_every and len(rows) % progress_every == 0:
                print(f"  compared {len(rows)} series ({path.stem}.json)", file=out, flush=True)
    return rows


def summary(rows: list[dict]) -> str:
    """Short text summary: counts and the 5 worst cells."""
    count = {s: sum(r["status"] == s for r in rows) for s in ("ok", "numeric", "significance", "error")}
    lines = [
        f"Compared: {len(rows)} series",
        f"Numeric mismatches (rel tol {REL_TOL:g}): {count['numeric']}",
        f"Significance/direction mismatches: {count['significance']}",
        f"Errors in analyze_trend (DB has a trend): {count['error']}",
    ]
    rank = {"error": 3, "significance": 2, "numeric": 1, "ok": 0}
    worst = sorted(rows, key=lambda r: (rank[r["status"]], r["max_rel_diff"] or 0.0), reverse=True)
    worst = [r for r in worst if r["status"] != "ok"][:5]
    if worst:
        lines.append("Worst 5:")
        for r in worst:
            detail = r["error"] if r["status"] == "error" else f"max rel diff {r['max_rel_diff']:.3g}"
            lines.append(f"  cell {r['cell_id']} {r['var_id']}: {r['status']}, {detail}")
    return "\n".join(lines)


def write_csv(rows: list[dict], path: str | Path) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for r in rows:
            writer.writerow({k: r.get(k) for k in CSV_COLUMNS})


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Compare analyze_trend with the database trends export.")
    ap.add_argument("export_dir")
    ap.add_argument("--vars", nargs="*", help="variable ids to compare (default: all)")
    ap.add_argument("--limit", type=int, help="maximum number of cells to read")
    ap.add_argument("--out", default="compare_db_report.csv", help="CSV report path")
    ap.add_argument("--recompute-db", action="store_true",
                    help="ignore the exported trend and recompute it with trend_stats() of etl_espana.py")
    args = ap.parse_args(argv)

    rows = compare_export(args.export_dir, args.vars, args.limit, recompute_db=args.recompute_db)
    write_csv(rows, args.out)
    print(summary(rows))
    print(f"Report: {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
