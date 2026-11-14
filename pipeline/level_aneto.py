"""Data of the Aneto glacier level (src/levels/aneto/), computed with the official trend method.

Usage:
    python -m pipeline.level_aneto

Reads data/cache/case_aneto_glacier_T2M.json, case_aneto_glacier_PRECIP.json and every
data/cache/case_*_T2M.json, and writes src/levels/aneto/aneto_level.json:
- t2m / precip: units, dataset and monthly anomalies (dates + values) for plotting;
- full: full-record analyze_trend results of Aneto T2M and PRECIP (per decade);
- race: one row per case with a T2M series (case id, title, period, trend + 95% range per decade),
  fastest first by the central estimate;
- verdict: is Aneto the fastest by the central estimate, which cases have a 95% range that
  overlaps Aneto's, and is Aneto "clearly" the fastest (its range above every other range).
Helpers: pipeline/level_data.py.
"""

from __future__ import annotations

import json
from pathlib import Path

from pipeline.build_cases import CACHE_DIR, ROOT
from pipeline.level_data import anomalies, load_case, trend_summary, write_json

CASE_ID = "aneto_glacier"
T2M_PATH = CACHE_DIR / f"case_{CASE_ID}_T2M.json"
PRECIP_PATH = CACHE_DIR / f"case_{CASE_ID}_PRECIP.json"
INDEX_PATH = ROOT / "data" / "cases_index.json"
OUT_PATH = ROOT / "src" / "levels" / "aneto" / "aneto_level.json"


def _series(case: dict) -> dict:
    return {"units": case["units"], "dataset": case["dataset"], "anomalies": anomalies(case["dates"], case["values"])}


def race(cache_dir: Path = CACHE_DIR, index_path: Path = INDEX_PATH) -> list[dict]:
    """T2M trend of every featured case with a T2M file, fastest first."""
    titles = {c["id"]: c["title"] for c in json.loads(index_path.read_text(encoding="utf-8"))}
    rows = []
    for path in sorted(cache_dir.glob("case_*_T2M.json")):
        case_id = path.stem[len("case_") : -len("_T2M")]
        case = load_case(path)
        t = trend_summary(case["dates"], case["values"])
        if t.get("too_short"):
            continue
        rows.append(
            {
                "case_id": case_id,
                "title": titles.get(case_id, case["place"]),
                "first": case["dates"][0],
                "last": case["dates"][-1],
                "slope_decade": t["slope_decade"],
                "ci_decade": t["ci_decade"],
                "significant": t["significant"],
            }
        )
    return sorted(rows, key=lambda r: -r["slope_decade"])


def verdict(rows: list[dict], case_id: str = CASE_ID) -> dict:
    me = next(r for r in rows if r["case_id"] == case_id)
    others = [r for r in rows if r["case_id"] != case_id]
    lo, hi = me["ci_decade"]
    overlapping = [r["case_id"] for r in others if r["ci_decade"][1] >= lo and r["ci_decade"][0] <= hi]
    fastest = rows[0]["case_id"] == case_id
    return {
        "fastest_estimate": fastest,
        "overlapping": overlapping,
        "clearly_fastest": fastest and all(r["ci_decade"][1] < lo for r in others),
    }


def build(t2m_path: Path = T2M_PATH, precip_path: Path = PRECIP_PATH, cache_dir: Path = CACHE_DIR) -> dict:
    t2m, precip = load_case(t2m_path), load_case(precip_path)
    rows = race(cache_dir)
    return {
        "case_id": CASE_ID,
        "t2m": _series(t2m),
        "precip": _series(precip),
        "full": {
            "t2m": trend_summary(t2m["dates"], t2m["values"]),
            "precip": trend_summary(precip["dates"], precip["values"]),
        },
        "race": rows,
        "verdict": verdict(rows),
    }


def write(path: Path = OUT_PATH) -> Path:
    return write_json(build(), path)


def main() -> int:
    out = write()
    data = json.loads(out.read_text(encoding="utf-8"))
    print(f"{out.relative_to(ROOT).as_posix()}: {out.stat().st_size / 1024:.0f} KB")
    print("full", data["full"])
    for r in data["race"]:
        print(f"{r['case_id']:16} {r['slope_decade']:+.3f}  [{r['ci_decade'][0]:+.3f}, {r['ci_decade'][1]:+.3f}]")
    print("verdict", data["verdict"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
