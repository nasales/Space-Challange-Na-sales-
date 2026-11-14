"""Data of the Galicia fires level (src/levels/galicia/), computed with the official trend method.

Usage:
    python -m pipeline.level_galicia

Reads data/cache/case_galicia_fires_T2M.json, case_galicia_fires_SOILM.json and
case_sierra_culebra_SOILM.json and writes src/levels/galicia/galicia_level.json:
- galicia_soilm / culebra_soilm / galicia_t2m: units, dataset and monthly anomalies for plotting;
- trends: analyze_trend result (per decade) of the three series over their full record;
- twins: the phase 1 answer (which forest has a significant drying trend), decided from the trends;
- why: the phase 2 comparison (slope, residual spread around the Sen line, valid months, lag-1
  autocorrelation) and the answer decided from the data (see why_comparison);
- warming: the phase 3 answer for Galicia's air temperature.
No simulation, so no random seed. Helpers: pipeline/level_data.py.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scipy import stats

from pipeline.build_cases import CACHE_DIR, ROOT
from pipeline.level_data import anomalies, load_case, r4, trend_summary, write_json
from pipeline.trend import _anomalies, _decimal_year

GALICIA_T2M_PATH = CACHE_DIR / "case_galicia_fires_T2M.json"
GALICIA_SOILM_PATH = CACHE_DIR / "case_galicia_fires_SOILM.json"
CULEBRA_SOILM_PATH = CACHE_DIR / "case_sierra_culebra_SOILM.json"
OUT_PATH = ROOT / "src" / "levels" / "galicia" / "galicia_level.json"


def _series(case: dict) -> dict:
    return {"units": case["units"], "dataset": case["dataset"], "anomalies": anomalies(case["dates"], case["values"])}


def noise_stats(dates: list[str], values: list) -> dict:
    """Year-to-year noise of a series: standard deviation of the monthly anomalies (same deseasonalising
    as analyze_trend) around their Sen line, their lag-1 autocorrelation and the number of valid months."""
    months = [(int(d[:4]), int(d[5:7])) for d in dates]
    an = _anomalies(months, values)
    keep = [i for i, v in enumerate(an) if v is not None]
    t = np.array([_decimal_year(*months[i]) for i in keep])
    y = np.array([an[i] for i in keep], dtype=float)
    sen = stats.theilslopes(y, t)
    resid = y - (sen.slope * t + sen.intercept)
    return {
        "residual_sd": r4(resid.std()),
        "rho": r4(np.corrcoef(resid[:-1], resid[1:])[0, 1]),
        "n_months": len(keep),
    }


def twins_answer(galicia: dict, culebra: dict) -> str:
    """Which forest shows a significant drying (negative) soil-moisture trend: galicia/culebra/both/neither."""

    def dry(r: dict) -> bool:
        return not r.get("too_short") and r["significant"] and r["slope_decade"] < 0

    g, c = dry(galicia), dry(culebra)
    return "both" if g and c else "galicia" if g else "culebra" if c else "neither"


def why_comparison(galicia: dict, culebra: dict, g_noise: dict, c_noise: dict) -> dict:
    """Why Galicia's soil trend is weaker evidence than Culebra's: smaller slope, more noise or fewer data.

    The evidence of a trend grows with the slope and the number of months and falls with the noise. Each
    reason gets a factor = Galicia's value relative to Culebra's, oriented so that below 1 means "this
    hurts Galicia's evidence": slope = |slope_G| / |slope_C|, noise = sd_C / sd_G, data = n_G / n_C.
    The answer is the reason with the smallest factor (the biggest handicap)."""
    factors = {
        "slope": r4(abs(galicia["slope_decade"]) / abs(culebra["slope_decade"])),
        "noise": r4(c_noise["residual_sd"] / g_noise["residual_sd"]),
        "data": r4(g_noise["n_months"] / c_noise["n_months"]),
    }
    answer = min(factors, key=lambda k: factors[k])
    return {"galicia": g_noise, "culebra": c_noise, "factors": factors, "answer": answer}


def warming_answer(t2m: dict) -> str:
    """Phase 3: is the air warming significantly (yes), warming but not significantly (weak), or not (no)?"""
    if t2m.get("too_short") or t2m["slope_decade"] <= 0:
        return "no"
    return "yes" if t2m["significant"] else "weak"


def build(
    galicia_t2m_path: Path = GALICIA_T2M_PATH,
    galicia_soilm_path: Path = GALICIA_SOILM_PATH,
    culebra_soilm_path: Path = CULEBRA_SOILM_PATH,
) -> dict:
    g_t2m, g_soil, c_soil = load_case(galicia_t2m_path), load_case(galicia_soilm_path), load_case(culebra_soilm_path)
    trends = {
        "galicia_soilm": trend_summary(g_soil["dates"], g_soil["values"]),
        "culebra_soilm": trend_summary(c_soil["dates"], c_soil["values"]),
        "galicia_t2m": trend_summary(g_t2m["dates"], g_t2m["values"]),
    }
    return {
        "case_id": "galicia_fires",
        "compare_case_id": "sierra_culebra",
        "galicia_soilm": _series(g_soil),
        "culebra_soilm": _series(c_soil),
        "galicia_t2m": _series(g_t2m),
        "trends": trends,
        "twins": {"answer": twins_answer(trends["galicia_soilm"], trends["culebra_soilm"])},
        "why": why_comparison(
            trends["galicia_soilm"],
            trends["culebra_soilm"],
            noise_stats(g_soil["dates"], g_soil["values"]),
            noise_stats(c_soil["dates"], c_soil["values"]),
        ),
        "warming": {"answer": warming_answer(trends["galicia_t2m"])},
    }


def write(path: Path = OUT_PATH) -> Path:
    return write_json(build(), path)


def main() -> int:
    out = write()
    data = json.loads(out.read_text(encoding="utf-8"))
    print(f"{out.relative_to(ROOT).as_posix()}: {out.stat().st_size / 1024:.0f} KB")
    for k, v in data["trends"].items():
        print(k, v)
    print("twins", data["twins"])
    print("why", {k: data["why"][k] for k in ("galicia", "culebra", "factors", "answer")})
    print("warming", data["warming"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
