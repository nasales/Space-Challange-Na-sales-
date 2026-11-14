"""Check the trend rows from `fill_trends` before they are uploaded to Supabase.

Usage:
    py -m pipeline.check_trends --export-dir export --rows trends_rows.json [--report report.md] [--no-compare]

Checks:
1. Coverage: every series in the export has a row, or a reason to be missing (< 120 valid months).
2. Consistency (errors): significant == p_value < 0.05, CI contains the slope, finite numbers,
   n_months >= 120, direction follows the database rule, no duplicated rows.
3. Plausible units (warnings): mean_value inside a sane range per variable (e.g. °C, not K).
4. Summary per variable and an independent cross-check: the GLDAS `tair` trend vs the MERRA-2
   `t2m_long` trend recomputed over the same period (two sources of the same quantity).

Exit code 1 if there is any consistency error, so a bad file is not uploaded.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

from pipeline.build_case import ALPHA, get_analyze_trend, stub_analyze_trend
from pipeline.fill_trends import MIN_MONTHS, TREND_COLUMNS
from pipeline.sources.supabase_export import iter_series

# Sane range of the mean value per variable (catches K instead of °C, m/s vs km/h, etc.).
PLAUSIBLE_MEAN = {
    "tair": (-10.0, 30.0),
    "t2m_long": (-10.0, 30.0),
    "wind": (0.0, 20.0),
    "soilmoist": (0.0, 60.0),
    "evap": (0.0, 10.0),
    "precip": (0.0, 20.0),
}


def check(export_dir: str | Path, rows: list[dict], *, compare: bool = True) -> dict:
    errors: list[str] = []
    warnings: list[str] = []

    # ---- 1. coverage ----
    series_index: dict[tuple[int, str], int] = {}  # (cell, var) -> valid months
    tair_period: dict[int, tuple[str, str]] = {}
    t2m_series = {}
    for cell_id, var_id, s in iter_series(export_dir):
        series_index[(cell_id, var_id)] = sum(v is not None for v in s.values)
        if var_id == "tair":
            tair_period[cell_id] = (s.dates[0], s.dates[-1])
        elif var_id == "t2m_long" and compare:
            t2m_series[cell_id] = s

    keys = [(r.get("cell_id"), r.get("var_id")) for r in rows]
    duplicated = [k for k, n in Counter(keys).items() if n > 1]
    if duplicated:
        errors.append(f"{len(duplicated)} duplicated (cell_id, var_id) rows, e.g. {duplicated[:3]}")
    unknown = [k for k in keys if k not in series_index]
    if unknown:
        errors.append(f"{len(unknown)} rows for series not in the export, e.g. {unknown[:3]}")
    have = set(keys)
    missing = [k for k in series_index if k not in have]
    missing_short = [k for k in missing if series_index[k] < MIN_MONTHS]
    missing_other = [k for k in missing if series_index[k] >= MIN_MONTHS]
    if missing_other:
        errors.append(f"{len(missing_other)} series with >= {MIN_MONTHS} valid months have no row, "
                      f"e.g. {missing_other[:3]}")

    # ---- 2. consistency ----
    bad = defaultdict(list)
    for r in rows:
        key = (r.get("cell_id"), r.get("var_id"))
        cols = [c for c in TREND_COLUMNS if c not in r]
        if cols:
            bad["missing columns"].append(key)
            continue
        numbers = ("slope_per_decade", "p_value", "mean_value", "slope_ci_low", "slope_ci_high", "mk_tau")
        if any(r[c] is not None and not _finite(r[c]) for c in numbers) or not _finite(r["slope_per_decade"]):
            bad["NaN, infinite or missing slope"].append(key)
            continue
        if not _finite(r["p_value"]):
            bad["p_value missing or not a number"].append(key)
        else:
            if not isinstance(r["significant"], bool) or r["significant"] != (r["p_value"] < ALPHA):
                bad["significant does not match p_value < 0.05"].append(key)
            if not 0 <= r["p_value"] <= 1:
                bad["p_value outside 0-1"].append(key)
        if not isinstance(r["n_months"], int) or isinstance(r["n_months"], bool) or r["n_months"] < MIN_MONTHS:
            bad[f"n_months missing or < {MIN_MONTHS}"].append(key)
        lo, hi, slope = r["slope_ci_low"], r["slope_ci_high"], r["slope_per_decade"]
        if lo is not None and hi is not None and not (lo - 1e-9 <= slope <= hi + 1e-9):
            bad["slope outside its confidence interval"].append(key)
        expected = ("increasing" if slope > 0 else "decreasing") if r["significant"] is True else "no trend"
        if r["direction"] != expected:
            bad["direction does not follow the database rule"].append(key)
    for problem, ks in bad.items():
        errors.append(f"{len(ks)} rows: {problem}, e.g. {ks[:3]}")

    # ---- 3. plausible units + 4. summary ----
    summary = {}
    by_var = defaultdict(list)
    for r in rows:
        if _finite(r.get("slope_per_decade")):
            by_var[r["var_id"]].append(r)
    for var_id in sorted(set(v for _, v in series_index)):
        rs = by_var.get(var_id, [])
        if not rs:
            summary[var_id] = {"rows": 0}
            continue
        slopes = np.array([r["slope_per_decade"] for r in rs])
        means = np.array([r["mean_value"] for r in rs if r["mean_value"] is not None])
        sig = [r for r in rs if r["significant"]]
        summary[var_id] = {
            "rows": len(rs),
            "skipped_short": sum(1 for k in missing_short if k[1] == var_id),
            "significant": len(sig) / len(rs),
            "increasing": sum(r["direction"] == "increasing" for r in rs) / len(rs),
            "decreasing": sum(r["direction"] == "decreasing" for r in rs) / len(rs),
            "slope_p5": float(np.percentile(slopes, 5)),
            "slope_median": float(np.median(slopes)),
            "slope_p95": float(np.percentile(slopes, 95)),
            "mean_median": float(np.median(means)) if len(means) else None,
        }
        if var_id in PLAUSIBLE_MEAN and len(means):
            lo, hi = PLAUSIBLE_MEAN[var_id]
            out = int(np.sum((means < lo) | (means > hi)))
            if out:
                warnings.append(f"{var_id}: {out} cells with mean_value outside [{lo}, {hi}] "
                                f"(median {np.median(means):.2f}); check the units")

    cross = _compare_temperatures(by_var, t2m_series, tair_period) if compare else None
    if cross and cross["sign_agreement"] < 0.6:
        warnings.append(f"tair and t2m_long agree in sign in only {cross['sign_agreement']:.0%} of cells")

    return {"errors": errors, "warnings": warnings, "series": len(series_index), "rows": len(rows),
            "missing_short": len(missing_short), "summary": summary, "temperature_cross_check": cross}


def _compare_temperatures(by_var: dict, t2m_series: dict, tair_period: dict) -> dict | None:
    """GLDAS tair trend vs MERRA-2 t2m_long trend recomputed over the tair period, per cell."""
    analyze = get_analyze_trend()
    if analyze is stub_analyze_trend or not t2m_series:
        return None
    tair = {r["cell_id"]: r for r in by_var.get("tair", [])}
    pairs = []
    for cell_id, row in tair.items():
        s = t2m_series.get(cell_id)
        if s is None or cell_id not in tair_period:
            continue
        start, end = tair_period[cell_id]
        idx = [i for i, d in enumerate(s.dates) if start <= d <= end]
        if not idx:
            continue
        try:
            t2m = analyze([s.dates[i] for i in idx], [s.values[i] for i in idx])
        except ValueError:
            continue
        pairs.append((row["slope_per_decade"], t2m["slope"] * 10, row["significant"], t2m["significant"]))
    if len(pairs) < 3:
        return None
    a = np.array([p[0] for p in pairs])
    b = np.array([p[1] for p in pairs])
    return {
        "cells": len(pairs),
        "tair_median_per_decade": float(np.median(a)),
        "t2m_long_median_per_decade": float(np.median(b)),
        "sign_agreement": float(np.mean(np.sign(a) == np.sign(b))),
        "significance_agreement": float(np.mean([p[2] == p[3] for p in pairs])),
        "correlation": float(np.corrcoef(a, b)[0, 1]) if np.std(a) > 0 and np.std(b) > 0 else None,
    }


def _finite(x: object) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def format_report(result: dict) -> str:
    lines = [f"# Trend check", "",
             f"Series in export: {result['series']}. Rows: {result['rows']}. "
             f"Skipped (< {MIN_MONTHS} valid months): {result['missing_short']}.", ""]
    lines.append(f"## Errors ({len(result['errors'])})")
    lines += [f"- {e}" for e in result["errors"]] or ["- none"]
    lines.append(f"\n## Warnings ({len(result['warnings'])})")
    lines += [f"- {w}" for w in result["warnings"]] or ["- none"]
    lines += ["", "## Summary per variable (slopes per decade)", "",
              "| variable | rows | skipped | significant | increasing | decreasing | slope p5 | median | p95 | mean value |",
              "|---|---|---|---|---|---|---|---|---|---|"]
    for var_id, m in result["summary"].items():
        if not m.get("rows"):
            lines.append(f"| {var_id} | 0 | | | | | | | | |")
            continue
        mean = f"{m['mean_median']:.2f}" if m["mean_median"] is not None else ""
        lines.append(
            f"| {var_id} | {m['rows']} | {m['skipped_short']} | {m['significant']:.0%} | {m['increasing']:.0%} | "
            f"{m['decreasing']:.0%} | {m['slope_p5']:.3g} | {m['slope_median']:.3g} | {m['slope_p95']:.3g} | {mean} |"
        )
    lines.append("\nWith no real trend anywhere, about 5 % of cells would be significant by chance.")
    cross = result["temperature_cross_check"]
    lines.append("\n## Cross-check: GLDAS tair vs MERRA-2 t2m_long over the same period")
    if cross:
        corr = f"{cross['correlation']:.2f}" if cross["correlation"] is not None else "n/a"
        lines += [
            f"- Cells compared: {cross['cells']}",
            f"- Median trend per decade: tair {cross['tair_median_per_decade']:.3f}, "
            f"t2m_long {cross['t2m_long_median_per_decade']:.3f}",
            f"- Same sign: {cross['sign_agreement']:.0%}; same significance: {cross['significance_agreement']:.0%}; "
            f"correlation across cells: {corr}",
        ]
    else:
        lines.append("- not run (no analyze_trend, --no-compare, or too few cells)")
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description="Check fill_trends rows before uploading them to Supabase.")
    ap.add_argument("--export-dir", required=True, type=Path)
    ap.add_argument("--rows", required=True, type=Path, help="trends_rows.json from fill_trends")
    ap.add_argument("--report", type=Path, help="also write the report as Markdown")
    ap.add_argument("--no-compare", action="store_true", help="skip the tair vs t2m_long cross-check")
    args = ap.parse_args()

    rows = json.loads(args.rows.read_text(encoding="utf-8"))
    result = check(args.export_dir, rows, compare=not args.no_compare)
    report = format_report(result)
    print(report)
    if args.report:
        args.report.write_text(report + "\n", encoding="utf-8")
    sys.exit(1 if result["errors"] else 0)


if __name__ == "__main__":
    main()
