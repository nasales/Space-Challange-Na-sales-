"""Read Perry's export of the `case_series` table (area-mean series of the featured cases).

Expected layout (same style as the map export, see `export_json()` in the ETL):
    <dir>/variables.json          {var_id: {unit, source, ...}}
    <dir>/cases/<case_id>.json    {case_id, lat_min, lat_max, lon_min, lon_max,
                                   vars: {var_id: {start_month, values, climatology?}}}

Reading is tolerant: common aliases of field names and variable ids are accepted (e.g. `units` for
`unit`, `precip` for PRECIP). When a required field is missing, the error lists what was found.
Variable ids are returned as the common ids of pipeline/cases.py (T2M, PRECIP, SOILM, NDVI, LST, SNOW);
ids that do not map to one of them are reported in `ignored`.
"""

from __future__ import annotations

import json
from pathlib import Path

from pipeline.cases import VARIABLES

# Accepted spellings (lower case) for each common variable id.
VAR_ALIASES = {
    "T2M": {"t2m", "t2m_long", "tair_2m", "temperature"},
    "PRECIP": {"precip", "precipitation", "prectotcorr", "prcp"},
    "SOILM": {"soilm", "soilmoist", "soil_moisture", "soilmoi0_10cm_inst", "gwettop"},
    "NDVI": {"ndvi"},
    "LST": {"lst", "lst_day", "lst_day_cmg"},
    "SNOW": {"snow", "snow_cover", "snowcover", "snow_cover_monthly_cmg"},
}
CASE_KEYS = {
    "case_id": ("case_id", "id"),
    "lat_min": ("lat_min", "latmin", "min_lat", "south"),
    "lat_max": ("lat_max", "latmax", "max_lat", "north"),
    "lon_min": ("lon_min", "lonmin", "min_lon", "west"),
    "lon_max": ("lon_max", "lonmax", "max_lon", "east"),
    "vars": ("vars", "variables", "series"),
}
ENTRY_KEYS = {"start_month": ("start_month", "start", "first_month"), "values": ("values", "series", "data")}
META_KEYS = {"unit": ("unit", "units"), "source": ("source", "dataset")}


def common_var(raw_id: str) -> str | None:
    """Common variable id for an export variable id, or None if unknown."""
    key = str(raw_id).strip().lower()
    for var, aliases in VAR_ALIASES.items():
        if key == var.lower() or key in aliases:
            return var
    return None


def load_variables(export_dir: str | Path) -> dict[str, dict]:
    """{common var id: {"unit", "source"}} from variables.json (unknown ids are skipped)."""
    path = Path(export_dir) / "variables.json"
    raw = _read_json(path)
    out = {}
    for raw_id, meta in raw.items():
        var = common_var(raw_id)
        if var is not None:
            out[var] = _pick(meta, META_KEYS, f"{path.name} / {raw_id}")
    return out


def load_case(export_dir: str | Path, case_id: str) -> dict | None:
    """Normalized case: {case_id, lat_min, lat_max, lon_min, lon_max, vars: {common id: entry}, ignored}.

    Returns None when cases/<case_id>.json is not in the export.
    """
    cases_dir = Path(export_dir) / "cases"
    if not cases_dir.is_dir():
        found = sorted(p.name for p in Path(export_dir).iterdir()) if Path(export_dir).is_dir() else []
        raise FileNotFoundError(f"no cases/ folder in {export_dir}; found: {found}")
    path = cases_dir / f"{case_id}.json"
    if not path.exists():
        return None
    case = _pick(_read_json(path), CASE_KEYS, f"cases/{path.name}")
    vars_, ignored = {}, []
    for raw_id, entry in case["vars"].items():
        var = common_var(raw_id)
        if var is None:
            ignored.append(raw_id)
            continue
        vars_[var] = _pick(entry, ENTRY_KEYS, f"cases/{path.name} / {raw_id}")
    return {**case, "vars": vars_, "ignored": ignored}


def box_center(case: dict) -> tuple[float, float]:
    return (round((case["lat_min"] + case["lat_max"]) / 2, 4),
            round((case["lon_min"] + case["lon_max"]) / 2, 4))


def _pick(obj: dict, keys: dict[str, tuple[str, ...]], where: str) -> dict:
    """Map aliased fields of `obj` to their canonical names; fail listing what was found."""
    if not isinstance(obj, dict):
        raise ValueError(f"{where}: expected a JSON object, found {type(obj).__name__}")
    lower = {str(k).lower(): k for k in obj}
    out = {k: v for k, v in obj.items()}
    for canonical, aliases in keys.items():
        hit = next((lower[a] for a in aliases if a in lower), None)
        if hit is None:
            raise ValueError(f"{where}: missing field {canonical!r} (accepted: {list(aliases)}); "
                             f"found fields: {sorted(obj)}")
        out[canonical] = obj[hit]
    return out


def _read_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"export file not found: {path}")
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1252")  # ETL files written on Windows without an encoding
    return json.loads(text)


assert set(VAR_ALIASES) == set(VARIABLES)
