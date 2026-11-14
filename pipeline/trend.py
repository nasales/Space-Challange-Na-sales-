"""Trend + significance for one time series. Owned by the Data area (Person 3).

Rules (docs/agents/data.md): use established libraries (pymannkendall, scipy.stats),
remove the seasonal cycle before testing monthly data, report the slope per year in
the variable's units, and never force significance.
"""
from typing import List, Optional, TypedDict


class TrendResult(TypedDict):
    slope: float          # units per year
    p_value: float        # 0-1
    significant: bool     # p_value < 0.05
    test: str             # e.g. "mann-kendall"


def compute_trend(dates: List[str], values: List[Optional[float]]) -> TrendResult:
    """Return the fields of docs/contract.md that come from the statistics."""
    raise NotImplementedError("Data area: implement with pymannkendall / scipy.stats")
