"""Build the featured case studies (Ivan) into data/cache/ from a pluggable data source.

Usage:
    python -m pipeline.build_cases [--source power] [--refresh] [--only dana_valencia ...]
    python -m pipeline.build_cases --source case_export --export-dir <unzipped dir> [--only ...]

Sources (get_series(case, variable) -> dates, values, units, dataset):
- power (default): NASA POWER point data. Loads data/raw/power/<id>_<param>.json (download it only
  if missing or with --refresh). Variables without a POWER parameter are skipped. Files keep the
  POWER parameter name: case_<id>_T2M / _PRECTOTCORR / _GWETTOP.
- case_export: Perry's export of the `case_series` table (area means over each case box, from the
  challenge datasets, see docs/case_data_request.md). Expected layout of the unzipped folder:

      <dir>/variables.json          {var_id: {unit, source, ...}}
      <dir>/cases/<case_id>.json    {case_id, lat_min, lat_max, lon_min, lon_max,
                                     vars: {var_id: {start_month, values, climatology?}}}

  `start_month` is "YYYY-MM" or "YYYY-MM-01"; `values` has one number per month, null for gaps (same
  shape as the `series` table). var_id is T2M, PRECIP, SOILM, NDVI, LST or SNOW (common aliases such
  as precip / soilmoist are accepted, see pipeline/sources/case_export.py). Units and dataset come
  from variables.json and are converted to the POWER display units before the analysis (see
  convert_units: K -> °C, mm/hr -> mm/day); lat / lon of the case file are the box centre. Files use the common id
  (case_<id>_PRECIP.json ...) and the POWER file of the same variable type is deleted
  (e.g. _PRECTOTCORR when _PRECIP is written). Cases or variables missing in the export keep their
  POWER file (fallback) and are listed in the report.

For each case and variable: get the series, run analyze_trend, and write data/cache/case_<id>_<var>.json
with exactly the contract fields (docs/contract.md), using Diego's build_case / write_case.
It also writes data/cases_index.json (outside data/cache/, so the contract validator ignores it)
with the texts of every case and the list of its files (the files present in data/cache/).
"""

from __future__ import annotations

import argparse
import json
import warnings
from pathlib import Path

from pipeline import nasa_power
from pipeline.build_case import build_case, write_case
from pipeline.cases import CASES, END_YEAR, POWER_PARAMS, START_YEAR, VARIABLES
from pipeline.explain import explain
from pipeline.series import Series, from_start_month
from pipeline.sources import case_export
from pipeline.trend import analyze_trend

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw" / "power"
CACHE_DIR = ROOT / "data" / "cache"
INDEX_PATH = ROOT / "data" / "cases_index.json"

DEFAULT_SOURCE = "power"


def dataset_name(param: str) -> str:
    return f"NASA POWER (MERRA-2 based) {param}"


def _power_series(case: dict, variable: str, raw_dir: Path = RAW_DIR, refresh: bool = False, **_):
    param = POWER_PARAMS[variable]
    raw_path = Path(raw_dir) / f"{case['id']}_{param}.json"
    if refresh or not raw_path.exists():
        raw = nasa_power.download(case["lat"], case["lon"], param, START_YEAR, END_YEAR, raw_path)
    else:
        raw = json.loads(raw_path.read_text(encoding="utf-8"))
    dates, values, units = nasa_power.parse(raw, param)
    return dates, values, units, dataset_name(param)


def _norm_unit(unit: str) -> str:
    return "".join(str(unit).lower().split()).replace("²", "2").replace("^", "").replace("-1", "")


KELVIN = {"k", "kelvin"}
MM_PER_HOUR = {"mm/hr", "mm/h", "mmhr", "mmh", "mm/hour"}
KG_M2 = {"kg/m2", "kgm-2", "kgm2", "kg/m-2"}
UNITLESS = {"", "1", "-", "none", "unitless", "ndvi", "ndvi(0-1)", "index"}
PERCENT = {"%", "percent", "pct"}


