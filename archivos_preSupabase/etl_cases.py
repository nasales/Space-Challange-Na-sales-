"""
Monthly series for the featured case studies (Ivan) -> `case_series` table.

Each case is a single point (lat, lon from pipeline/cases.py). For every case and variable,
the value is the native pixel of the NASA product that contains the point (no grid, no box
average). Reads the Spain subsets already cached by etl_espana.py (ETL_CACHE_DIR), so it
needs no Earthdata login and no download. Units and variable ids are the same as the grid
database (`variables` table). No statistics here: the statistics team analyses the export.

Usage (from the repo root):
    ETL_CACHE_DIR=C:/Users/perry/nasa_etl_cache python archivos_preSupabase/etl_cases.py --export-dir case_export
    SUPABASE_DB_URL="postgresql://..." python archivos_preSupabase/etl_cases.py --upload

Run case_series_schema.sql once in the Supabase SQL editor before --upload.

This script was written with AI help (Claude, Anthropic). Declared in AI_USAGE.md.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
import xarray as xr

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))  # repo root, for pipeline.cases

from etl_espana import CACHE_DIR, VARS, VarSpec, climatology, prepare  # noqa: E402
from pipeline.cases import CASES  # noqa: E402

# Variables per case, from docs/case_data_request.md (Ivan). Priority 1 only:
# T2M -> t2m_long (MERRA-2), PRECIP -> precip (IMERG), SOILM -> soilmoist (GLDAS).
# NDVI, LST and SNOW (MODIS) are a later step.
CASE_VARS = {
    "dana_valencia": ["precip", "t2m_long"],
    "donana": ["soilmoist", "precip"],
    "sierra_culebra": ["t2m_long", "soilmoist"],
    "galicia_fires": ["t2m_long", "soilmoist"],
    "ebro_delta": ["precip", "t2m_long"],
    "filomena_madrid": ["t2m_long", "precip"],
    "almeria_murcia": ["precip", "soilmoist"],
    "cordoba_heat": ["t2m_long"],
    "aneto_glacier": ["t2m_long", "precip"],
    "daimiel": ["soilmoist", "precip"],
}


def cache_folder(spec: VarSpec) -> Path:
    """The grid ETL caches each product once, under the names of all the variables it read."""
    base = CACHE_DIR / spec.short_name
    folders = [d for d in base.iterdir() if d.is_dir() and spec.nc_var in d.name]
    if not folders:
        raise FileNotFoundError(f"no cache for {spec.id} in {base}")
    return max(folders, key=lambda d: len(list(d.glob("*.nc"))))  # the full-period one


def load_product(spec: VarSpec) -> xr.DataArray:
    files = sorted(cache_folder(spec).glob("*.nc"))
    parts = [xr.load_dataset(f)[spec.nc_var] for f in files]
    da = xr.concat(parts, dim="time").sortby("time")
    return prepare(da, spec)


def point_series(da: xr.DataArray, lat: float, lon: float) -> tuple[np.ndarray, np.ndarray, float, float]:
    """Values of the native pixel that contains (lat, lon), plus that pixel's centre."""
    px = da.sel(lat=lat, lon=lon, method="nearest")
    return (px.values.astype(float), da["time"].values,
            float(px["lat"]), float(px["lon"]))


def build(var_ids: list[str] | None = None) -> tuple[list[dict], list[VarSpec]]:
    specs = {s.id: s for s in VARS}
    wanted = sorted({v for vs in CASE_VARS.values() for v in vs if not var_ids or v in var_ids})
    cases = {c["id"]: c for c in CASES}
    rows = []
    clean = lambda a: [None if np.isnan(x) else round(float(x), 4) for x in a]
    for var_id in wanted:
        spec = specs[var_id]
        da = load_product(spec)
        print(f"[{var_id}] {da.sizes['time']} months, "
              f"{str(da['time'].values[0])[:7]} .. {str(da['time'].values[-1])[:7]}")
        for case_id, vs in CASE_VARS.items():
            if var_id not in vs:
                continue
            c = cases[case_id]
            v, months, plat, plon = point_series(da, c["lat"], c["lon"])
            n_valid = int(np.sum(~np.isnan(v)))
            print(f"  {case_id:16s} point ({c['lat']}, {c['lon']}) -> pixel ({plat:.3f}, {plon:.3f}), "
                  f"{n_valid}/{len(v)} valid months")
            if n_valid == 0:
                raise ValueError(f"{case_id}/{var_id}: the pixel has no data (sea?); "
                                 "check the case point")
            rows.append({
                "case_id": case_id, "var_id": var_id, "lat": c["lat"], "lon": c["lon"],
                "start_month": str(months[0])[:10],
                "values": clean(v), "climatology": clean(climatology(v, months)),
            })
    return rows, [specs[v] for v in wanted]


def export_json(out: Path, rows: list[dict], specs: list[VarSpec]) -> None:
    """variables.json + one JSON per case (same shape as the grid export, case_id for cell_id)."""
    (out / "cases").mkdir(parents=True, exist_ok=True)
    meta = {s.id: {"name_en": s.name_en, "unit": s.unit,
                   "source": f"NASA {s.short_name} v{s.version}",
                   "definition_en": s.definition_en} for s in specs}
    (out / "variables.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    by_case: dict[str, dict] = {}
    for r in rows:
        d = by_case.setdefault(r["case_id"], {"case_id": r["case_id"], "lat": r["lat"],
                                              "lon": r["lon"], "vars": {}})
        d["vars"][r["var_id"]] = {k: r[k] for k in ("start_month", "values", "climatology")}
    for cid, d in by_case.items():
        (out / "cases" / f"{cid}.json").write_text(json.dumps(d), encoding="utf-8")
    print(f"Exported: {len(by_case)} cases, {len(rows)} series to {out}")


def upload(db_url: str, rows: list[dict]) -> None:
    import psycopg

    with psycopg.connect(db_url) as conn, conn.cursor() as cur:
        cur.executemany(
            """insert into case_series (case_id, var_id, lat, lon, start_month, values, climatology)
               values (%s,%s,%s,%s,%s,%s,%s)
               on conflict (case_id, var_id) do update set lat=excluded.lat, lon=excluded.lon,
               start_month=excluded.start_month, values=excluded.values,
               climatology=excluded.climatology""",
            [(r["case_id"], r["var_id"], r["lat"], r["lon"], r["start_month"], r["values"],
              r["climatology"]) for r in rows])
        conn.commit()
    print(f"Uploaded: {len(rows)} case series")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", help="ids of the variables to process")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--export-dir", type=Path)
    args = ap.parse_args()
    rows, specs = build(args.only)
    if args.export_dir:
        export_json(args.export_dir, rows, specs)
    if args.upload:
        upload(os.environ["SUPABASE_DB_URL"], rows)


if __name__ == "__main__":
    main()
