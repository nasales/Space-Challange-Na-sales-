"""Pydantic mirror of docs/contract.md. Do not change it unless the contract changes."""
from typing import List, Optional

from pydantic import BaseModel


class CaseData(BaseModel):
    place: str
    lat: float
    lon: float
    variable: str
    units: str
    dataset: str
    dates: List[str]
    values: List[Optional[float]]
    slope: float
    p_value: float
    significant: bool
    test: str


class CaseSummary(BaseModel):
    """Light item for the case list (no series, no statistical result)."""

    id: str
    place: str
    lat: float
    lon: float
    variable: str
