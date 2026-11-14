"""Data of the Córdoba heat level (src/levels/cordoba/), computed with the official trend method.

Usage:
    python -m pipeline.level_cordoba

Reads data/cache/case_cordoba_heat_T2M.json and writes src/levels/cordoba/cordoba_level.json:
- t2m: units, dataset and monthly anomalies (dates + values) for plotting;
- full: full-record analyze_trend result (per decade);
- decades: label, first and last year of the four decades (the 2020s are partial);
- records: indices of the record warm and record cold months, their counts per decade and the
  decade(s) with the most warm records (a tie gives several);
- simulation: expected record counts per decade in the same series without its trend, and the
  simulated distribution of the total number of warm records (see simulate_records).

Records (count_records): a month is a record warm (cold) month when its value is strictly above
(below) the values of the same calendar month in every earlier year. Records are counted from
FIRST_RECORD_YEAR on; the earlier years (1980-1989) only build the history, because with one or two
years of history almost every month would be a "record". Raw values and anomalies give the same
records (an anomaly is the value minus a constant per calendar month).

Simulation (simulate_records), "the same series without a trend":
1. Detrend: anomalies (same deseasonalising as analyze_trend) minus the official Sen slope times
   time. What is left is the year-to-year noise of Córdoba around its trend line.
2. Shuffle whole years: one random permutation of the years is applied to all twelve calendar
   months, so each residual keeps its calendar month and the months of one year stay together (a hot
   summer stays a hot summer, July and August stay correlated). A shuffled series has no trend by
   design and the same noise as the real one.
3. Count the records of the shuffled series exactly as for the real one (records from the same
   year positions on). Repeat N_RUNS times with a fixed SEED.
Without a trend every order of the years is equally likely, so the k-th year is a record for its
calendar month with probability 1/k: the expected counts fall roughly like 1/n, and the warm and
cold expected counts are about equal. The last year is partial (January to September); in a
shuffle its three missing months land in a random year and are skipped there (no record that
month, the history is unchanged).

The verdict of phase 2 ("are the warm records more than chance?") is yes when the observed total of
warm records is above the 95th percentile of the simulated totals. This is a teaching picture, not
the official test: the official numbers are the analyze_trend ones in "full".
Helpers: pipeline/level_data.py.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from pipeline.build_cases import CACHE_DIR, ROOT
from pipeline.level_data import anomalies, load_case, r4, trend_summary, write_json
from pipeline.trend import _anomalies, _decimal_year, analyze_trend

T2M_PATH = CACHE_DIR / "case_cordoba_heat_T2M.json"
OUT_PATH = ROOT / "src" / "levels" / "cordoba" / "cordoba_level.json"

FIRST_RECORD_YEAR = 1990
DECADES = (1990, 2000, 2010, 2020)
N_RUNS = 2000
SEED = 2000
PERCENTILE = 95


def count_records(dates: list[str], values: list, first_year: int = FIRST_RECORD_YEAR) -> dict:
    """Indices of the record warm and record cold months (strictly above / below every earlier year
    of the same calendar month), counted from first_year on. None values are skipped."""
    best: dict[int, float] = {}
    worst: dict[int, float] = {}
    warm, cold = [], []
    for i, (d, v) in enumerate(zip(dates, values)):
        if v is None:
            continue
        year, month = int(d[:4]), int(d[5:7])
        v = float(v)
        if month in best and year >= first_year:
            if v > best[month]:
                warm.append(i)
            if v < worst[month]:
                cold.append(i)
        best[month] = max(best.get(month, v), v)
        worst[month] = min(worst.get(month, v), v)
    return {"warm": warm, "cold": cold}


def decade_of(year: int) -> int:
    return year // 10 * 10


def per_decade(dates: list[str], indices: list[int], decades: tuple[int, ...] = DECADES) -> list[int]:
    """Number of the given months in each decade."""
    counts = {dec: 0 for dec in decades}
    for i in indices:
        dec = decade_of(int(dates[i][:4]))
        if dec in counts:
            counts[dec] += 1
    return [counts[dec] for dec in decades]


def detrended_residuals(dates: list[str], values: list, slope: float) -> list[float | None]:
    """Anomalies minus slope (units per year) times decimal year."""
    months = [(int(d[:4]), int(d[5:7])) for d in dates]
    anom = _anomalies(months, values)
    return [None if a is None else a - slope * _decimal_year(y, m) for (y, m), a in zip(months, anom)]


def simulate_records(dates: list[str], values: list, slope: float, n: int = N_RUNS, seed: int = SEED) -> dict:
    """Warm and cold record counts per decade (arrays n x decades) of n detrended, year-shuffled
    copies of the series (method in the module docstring)."""
    resid = detrended_residuals(dates, values, slope)
    years = sorted({int(d[:4]) for d in dates})
    grid = np.full((len(years), 12), np.nan)
    for d, r in zip(dates, resid):
        if r is not None:
            grid[years.index(int(d[:4])), int(d[5:7]) - 1] = r
    sim_dates = [f"{y}-{m:02d}" for y in years for m in range(1, 13)]
    rng = np.random.default_rng(seed)
    warm = np.zeros((n, len(DECADES)), dtype=int)
    cold = np.zeros((n, len(DECADES)), dtype=int)
    for k in range(n):
        shuffled = grid[rng.permutation(len(years))].ravel()
        vals = [None if np.isnan(x) else float(x) for x in shuffled]
        rec = count_records(sim_dates, vals)
        warm[k] = per_decade(sim_dates, rec["warm"])
        cold[k] = per_decade(sim_dates, rec["cold"])
    return {"warm": warm, "cold": cold}


def _decade_info(dates: list[str]) -> list[dict]:
    last = dates[-1]
    out = []
    for dec in DECADES:
        end = min(dec + 9, int(last[:4]))
        partial = end < dec + 9
        out.append({"label": f"{dec}s", "start": dec, "end": end, "partial": partial, "last_month": last if partial else None})
    return out


def build(path: Path = T2M_PATH, n: int = N_RUNS, seed: int = SEED) -> dict:
    case = load_case(path)
    dates, values = case["dates"], case["values"]
    slope = analyze_trend(dates, values)["slope"]
    rec = count_records(dates, values)
    warm_obs, cold_obs = per_decade(dates, rec["warm"]), per_decade(dates, rec["cold"])
    sim = simulate_records(dates, values, slope, n, seed)
    totals = sim["warm"].sum(axis=1)
    p95 = float(np.percentile(totals, PERCENTILE))
    observed = int(sum(warm_obs))
    top = max(warm_obs)
    return {
        "case_id": "cordoba_heat",
        "t2m": {"units": case["units"], "dataset": case["dataset"], "anomalies": anomalies(dates, values)},
        "full": trend_summary(dates, values),
        "decades": _decade_info(dates),
        "records": {
            "first_year": FIRST_RECORD_YEAR,
            "warm_idx": rec["warm"],
            "cold_idx": rec["cold"],
            "warm": warm_obs,
            "cold": cold_obs,
            # every decade tied for the most warm records (all of them count as a right answer)
            "most_warm_decades": [dec for dec, c in zip(DECADES, warm_obs) if c == top],
        },
        "simulation": {
            "seed": seed,
            "n": n,
            "slope_removed_decade": r4(slope * 10),
            "expected_warm": [r4(x) for x in sim["warm"].mean(axis=0)],
            "expected_cold": [r4(x) for x in sim["cold"].mean(axis=0)],
            "total_warm_mean": r4(totals.mean()),
            "total_warm_p95": r4(p95),
            "total_warm_max": int(totals.max()),
            "share_at_least_observed": r4(float((totals >= observed).mean())),
            "observed_total_warm": observed,
            "observed_total_cold": int(sum(cold_obs)),
            "more_than_chance": bool(observed > p95),
        },
    }


def write(path: Path = OUT_PATH) -> Path:
    return write_json(build(), path)


def main() -> int:
    out = write()
    data = json.loads(out.read_text(encoding="utf-8"))
    print(f"{out.relative_to(ROOT).as_posix()}: {out.stat().st_size / 1024:.0f} KB")
    print("full", data["full"])
    r, s = data["records"], data["simulation"]
    print("decades", [d["label"] for d in data["decades"]])
    print("observed warm", r["warm"], "cold", r["cold"], "most warm", r["most_warm_decades"])
    print("expected warm", s["expected_warm"], "cold", s["expected_cold"])
    print({k: v for k, v in s.items() if not k.startswith("expected")})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
