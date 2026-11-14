"""Data of the Almeria-Murcia level (src/levels/almeria/), computed with the official trend method.

Usage:
    python -m pipeline.level_almeria

Reads data/cache/case_almeria_murcia_SOILM.json and case_almeria_murcia_PRECIP.json and writes
src/levels/almeria/almeria_level.json:
- soilm: units, dataset and monthly anomalies (dates + values) for plotting;
- full: full-record analyze_trend results of SOILM and PRECIP (per decade);
- shuffles: for SOILM and PRECIP, the Sen slope (per decade) of N_SHUFFLES random shuffles of the
  years (fixed SEED), the real slope, the share of shuffles at least as steep as the real slope
  (in absolute value) and whether the real slope stands out (share < 0.05).

Why whole years are shuffled, not single months: monthly soil moisture has a long memory (one wet
month is followed by more wet months). Shuffling single months destroys that memory, so chance looks
much calmer than it really is and even a non-significant slope seems to stand out (about 3 % of
month shuffles are as steep as the real SOILM slope, against p = 0.15 from the official
pre-whitened Mann-Kendall test). Shuffling whole years keeps the months of each year together, so
the within-year memory stays and the shuffles are a fairer picture of chance. Each anomaly keeps its
calendar month; only its year changes. This is a teaching picture, not the official test: the
official numbers are always the analyze_trend ones in "full".
Helpers: pipeline/level_data.py.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scipy import stats

from pipeline.build_cases import CACHE_DIR, ROOT
from pipeline.level_data import anomalies, load_case, r4, trend_summary, write_json
from pipeline.trend import _anomalies, _decimal_year

SOILM_PATH = CACHE_DIR / "case_almeria_murcia_SOILM.json"
PRECIP_PATH = CACHE_DIR / "case_almeria_murcia_PRECIP.json"
OUT_PATH = ROOT / "src" / "levels" / "almeria" / "almeria_level.json"
SEED = 2026
N_SHUFFLES = 200
ALPHA = 0.05


def _points(dates: list[str], values: list) -> tuple[list[tuple[int, int]], np.ndarray]:
    """(year, month) and anomaly of every valid month, deseasonalised as analyze_trend."""
    months = [(int(d[:4]), int(d[5:7])) for d in dates]
    anom = _anomalies(months, values)
    keep = [i for i, a in enumerate(anom) if a is not None]
    return [months[i] for i in keep], np.array([anom[i] for i in keep], dtype=float)


def year_shuffle_slopes(dates: list[str], values: list, n: int = N_SHUFFLES, seed: int = SEED) -> list[float]:
    """Sen slopes (units per year) of the anomalies after n random shuffles of the years."""
    months, y = _points(dates, values)
    years = sorted({yr for yr, _ in months})
    rng = np.random.default_rng(seed)
    out = []
    for _ in range(n):
        new_year = dict(zip(years, (years[j] for j in rng.permutation(len(years)))))
        t = np.array([_decimal_year(new_year[yr], m) for yr, m in months])
        out.append(float(stats.theilslopes(y, t).slope))
    return out


def real_slope(dates: list[str], values: list) -> float:
    """Sen slope (units per year) of the anomalies in their real order, same as analyze_trend."""
    months, y = _points(dates, values)
    t = np.array([_decimal_year(yr, m) for yr, m in months])
    return float(stats.theilslopes(y, t).slope)


def shuffle_summary(dates: list[str], values: list, n: int = N_SHUFFLES, seed: int = SEED) -> dict:
    real = real_slope(dates, values)
    slopes = year_shuffle_slopes(dates, values, n, seed)
    share = sum(abs(s) >= abs(real) for s in slopes) / len(slopes)
    return {
        "real_decade": r4(real * 10),
        "slopes_decade": [r4(s * 10) for s in slopes],
        "share_as_steep": r4(share),
        "stands_out": bool(share < ALPHA),
    }


def build(soilm_path: Path = SOILM_PATH, precip_path: Path = PRECIP_PATH) -> dict:
    soilm, precip = load_case(soilm_path), load_case(precip_path)
    return {
        "case_id": "almeria_murcia",
        "soilm": {
            "units": soilm["units"],
            "dataset": soilm["dataset"],
            "anomalies": anomalies(soilm["dates"], soilm["values"]),
        },
        "precip": {"units": precip["units"], "dataset": precip["dataset"]},
        "full": {
            "soilm": trend_summary(soilm["dates"], soilm["values"]),
            "precip": trend_summary(precip["dates"], precip["values"]),
        },
        "shuffles": {
            "seed": SEED,
            "n": N_SHUFFLES,
            "soilm": shuffle_summary(soilm["dates"], soilm["values"]),
            "precip": shuffle_summary(precip["dates"], precip["values"]),
        },
    }


def write(path: Path = OUT_PATH) -> Path:
    return write_json(build(), path)


def main() -> int:
    out = write()
    data = json.loads(out.read_text(encoding="utf-8"))
    print(f"{out.relative_to(ROOT).as_posix()}: {out.stat().st_size / 1024:.0f} KB")
    print("full", data["full"])
    for var in ("soilm", "precip"):
        s = data["shuffles"][var]
        lo, hi = min(s["slopes_decade"]), max(s["slopes_decade"])
        print(var, "real", s["real_decade"], "shuffles", lo, "to", hi, "share", s["share_as_steep"], "stands out", s["stands_out"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
