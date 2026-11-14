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
"""

from __future__ import annotations

import json
from pathlib import Path

from pipeline.build_cases import CACHE_DIR, ROOT
from pipeline.trend import MIN_MONTHS, _anomalies, analyze_trend

CASE_PATH = CACHE_DIR / "case_filomena_madrid_T2M.json"
OUT_PATH = ROOT / "src" / "levels" / "filomena" / "filomena_level.json"
FILOMENA_MONTH = "2021-01"
FIRST_YEAR, LAST_YEAR = 1980, 2026


def _r(x: float) -> float:
    return round(float(x), 4) + 0.0  # + 0.0: no "-0.0" in the JSON


def trend_summary(dates: list[str], values: list) -> dict:
    """analyze_trend result per decade, or {"too_short": True} below MIN_MONTHS valid months."""
    if sum(v is not None for v in values) < MIN_MONTHS:
        return {"too_short": True}
    t = analyze_trend(dates, values)
    return {
        "slope_decade": _r(t["slope"] * 10),
        "ci_decade": [_r(t["slope_ci_low"] * 10), _r(t["slope_ci_high"] * 10)],
        "p_value": _r(t["p_value"]),
        "significant": bool(t["significant"]),
        "n_months": t["n_points"],
    }


def windows(dates: list[str], values: list, first: int = FIRST_YEAR, last: int = LAST_YEAR) -> dict:
    out = {}
    for start in range(first, last + 1):
        for end in range(start, last + 1):
            keep = [i for i, d in enumerate(dates) if start <= int(d[:4]) <= end]
            out[f"{start}-{end}"] = trend_summary([dates[i] for i in keep], [values[i] for i in keep]) \
                if keep else {"too_short": True}
    return out


def build(case_path: Path = CASE_PATH) -> dict:
    case = json.loads(Path(case_path).read_text(encoding="utf-8"))
    dates, values = case["dates"], case["values"]
    months = [(int(d[:4]), int(d[5:7])) for d in dates]
    anomalies = _anomalies(months, values)
    without = [None if d == FILOMENA_MONTH else v for d, v in zip(dates, values)]
    return {
        "case_id": "filomena_madrid",
        "variable": case["variable"],
        "units": case["units"],
        "dataset": case["dataset"],
        "filomena_month": FILOMENA_MONTH,
        "anomalies": {"dates": dates, "values": [None if a is None else _r(a) for a in anomalies]},
        "windows": windows(dates, values),
        "filomena": {"with": trend_summary(dates, values), "without": trend_summary(dates, without)},
    }


def write(path: Path = OUT_PATH, case_path: Path = CASE_PATH) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(build(case_path), separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    return path


def main() -> int:
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
