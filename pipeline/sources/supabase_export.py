"""Read the JSON export written by `archivos_preSupabase/etl_espana.py --export-dir <dir>`.

Layout (see `export_json()` in the ETL):
    <dir>/variables.json        {var_id: {name_en, unit, source, definition_en}}
    <dir>/cells/<cell_id>.json  {cell_id, lat, lon, region,
                                 vars: {var_id: {start_month, values, climatology, trend}}}
`trend` is null until the statistics team fills the `trends` table.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Iterator

from pipeline.build_case import trend_from_db
from pipeline.series import Series, from_start_month

GRID = 0.25  # degrees, same grid as GLDAS and the ETL
COLS = int(360 / GRID)  # 1440
SEARCH_DEG = 0.5  # get_cell() looks for the nearest land cell within ~0.5°


# ---------- grid ----------


def cell_id_for(lat: float, lon: float) -> int:
    """Cell that contains (lat, lon): floor((lat+90)/0.25) * 1440 + floor((lon+180)/0.25)."""
    if not -90 <= lat <= 90 or not -180 <= lon <= 180:
        raise ValueError(f"coordinates out of range: {lat}, {lon}")
    return math.floor((lat + 90) / GRID) * COLS + math.floor((lon + 180) / GRID)


def cell_center(cell_id: int) -> tuple[float, float]:
    row, col = divmod(cell_id, COLS)
    return round(-90 + GRID * (row + 0.5), 4), round(-180 + GRID * (col + 0.5), 4)


def find_cell(export_dir: str | Path, lat: float, lon: float) -> int:
    """Nearest land cell present in the export, within ~0.5° (like `get_cell` in Supabase).

    Raises LookupError when there is none (open sea or outside the exported area).
    """
    cells_dir = Path(export_dir) / "cells"
    reach = math.ceil(SEARCH_DEG / GRID)
    centre = cell_id_for(lat, lon)
    row0, col0 = divmod(centre, COLS)
    best: tuple[float, int] | None = None
    for dr in range(-reach, reach + 1):
        for dc in range(-reach, reach + 1):
            cid = (row0 + dr) * COLS + (col0 + dc)
            if not (cells_dir / f"{cid}.json").exists():
                continue
            clat, clon = cell_center(cid)
            dist = math.hypot(clat - lat, (clon - lon) * math.cos(math.radians(lat)))
            if dist <= SEARCH_DEG and (best is None or dist < best[0]):
                best = (dist, cid)
    if best is None:
        raise LookupError(f"no land cell within {SEARCH_DEG}° of ({lat}, {lon}) in {cells_dir}")
    return best[1]


# ---------- reading ----------


def load_variables(export_dir: str | Path) -> dict:
    return _read_json(Path(export_dir) / "variables.json")


def load_cell(export_dir: str | Path, cell_id: int) -> dict:
    return _read_json(Path(export_dir) / "cells" / f"{int(cell_id)}.json")


def load_series(
    export_dir: str | Path,
    cell_id: int,
    var_id: str,
    *,
    place: str | None = None,
) -> Series:
    """`Series` for one cell and variable. `place` defaults to "Cell <id>"."""
    cell = load_cell(export_dir, cell_id)
    meta = _variable_meta(export_dir, var_id)
    entry = _var_entry(cell, var_id)
    return from_start_month(
        entry["start_month"],
        entry["values"],
        place=place or f"Cell {cell['cell_id']}",
        lat=cell["lat"],
        lon=cell["lon"],
        variable=var_id,
        units=meta["unit"],
        dataset=meta["source"],
    )


def load_trend(export_dir: str | Path, cell_id: int, var_id: str) -> dict | None:
    """Trend already stored for this cell (analyze_trend shape, slope per year), or None if empty."""
    row = _var_entry(load_cell(export_dir, cell_id), var_id).get("trend")
    return trend_from_db(row) if row else None


def iter_series(export_dir: str | Path, var_ids: list[str] | None = None) -> Iterator[tuple[int, str, Series]]:
    """Every (cell_id, var_id, Series) in the export, sorted by cell then variable."""
    cells_dir = Path(export_dir) / "cells"
    if not cells_dir.is_dir():
        raise FileNotFoundError(f"no cells/ folder in {export_dir}")
    ids = sorted(int(p.stem) for p in cells_dir.glob("*.json") if p.stem.isdigit())
    for cid in ids:
        cell = load_cell(export_dir, cid)
        for var_id in sorted(cell.get("vars", {})):
            if var_ids is None or var_id in var_ids:
                yield cid, var_id, load_series(export_dir, cid, var_id)


# ---------- private ----------


def _variable_meta(export_dir: str | Path, var_id: str) -> dict:
    variables = _read_json_cached(str(Path(export_dir).resolve() / "variables.json"))
    if var_id not in variables:
        raise ValueError(f"unknown variable {var_id!r}; variables.json has {sorted(variables)}")
    meta = variables[var_id]
    for key in ("unit", "source"):
        if not meta.get(key):
            raise ValueError(f"variables.json: {var_id} has no {key!r}")
    return meta


def _var_entry(cell: dict, var_id: str) -> dict:
    entries = cell.get("vars") or {}
    if var_id not in entries:
        raise ValueError(f"cell {cell.get('cell_id')} has no variable {var_id!r}; it has {sorted(entries)}")
    entry = entries[var_id]
    for key in ("start_month", "values"):
        if key not in entry:
            raise ValueError(f"cell {cell.get('cell_id')} / {var_id}: missing {key!r}")
    return entry


def _read_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"export file not found: {path}")
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        # The ETL writes variables.json with Path.write_text() and no encoding,
        # which on Windows means cp1252 ("°C", "kg/m²").
        text = raw.decode("cp1252")
    return json.loads(text)


@lru_cache(maxsize=8)
def _read_json_cached(path: str) -> dict:
    return _read_json(Path(path))
