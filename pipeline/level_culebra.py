"""Data of the Sierra de la Culebra level (src/levels/culebra/), computed with the official trend method.

Usage:
    python -m pipeline.level_culebra

Reads data/cache/case_sierra_culebra_T2M.json and case_sierra_culebra_SOILM.json and writes
src/levels/culebra/culebra_level.json:
- t2m / soilm: units, dataset and monthly anomalies (dates + values) for plotting;
- fire: the fire month (June 2022) and the analyze_trend result of both variables up to the month
  before it (PRE_FIRE_LAST), plus the full-record results;
- noise: the "signal vs noise" experiment of phase 2 (see noise_experiment).
Helpers: pipeline/level_data.py.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scipy import stats

from pipeline.build_cases import CACHE_DIR, ROOT
from pipeline.level_data import anomalies, clip, load_case, r4, trend_summary, write_json
from pipeline.trend import _anomalies, _decimal_year, analyze_trend

T2M_PATH = CACHE_DIR / "case_sierra_culebra_T2M.json"
SOILM_PATH = CACHE_DIR / "case_sierra_culebra_SOILM.json"
OUT_PATH = ROOT / "src" / "levels" / "culebra" / "culebra_level.json"

FIRE_MONTH = "2022-06"
PRE_FIRE_LAST = "2022-05"

NOISE_FACTORS = (0.5, 1.0, 1.5, 2.0, 2.5, 3.0)
RUNS = 20
SEED = 2026


def _series(case: dict) -> dict:
    return {"units": case["units"], "dataset": case["dataset"], "anomalies": anomalies(case["dates"], case["values"])}


def _ar1(rng: np.random.Generator, n: int, rho: float) -> np.ndarray:
    """AR(1) noise with unit variance and lag-1 autocorrelation rho."""
    e = np.empty(n)
    e[0] = rng.normal()
    innov = np.sqrt(1 - rho**2) * rng.normal(size=n)
    for i in range(1, n):
        e[i] = rho * e[i - 1] + innov[i]
    return e


def noise_experiment(dates: list[str], values: list, factors=NOISE_FACTORS, runs: int = RUNS, seed: int = SEED) -> dict:
    """How often analyze_trend detects the real SOILM trend when the noise grows.

    Signal: the Sen line of the real anomalies (slope + intercept). Residual spread: standard deviation
    of the real anomalies around that line; rho: their lag-1 autocorrelation. Each synthetic series is
    signal + factor * spread * AR(1) noise (rho kept, so monthly persistence is as in the real data).
    Run i uses the seed [seed, i] for every factor (same random shape, only scaled), so the levels are
    comparable. Rate = share of runs where analyze_trend calls the trend significant. Example = run 0.
    """
    months = [(int(d[:4]), int(d[5:7])) for d in dates]
    an = _anomalies(months, values)
    keep = [i for i, v in enumerate(an) if v is not None]
    t = np.array([_decimal_year(*months[i]) for i in keep])
    y = np.array([an[i] for i in keep], dtype=float)
    sen = stats.theilslopes(y, t)
    signal = sen.slope * t + sen.intercept
    resid = y - signal
    spread = float(resid.std())
    rho = float(np.corrcoef(resid[:-1], resid[1:])[0, 1])

    noises = [_ar1(np.random.default_rng([seed, i]), len(t), rho) for i in range(runs)]
    kept_dates = [dates[i] for i in keep]
    levels = []
    for f in factors:
        detected = 0
        example = None
        for i, e in enumerate(noises):
            series = signal + f * spread * e
            detected += analyze_trend(kept_dates, series.tolist())["significant"]
            if i == 0:
                example = [round(float(v), 3) + 0.0 for v in series]
        levels.append({"factor": f, "detected": detected, "runs": runs, "rate": r4(detected / runs), "example": example})
    return {
        "seed": seed,
        "runs": runs,
        "slope_decade": r4(sen.slope * 10),
        "intercept": r4(sen.intercept),
        "residual_sd": r4(spread),
        "rho": r4(rho),
        "dates": kept_dates,
        "levels": levels,
    }


def build(t2m_path: Path = T2M_PATH, soilm_path: Path = SOILM_PATH) -> dict:
    t2m, soilm = load_case(t2m_path), load_case(soilm_path)
    return {
        "case_id": "sierra_culebra",
        "t2m": _series(t2m),
        "soilm": _series(soilm),
        "fire": {
            "month": FIRE_MONTH,
            "pre_last": PRE_FIRE_LAST,
            "t2m": trend_summary(*clip(t2m["dates"], t2m["values"], t2m["dates"][0], PRE_FIRE_LAST)),
            "soilm": trend_summary(*clip(soilm["dates"], soilm["values"], soilm["dates"][0], PRE_FIRE_LAST)),
        },
        "full": {
            "t2m": trend_summary(t2m["dates"], t2m["values"]),
            "soilm": trend_summary(soilm["dates"], soilm["values"]),
        },
        "noise": noise_experiment(soilm["dates"], soilm["values"]),
    }


def write(path: Path = OUT_PATH) -> Path:
    return write_json(build(), path)


def main() -> int:
    out = write()
    data = json.loads(out.read_text(encoding="utf-8"))
    print(f"{out.relative_to(ROOT).as_posix()}: {out.stat().st_size / 1024:.0f} KB")
    print("fire", data["fire"])
    print("full", data["full"])
    n = data["noise"]
    print("noise", {k: n[k] for k in ("slope_decade", "residual_sd", "rho")})
    for lv in n["levels"]:
        print(f"  {lv['factor']}x: {lv['detected']}/{lv['runs']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
