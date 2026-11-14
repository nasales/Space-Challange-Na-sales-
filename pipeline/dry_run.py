"""Full-scale dry run of `fill_trends` on a synthetic export with a known truth.

It builds an export with the real layout and series lengths (default 1184 cells x 6 variables),
made of a seasonal cycle + AR(1) noise + a known trend + some gaps, runs `fill_trends` with
Ivan's `analyze_trend` and measures, per variable:
- false-positive rate on series with no trend (should be about 5 %),
- power on moderate and strong trends,
- median relative bias of the slope,
- coverage of the 95 % confidence interval (should be about 95 %),
plus run time and peak memory.

Synthetic precipitation is NOT clipped at 0: clipping changes the true slope of the series
and would make the check compare against the wrong truth.

Usage:
    py -m pipeline.dry_run                       # full size, output in a temporary folder
    py -m pipeline.dry_run --cells 100 --out C:/tmp/dry
"""

from __future__ import annotations

import argparse
import json
import math
import tempfile
import time
import tracemalloc
from pathlib import Path

import numpy as np

from pipeline.fill_trends import fill_trends

END = (2026, 7)  # last month of Perry's real load
COLS = 1440

# var_id: (unit, source, start_month, mean, seasonal amplitude, anomaly sd, AR(1) phi)
VARIABLES = {
    "tair": ("°C", "NASA GLDAS_NOAH025_M v2.1", "2000-01-01", 12.0, 9.0, 1.0, 0.4),
    "wind": ("m/s", "NASA GLDAS_NOAH025_M v2.1", "2000-01-01", 3.0, 0.5, 0.4, 0.2),
    "soilmoist": ("kg/m²", "NASA GLDAS_NOAH025_M v2.1", "2000-01-01", 22.0, 6.0, 3.0, 0.7),
    "evap": ("mm/day", "NASA GLDAS_NOAH025_M v2.1", "2000-01-01", 1.5, 1.2, 0.3, 0.4),
    "precip": ("mm/day", "NASA GPM_3IMERGM v07", "1998-01-01", 1.6, 0.8, 0.9, 0.1),
    "t2m_long": ("°C", "NASA M2TMNXSLV v5.12.4", "1980-01-01", 12.0, 9.0, 1.0, 0.4),
}
# True trend per decade in units of the anomaly sd, and its share of series.
EFFECTS = ((0.0, 0.5), (0.3, 0.25), (1.0, 0.25))
EFFECT_NAMES = {0.0: "none", 0.3: "moderate", 1.0: "strong"}


def months_until_end(start: str) -> int:
    year, month = int(start[:4]), int(start[5:7])
    return (END[0] - year) * 12 + (END[1] - month) + 1


def _ar1(rng: np.random.Generator, n: int, phi: float, sd: float) -> np.ndarray:
    noise = rng.normal(0, sd * math.sqrt(1 - phi**2), n)
    x = np.empty(n)
    x[0] = rng.normal(0, sd)
    for i in range(1, n):
        x[i] = phi * x[i - 1] + noise[i]
    return x


