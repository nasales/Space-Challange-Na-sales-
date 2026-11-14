"""Data of the Doñana level (src/levels/donana/), computed with the official trend method.

Usage:
    python -m pipeline.level_donana

Reads data/cache/case_donana_SOILM.json and case_donana_PRECIP.json and writes
src/levels/donana/donana_level.json:
- soilm / precip: units, dataset and monthly anomalies (dates + values) for plotting;
- windows: SOILM analyze_trend result for every start / end year ("START-END" key), or
  {"too_short": true} with fewer than 120 valid months;
- full: full-record results of SOILM and PRECIP;
- common: both series on their common period (first and last month present in both).
Helpers: pipeline/level_data.py.
"""

from __future__ import annotations

import json
from pathlib import Path

from pipeline.build_cases import CACHE_DIR, ROOT
from pipeline.level_data import anomalies, clip, load_case, trend_summary, windows, write_json

SOILM_PATH = CACHE_DIR / "case_donana_SOILM.json"
PRECIP_PATH = CACHE_DIR / "case_donana_PRECIP.json"
OUT_PATH = ROOT / "src" / "levels" / "donana" / "donana_level.json"


def _series(case: dict) -> dict:
    return {"units": case["units"], "dataset": case["dataset"], "anomalies": anomalies(case["dates"], case["values"])}


def build(soilm_path: Path = SOILM_PATH, precip_path: Path = PRECIP_PATH) -> dict:
    soilm, precip = load_case(soilm_path), load_case(precip_path)
    first = max(soilm["dates"][0], precip["dates"][0])
    last = min(soilm["dates"][-1], precip["dates"][-1])
    return {
        "case_id": "donana",
        "soilm": _series(soilm),
        "precip": _series(precip),
        "windows": windows(soilm["dates"], soilm["values"]),
        "full": {
            "soilm": trend_summary(soilm["dates"], soilm["values"]),
            "precip": trend_summary(precip["dates"], precip["values"]),
        },
        "common": {
            "first": first,
            "last": last,
            "soilm": trend_summary(*clip(soilm["dates"], soilm["values"], first, last)),
            "precip": trend_summary(*clip(precip["dates"], precip["values"], first, last)),
        },
    }


def write(path: Path = OUT_PATH) -> Path:
    return write_json(build(), path)


def main() -> int:
    out = write()
    data = json.loads(out.read_text(encoding="utf-8"))
    print(f"{out.relative_to(ROOT).as_posix()}: {out.stat().st_size / 1024:.0f} KB")
    print("full", data["full"])
    print("common", data["common"])
    w = data["windows"]
    first, last = data["soilm"]["anomalies"]["dates"][0][:4], data["soilm"]["anomalies"]["dates"][-1][:4]
    full = f"{first}-{last}"
    s0, e0 = int(first), int(last)
    for ds in range(0, 3):
        for de in range(0, 3):
            key = f"{s0 + ds}-{e0 - de}"
            r = w.get(key, {})
            print(key, "too short" if r.get("too_short") else (r["p_value"], r["significant"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
