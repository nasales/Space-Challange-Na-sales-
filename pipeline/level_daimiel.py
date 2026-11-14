"""Data of the Tablas de Daimiel level (src/levels/daimiel/), computed with the official trend method.

Usage:
    python -m pipeline.level_daimiel

Lesson of the level: test many things and some will look "significant" by chance.

Reads data/cache/case_daimiel_SOILM.json, case_daimiel_PRECIP.json, every featured series
data/cache/case_*.json (listed in data/cases_index.json) and writes src/levels/daimiel/daimiel_level.json:
- soilm / precip: units, dataset and monthly anomalies (dates + values) for plotting;
- full: full-record analyze_trend results of Daimiel SOILM and PRECIP, and the phase 1 answer
  ("strong" if p < 0.01, "weak" if 0.01 <= p < 0.05, "none" if not significant);
- tests: the featured series with their analyze_trend p-value, significant at 0.05 and at the
  Bonferroni threshold 0.05 / number of tests;
- simulation: the multiple-testing experiment of phase 2 (see simulate).
Helpers: pipeline/level_data.py.

Speed: analyze_trend also computes the Sen slope and its confidence interval, which the simulation does
not need (only "p < 0.05" is counted) and which make 500 x 19 calls take minutes. The simulation uses
fast_p_value, the same p-value as analyze_trend (same anomalies, same Yue-Wang pre-whitening, same
Mann-Kendall S, variance and two-sided normal p) written with numpy. pipeline/tests/test_level_daimiel.py
checks on a subset of runs that it gives the same p-values (to 1e-9) and verdicts as analyze_trend.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from scipy import stats

from pipeline.build_cases import CACHE_DIR, ROOT
from pipeline.level_data import anomalies, load_case, r4, trend_summary, write_json
from pipeline.trend import _anomalies, analyze_trend

SOILM_PATH = CACHE_DIR / "case_daimiel_SOILM.json"
PRECIP_PATH = CACHE_DIR / "case_daimiel_PRECIP.json"
INDEX_PATH = ROOT / "data" / "cases_index.json"
OUT_PATH = ROOT / "src" / "levels" / "daimiel" / "daimiel_level.json"

ALPHA = 0.05
STRONG_P = 0.01
RUNS = 500
SEED = 2026

# Answer options of the phase 2 question (inclusive ranges of "significant" results by chance alone).
OPTIONS = (
    {"id": "none", "lo": 0, "hi": 0},
    {"id": "one", "lo": 1, "hi": 2},
    {"id": "five", "lo": 4, "hi": 6},
    {"id": "ten", "lo": 9, "hi": 11},
)


def sig4(x: float) -> float:
    """4 significant digits (tiny T2M p-values stay readable, e.g. 1.083e-07)."""
    return float(f"{float(x):.4g}") + 0.0


def _series(case: dict) -> dict:
    return {"units": case["units"], "dataset": case["dataset"], "anomalies": anomalies(case["dates"], case["values"])}


def fast_p_value(dates: list[str], values: list) -> float:
    """analyze_trend's p-value without the slope and CI (see the module docstring).

    Steps of pymannkendall.pre_whitening_modification_test on the anomalies: lag-1 autocorrelation
    (biased ACF), pre-whitened x[1:] - r * x[:-1], Mann-Kendall S, var(S) (ties corrected), z with
    continuity correction, p = 2 * (1 - Phi(|z|)).
    """
    months = [(int(d[:4]), int(d[5:7])) for d in dates]
    x = np.array([a for a in _anomalies(months, values) if a is not None], dtype=float)
    y = x - x.mean()
    r = float(np.dot(y[:-1], y[1:]) / np.dot(y, y))
    w = x[1:] - x[:-1] * r
    n = len(w)
    i, j = np.triu_indices(n, k=1)
    s = float(np.sign(w[j] - w[i]).sum())
    _, tp = np.unique(w, return_counts=True)
    var_s = (n * (n - 1) * (2 * n + 5) - float(np.sum(tp * (tp - 1) * (2 * tp + 5)))) / 18
    z = (s - 1) / np.sqrt(var_s) if s > 0 else (s + 1) / np.sqrt(var_s) if s < 0 else 0.0
    return float(2 * (1 - stats.norm.cdf(abs(z))))


def featured_files(index_path: Path = INDEX_PATH) -> list[tuple[dict, Path]]:
    """(case index entry, case file path) of every featured series, in index order."""
    index = json.loads(Path(index_path).read_text(encoding="utf-8"))
    return [(entry, ROOT / f) for entry in index for f in entry["files"]]


def real_tests(index_path: Path = INDEX_PATH) -> list[dict]:
    files = featured_files(index_path)
    threshold = ALPHA / len(files)
    out = []
    for entry, path in files:
        case = load_case(path)
        p = analyze_trend(case["dates"], case["values"])["p_value"]
        out.append(
            {
                "id": path.stem,
                "case_id": entry["id"],
                "title": entry["title"],
                "variable": case["variable"],
                "dataset": case["dataset"],
                "p_value": sig4(p),
                "significant": bool(p < ALPHA),
                "bonferroni": bool(p < threshold),
            }
        )
    return out


def noise_run(lengths: list[tuple[str, int]], run: int, seed: int = SEED, p_value=fast_p_value) -> list[float]:
    """p-values of one run: one pure-noise series per featured series (same first month and length).

    Noise: independent standard normal values (no trend, no autocorrelation), seed [seed, run], drawn in
    the order of `lengths`, so every run can be recomputed alone.
    """
    rng = np.random.default_rng([seed, run])
    out = []
    for first, n in lengths:
        y0, m0 = int(first[:4]), int(first[5:7])
        dates = [f"{y0 + (m0 - 1 + k) // 12}-{(m0 - 1 + k) % 12 + 1:02d}" for k in range(n)]
        out.append(p_value(dates, rng.normal(size=n).tolist()))
    return out


def series_lengths(index_path: Path = INDEX_PATH) -> list[tuple[str, int]]:
    out = []
    for _, path in featured_files(index_path):
        case = load_case(path)
        out.append((case["dates"][0], len(case["dates"])))
    return out


def simulate(lengths: list[tuple[str, int]], runs: int = RUNS, seed: int = SEED) -> dict:
    """How many of len(lengths) pure-noise series come out p < ALPHA, over `runs` runs.

    share_any_bonferroni: share of runs with at least one p below the Bonferroni threshold
    ALPHA / len(lengths) (the family-wise false-alarm rate, about ALPHA).
    """
    threshold = ALPHA / len(lengths)
    pvals = [noise_run(lengths, k, seed) for k in range(runs)]
    counts = [sum(p < ALPHA for p in ps) for ps in pvals]
    hist = np.bincount(counts).tolist()
    mean = float(np.mean(counts))
    typical = int(round(mean))
    answer = next((o["id"] for o in OPTIONS if o["lo"] <= typical <= o["hi"]), None)
    return {
        "seed": seed,
        "runs": runs,
        "n_series": len(lengths),
        "alpha": ALPHA,
        "expected": r4(len(lengths) * ALPHA),
        "counts": counts,
        "histogram": hist,
        "mean": r4(mean),
        "typical": typical,
        "share_at_least_one": r4(np.mean([c >= 1 for c in counts])),
        "share_any_bonferroni": r4(np.mean([min(ps) < threshold for ps in pvals])),
        "max": max(counts),
        "options": [dict(o) for o in OPTIONS],
        "answer": answer,
    }


def evidence(result: dict) -> str:
    if result.get("too_short") or not result["significant"]:
        return "none"
    return "strong" if result["p_value"] < STRONG_P else "weak"


def build(soilm_path: Path = SOILM_PATH, precip_path: Path = PRECIP_PATH, index_path: Path = INDEX_PATH) -> dict:
    soilm, precip = load_case(soilm_path), load_case(precip_path)
    full_soil = trend_summary(soilm["dates"], soilm["values"])
    tests = real_tests(index_path)
    return {
        "case_id": "daimiel",
        "soilm": _series(soilm),
        "precip": _series(precip),
        "full": {
            "soilm": full_soil,
            "precip": trend_summary(precip["dates"], precip["values"]),
            "evidence": evidence(full_soil),
        },
        "tests": tests,
        "real_significant": sum(t["significant"] for t in tests),
        "bonferroni_threshold": round(ALPHA / len(tests), 6),
        "bonferroni_survivors": sum(t["bonferroni"] for t in tests),
        "simulation": simulate(series_lengths(index_path)),
    }


def write(path: Path = OUT_PATH) -> Path:
    return write_json(build(), path)


def main() -> int:
    out = write()
    data = json.loads(out.read_text(encoding="utf-8"))
    print(f"{out.relative_to(ROOT).as_posix()}: {out.stat().st_size / 1024:.0f} KB")
    print("full", data["full"])
    for t in data["tests"]:
        print(f"  {t['id']:<34} p={t['p_value']:<10} sig={t['significant']!s:<5} bonferroni={t['bonferroni']}")
    print("real significant", data["real_significant"], "bonferroni", data["bonferroni_threshold"], data["bonferroni_survivors"])
    sim = {k: v for k, v in data["simulation"].items() if k != "counts"}
    print("simulation", sim)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
