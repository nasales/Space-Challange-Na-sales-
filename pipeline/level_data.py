"""Shared helpers for the level data files (src/levels/<case>/<case>_level.json), Ivan.

All official numbers of the levels come from here, through pipeline.trend.analyze_trend. Numbers are
rounded to 4 decimals to keep the JSON small.
"""

from __future__ import annotations

import json
from pathlib import Path

from pipeline.trend import MIN_MONTHS, _anomalies, analyze_trend


def r4(x: float) -> float:
    return round(float(x), 4) + 0.0  # + 0.0: no "-0.0" in the JSON


def load_case(path: str | Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def trend_summary(dates: list[str], values: list) -> dict:
    """analyze_trend result per decade, or {"too_short": True} below MIN_MONTHS valid months."""
    if sum(v is not None for v in values) < MIN_MONTHS:
        return {"too_short": True}
    t = analyze_trend(dates, values)
    return {
        "slope_decade": r4(t["slope"] * 10),
        "ci_decade": [r4(t["slope_ci_low"] * 10), r4(t["slope_ci_high"] * 10)],
        "p_value": r4(t["p_value"]),
        "significant": bool(t["significant"]),
        "n_months": t["n_points"],
    }


def clip(dates: list[str], values: list, first: str, last: str) -> tuple[list[str], list]:
    """Months between first and last ("YYYY-MM", inclusive)."""
    keep = [i for i, d in enumerate(dates) if first <= d <= last]
    return [dates[i] for i in keep], [values[i] for i in keep]


def windows(dates: list[str], values: list, first: int | None = None, last: int | None = None) -> dict:
    """trend_summary for every start year and end year >= start ("START-END" key, January of START to
    December of END, clipped to the data). Years default to the first and last year of the data."""
    first = int(dates[0][:4]) if first is None else first
    last = int(dates[-1][:4]) if last is None else last
    out = {}
    for start in range(first, last + 1):
        for end in range(start, last + 1):
            d, v = clip(dates, values, f"{start}-01", f"{end}-12")
            out[f"{start}-{end}"] = trend_summary(d, v) if d else {"too_short": True}
    return out


def anomalies(dates: list[str], values: list) -> dict:
    """Monthly anomalies for plotting, same deseasonalising as analyze_trend."""
    months = [(int(d[:4]), int(d[5:7])) for d in dates]
    return {"dates": dates, "values": [None if a is None else r4(a) for a in _anomalies(months, values)]}


def write_json(data: dict, path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    return path
