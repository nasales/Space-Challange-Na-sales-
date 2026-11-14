"""Build the featured case studies (Ivan) into data/cache/ from a pluggable data source.

Usage:
    python -m pipeline.build_cases [--source power|supabase_cases] [--refresh] [--only dana_valencia ...]

Sources (get_series(case, variable) -> dates, values, units, dataset):
- power (default): NASA POWER point data. Loads data/raw/power/<id>_<param>.json (download it only
  if missing or with --refresh). Variables without a POWER parameter are skipped.
- supabase_cases: area-mean series from the challenge datasets (docs/case_data_request.md).
  Stub until Perry shares the read functions.

For each case and variable: get the series, run analyze_trend, and write data/cache/case_<id>_<var>.json with exactly the
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
from pipeline.cases import CASES, END_YEAR, POWER_PARAMS, START_YEAR
from pipeline.explain import explain
from pipeline.series import Series
from pipeline.trend import analyze_trend

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw" / "power"
CACHE_DIR = ROOT / "data" / "cache"
INDEX_PATH = ROOT / "data" / "cases_index.json"


def dataset_name(param: str) -> str:
    return f"NASA POWER (MERRA-2 based) {param}"


DEFAULT_SOURCE = "power"


def _power_series(case: dict, variable: str, raw_dir: Path = RAW_DIR, refresh: bool = False):
    param = POWER_PARAMS[variable]
    raw_path = Path(raw_dir) / f"{case['id']}_{param}.json"
    if refresh or not raw_path.exists():
        raw = nasa_power.download(case["lat"], case["lon"], param, START_YEAR, END_YEAR, raw_path)
    else:
        raw = json.loads(raw_path.read_text(encoding="utf-8"))
    dates, values, units = nasa_power.parse(raw, param)
    return dates, values, units, dataset_name(param)


def _supabase_cases_series(case: dict, variable: str, **_):
    # Expected input once Perry shares the read functions: one row per case x variable with
    # start_month ("YYYY-MM") and a list of monthly area-mean values (None for gaps), same shape
    # as the `series` table. Convert it to dates/values and return (dates, values, units, dataset).
    raise NotImplementedError(
        f"source 'supabase_cases' is not available yet ({case['id']} {variable}): it needs Perry's "
        "functions to read the area-mean case series (start_month + monthly values with nulls, like "
        "the `series` table; see docs/case_data_request.md). Use --source power."
    )


SOURCES = {"power": _power_series, "supabase_cases": _supabase_cases_series}


def output_var(variable: str, source: str = DEFAULT_SOURCE) -> str | None:
    """Name used in the case file name and `variable` field, or None if the source lacks it.

    With power it is the POWER parameter (e.g. PRECIP -> PRECTOTCORR), so outputs stay unchanged.
    """
    if source == "power":
        return POWER_PARAMS.get(variable)
    return variable


def get_series(case: dict, variable: str, source: str = DEFAULT_SOURCE, **kwargs):
    """Monthly series of one case and variable id: (dates, values, units, dataset)."""
    if source not in SOURCES:
        raise ValueError(f"unknown source {source!r}; choose one of {sorted(SOURCES)}")
    return SOURCES[source](case, variable, **kwargs)


def build_one(case: dict, variable: str, raw_dir: Path = RAW_DIR, cache_dir: Path = CACHE_DIR,
              refresh: bool = False, source: str = DEFAULT_SOURCE) -> tuple[dict, dict, Series]:
    """Build and write one case file. Returns (contract case, trend, series)."""
    name = output_var(variable, source)
    if name is None:
        raise ValueError(f"source {source!r} has no data for variable {variable!r}")
    dates, values, units, dataset = get_series(case, variable, source, raw_dir=raw_dir, refresh=refresh)
    series = Series(place=case["place"], lat=case["lat"], lon=case["lon"], variable=name,
                    units=units, dataset=dataset, dates=dates, values=values).validate()
    trend = analyze_trend(dates, values)
    contract_case = build_case(series, trend)
    write_case(contract_case, Path(cache_dir) / f"case_{case['id']}_{name}.json")
    return contract_case, trend, series


def case_file(case_id: str, name: str) -> str:
    """Repo-relative path of a case file, as listed in the index (name from output_var)."""
    return f"data/cache/case_{case_id}_{name}.json"


def case_vars(case: dict, source: str = DEFAULT_SOURCE) -> list[str]:
    """Output names of the case variables available in `source`, in case order."""
    return [n for n in (output_var(v, source) for v in case["variables"]) if n is not None]


def load_case_file(path: str | Path) -> tuple[dict, Series]:
    """Re-run analyze_trend on a committed contract file. Returns (full trend dict, series).

    The contract file stores only slope / p_value / significant / test, so the CI and the other
    trend keys are recomputed from its dates and values (deterministic, no download).
    """
    case = json.loads(Path(path).read_text(encoding="utf-8"))
    series = Series(place=case["place"], lat=case["lat"], lon=case["lon"], variable=case["variable"],
                    units=case["units"], dataset=case["dataset"], dates=case["dates"],
                    values=case["values"]).validate()
    return analyze_trend(series.dates, series.values), series


def build_index(cases: list[dict] = CASES, root: Path = ROOT, source: str = DEFAULT_SOURCE) -> list[dict]:
    """One entry per case: id, title, place, lat, lon, question, context, files, facts.

    `facts` maps each variable to the explain() text of its series (built from the case files).
    """
    keys = ("id", "title", "place", "lat", "lon", "question", "context")
    index = []
    for c in cases:
        names = case_vars(c, source)
        files = [case_file(c["id"], v) for v in names]
        facts = {v: explain(*load_case_file(Path(root) / f)) for v, f in zip(names, files)}
        index.append({**{k: c[k] for k in keys}, "files": files, "facts": facts})
    return index


def write_index(path: str | Path = INDEX_PATH, cases: list[dict] = CASES,
                source: str = DEFAULT_SOURCE) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(build_index(cases, source=source), f, ensure_ascii=False, indent=1)
        f.write("\n")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Build the featured case studies.")
    ap.add_argument("--source", choices=sorted(SOURCES), default=DEFAULT_SOURCE,
                    help="data source (default: power)")
    ap.add_argument("--refresh", action="store_true", help="download again even if the raw file exists")
    ap.add_argument("--only", nargs="*", help="case ids to build (default: all)")
    args = ap.parse_args(argv)

    for case in CASES:
        if args.only and case["id"] not in args.only:
            continue
        print(f"== {case['title']} ({case['id']}) ==")
        for variable in case["variables"]:
            if output_var(variable, args.source) is None:
                print(f"(skipped {variable}: not available in source {args.source})\n")
                continue
            _, trend, series = build_one(case, variable, refresh=args.refresh, source=args.source)
            print(explain(trend, series))
            print()
    write_index(source=args.source)
    print(f"Index: {INDEX_PATH.relative_to(ROOT).as_posix()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