def make_export(root: Path, n_cells: int, seed: int) -> dict:
    """Write a synthetic export like etl_espana.export_json(). Returns {(cell_id, var_id): (effect, slope/yr)}."""
    rng = np.random.default_rng(seed)
    (root / "cells").mkdir(parents=True)
    meta = {v: {"name_en": v, "unit": u, "source": s, "definition_en": "synthetic"}
            for v, (u, s, *_rest) in VARIABLES.items()}
    (root / "variables.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

    truth = {}
    base_row, base_col, width = 520, 690, 56  # a block of cells around Spain
    for k in range(n_cells):
        r, c = divmod(k, width)
        cell_id = (base_row + r) * COLS + base_col + c
        cell = {
            "cell_id": cell_id,
            "lat": round(-90 + 0.25 * (base_row + r + 0.5), 4),
            "lon": round(-180 + 0.25 * (base_col + c + 0.5), 4),
            "region": "peninsula_baleares",
            "vars": {},
        }
        for var_id, (_u, _s, start, mean, amp, sd, phi) in VARIABLES.items():
            n = months_until_end(start)
            effect = float(rng.choice([e for e, _ in EFFECTS], p=[p for _, p in EFFECTS]))
            slope = effect * sd / 10 * float(rng.choice([-1, 1]))  # units per year
            season = amp * np.sin(2 * np.pi * (np.arange(n) % 12) / 12)
            y = mean + season + slope * np.arange(n) / 12 + _ar1(rng, n, phi, sd)
            values: list[float | None] = [round(float(x), 4) for x in y]
            if rng.random() < 0.05:  # 5 % of series lose 2 % of their months
                for i in rng.choice(n, size=max(1, n // 50), replace=False):
                    values[i] = None
            if rng.random() < 0.01:  # 1 % are mostly empty and must be skipped
                values = [x if i < 100 else None for i, x in enumerate(values)]
            cell["vars"][var_id] = {"cell_id": cell_id, "var_id": var_id, "start_month": start,
                                    "values": values, "climatology": [0.0] * 12, "trend": None}
            truth[(cell_id, var_id)] = (effect, slope)
        (root / "cells" / f"{cell_id}.json").write_text(json.dumps(cell), encoding="utf-8")
    return truth


def score(rows: list[dict], truth: dict) -> dict:
    """Per-variable quality metrics of the computed rows against the known truth."""
    report = {}
    for var_id in VARIABLES:
        rs = [r for r in rows if r["var_id"] == var_id]
        by_effect = {e: [r for r in rs if truth[(r["cell_id"], var_id)][0] == e] for e, _ in EFFECTS}
        trended = by_effect[0.3] + by_effect[1.0]

        def rate(group):
            return sum(r["significant"] for r in group) / len(group) if group else float("nan")

        bias = [(r["slope_per_decade"] / 10 - truth[(r["cell_id"], var_id)][1])
                / abs(truth[(r["cell_id"], var_id)][1]) for r in trended]
        with_ci = [r for r in rs if r["slope_ci_low"] is not None and r["slope_ci_high"] is not None]
        covered = [r["slope_ci_low"] / 10 <= truth[(r["cell_id"], var_id)][1] <= r["slope_ci_high"] / 10
                   for r in with_ci]
        report[var_id] = {
            "n": len(rs),
            "false_positive_rate": rate(by_effect[0.0]),
            "power_moderate": rate(by_effect[0.3]),
            "power_strong": rate(by_effect[1.0]),
            "median_bias": float(np.median(bias)) if bias else float("nan"),
            "ci_coverage": float(np.mean(covered)) if covered else float("nan"),
        }
    return report


def run(out_dir: Path, n_cells: int = 1184, seed: int = 2026) -> dict:
    if out_dir.exists() and any(out_dir.iterdir()):
        raise FileExistsError(f"{out_dir} is not empty")
    export = out_dir / "export"
    truth = make_export(export, n_cells, seed)

    tracemalloc.start()
    t0 = time.perf_counter()
    summary = fill_trends(export, out_dir / "trends_rows.json", sql_path=out_dir / "trends_upsert.sql")
    seconds = time.perf_counter() - t0
    peak_mb = tracemalloc.get_traced_memory()[1] / 1e6
    tracemalloc.stop()

    rows = json.loads((out_dir / "trends_rows.json").read_text(encoding="utf-8"))
    return {
        "cells": n_cells,
        "series": len(truth),
        "rows": summary["rows"],
        "skipped": len(summary["skipped"]),
        "seconds": seconds,
        "peak_mb": peak_mb,
        "sql_mb": (out_dir / "trends_upsert.sql").stat().st_size / 1e6,
        "by_variable": score(rows, truth),
    }


def format_report(result: dict) -> str:
    lines = [
        f"Synthetic export: {result['cells']} cells, {result['series']} series",
        f"fill_trends: {result['rows']} rows, {result['skipped']} skipped, "
        f"{result['seconds']:.0f} s ({result['seconds'] / max(result['rows'], 1) * 1000:.0f} ms/series), "
        f"peak {result['peak_mb']:.0f} MB, SQL {result['sql_mb']:.1f} MB",
        "",
        f"{'variable':10} {'n':>5} {'false pos':>9} {'power mod':>9} {'power str':>9} {'bias':>7} {'CI cov':>7}",
    ]
    for var_id, m in result["by_variable"].items():
        lines.append(
            f"{var_id:10} {m['n']:5} {m['false_positive_rate']:9.1%} {m['power_moderate']:9.1%} "
            f"{m['power_strong']:9.1%} {m['median_bias']:7.1%} {m['ci_coverage']:7.1%}"
        )
    lines.append("Expected: false positives about 5 %, CI coverage about 95 %, bias about 0 %.")
    return "\n".join(lines)


def main() -> None:
    ap = argparse.ArgumentParser(description="Dry run of fill_trends on a synthetic export with known truth.")
    ap.add_argument("--cells", type=int, default=1184)
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--out", type=Path, help="empty output folder (default: a temporary folder)")
    args = ap.parse_args()
    out = args.out or Path(tempfile.mkdtemp(prefix="dry_run_"))
    print(f"Output: {out}")
    print(format_report(run(out, args.cells, args.seed)))


if __name__ == "__main__":
    main()
