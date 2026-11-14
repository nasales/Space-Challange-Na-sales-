"""NASA POWER monthly point data: download the raw JSON and parse it into monthly series.

API: https://power.larc.nasa.gov/api/temporal/monthly/point (community AG, JSON, no API key).
The raw JSON is saved under data/raw/power/ so the demo works offline (AGENTS.md rule 10).
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

API_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point"
ANNUAL_MONTH = "13"  # POWER adds an annual value as month "13"; it is not a month
DEFAULT_FILL = -999.0
# POWER unit codes -> units shown to the player. Unknown units are kept as given.
DISPLAY_UNITS = {"C": "°C", "1": "fraction (0-1)", "mm/day": "mm/day"}


def download(lat: float, lon: float, param: str, start: int, end: int, path: str | Path,
             timeout: float = 120) -> dict:
    """Download one parameter for one point and save the raw JSON to `path`. Returns the JSON."""
    query = urllib.parse.urlencode({
        "parameters": param, "community": "AG", "longitude": lon, "latitude": lat,
        "start": start, "end": end, "format": "JSON",
    })
    with urllib.request.urlopen(f"{API_URL}?{query}", timeout=timeout) as response:
        raw = json.load(response)
    if param not in raw.get("properties", {}).get("parameter", {}):
        raise ValueError(f"NASA POWER returned no data for {param}: {raw.get('messages')}")
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
    return raw


def parse(raw: dict, param: str) -> tuple[list[str], list[float | None], str]:
    """Raw POWER JSON -> (dates "YYYY-MM", values with None for fill values, units).

    Keys "YYYYMM" are sorted; the annual month "13" is dropped; the header fill value
    (-999) becomes None. Units are mapped for display with DISPLAY_UNITS.
    """
    data = raw["properties"]["parameter"][param]
    fill = float(raw.get("header", {}).get("fill_value", DEFAULT_FILL))
    units = raw.get("parameters", {}).get(param, {}).get("units", "")
    units = DISPLAY_UNITS.get(units, units)

    dates, values = [], []
    for key in sorted(data):
        if len(key) != 6 or not key.isdigit():
            raise ValueError(f"unexpected POWER date key {key!r}")
        if key[4:] == ANNUAL_MONTH:
            continue
        value = data[key]
        dates.append(f"{key[:4]}-{key[4:]}")
        values.append(None if value is None or float(value) == fill else float(value))
    return dates, values, units
