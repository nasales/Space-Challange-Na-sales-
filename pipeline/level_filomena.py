"""Data of the Filomena level (src/levels/filomena/), computed with the official trend method.

Usage:
    python -m pipeline.level_filomena

Reads data/cache/case_filomena_madrid_T2M.json and writes src/levels/filomena/filomena_level.json:
- anomalies: monthly anomalies (dates + values) for plotting, same deseasonalising as analyze_trend;
- windows: for every start year 1980..2026 and end year >= start ("START-END" key, January of START
  to December of END, clipped to the data), the analyze_trend result (slope and 95 % CI per decade,
  p_value, significant), or {"too_short": true} with fewer than 120 valid months;
- filomena: the full series with and without January 2021 (storm Filomena), same fields.
Numbers are rounded to 4 decimals to keep the file small. The level only displays them; it never
recomputes the official statistics (the Sen line drawn in the browser is for display only).
Shared helpers: pipeline/level_data.py.
"""

from __future__ import annotations

from pathlib import Path

from pipeline.build_cases import CACHE_DIR, ROOT
from pipeline.level_data import anomalies, load_case, trend_summary, windows, write_json

__all__ = ["build", "write", "trend_summary", "windows"]

CASE_PATH = CACHE_DIR / "case_filomena_madrid_T2M.json"
OUT_PATH = ROOT / "src" / "levels" / "filomena" / "filomena_level.json"
FILOMENA_MONTH = "2021-01"
FIRST_YEAR, LAST_YEAR = 1980, 2026


def build(case_path: Path = CASE_PATH) -> dict:
    case = load_case(case_path)
    dates, values = case["dates"], case["values"]
    without = [None if d == FILOMENA_MONTH else v for d, v in zip(dates, values)]
    return {
        "case_id": "filomena_madrid",
        "variable": case["variable"],
        "units": case["units"],
        "dataset": case["dataset"],
        "filomena_month": FILOMENA_MONTH,
        "anomalies": anomalies(dates, values),
        "windows": windows(dates, values, FIRST_YEAR, LAST_YEAR),
        "filomena": {"with": trend_summary(dates, values), "without": trend_summary(dates, without)},
    }


def write(path: Path = OUT_PATH, case_path: Path = CASE_PATH) -> Path:
    return write_json(build(case_path), path)


def main() -> int:
    import json

    out = write()
    data = json.loads(out.read_text(encoding="utf-8"))
    print(f"{out.relative_to(ROOT).as_posix()}: {out.stat().st_size / 1024:.0f} KB")
    for key in ("1980-2026", "2018-2021", "1996-2025", "2012-2021"):
        print(key, data["windows"][key])
    print("with Filomena   ", data["filomena"]["with"])
    print("without Filomena", data["filomena"]["without"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
