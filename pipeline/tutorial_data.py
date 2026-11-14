"""Chart data for featured-case tutorials: data/cache/tutorial_<case_id>.json.

Output shape: `TutorialData` / `TutorialSeries` in src/shared/tutorial.ts (rules in
docs/case_tutorials.md). The UI draws every tutorial chart from this file only (offline).

Input: the committed contract files data/cache/case_<id>_<VAR>.json listed in
data/cases_index.json for the case. No network.

Per variable (TutorialSeries):
  monthly      dates and values exactly as in the case file (null = gap).
  climatology  12 means, January..December: mean of the non-null values of each calendar
               month over the whole series. Same baseline as the anomalies of
               pipeline/trend.py (`_anomalies`).
  anomaly      `trend._anomalies` (value minus the climatology of its month; null stays null).
  annual       mean of the raw monthly values of each calendar year with all 12 months
               present and non-null. Incomplete years (partial first/last year, or any gap)
               are left out, so a missing winter or summer never biases an annual mean.
  max          largest non-null monthly value and its date (first one on ties).
  trend        `analyze_trend` on the monthly series: slope_per_year, ci_low, ci_high,
               p_value, significant, test. The slope and p-value are checked against the
               case file (abs. difference <= 1e-9); a mismatch raises an error.

Trend lines (straight, for drawing). t = decimal year as in trend.py, year + (month - 1) / 12.
  intercept     Sen-style: median over non-null months of (anomaly_i - slope * t_i).
  anomaly_line  intercept + slope * t at the first and last date of the monthly series.
  monthly_line  anomaly_line + mean of the 12 climatology values, so the line sits on the
                raw monthly series.
  annual_line   intercept + slope * t + mean of the climatology, at t = year + 5.5 / 12 for
                the first and last annual year. year + 5.5 / 12 is the mean t of the 12
                months of that year, so the line value equals the annual mean of the
                monthly line (the line passes through the "middle" of each annual bar).

Rounding: series values and line ends to 6 significant digits; trend statistics are kept
at full precision (they must match the case file). Output is deterministic: fixed key
order, UTF-8, ensure_ascii=False, newline at the end.

CLI:
  py -m pipeline.tutorial_data --case dana_valencia
  py -m pipeline.tutorial_data --all
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
from pathlib import Path

from pipeline.trend import _anomalies, _decimal_year, _validate, analyze_trend

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "data" / "cases_index.json"
CACHE_DIR = ROOT / "data" / "cache"
TOLERANCE = 1e-9
DIGITS = 6
ANNUAL_T_OFFSET = 5.5 / 12   # mean of (month - 1) / 12 over the 12 months

NAMES = {
    "PRECIP": "Precipitation",
    "T2M": "Air temperature at 2 m",
    "SOILM": "Soil moisture (top 10 cm)",
}


def _round(x: float | None, digits: int = DIGITS) -> float | None:
    """Round to `digits` significant digits (None stays None)."""
    if x is None:
        return None
    if x == 0 or not math.isfinite(x):
        return float(x)
    return round(float(x), digits - 1 - int(math.floor(math.log10(abs(x)))))


def climatology(months: list[tuple[int, int]], values: list[float | None]) -> list[float]:
    """Mean of each calendar month (Jan..Dec) over the non-null values (same as trend.py)."""
    by_month: dict[int, list[float]] = {m: [] for m in range(1, 13)}
    for (_, m), v in zip(months, values):
        if v is not None:
            by_month[m].append(float(v))
    missing = [m for m, vs in by_month.items() if not vs]
    if missing:
        raise ValueError(f"no data for calendar month(s) {missing}; cannot build a climatology")
    return [sum(by_month[m]) / len(by_month[m]) for m in range(1, 13)]


def annual_means(months: list[tuple[int, int]], values: list[float | None]) -> tuple[list[int], list[float]]:
    """Mean of each calendar year that has all 12 months non-null (other years are skipped)."""
    by_year: dict[int, list[float]] = {}
    for (y, _), v in zip(months, values):
        by_year.setdefault(y, [])
        if v is not None:
            by_year[y].append(float(v))
    years = [y for y in sorted(by_year) if len(by_year[y]) == 12]
    return years, [sum(by_year[y]) / 12 for y in years]


def build_series(case: dict) -> dict:
    """One TutorialSeries from a contract case file (already parsed)."""
    dates, values = case["dates"], case["values"]
    months = _validate(dates, values, 0.05)
    var = case["variable"]

    clim = climatology(months, values)
    anomaly = _anomalies(months, values)
    years, annual = annual_means(months, values)

    valid = [i for i, v in enumerate(values) if v is not None]
    i_max = max(valid, key=lambda i: values[i])   # max() keeps the first on ties

    result = analyze_trend(dates, values)
    for key in ("slope", "p_value"):
        if abs(result[key] - case[key]) > TOLERANCE:
            raise ValueError(
                f"{var}: analyze_trend {key} = {result[key]!r} differs from the case file "
                f"({case[key]!r}); rebuild the case file before the tutorial data"
            )
    if result["significant"] != case["significant"] or result["test"] != case["test"]:
        raise ValueError(f"{var}: significant/test differ from the case file")

    slope = result["slope"]
    t = [_decimal_year(*m) for m in months]
    intercept = statistics.median(anomaly[i] - slope * t[i] for i in valid)
    clim_mean = sum(clim) / 12

    def line(tt: float) -> float:
        return intercept + slope * tt

    anomaly_line = [line(t[0]), line(t[-1])]
    monthly_line = [v + clim_mean for v in anomaly_line]
    annual_line = ([line(y + ANNUAL_T_OFFSET) + clim_mean for y in (years[0], years[-1])]
                   if years else [None, None])

    return {
        "variable": var,
        "name": NAMES.get(var, var),
        "units": case["units"],
        "dataset": case["dataset"],
        "monthly": {"dates": list(dates), "values": [_round(v) for v in values]},
        "climatology": [_round(c) for c in clim],
        "anomaly": {"dates": list(dates), "values": [_round(a) for a in anomaly]},
        "annual": {"years": years, "values": [_round(a) for a in annual]},
        "max": {"date": dates[i_max], "value": _round(values[i_max])},
        "trend": {
            "slope_per_year": slope,
            "ci_low": result["slope_ci_low"],
            "ci_high": result["slope_ci_high"],
            "p_value": result["p_value"],
            "significant": result["significant"],
            "test": result["test"],
            "anomaly_line": [_round(v) for v in anomaly_line],
            "monthly_line": [_round(v) for v in monthly_line],
            "annual_line": [_round(v) for v in annual_line],
        },
    }


def build_tutorial(case_id: str, index: list[dict] | None = None, root: Path = ROOT) -> dict:
    """TutorialData for one case of data/cases_index.json."""
    if index is None:
        index = json.loads((root / "data" / "cases_index.json").read_text(encoding="utf-8"))
    entry = next((c for c in index if c["id"] == case_id), None)
    if entry is None:
        raise ValueError(f"case {case_id!r} not in cases_index.json")
    variables = {}
    for rel in entry["files"]:
        case = json.loads((root / rel).read_text(encoding="utf-8"))
        variables[case["variable"]] = build_series(case)
    return {
        "case_id": case_id,
        "place": entry["place"],
        "lat": entry["lat"],
        "lon": entry["lon"],
        "variables": variables,
    }


def write_tutorial(data: dict, out_dir: Path = CACHE_DIR) -> Path:
    """Write data/cache/tutorial_<case_id>.json (deterministic)."""
    path = Path(out_dir) / f"tutorial_{data['case_id']}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--case", help="case id from data/cases_index.json")
    group.add_argument("--all", action="store_true", help="every case in data/cases_index.json")
    parser.add_argument("--out-dir", type=Path, default=CACHE_DIR)
    args = parser.parse_args(argv)

    index = json.loads(INDEX.read_text(encoding="utf-8"))
    ids = [c["id"] for c in index] if args.all else [args.case]
    for case_id in ids:
        path = write_tutorial(build_tutorial(case_id, index), args.out_dir)
        print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
