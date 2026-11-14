"""Trend detection for monthly series (Interface 2 of pipeline/README.md).

Same method as the database `trends` table (docs/stats-data.md), so that both give the
same slope, p-value and significance for the same series.
"""

from __future__ import annotations

import math
import re

import numpy as np
import pymannkendall
from scipy import stats

MIN_MONTHS = 120
TEST_NAME = "mann-kendall-prewhitening-yue-wang-2002"
_DATE_RE = re.compile(r"^(\d{4})-(\d{2})$")


def analyze_trend(dates: list[str], values: list[float | None], alpha: float = 0.05) -> dict:
    """Detect a monotonic trend in a monthly series.

    Method (identical to the database `trends` rows):
      1. Anomalies: each value minus the mean of its calendar month over the whole series
         (gaps ignored), so the seasonal cycle does not contaminate the trend.
      2. Slope: Sen slope (median of all pairwise slopes, `scipy.stats.theilslopes`) of the
         anomalies against real time in decimal years -> units per year.
      3. Significance: Mann-Kendall test with pre-whitening (Yue and Wang, 2002), via
         `pymannkendall.pre_whitening_modification_test`. The lag-1 autocorrelation is removed
         before the test, which corrects the false positives caused by serially correlated
         monthly data.
      4. 95 % confidence interval of the slope: Gilbert (1987) rank method, with var(S)
         inflated by (1 + rho) / (1 - rho), rho = lag-1 autocorrelation of the residuals.

    References:
      Yue, S. and Wang, C. (2002). Applicability of prewhitening to eliminate the influence
        of serial correlation on the Mann-Kendall test. Water Resources Research 38(6), 1068.
      Gilbert, R. O. (1987). Statistical Methods for Environmental Pollution Monitoring.
        Van Nostrand Reinhold, New York.

    Args:
        dates: "YYYY-MM" strings, monthly, sorted, consecutive, no duplicates.
        values: same length as `dates`; None marks a gap.
        alpha: significance level of the test and of the (1 - alpha) confidence interval.

    Returns:
        dict with slope (units/year), p_value, significant, test, slope_ci_low, slope_ci_high,
        mk_tau, n_points (non-null months), start and end (first and last non-null month),
        total_change (slope * years spanned) and direction ("increasing", "decreasing" or
        "no trend").

    Raises:
        ValueError: mismatched lengths, malformed / duplicated / unsorted / non-consecutive
            dates, NaN or infinite values, alpha outside (0, 1), or fewer than 120 non-null months.
    """
    months = _validate(dates, values, alpha)

    anomalies = _anomalies(months, values)
    keep = [i for i, v in enumerate(anomalies) if v is not None]
    t = np.array([_decimal_year(*months[i]) for i in keep])
    y = np.array([anomalies[i] for i in keep], dtype=float)

    sen = stats.theilslopes(y, t)
    slope = float(sen.slope)
    intercept = float(sen.intercept)

    mk = pymannkendall.pre_whitening_modification_test(y, alpha)
    p_value = float(mk.p)

    ci_low, ci_high = _gilbert_ci(t, y, slope, intercept, alpha)

    significant = bool(p_value < alpha)
    if not significant:
        direction = "no trend"
    elif slope > 0:
        direction = "increasing"
    else:
        direction = "decreasing"

    return {
        "slope": slope,
        "p_value": p_value,
        "significant": significant,
        "test": TEST_NAME,
        "slope_ci_low": ci_low,
        "slope_ci_high": ci_high,
        "mk_tau": float(mk.Tau),
        "n_points": len(keep),
        "start": dates[keep[0]],
        "end": dates[keep[-1]],
        "total_change": slope * float(t[-1] - t[0]),
        "direction": direction,
    }


