"""
Earth System Trend Detective — ETL Spain → Supabase
====================================================
1. Downloads (streaming, only the Spain subset) the monthly NASA products:
     - GLDAS-2.1 Noah monthly 0.25°    (GLDAS_NOAH025_M v2.1)   2000 → today
     - GPM IMERG Final monthly 0.1°    (GPM_3IMERGM v07)        1998 → today
     - MERRA-2 monthly 0.5°×0.625°     (M2TMNXSLV v5.12.4)      1980 → today
2. Moves them to a common 0.25° grid (GLDAS cell centres) and keeps ONLY the land
   cells (GLDAS mask): the game map has no sea.
3. Stores, per cell, the monthly series and its climatology (12 means, for charts).
   Trends and significance are NOT computed here: the statistics team fills the
   `trends` table (pipeline/fill_trends.py). There is an optional --with-trends
   computation, used only as an independent reference for pipeline/compare_db.py.
4. Uploads everything to Supabase (or exports static JSON as plan B).

Requirements:
    pip install earthaccess xarray h5netcdf h5py netCDF4 scipy numpy pymannkendall "psycopg[binary]"
    A free NASA Earthdata account (https://urs.earthdata.nasa.gov) with the
    "NASA GESDISC DATA ARCHIVE" app authorized in the profile.

Usage:
    python etl_espana.py --export-dir export              # compute and export JSON only
    SUPABASE_DB_URL="postgresql://..." python etl_espana.py --upload
    python etl_espana.py --upload --only tair precip      # only some variables

This script was written with AI help (Claude, Anthropic). Declared in AI_USAGE.md.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import xarray as xr

GRID = 0.25  # degrees; common grid (the GLDAS one)

# Boxes (lon_min, lat_min, lon_max, lat_max)
REGIONS = {
    "peninsula_baleares": (-9.5, 35.75, 4.5, 44.0),
    "canarias": (-18.25, 27.5, -13.25, 29.5),
}
MIN_MONTHS = 120  # at least 10 years of valid data to compute a trend
# Monthly Spain subsets already read (resume after a crash). Override with ETL_CACHE_DIR.
CACHE_DIR = Path(os.environ.get("ETL_CACHE_DIR", "etl_cache"))
WORKERS = int(os.environ.get("ETL_WORKERS", "4"))  # monthly files read in parallel


@dataclass
class VarSpec:
    id: str
    short_name: str
    version: str
    nc_var: str
    name_en: str
    unit: str
    definition_en: str
    temporal_start: str
    group: str | None = None   # HDF5 group (IMERG uses "Grid")
    scale: float = 1.0         # multiply...
    offset: float = 0.0        # ...then add
    regrid: str = "nearest"    # "nearest" | "linear"


VARS = [
    VarSpec("tair", "GLDAS_NOAH025_M", "2.1", "Tair_f_inst",
            "Air temperature (near surface)", "°C",
            "How warm the air is close to the ground, averaged over the month.",
            "2000-01-01", offset=-273.15),
    VarSpec("wind", "GLDAS_NOAH025_M", "2.1", "Wind_f_inst",
            "Wind speed (near surface)", "m/s",
            "How fast the wind blows near the ground, averaged over the month.",
            "2000-01-01"),
    VarSpec("soilmoist", "GLDAS_NOAH025_M", "2.1", "SoilMoi0_10cm_inst",
            "Topsoil moisture (0-10 cm)", "kg/m²",
            "How much water is stored in the top 10 cm of soil (1 kg/m² = 1 mm of water).",
            "2000-01-01"),
    VarSpec("evap", "GLDAS_NOAH025_M", "2.1", "Evap_tavg",
            "Evapotranspiration", "mm/day",
            "Water returning to the air from soil, water bodies and plants.",
            "2000-01-01", scale=86400.0),
    VarSpec("precip", "GPM_3IMERGM", "07", "precipitation",
            "Precipitation", "mm/day",
            "Rain and snow reaching the ground, from satellites calibrated with rain gauges.",
            "1998-01-01", group="Grid", scale=24.0, regrid="linear"),
    VarSpec("t2m_long", "M2TMNXSLV", "5.12.4", "T2M",
            "Air temperature at 2 m (long record, coarse)", "°C",
            "Air temperature 2 m above the ground from NASA's MERRA-2 reanalysis "
            "(a weather model constrained by observations). Coarser grid, but starts in 1980.",
            "1980-01-01", offset=-273.15),
]


# ------------------------------------------------------------------- grid ---
def target_cells() -> list[dict]:
    """0.25° cell centres inside each region, with their global cell_id."""
    cells = []
    for region, (lon0, lat0, lon1, lat1) in REGIONS.items():
        rows = range(math.floor((lat0 + 90) / GRID), math.ceil((lat1 + 90) / GRID))
        cols = range(math.floor((lon0 + 180) / GRID), math.ceil((lon1 + 180) / GRID))
        for r in rows:
            for c in cols:
                cells.append({
                    "cell_id": r * int(360 / GRID) + c,
                    "lat": round(-90 + GRID * (r + 0.5), 4),
                    "lon": round(-180 + GRID * (c + 0.5), 4),
                    "region": region,
                })
    return cells


def union_bbox() -> tuple[float, float, float, float]:
    b = np.array(list(REGIONS.values()))
    return (b[:, 0].min() - 1, b[:, 1].min() - 1, b[:, 2].max() + 1, b[:, 3].max() + 1)


# --------------------------------------------------------------- download ---
def fetch_dataset(specs: list[VarSpec], end: str, start: str | None = None) -> xr.Dataset:
    """Opens each monthly file over HTTPS once and keeps the Spain subset and the
    requested variables (all from the same product)."""
    import earthaccess

    s0 = specs[0]
    earthaccess.login(persist=True)
    lon0, lat0, lon1, lat1 = union_bbox()
    results = earthaccess.search_data(
        short_name=s0.short_name, version=s0.version,
        temporal=(start or s0.temporal_start, end), bounding_box=(lon0, lat0, lon1, lat1),
    )
    print(f"[{s0.short_name}] {len(results)} monthly files")
    names = [s.nc_var for s in specs]
    # Local cache of the Spain subsets: a crashed run resumes where it stopped.
    cache = CACHE_DIR / s0.short_name / "_".join(names)
    cache.mkdir(parents=True, exist_ok=True)
    jobs = []
    for granule in results:
        url = granule.data_links()[0]
        jobs.append((url, names, s0.group, (lon0, lat0, lon1, lat1),
                     str(cache / (Path(url).stem + ".nc"))))
    todo = [j for j in jobs if not Path(j[4]).exists()]
    print(f"  {len(jobs) - len(todo)} already cached, {len(todo)} to read "
          f"with {WORKERS} parallel workers")
    # Separate processes, not threads: h5py serialises all reads inside one process.
    from concurrent.futures import ProcessPoolExecutor, as_completed
    done = len(jobs) - len(todo)
    with ProcessPoolExecutor(max_workers=WORKERS) as pool:
        futures = [pool.submit(_fetch_subset, *j) for j in todo]
        for fut in as_completed(futures):
            fut.result()  # re-raises a file that failed after all retries
            done += 1
            if done % 8 == 0 or done == len(jobs):
                print(f"  {s0.short_name}: {done}/{len(jobs)}")
    parts = [xr.load_dataset(j[4]) for j in jobs]
    return xr.concat(parts, dim="time").sortby("time")


_logged_in = False


def _fetch_subset(url: str, names: list[str], group: str | None,
                  bbox: tuple[float, float, float, float], cached: str) -> None:
    """Worker: read the Spain subset of one monthly file and save it to the cache.
    Retries transient NASA errors (502/503...) with exponential backoff."""
    import earthaccess

    global _logged_in
    if not _logged_in:
        earthaccess.login(strategy="netrc")
        _logged_in = True
    lon0, lat0, lon1, lat1 = bbox
    kw = {"group": group} if group else {}
    for attempt in range(6):
        try:
            f = earthaccess.open([url])[0]
            try:
                with xr.open_dataset(f, engine="h5netcdf", **kw) as ds:
                    part = ds[names].sel(lat=slice(lat0, lat1), lon=slice(lon0, lon1)).load()
            finally:
                f.close()  # otherwise each file keeps its read cache in memory
            break
        except Exception as exc:  # NASA servers return transient 5xx errors
            if attempt == 5:
                raise
            wait = 10 * 2 ** attempt
            print(f"  retry {attempt + 1}/5 in {wait}s ({Path(url).name}): {str(exc)[:100]}",
                  flush=True)
            time.sleep(wait)
    tmp = cached + ".tmp"
    part.to_netcdf(tmp)
    os.replace(tmp, cached)  # atomic: a killed run never leaves a half-written file


def land_cells(cells: list[dict]) -> list[dict]:
    """The game map has no sea: keep the cells that GLDAS considers land (the ones
    with data). One month is enough. All variables, IMERG and MERRA-2 included,
    are computed only on these cells."""
    gldas = next(s for s in VARS if s.short_name == "GLDAS_NOAH025_M")
    ds = fetch_dataset([gldas], end="2020-01-31", start="2020-01-01")
    grid = to_grid(prepare(ds[gldas.nc_var], gldas), cells, "nearest")
    has_data = grid.notnull().any("time").values
    land = [c for c, ok in zip(cells, has_data) if ok]
    for r in REGIONS:
        print(f"Land in {r}: {sum(c['region'] == r for c in land)} cells")
    return land


def prepare(da: xr.DataArray, spec: VarSpec) -> xr.DataArray:
    """Units, time set to the first day of the month, and (time, lat, lon) order."""
    da = da * spec.scale + spec.offset
    da = da.transpose("time", "lat", "lon")
    t = da["time"].values.astype("datetime64[M]")
    da = da.assign_coords(time=t.astype("datetime64[ns]"))
    return da.groupby("time").mean()  # in case of duplicated months


def to_grid(da: xr.DataArray, cells: list[dict], method: str) -> xr.DataArray:
    """Moves the variable to the cell centres: (time, cell)."""
    lats = xr.DataArray([c["lat"] for c in cells], dims="cell")
    lons = xr.DataArray([c["lon"] for c in cells], dims="cell")
    if method == "linear":
        out = da.interp(lat=lats, lon=lons, method="linear")
    else:
        out = da.sel(lat=lats, lon=lons, method="nearest")
    return out.assign_coords(cell=[c["cell_id"] for c in cells])


# ------------------------------------------------------------- statistics ---
def trend_stats(values: np.ndarray, months: np.ndarray) -> dict | None:
    """Trend on anomalies (seasonal cycle removed).

    - Sen slope on real time (tolerates gaps).
    - Mann-Kendall with pre-whitening: corrects the autocorrelation that inflates
      significance in monthly series.
    - 95 % CI of the slope (Gilbert, 1987) corrected for autocorrelation.
    """
    import pymannkendall as mk

    valid = ~np.isnan(values)
    if valid.sum() < MIN_MONTHS:
        return None
    moy = months.astype("datetime64[M]").astype(int) % 12
    clim = np.array([np.nanmean(values[moy == m]) if np.any(valid & (moy == m)) else np.nan
                     for m in range(12)])
    anom = values - clim[moy]
    t_years = months.astype("datetime64[M]").astype(int) / 12.0
    y, t = anom[valid], t_years[valid]

    # p-value: Mann-Kendall with pre-whitening (Yue and Wang, 2002). On simulated AR(1)
    # series like ours it keeps ~5 % false positives; the classic test gives ~26 % and
    # the Hamed-Rao variant in pymannkendall ~16 %.
    res = mk.pre_whitening_modification_test(y)

    i, j = np.triu_indices(len(y), k=1)
    slopes = np.sort((y[j] - y[i]) / (t[j] - t[i]))
    n_sl, n = len(slopes), len(y)
    # 95 % CI of Sen's slope (Gilbert, 1987) with the variance inflated by the lag-1
    # autocorrelation of the residuals: factor (1+rho)/(1-rho). Simulated coverage: ~95 %.
    resid = y - np.median(slopes) * t
    resid = resid - resid.mean()
    rho = float(np.clip(np.corrcoef(resid[:-1], resid[1:])[0, 1], 0, 0.95))
    var_s = n * (n - 1) * (2 * n + 5) / 18 * (1 + rho) / (1 - rho)
    c = 1.96 * math.sqrt(var_s)
    lo = int(np.clip(math.floor((n_sl - c) / 2), 0, n_sl - 1))
    hi = int(np.clip(math.ceil((n_sl + c) / 2), 0, n_sl - 1))
    slope = float(np.median(slopes))

    sig = bool(res.p < 0.05)
    return {
        "climatology": clim,
        "n_months": int(valid.sum()),
        "mean_value": float(np.nanmean(values)),
        "slope_per_decade": slope * 10,
        "slope_ci_low": float(slopes[lo]) * 10,
        "slope_ci_high": float(slopes[hi]) * 10,
        "mk_tau": float(res.Tau),
        "p_value": float(res.p),
        "significant": sig,
        "direction": ("increasing" if slope > 0 else "decreasing") if sig else "no trend",
    }


def climatology(values: np.ndarray, months: np.ndarray) -> np.ndarray:
    """12 monthly means (Jan..Dec). Descriptive, for the charts."""
    moy = months.astype("datetime64[M]").astype(int) % 12
    return np.array([np.nanmean(values[moy == m]) if np.any(~np.isnan(values[moy == m]))
                     else np.nan for m in range(12)])


def build_rows(spec: VarSpec, grid: xr.DataArray, with_trends: bool) -> tuple[list, list]:
    months = grid["time"].values
    series_rows, trend_rows = [], []
    clean = lambda a: [None if np.isnan(x) else round(float(x), 4) for x in a]
    for k, cell_id in enumerate(grid["cell"].values):
        v = grid.isel(cell=k).values.astype(float)
        if np.all(np.isnan(v)):
            continue  # cell without any data
        series_rows.append({
            "cell_id": int(cell_id), "var_id": spec.id,
            "start_month": str(months[0])[:10],
            "values": clean(v), "climatology": clean(climatology(v, months)),
        })
        if not with_trends:
            continue
        st = trend_stats(v, months)
        if st is None:
            continue
        trend_rows.append({
            "cell_id": int(cell_id), "var_id": spec.id,
            "period_start": str(months[0])[:10], "period_end": str(months[-1])[:10],
            **{key: st[key] for key in ("n_months", "mean_value", "slope_per_decade",
                                        "slope_ci_low", "slope_ci_high", "mk_tau",
                                        "p_value", "significant", "direction")},
        })
    return series_rows, trend_rows


# ----------------------------------------------------------------- output ---
def upload(db_url: str, cells: list, specs: list, series: list, trends: list) -> None:
    import psycopg

    used = {r["cell_id"] for r in series}
    with psycopg.connect(db_url) as conn, conn.cursor() as cur:
        cur.executemany(
            """insert into variables (id, name_en, unit, source, definition_en)
               values (%s,%s,%s,%s,%s)
               on conflict (id) do update set name_en=excluded.name_en, unit=excluded.unit,
               source=excluded.source, definition_en=excluded.definition_en""",
            [(s.id, s.name_en, s.unit, f"NASA {s.short_name} v{s.version}", s.definition_en)
             for s in specs])
        cur.executemany(
            """insert into cells (cell_id, lat, lon, region) values (%s,%s,%s,%s)
               on conflict (cell_id) do nothing""",
            [(c["cell_id"], c["lat"], c["lon"], c["region"]) for c in cells
             if c["cell_id"] in used])
        cur.executemany(
            """insert into series (cell_id, var_id, start_month, values, climatology)
               values (%s,%s,%s,%s,%s)
               on conflict (cell_id, var_id) do update set start_month=excluded.start_month,
               values=excluded.values, climatology=excluded.climatology""",
            [(r["cell_id"], r["var_id"], r["start_month"], r["values"], r["climatology"])
             for r in series])
        if not trends:
            conn.commit()
            print(f"Uploaded: {len(used)} cells, {len(series)} series (no trends)")
            return
        cols = ["cell_id", "var_id", "period_start", "period_end", "n_months", "mean_value",
                "slope_per_decade", "slope_ci_low", "slope_ci_high", "mk_tau", "p_value",
                "significant", "direction"]
        upd = ", ".join(f"{c}=excluded.{c}" for c in cols[2:])
        cur.executemany(
            f"""insert into trends ({", ".join(cols)}) values ({", ".join(["%s"] * len(cols))})
                on conflict (cell_id, var_id) do update set {upd}""",
            [tuple(r[c] for c in cols) for r in trends])
        conn.commit()
    print(f"Uploaded: {len(used)} cells, {len(series)} series, {len(trends)} trends")


def export_json(out: Path, cells: list, specs: list, series: list, trends: list) -> None:
    """Static plan B (GitHub Pages, Storage...): one JSON per cell + one JSON of trends."""
    (out / "cells").mkdir(parents=True, exist_ok=True)
    meta = {s.id: {"name_en": s.name_en, "unit": s.unit,
                   "source": f"NASA {s.short_name} v{s.version}",
                   "definition_en": s.definition_en} for s in specs}
    (out / "variables.json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    (out / "trends.json").write_text(json.dumps(trends))
    by_cell: dict[int, dict] = {}
    cinfo = {c["cell_id"]: c for c in cells}
    tr = {(t["cell_id"], t["var_id"]): t for t in trends}
    for s in series:
        d = by_cell.setdefault(s["cell_id"], {**cinfo[s["cell_id"]], "vars": {}})
        d["vars"][s["var_id"]] = {**s, "trend": tr.get((s["cell_id"], s["var_id"]))}
    for cid, d in by_cell.items():
        (out / "cells" / f"{cid}.json").write_text(json.dumps(d))
    print(f"Exported: {len(by_cell)} cells to {out}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--end", default="2026-10-31", help="last month to request")
    ap.add_argument("--only", nargs="*", help="ids of the variables to process")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--export-dir", type=Path)
    ap.add_argument("--with-trends", action="store_true",
                    help="also compute trends (off by default: statistics fills `trends`)")
    args = ap.parse_args()

    specs = [s for s in VARS if not args.only or s.id in args.only]
    cells = land_cells(target_cells())
    all_series, all_trends = [], []
    by_product: dict[str, list[VarSpec]] = {}
    for spec in specs:
        by_product.setdefault(spec.short_name, []).append(spec)
    for group in by_product.values():
        ds = fetch_dataset(group, args.end)
        for spec in group:
            da = prepare(ds[spec.nc_var], spec)
            grid = to_grid(da, cells, spec.regrid)
            s_rows, t_rows = build_rows(spec, grid, args.with_trends)
            all_series += s_rows
            all_trends += t_rows
            print(f"[{spec.id}] {len(s_rows)} cells with a series")

    if args.export_dir:
        export_json(args.export_dir, cells, specs, all_series, all_trends)
    if args.upload:
        upload(os.environ["SUPABASE_DB_URL"], cells, specs, all_series, all_trends)


if __name__ == "__main__":
    main()