def convert_units(variable: str, unit: str, values: list) -> tuple[list, str]:
    """Convert an export series to the display units used for POWER. Returns (values, unit label).

    K -> °C (value - 273.15), mm/hr -> mm/day (x 24); soil moisture kg/m2 -> "kg/m² (0-10 cm)";
    NDVI -> "NDVI (0-1)"; snow cover % -> "%". Unknown units are kept as they are, with a warning.
    """
    u = _norm_unit(unit)

    def conv(f):
        return [None if v is None else f(v) for v in values]

    if variable in ("T2M", "LST") and u in KELVIN:
        return conv(lambda v: v - 273.15), "°C"
    if variable == "PRECIP" and u in MM_PER_HOUR:
        return conv(lambda v: v * 24), "mm/day"
    if variable == "SOILM" and u in KG_M2:
        return list(values), "kg/m² (0-10 cm)"
    if variable == "NDVI" and u in UNITLESS:
        return list(values), "NDVI (0-1)"
    if variable == "SNOW" and u in PERCENT:
        return list(values), "%"
    warnings.warn(f"unknown unit {unit!r} for {variable}: kept as it is, no conversion", stacklevel=2)
    return list(values), str(unit)


def _case_export_series(case: dict, variable: str, export_dir: str | Path | None = None, **_):
    """Series from the case export. Raises LookupError if the case or variable is not in it."""
    if export_dir is None:
        raise ValueError("source 'case_export' needs --export-dir <unzipped export folder>")
    data = case_export.load_case(export_dir, case["id"])
    if data is None:
        raise LookupError(f"case {case['id']!r} is not in the export")
    if variable not in data["vars"]:
        raise LookupError(f"case {case['id']!r} has no {variable} in the export; it has {sorted(data['vars'])}")
    meta = case_export.load_variables(export_dir)
    if variable not in meta:
        raise ValueError(f"variables.json has no entry for {variable}; it has {sorted(meta)}")
    entry = data["vars"][variable]
    s = from_start_month(entry["start_month"], entry["values"], place=case["place"], lat=0.0, lon=0.0,
                         variable=variable, units=str(meta[variable]["unit"]),
                         dataset=str(meta[variable]["source"]))
    values, units = convert_units(variable, s.units, s.values)
    return s.dates, values, units, s.dataset


SOURCES = {"power": _power_series, "case_export": _case_export_series}


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
              refresh: bool = False, source: str = DEFAULT_SOURCE,
              export_dir: str | Path | None = None) -> tuple[dict, dict, Series]:
    """Build and write one case file. Returns (contract case, trend, series)."""
    name = output_var(variable, source)
    if name is None:
        raise ValueError(f"source {source!r} has no data for variable {variable!r}")
    dates, values, units, dataset = get_series(case, variable, source, raw_dir=raw_dir, refresh=refresh,
                                               export_dir=export_dir)
    lat, lon = case["lat"], case["lon"]
    if source == "case_export":
        lat, lon = case_export.box_center(case_export.load_case(export_dir, case["id"]))
    series = Series(place=case["place"], lat=lat, lon=lon, variable=name,
                    units=units, dataset=dataset, dates=dates, values=values).validate()
    trend = analyze_trend(dates, values)
    contract_case = build_case(series, trend)
    write_case(contract_case, Path(cache_dir) / f"case_{case['id']}_{name}.json")
    return contract_case, trend, series


def build_from_export(export_dir: str | Path, cases: list[dict] = CASES, cache_dir: Path = CACHE_DIR,
                      log=print) -> dict[str, list[str]]:
    """Build every case x variable found in the export; keep POWER files for the rest.

    Variables built per case: the case variables of pipeline/cases.py plus any other common
    variable present in the export. Returns the report:
    built, replaced (deleted POWER files), fallback (POWER file kept), missing (no file at all),
    ignored (export variable ids not recognised).
    """
    cache_dir = Path(cache_dir)
    case_export.load_variables(export_dir)  # fail early on a bad variables.json
    report = {"built": [], "replaced": [], "fallback": [], "missing": [], "ignored": []}
    for case in cases:
        data = case_export.load_case(export_dir, case["id"])
        present = data["vars"] if data else {}
        if data:
            report["ignored"] += [f"{case['id']}/{v}" for v in data["ignored"]]
        wanted = list(case["variables"]) + [v for v in VARIABLES if v in present and v not in case["variables"]]
        log(f"== {case['title']} ({case['id']}) ==")
        for variable in wanted:
            label = f"{case['id']}/{variable}"
            if variable in present:
                _, trend, series = build_one(case, variable, cache_dir=cache_dir, source="case_export",
                                             export_dir=export_dir)
                report["built"].append(label)
                old = POWER_PARAMS.get(variable)
                old_path = cache_dir / f"case_{case['id']}_{old}.json"
                if old and old != variable and old_path.exists():
                    old_path.unlink()
                    report["replaced"].append(old_path.name)
                log(explain(trend, series) + "\n")
            elif resolve_file(case["id"], variable, cache_dir) is not None:
                report["fallback"].append(label)
            else:
                report["missing"].append(label)
    return report


