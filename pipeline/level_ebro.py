"""Data of the Ebro Delta level (src/levels/ebro/), computed with the official trend method.

Usage:
    python -m pipeline.level_ebro

Reads data/cache/case_ebro_delta_T2M.json and case_ebro_delta_PRECIP.json and writes
src/levels/ebro/ebro_level.json:
- t2m: units, dataset, raw monthly values (dates + values), the typical year (12 monthly means, the
  same climatology that analyze_trend removes, see pipeline/trend.py _anomalies) and the monthly
  anomalies (raw minus typical year);
- full: analyze_trend result of T2M and PRECIP over their full records;
- total: T2M rate turned into a total change over the record (slope x decades spanned, as
  trend.py total_change) with the 95 % range (CI low x decades to CI high x decades);
- precip: units, dataset and period of the precipitation record (only one line in the level).
Helpers: pipeline/level_data.py.
"""

from __future__ import annotations

import json
from pathlib import Path

from pipeline.build_cases import CACHE_DIR, ROOT
from pipeline.level_data import anomalies, load_case, r4, trend_summary, write_json
from pipeline.trend import _decimal_year, analyze_trend

T2M_PATH = CACHE_DIR / "case_ebro_delta_T2M.json"
PRECIP_PATH = CACHE_DIR / "case_ebro_delta_PRECIP.json"
OUT_PATH = ROOT / "src" / "levels" / "ebro" / "ebro_level.json"


def climatology(dates: list[str], values: list) -> list[float]:
    """Mean of each calendar month (January first) over the whole series, as trend.py _anomalies."""
    by_month: dict[int, list[float]] = {}
    for d, v in zip(dates, values):
        if v is not None:
            by_month.setdefault(int(d[5:7]), []).append(float(v))
    return [r4(sum(by_month[m]) / len(by_month[m])) for m in range(1, 13)]


def total_change(dates: list[str], values: list) -> dict:
    """Total change over the record: slope (and its 95 % range) x decades spanned by the valid months."""
    t = analyze_trend(dates, values)
    valid = [d for d, v in zip(dates, values) if v is not None]
    first, last = valid[0], valid[-1]
    years = _decimal_year(int(last[:4]), int(last[5:7])) - _decimal_year(int(first[:4]), int(first[5:7]))
    decades = years / 10
    return {
        "first": first,
        "last": last,
        "decades": r4(decades),
        "change": r4(t["slope"] * 10 * decades),
        "ci": [r4(t["slope_ci_low"] * 10 * decades), r4(t["slope_ci_high"] * 10 * decades)],
    }


def build(t2m_path: Path = T2M_PATH, precip_path: Path = PRECIP_PATH) -> dict:
    t2m, precip = load_case(t2m_path), load_case(precip_path)
    clim = climatology(t2m["dates"], t2m["values"])
    return {
        "case_id": "ebro_delta",
        "t2m": {
            "units": t2m["units"],
            "dataset": t2m["dataset"],
            "raw": {"dates": t2m["dates"], "values": [None if v is None else r4(v) for v in t2m["values"]]},
            "typical_year": clim,
            "anomalies": anomalies(t2m["dates"], t2m["values"]),
        },
        "full": {
            "t2m": trend_summary(t2m["dates"], t2m["values"]),
            "precip": trend_summary(precip["dates"], precip["values"]),
        },
        "total": total_change(t2m["dates"], t2m["values"]),
        "precip": {
            "units": precip["units"],
            "dataset": precip["dataset"],
            "first": precip["dates"][0],
            "last": precip["dates"][-1],
        },
    }


def write(path: Path = OUT_PATH) -> Path:
    return write_json(build(), path)


def main() -> int:
    out = write()
    data = json.loads(out.read_text(encoding="utf-8"))
    print(f"{out.relative_to(ROOT).as_posix()}: {out.stat().st_size / 1024:.0f} KB")
    print("typical year", data["t2m"]["typical_year"])
    print("full", data["full"])
    print("total", data["total"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
