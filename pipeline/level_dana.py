"""Data of the Valencia DANA level (src/levels/dana/), computed with the official trend method.

Usage:
    python -m pipeline.level_dana

Reads data/cache/case_dana_valencia_PRECIP.json and case_dana_valencia_T2M.json and writes
src/levels/dana/dana_level.json:
- precip / t2m: units, dataset and monthly anomalies (dates + values) for plotting;
- flood: the flood month (October 2024), its monthly value and anomaly, its rank among all months,
  the wettest month of the record and the mean of the other Octobers;
- precip_trend: analyze_trend result with all months and without October 2024 (that month set to
  missing, so the series keeps its length);
- t2m_trend: full-record analyze_trend result, the total change over the record and the extra
  water-holding capacity of the air for that warming (about 7 % per degree, Clausius-Clapeyron).
Helpers: pipeline/level_data.py. No simulation, so no random seed.
"""

from __future__ import annotations

import json
from pathlib import Path

from pipeline.build_cases import CACHE_DIR, ROOT
from pipeline.level_data import anomalies, load_case, r4, trend_summary, write_json
from pipeline.trend import _decimal_year, analyze_trend

PRECIP_PATH = CACHE_DIR / "case_dana_valencia_PRECIP.json"
T2M_PATH = CACHE_DIR / "case_dana_valencia_T2M.json"
OUT_PATH = ROOT / "src" / "levels" / "dana" / "dana_level.json"

FLOOD_MONTH = "2024-10"
CC_RATE = 0.07  # extra water vapour the air can hold per degree C of warming (Clausius-Clapeyron)


def _series(case: dict) -> dict:
    return {"units": case["units"], "dataset": case["dataset"], "anomalies": anomalies(case["dates"], case["values"])}


def flood_facts(dates: list[str], values: list, month: str = FLOOD_MONTH) -> dict:
    """Value of the flood month and how it compares with the rest of the record."""
    i = dates.index(month)
    an = anomalies(dates, values)["values"]
    valid = [(v, d) for d, v in zip(dates, values) if v is not None]
    rank = 1 + sum(v > values[i] for v, _ in valid)
    wettest_value, wettest_month = max(valid)
    others = [v for d, v in zip(dates, values) if v is not None and d[5:7] == month[5:7] and d != month]
    return {
        "month": month,
        "index": i,
        "value": r4(values[i]),
        "anomaly": r4(an[i]),
        "rank": rank,
        "n_months": len(valid),
        "wettest_month": wettest_month,
        "wettest_value": r4(wettest_value),
        "same_month_mean": r4(sum(others) / len(others)),
    }


def without_month(dates: list[str], values: list, month: str = FLOOD_MONTH) -> list:
    """Same series with one month set to missing."""
    return [None if d == month else v for d, v in zip(dates, values)]


def warming(dates: list[str], values: list, cc_rate: float = CC_RATE) -> dict:
    """Total change over the record (Sen slope x record length) and the matching extra water capacity."""
    t = analyze_trend(dates, values)
    span = _decimal_year(int(dates[-1][:4]), int(dates[-1][5:7])) - _decimal_year(int(dates[0][:4]), int(dates[0][5:7]))
    change = t["slope"] * span
    return {
        "first": dates[0],
        "last": dates[-1],
        "years": r4(span),
        "total_change": r4(change),
        "cc_rate": cc_rate,
        "water_capacity_gain": r4((1 + cc_rate) ** change - 1),
    }


def build(precip_path: Path = PRECIP_PATH, t2m_path: Path = T2M_PATH) -> dict:
    precip, t2m = load_case(precip_path), load_case(t2m_path)
    pd, pv = precip["dates"], precip["values"]
    return {
        "case_id": "dana_valencia",
        "precip": _series(precip),
        "t2m": _series(t2m),
        "flood": flood_facts(pd, pv),
        "precip_trend": {
            "with_flood": trend_summary(pd, pv),
            "without_flood": trend_summary(pd, without_month(pd, pv)),
        },
        "t2m_trend": {"full": trend_summary(t2m["dates"], t2m["values"]), **warming(t2m["dates"], t2m["values"])},
    }


def write(path: Path = OUT_PATH) -> Path:
    return write_json(build(), path)


def main() -> int:
    out = write()
    data = json.loads(out.read_text(encoding="utf-8"))
    print(f"{out.relative_to(ROOT).as_posix()}: {out.stat().st_size / 1024:.0f} KB")
    print("flood", data["flood"])
    print("precip_trend", data["precip_trend"])
    print("t2m_trend", data["t2m_trend"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
