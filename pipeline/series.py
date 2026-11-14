"""Monthly time series shared by the whole pipeline (Interface 1 in pipeline/README.md).

Every source adapter turns its raw data into a `Series`:
always monthly, sorted, one value per month, gaps as `None`.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass

# "Missing data" codes used in NASA files. They are never real values.
FILL_VALUES: tuple[float, ...] = (-999.0, -9999.0, -99999.0)

_MONTH_RE = re.compile(r"^(\d{4})-(\d{2})$")
_FIRST_DAY_RE = re.compile(r"^\d{4}-\d{2}-01$")


@dataclass
class Series:
    place: str
    lat: float
    lon: float
    variable: str  # dataset id, e.g. "tair"
    units: str  # e.g. "°C"
    dataset: str  # e.g. "GLDAS-2.1 Noah"
    dates: list[str]  # "YYYY-MM", sorted, monthly, no duplicates
    values: list[float | None]  # same length as dates; None = gap

    def validate(self) -> Series:
        """Raise ValueError if the series breaks the rules in pipeline/README.md. Returns self."""
        for name in ("place", "variable", "units", "dataset"):
            text = getattr(self, name)
            if not isinstance(text, str) or not text.strip():
                raise ValueError(f"{name} must be a non-empty string")

        for name, limit in (("lat", 90), ("lon", 180)):
            number = getattr(self, name)
            if not _is_number(number) or not math.isfinite(number) or abs(number) > limit:
                raise ValueError(f"{name} must be a number between -{limit} and {limit}, got {number!r}")

        if len(self.dates) != len(self.values):
            raise ValueError(
                f"dates and values differ in length ({len(self.dates)} vs {len(self.values)})"
            )
        if not self.dates:
            raise ValueError("series is empty")

        months = [parse_month(d) for d in self.dates]
        for prev, cur, label in zip(months, months[1:], self.dates[1:]):
            if cur != next_month(prev):
                raise ValueError(
                    f"dates must be consecutive months, sorted, with no duplicates; problem at {label}"
                )

        for date, value in zip(self.dates, self.values):
            if value is None:
                continue
            if not _is_number(value):
                raise ValueError(f"value at {date} is not a number: {value!r}")
            if not math.isfinite(value):
                raise ValueError(f"value at {date} is NaN or infinite; use None for gaps")
            if float(value) in FILL_VALUES:
                raise ValueError(f"value at {date} is a fill code ({value}); use None for gaps")
        return self


def from_start_month(
    start_month: str,
    values: list,
    *,
    place: str,
    lat: float,
    lon: float,
    variable: str,
    units: str,
    dataset: str,
) -> Series:
    """Build a validated `Series` from the Supabase export shape: first month + one value per month.

    `start_month` is "YYYY-MM" or the database date "YYYY-MM-01".
    `null`/None, NaN, infinity and fill codes (-999, -9999, -99999) become `None`.
    Anything else that is not a number raises ValueError.
    """
    month = parse_month(normalize_month(start_month))
    dates: list[str] = []
    clean: list[float | None] = []
    for i, raw in enumerate(values):
        dates.append(format_month(month))
        clean.append(_clean_value(raw, i))
        month = next_month(month)

    return Series(
        place=place,
        lat=lat,
        lon=lon,
        variable=variable,
        units=units,
        dataset=dataset,
        dates=dates,
        values=clean,
    ).validate()


# ---------- month helpers (also useful for other modules) ----------


def parse_month(text: str) -> tuple[int, int]:
    """'2000-01' -> (2000, 1). Raises ValueError if malformed."""
    match = _MONTH_RE.match(text) if isinstance(text, str) else None
    if not match:
        raise ValueError(f"malformed month {text!r} (expected YYYY-MM)")
    year, month = int(match.group(1)), int(match.group(2))
    if not 1 <= month <= 12:
        raise ValueError(f"invalid month number in {text!r}")
    return year, month


def normalize_month(text: str) -> str:
    """Accept "YYYY-MM" or a first-of-month date "YYYY-MM-01" (Supabase `date`); return "YYYY-MM"."""
    if isinstance(text, str) and _FIRST_DAY_RE.match(text):
        text = text[:7]
    format_month(parse_month(text))  # raises ValueError if malformed
    return text


def format_month(ym: tuple[int, int]) -> str:
    return f"{ym[0]:04d}-{ym[1]:02d}"


def next_month(ym: tuple[int, int]) -> tuple[int, int]:
    year, month = ym
    return (year + 1, 1) if month == 12 else (year, month + 1)


# ---------- private ----------


def _is_number(x: object) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _clean_value(raw: object, index: int) -> float | None:
    if raw is None:
        return None
    if not _is_number(raw):
        raise ValueError(f"value #{index} is not a number: {raw!r}")
    value = float(raw)
    if not math.isfinite(value) or value in FILL_VALUES:
        return None
    return value
