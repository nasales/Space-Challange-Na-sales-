"""Build the featured case studies (Ivan) into data/cache/ from NASA POWER raw JSON.

Usage:
    python -m pipeline.build_cases [--refresh] [--only dana_valencia ...]

For each case and variable: load data/raw/power/<id>_<var>.json (download it only if missing or
with --refresh), run analyze_trend, and write data/cache/case_<id>_<var>.json with exactly the
contract fields (docs/contract.md), using Diego's build_case / write_case.
It also writes data/cases_index.json (outside data/cache/, so the contract validator ignores it)
with the texts of every case and the list of its files.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from pipeline import nasa_power
from pipeline.build_case import build_case, write_case
from pipeline.cases import CASES, END_YEAR, START_YEAR
from pipeline.explain import explain
from pipeline.series import Series
from pipeline.trend import analyze_trend

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw" / "power"
CACHE_DIR = ROOT / "data" / "cache"
INDEX_PATH = ROOT / "data" / "cases_index.json"


def dataset_name(param: str) -> str:
    return f"NASA POWER (MERRA-2 based) {param}"


def build_one(case: dict, param: str, raw_dir: Path = RAW_DIR, cache_dir: Path = CACHE_DIR,
              refresh: bool = False) -> tuple[dict, dict, Series]:
    """Build and write one case file. Returns (contract case, trend, series)."""
    raw_path = Path(raw_dir) / f"{case['id']}_{param}.json"
    if refresh or not raw_path.exists():
        raw = nasa_power.download(case["lat"], case["lon"], param, START_YEAR, END_YEAR, raw_path)
    else:
        raw = json.loads(raw_path.read_text(encoding="utf-8"))

    dates, values, units = nasa_power.parse(raw, param)
    series = Series(place=case["place"], lat=case["lat"], lon=case["lon"], variable=param,
                    units=units, dataset=dataset_name(param), dates=dates, values=values).validate()
    trend = analyze_trend(dates, values)
    contract_case = build_case(series, trend)
    write_case(contract_case, Path(cache_dir) / f"case_{case['id']}_{param}.json")
    return contract_case, trend, series


def case_file(case_id: str, param: str) -> str:
    """Repo-relative path of a case file, as listed in the index."""
    return f"data/cache/case_{case_id}_{param}.json"


def build_index(cases: list[dict] = CASES) -> list[dict]:
    """One entry per case: id, title, place, lat, lon, question, context, files."""
    keys = ("id", "title", "place", "lat", "lon", "question", "context")
    return [{**{k: c[k] for k in keys}, "files": [case_file(c["id"], v) for v in c["variables"]]}
            for c in cases]


def write_index(path: str | Path = INDEX_PATH, cases: list[dict] = CASES) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(build_index(cases), f, ensure_ascii=False, indent=1)
        f.write("\n")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Build the featured case studies from NASA POWER.")
    ap.add_argument("--refresh", action="store_true", help="download again even if the raw file exists")
    ap.add_argument("--only", nargs="*", help="case ids to build (default: all)")
    args = ap.parse_args(argv)

    for case in CASES:
        if args.only and case["id"] not in args.only:
            continue
        print(f"== {case['title']} ({case['id']}) ==")
        for param in case["variables"]:
            _, trend, series = build_one(case, param, refresh=args.refresh)
            print(explain(trend, series))
            print()
    write_index()
    print(f"Index: {INDEX_PATH.relative_to(ROOT).as_posix()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