def case_file(case_id: str, name: str) -> str:
    """Repo-relative path of a case file, as listed in the index (name from output_var)."""
    return f"data/cache/case_{case_id}_{name}.json"


def case_vars(case: dict, source: str = DEFAULT_SOURCE) -> list[str]:
    """Output names of the case variables available in `source`, in case order."""
    return [n for n in (output_var(v, source) for v in case["variables"]) if n is not None]


def resolve_file(case_id: str, variable: str, cache_dir: Path = CACHE_DIR) -> str | None:
    """File name used for this case variable in cache_dir: the common id first, else the POWER one."""
    for name in dict.fromkeys([variable, POWER_PARAMS.get(variable)]):
        if name and (Path(cache_dir) / f"case_{case_id}_{name}.json").exists():
            return name
    return None


def resolved_vars(case: dict, root: Path = ROOT) -> list[str]:
    """File names of the case series present in <root>/data/cache: case variables first, then extras."""
    cache_dir = Path(root) / "data" / "cache"
    order = list(case["variables"]) + [v for v in VARIABLES if v not in case["variables"]]
    names = []
    for i, variable in enumerate(order):
        name = resolve_file(case["id"], variable, cache_dir)
        if name is not None and (i < len(case["variables"]) or name == variable):
            names.append(name)
    return names


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


def build_index(cases: list[dict] = CASES, root: Path = ROOT) -> list[dict]:
    """One entry per case: id, title, place, lat, lon, question, context, files, facts.

    `files` are the case files present in <root>/data/cache (see resolved_vars); `facts` maps each
    file variable to the explain() text of its series.
    """
    keys = ("id", "title", "place", "lat", "lon", "question", "context")
    index = []
    for c in cases:
        names = resolved_vars(c, root)
        files = [case_file(c["id"], v) for v in names]
        facts = {v: explain(*load_case_file(Path(root) / f)) for v, f in zip(names, files)}
        index.append({**{k: c[k] for k in keys}, "files": files, "facts": facts})
    return index


def write_index(path: str | Path = INDEX_PATH, cases: list[dict] = CASES, root: Path = ROOT) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(build_index(cases, root), f, ensure_ascii=False, indent=1)
        f.write("\n")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Build the featured case studies.")
    ap.add_argument("--source", choices=sorted(SOURCES), default=DEFAULT_SOURCE,
                    help="data source (default: power)")
    ap.add_argument("--export-dir", help="unzipped case export folder (needed for --source case_export)")
    ap.add_argument("--refresh", action="store_true", help="download again even if the raw file exists")
    ap.add_argument("--only", nargs="*", help="case ids to build (default: all)")
    args = ap.parse_args(argv)
    cases = [c for c in CASES if not args.only or c["id"] in args.only]

    if args.source == "case_export":
        if not args.export_dir:
            ap.error("--source case_export needs --export-dir <unzipped export folder>")
        report = build_from_export(args.export_dir, cases)
        print("== Report ==")
        for key, items in report.items():
            print(f"{key} ({len(items)}): {', '.join(items) if items else '-'}")
    else:
        for case in cases:
            print(f"== {case['title']} ({case['id']}) ==")
            for variable in case["variables"]:
                if output_var(variable, args.source) is None:
                    print(f"(skipped {variable}: not available in source {args.source})\n")
                    continue
                _, trend, series = build_one(case, variable, refresh=args.refresh, source=args.source)
                print(explain(trend, series))
                print()
    write_index()
    print(f"Index: {INDEX_PATH.relative_to(ROOT).as_posix()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