def _validate(dates: list[str], values: list[float | None], alpha: float) -> list[tuple[int, int]]:
    """Check the inputs and return the dates parsed as (year, month) tuples."""
    if len(dates) != len(values):
        raise ValueError(f"dates and values have different lengths ({len(dates)} vs {len(values)})")
    if not 0 < alpha < 1:
        raise ValueError(f"alpha must be between 0 and 1, got {alpha}")

    months = []
    for d in dates:
        m = _DATE_RE.match(d) if isinstance(d, str) else None
        if not m or not 1 <= int(m.group(2)) <= 12:
            raise ValueError(f"date {d!r} is not in 'YYYY-MM' format")
        months.append((int(m.group(1)), int(m.group(2))))

    if len(set(months)) != len(months):
        raise ValueError("dates contain duplicates")
    if months != sorted(months):
        raise ValueError("dates are not sorted")
    for (y0, m0), (y1, m1) in zip(months, months[1:]):
        if (y1 * 12 + m1) - (y0 * 12 + m0) != 1:
            raise ValueError(
                f"dates are not consecutive months ({y0}-{m0:02d} -> {y1}-{m1:02d}); "
                "insert missing months as None"
            )

    for v in values:
        if v is not None and not math.isfinite(v):
            raise ValueError(f"value {v!r} is not finite; use None for gaps")

    n_valid = sum(v is not None for v in values)
    if n_valid < MIN_MONTHS:
        raise ValueError(f"need at least {MIN_MONTHS} non-null months, got {n_valid}")
    return months


def _decimal_year(year: int, month: int) -> float:
    """Decimal year: year + (month - 1) / 12."""
    return year + (month - 1) / 12


def _anomalies(months: list[tuple[int, int]], values: list[float | None]) -> list[float | None]:
    """Value minus the mean of its calendar month over the whole series (None stays None)."""
    by_month: dict[int, list[float]] = {}
    for (_, m), v in zip(months, values):
        if v is not None:
            by_month.setdefault(m, []).append(float(v))
    climatology = {m: sum(vs) / len(vs) for m, vs in by_month.items()}
    return [None if v is None else float(v) - climatology[m] for (_, m), v in zip(months, values)]


def _gilbert_ci(t: np.ndarray, y: np.ndarray, slope: float, intercept: float, alpha: float) -> tuple[float, float]:
    """(1 - alpha) confidence interval of the Sen slope, Gilbert (1987), autocorrelation-inflated.

    Steps:
      1. All N' = n(n-1)/2 pairwise slopes (y_j - y_i) / (t_j - t_i), i < j, sorted.
      2. var(S) of Mann-Kendall with the ties correction, on the (non-pre-whitened) anomalies:
         [n(n-1)(2n+5) - sum t_k(t_k-1)(2t_k+5)] / 18, t_k = size of each group of tied values.
      3. var(S) *= (1 + rho) / (1 - rho), rho = lag-1 autocorrelation of the residuals
         y - (intercept + slope * t), taken between consecutive non-null points.
      4. C = z(1 - alpha/2) * sqrt(var(S)); 1-based ranks M1 = (N' - C) / 2 and
         M2 = (N' + C) / 2 + 1; the interval is the slopes at ranks M1 and M2.

    Rounding: M1 is rounded down and M2 rounded up, then both are clipped to [1, N'].
    This makes the interval slightly wider (conservative) and guarantees low <= slope <= high.
    """
    n = len(y)
    i, j = np.triu_indices(n, k=1)
    pair_slopes = np.sort((y[j] - y[i]) / (t[j] - t[i]))
    n_pairs = len(pair_slopes)

    _, tie_counts = np.unique(y, return_counts=True)
    var_s = (n * (n - 1) * (2 * n + 5) - np.sum(tie_counts * (tie_counts - 1) * (2 * tie_counts + 5))) / 18

    residuals = y - (intercept + slope * t)
    rho = _lag1_autocorrelation(residuals)
    # Clip rho to [0, 0.99]: a negative rho would shrink the interval below the
    # independent-data case, and rho close to 1 would make the inflation factor explode.
    rho = min(max(rho, 0.0), 0.99)
    var_s *= (1 + rho) / (1 - rho)

    c = stats.norm.ppf(1 - alpha / 2) * math.sqrt(var_s)
    m1 = math.floor((n_pairs - c) / 2)
    m2 = math.ceil((n_pairs + c) / 2 + 1)
    m1 = min(max(m1, 1), n_pairs)
    m2 = min(max(m2, 1), n_pairs)
    return float(pair_slopes[m1 - 1]), float(pair_slopes[m2 - 1])


def _lag1_autocorrelation(x: np.ndarray) -> float:
    """Lag-1 autocorrelation, same estimator as pymannkendall (mean removed, divided by n)."""
    d = x - x.mean()
    denom = float(np.dot(d, d))
    if denom == 0:
        return 0.0
    return float(np.dot(d[:-1], d[1:]) / denom)
