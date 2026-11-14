"""Plain-English facts about a trend result, for the AI checker (block 4 of pipeline/README.md).

Deterministic: no LLM, no randomness. Same input -> same text.
"""

from __future__ import annotations

CAVEAT = (
    "A non-significant result means the data show no clear evidence of change, "
    "not proof that nothing changed."
)


def explain(trend: dict, series) -> str:
    """Return short facts about `trend` and `series`, one fact per line.

    Args:
        trend: output of analyze_trend (or of trend_from_db, same keys). Only the contract keys
            (slope, p_value, significant, test) are required; a line whose keys are missing is skipped.
        series: any object with attributes place, variable, units, dataset, lat, lon
            (e.g. pipeline.series.Series); missing attributes are skipped too.

    Numbers use 3 significant figures, except lat/lon (3 decimals); p-values below 0.001 are
    written "p < 0.001".
    """
    place = getattr(series, "place", None)
    variable = getattr(series, "variable", None)
    units = getattr(series, "units", None)
    dataset = getattr(series, "dataset", None)
    lat = getattr(series, "lat", None)
    lon = getattr(series, "lon", None)
    u = f" {units}" if units else ""

    lines = []

    if place is not None:
        coords = f" ({lat:.3f}, {lon:.3f})" if lat is not None and lon is not None else ""
        lines.append(f"Place: {place}{coords}")

    if variable is not None:
        line = f"Variable: {variable}" + (f" ({units})" if units else "")
        if dataset:
            line += f". {_credit(dataset)}"
        lines.append(line)
    elif dataset:
        lines.append(_credit(dataset))

    if "start" in trend and "end" in trend:
        line = f"Period: {trend['start']} to {trend['end']}"
        if "n_points" in trend:
            line += f", {trend['n_points']} valid months"
        lines.append(line)

    slope = trend.get("slope")
    if slope is not None:
        line = f"Trend: {_num(slope)}{u}/year ({_num(slope * 10)}{u}/decade)"
        if trend.get("slope_ci_low") is not None and trend.get("slope_ci_high") is not None:
            line += f", 95% CI {_num(trend['slope_ci_low'])} to {_num(trend['slope_ci_high'])}{u}/year"
        lines.append(line)

    if trend.get("total_change") is not None:
        lines.append(f"Total change over the period: {_num(trend['total_change'])}{u}")

    significant = trend.get("significant")
    if trend.get("p_value") is not None:
        line = f"Mann-Kendall p-value: {_p(trend['p_value'])}"
        if significant is not None:
            line += ", significant at the 5% level" if significant else ", not significant at the 5% level"
        lines.append(line)

    direction = _direction(trend)
    if direction is not None:
        lines.append(f"Direction: {direction}")

    for warning in trend.get("warnings") or []:
        lines.append(f"Warning: {warning}")

    if significant is False:
        lines.append(CAVEAT)

    return "\n".join(lines)


def _credit(dataset: str) -> str:
    """'Data: NASA <dataset>', without repeating NASA when the dataset name already has it."""
    return f"Data: {dataset}" if dataset.startswith("NASA") else f"Data: NASA {dataset}"


def _num(x: float) -> str:
    """3 significant figures."""
    return f"{x:.3g}"


def _p(p: float) -> str:
    return "p < 0.001" if p < 0.001 else f"p = {_num(p)}"


def _direction(trend: dict) -> str | None:
    """Direction in words; derived from significant and the slope sign if the key is missing."""
    direction = trend.get("direction")
    if direction is None:
        significant, slope = trend.get("significant"), trend.get("slope")
        if significant is None or slope is None:
            return None
        direction = ("increasing" if slope > 0 else "decreasing") if significant else "no trend"
    return "no statistically significant trend" if direction == "no trend" else direction
