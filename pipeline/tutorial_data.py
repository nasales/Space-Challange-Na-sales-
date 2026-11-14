"""Chart data for featured-case tutorials: data/tutorial_data/<case_id>.json.

Output shape: `TutorialData` / `TutorialSeries` in src/shared/tutorial.ts (rules in
docs/case_tutorials.md). The UI draws every tutorial chart from this file only (offline).

Input: the committed contract files data/cache/case_<id>_<VAR>.json listed in
data/cases_index.json for the case. No network.

Per variable (TutorialSeries):
  monthly      dates and values exactly as in the case file (null = gap).
  climatology  12 means, January..December: mean of the non-null values of each calendar
               month over the whole series. Same baseline as the anomalies of
               pipeline/trend.py (`_anomalies`).
  anomaly      `trend._anomalies` (value minus the climatology of its month; null stays null).
  annual       mean of the raw monthly values of each calendar year with all 12 months
               present and non-null. Incomplete years (partial first/last year, or any gap)
               are left out, so a missing winter or summer never biases an annual mean.
  max          largest non-null monthly value and its date (first one on ties).
  trend        `analyze_trend` on the monthly series: slope_per_year, ci_low, ci_high,
               p_value, significant, test. The slope and p-value are checked against the
               case file (abs. difference <= 1e-9); a mismatch raises an error.

Trend lines (straight, for drawing). t = decimal year as in trend.py, year + (month - 1) / 12.
  intercept     Sen-style: median over non-null months of (anomaly_i - slope * t_i).
  anomaly_line  intercept + slope * t at the first and last date of the monthly series.
  monthly_line  anomaly_line + mean of the 12 climatology values, so the line sits on the
                raw monthly series.
  annual_line   intercept + slope * t + mean of the climatology, at t = year + 5.5 / 12 for
                the first and last annual year. year + 5.5 / 12 is the mean t of the 12
                months of that year, so the line value equals the annual mean of the
                monthly line (the line passes through the "middle" of each annual bar).

Technique data (`extras`, TutorialExtras; always present):
  same_month        12 YearlySeries (index 0 = January): the raw value of that calendar month
                    in each year where it is non-null.
  seasons           DJF, MAM, JJA, SON, JJAS: mean of the raw monthly values of each complete
                    season (every month present and non-null; incomplete seasons are skipped).
                    DJF = December of year - 1 + January + February, labelled with the year of
                    its January (so the first DJF needs the December before it).
  YearlySeries.trend  Sen slope with its 95 % CI (`scipy.stats.theilslopes`) against the year;
                    p-value from the ORIGINAL Mann-Kendall test (`pymannkendall.original_test`,
                    no pre-whitening: one value per year has little serial correlation, and
                    pre-whitening a short yearly series removes part of the trend);
                    significant = p < 0.05; test = "mann-kendall"; line = Theil-Sen intercept
                    + slope * year at the first and last year.
  threshold_counts  per case and variable from CASE_THRESHOLDS: per complete calendar year
                    (12 non-null months), number of monthly values strictly above / below the
                    threshold, with a yearly trend as above. Chosen after looking at the data
                    (both give non-zero counts in most years, 1980-2025):
                    aneto_glacier T2M below 0 °C: 0-4 months per year (0 in 2016, 2022,
                      2024, 2025). The MERRA-2 pixel is much lower than the glacier, so these
                      are freezing months of the pixel, not of the ice.
                    cordoba_heat T2M monthly mean above 28 °C: 0-2 months per year (mostly 0
                      before 2000, 2 in every year 2019-2025).
                    Other cases: empty list.
  zscore_smooth12   anomaly / population standard deviation (ddof = 0) of all non-null
                    anomalies, then a centred 12-month running mean (null unless all 12 months
                    of the window are non-null and inside the record). Same dates as monthly.
  cumulative_anomaly  running sum of the anomalies; a gap adds 0 but its own value is null.
  running_mean      "12" and "60": centred running means of the raw monthly values, same
                    length as monthly; null where the window runs past either end of the record
                    or contains a gap. Centring for an even window w: the value at month i is
                    the mean of months i - w/2 .. i + w/2 - 1 (w/2 months before, w/2 - 1
                    after; the true centre is half a month before month i). zscore_smooth12
                    uses the same convention.
  periods           split = the January closest to the middle of the monthly record (earlier
                    one on ties); before = months < split, after = months >= split; from/to,
                    mean anomaly and n over the non-null anomalies of each part. bin_edges:
                    shared equal-width bins, step = 1, 2, 2.5 or 5 x 10^k with edges on
                    multiples of the step, spanning all anomalies; the step with 12-16 bins
                    closest to 14, or else the closest count to 14 (11-18 bins on the 10
                    cases). Counts as numpy.histogram (each bin [a, b), the last one [a, b]).
  window_trends     `analyze_trend` (the official method) on the monthly series from January of
                    each start year to the last date: start years = first complete calendar
                    year, then every 5 years, while at least 180 months (15 years) remain.

Rounding: series values and line ends to 6 significant digits; trend statistics are kept
at full precision (they must match the case file). Extras (values and their trend numbers)
are rounded to 6 significant digits. Output is deterministic: fixed key
order, UTF-8, ensure_ascii=False, newline at the end.

CLI:
  py -m pipeline.tutorial_data --case dana_valencia
  py -m pipeline.tutorial_data --all
"""

from __future__ import annotations

import argparse
import json
import math
import statistics
from pathlib import Path

import numpy as np
import pymannkendall
from scipy import stats

from pipeline.trend import _anomalies, _decimal_year, _validate, analyze_trend

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "data" / "cases_index.json"
CACHE_DIR = ROOT / "data" / "cache"
OUT_DIR = ROOT / "data" / "tutorial_data"
TOLERANCE = 1e-9
DIGITS = 6
ANNUAL_T_OFFSET = 5.5 / 12   # mean of (month - 1) / 12 over the 12 months

ALPHA = 0.05
YEARLY_TEST = "mann-kendall"
WINDOW_STEP_YEARS = 5
WINDOW_MIN_MONTHS = 180
RUNNING_WINDOWS = (12, 60)
SEASONS = {   # season id -> (year offset, month); offset -1 = the year before
    "DJF": [(-1, 12), (0, 1), (0, 2)],
    "MAM": [(0, 3), (0, 4), (0, 5)],
    "JJA": [(0, 6), (0, 7), (0, 8)],
    "SON": [(0, 9), (0, 10), (0, 11)],
    "JJAS": [(0, 6), (0, 7), (0, 8), (0, 9)],
}
# threshold_counts per case and variable (why these values: module docstring)
CASE_THRESHOLDS = {
    "aneto_glacier": {
        "T2M": [{"id": "below_0", "label": "Months below 0 °C", "op": "below", "value": 0.0}],
    },
    "cordoba_heat": {
        "T2M": [{"id": "above_28", "label": "Months above 28 °C on average", "op": "above",
                 "value": 28.0}],
    },
}

NAMES = {
    "PRECIP": "Precipitation",
    "T2M": "Air temperature at 2 m",
    "SOILM": "Soil moisture (top 10 cm)",
}


def _round(x: float | None, digits: int = DIGITS) -> float | None:
    """Round to `digits` significant digits (None stays None)."""
    if x is None:
        return None
    if x == 0 or not math.isfinite(x):
        return float(x)
    return round(float(x), digits - 1 - int(math.floor(math.log10(abs(x)))))


def climatology(months: list[tuple[int, int]], values: list[float | None]) -> list[float]:
    """Mean of each calendar month (Jan..Dec) over the non-null values (same as trend.py)."""
    by_month: dict[int, list[float]] = {m: [] for m in range(1, 13)}
    for (_, m), v in zip(months, values):
        if v is not None:
            by_month[m].append(float(v))
    missing = [m for m, vs in by_month.items() if not vs]
    if missing:
        raise ValueError(f"no data for calendar month(s) {missing}; cannot build a climatology")
    return [sum(by_month[m]) / len(by_month[m]) for m in range(1, 13)]


def annual_means(months: list[tuple[int, int]], values: list[float | None]) -> tuple[list[int], list[float]]:
    """Mean of each calendar year that has all 12 months non-null (other years are skipped)."""
    by_year: dict[int, list[float]] = {}
    for (y, _), v in zip(months, values):
        by_year.setdefault(y, [])
        if v is not None:
            by_year[y].append(float(v))
    years = [y for y in sorted(by_year) if len(by_year[y]) == 12]
    return years, [sum(by_year[y]) / 12 for y in years]


# --- technique data (extras) -----------------------------------------------------------------

def yearly_trend(years: list[int], values: list[float]) -> dict:
    """Sen slope + 95 % CI (theilslopes) and original Mann-Kendall p-value of a yearly series."""
    x = np.asarray(years, dtype=float)
    y = np.asarray(values, dtype=float)
    sen = stats.theilslopes(y, x, 1 - ALPHA)
    p = float(pymannkendall.original_test(y, ALPHA).p)
    slope, intercept = float(sen.slope), float(sen.intercept)
    return {
        "slope_per_year": _round(slope),
        "ci_low": _round(float(sen.low_slope)),
        "ci_high": _round(float(sen.high_slope)),
        "p_value": _round(p),
        "significant": bool(p < ALPHA),
        "test": YEARLY_TEST,
        "line": [_round(intercept + slope * years[0]), _round(intercept + slope * years[-1])],
    }


def yearly_series(years: list[int], values: list[float]) -> dict:
    """YearlySeries: years, rounded values and their yearly trend (computed unrounded)."""
    return {"years": list(years), "values": [_round(v) for v in values],
            "trend": yearly_trend(years, values)}


def same_month(months: list[tuple[int, int]], values: list[float | None]) -> list[dict]:
    """12 YearlySeries, January..December: the value of that month in each year (no nulls)."""
    out = []
    for m in range(1, 13):
        pairs = [(y, float(v)) for (y, mm), v in zip(months, values) if mm == m and v is not None]
        out.append(yearly_series([y for y, _ in pairs], [v for _, v in pairs]))
    return out


def season_means(months: list[tuple[int, int]], values: list[float | None],
                 season: str) -> tuple[list[int], list[float]]:
    """Mean of each complete season (all its months non-null); DJF labelled by its January."""
    lookup = dict(zip(months, values))
    years, out = [], []
    for y in sorted({ym[0] for ym in months}):
        vals = [lookup.get((y + off, m)) for off, m in SEASONS[season]]
        if all(v is not None for v in vals):
            years.append(y)
            out.append(sum(float(v) for v in vals) / len(vals))
    return years, out


def threshold_counts(months: list[tuple[int, int]], values: list[float | None],
                     configs: list[dict]) -> list[dict]:
    """Per complete year, months strictly above / below each configured threshold."""
    by_year: dict[int, list[float]] = {}
    for (y, _), v in zip(months, values):
        by_year.setdefault(y, [])
        if v is not None:
            by_year[y].append(float(v))
    years = [y for y in sorted(by_year) if len(by_year[y]) == 12]
    out = []
    for c in configs:
        if c["op"] == "above":
            counts = [sum(v > c["value"] for v in by_year[y]) for y in years]
        elif c["op"] == "below":
            counts = [sum(v < c["value"] for v in by_year[y]) for y in years]
        else:
            raise ValueError(f"threshold {c['id']}: op must be 'above' or 'below'")
        out.append({"id": c["id"], "label": c["label"], "op": c["op"], "value": c["value"],
                    "years": years, "counts": counts, "trend": yearly_trend(years, counts)})
    return out


def centred_running_mean(values: list[float | None], window: int) -> list[float | None]:
    """Centred running mean; month i uses i - w//2 .. i + (w - 1)//2 (null if any is missing)."""
    before, after = window // 2, (window - 1) // 2
    n = len(values)
    out: list[float | None] = []
    for i in range(n):
        lo, hi = i - before, i + after
        if lo < 0 or hi >= n:
            out.append(None)
            continue
        win = values[lo:hi + 1]
        out.append(None if any(v is None for v in win) else sum(win) / window)
    return out


def standardise(anomaly: list[float | None]) -> list[float | None]:
    """anomaly / population standard deviation (ddof = 0) of the non-null anomalies."""
    sd = statistics.pstdev([a for a in anomaly if a is not None])
    if sd == 0:
        raise ValueError("anomalies have zero spread; cannot standardise")
    return [None if a is None else a / sd for a in anomaly]


def cumulative_anomaly(anomaly: list[float | None]) -> list[float | None]:
    """Running sum of anomalies; gaps add 0 and are null themselves."""
    total, out = 0.0, []
    for a in anomaly:
        if a is None:
            out.append(None)
        else:
            total += a
            out.append(total)
    return out


def nice_bin_edges(lo: float, hi: float, min_bins: int = 12, max_bins: int = 16) -> list[float]:
    """Equal bins with a round step (1, 2, 2.5, 5 x 10^k) spanning [lo, hi]; 12-16 bins."""
    span = hi - lo if hi > lo else max(abs(hi), 1.0)
    target = (min_bins + max_bins) / 2
    best = None
    k0 = int(math.floor(math.log10(span / target)))
    for k in range(k0 - 2, k0 + 3):
        for mult in (1, 2, 2.5, 5):
            step = mult * 10.0 ** k
            start = math.floor(lo / step + 1e-9)
            stop = math.ceil(hi / step - 1e-9)
            nbins = max(stop - start, 1)
            score = (not (min_bins <= nbins <= max_bins), abs(nbins - target), step)
            if best is None or score < best[0]:
                best = (score, step, start, nbins)
    _, step, start, nbins = best
    return [_round((start + j) * step) for j in range(nbins + 1)]


def periods(dates: list[str], months: list[tuple[int, int]], anomaly: list[float | None]) -> dict:
    """Before vs from the January closest to the middle of the record: means and histograms."""
    idx = [y * 12 + m - 1 for y, m in months]
    mid = (idx[0] + idx[-1]) / 2
    januaries = [i for i, (_, m) in enumerate(months) if m == 1 and i > 0]
    if not januaries:
        raise ValueError("no January after the first month; cannot split the record")
    k = min(januaries, key=lambda i: (abs(idx[i] - mid), i))

    def part(lo: int, hi: int) -> tuple[dict, list[float]]:
        keep = [i for i in range(lo, hi) if anomaly[i] is not None]
        vals = [float(anomaly[i]) for i in keep]
        return ({"from": dates[keep[0]], "to": dates[keep[-1]],
                 "mean": _round(sum(vals) / len(vals)), "n": len(vals)}, vals)

    before, bvals = part(0, k)
    after, avals = part(k, len(dates))
    edges = nice_bin_edges(min(bvals + avals), max(bvals + avals))
    return {
        "split": dates[k],
        "before": before,
        "after": after,
        "bin_edges": edges,
        "before_counts": [int(c) for c in np.histogram(bvals, bins=edges)[0]],
        "after_counts": [int(c) for c in np.histogram(avals, bins=edges)[0]],
    }


def window_trends(dates: list[str], values: list[float | None],
                  months: list[tuple[int, int]]) -> list[dict]:
    """analyze_trend from January of each start year (first complete year, +5 y) to the end."""
    per_year: dict[int, int] = {}
    for (y, _), v in zip(months, values):
        if v is not None:
            per_year[y] = per_year.get(y, 0) + 1
    complete = [y for y in sorted(per_year) if per_year[y] == 12]
    out = []
    start = complete[0] if complete else None
    while start is not None and (start, 1) in months:
        i0 = months.index((start, 1))
        if len(dates) - i0 < WINDOW_MIN_MONTHS:
            break
        r = analyze_trend(dates[i0:], values[i0:])
        out.append({
            "start_year": start,
            "slope_per_year": _round(r["slope"]),
            "ci_low": _round(r["slope_ci_low"]),
            "ci_high": _round(r["slope_ci_high"]),
            "p_value": _round(r["p_value"]),
            "significant": r["significant"],
        })
        start += WINDOW_STEP_YEARS
    return out


def build_extras(dates: list[str], values: list[float | None], months: list[tuple[int, int]],
                 anomaly: list[float | None], thresholds: list[dict]) -> dict:
    """TutorialExtras for one variable."""
    return {
        "same_month": same_month(months, values),
        "seasons": {sid: yearly_series(*season_means(months, values, sid)) for sid in SEASONS},
        "threshold_counts": threshold_counts(months, values, thresholds),
        "zscore_smooth12": {"dates": list(dates),
                            "values": [_round(v) for v in
                                       centred_running_mean(standardise(anomaly), 12)]},
        "cumulative_anomaly": {"dates": list(dates),
                               "values": [_round(v) for v in cumulative_anomaly(anomaly)]},
        "running_mean": {str(w): [_round(v) for v in centred_running_mean(values, w)]
                         for w in RUNNING_WINDOWS},
        "periods": periods(dates, months, anomaly),
        "window_trends": window_trends(dates, values, months),
    }


def build_series(case: dict, thresholds: list[dict] | None = None) -> dict:
    """One TutorialSeries from a contract case file (already parsed).

    `thresholds`: threshold_counts configs for this variable (see CASE_THRESHOLDS).
    """
    dates, values = case["dates"], case["values"]
    months = _validate(dates, values, 0.05)
    var = case["variable"]

    clim = climatology(months, values)
    anomaly = _anomalies(months, values)
    years, annual = annual_means(months, values)

    valid = [i for i, v in enumerate(values) if v is not None]
    i_max = max(valid, key=lambda i: values[i])   # max() keeps the first on ties

    result = analyze_trend(dates, values)
    for key in ("slope", "p_value"):
        if abs(result[key] - case[key]) > TOLERANCE:
            raise ValueError(
                f"{var}: analyze_trend {key} = {result[key]!r} differs from the case file "
                f"({case[key]!r}); rebuild the case file before the tutorial data"
            )
    if result["significant"] != case["significant"] or result["test"] != case["test"]:
        raise ValueError(f"{var}: significant/test differ from the case file")

    slope = result["slope"]
    t = [_decimal_year(*m) for m in months]
    intercept = statistics.median(anomaly[i] - slope * t[i] for i in valid)
    clim_mean = sum(clim) / 12

    def line(tt: float) -> float:
        return intercept + slope * tt

    anomaly_line = [line(t[0]), line(t[-1])]
    monthly_line = [v + clim_mean for v in anomaly_line]
    annual_line = ([line(y + ANNUAL_T_OFFSET) + clim_mean for y in (years[0], years[-1])]
                   if years else [None, None])

    return {
        "variable": var,
        "name": NAMES.get(var, var),
        "units": case["units"],
        "dataset": case["dataset"],
        "monthly": {"dates": list(dates), "values": [_round(v) for v in values]},
        "climatology": [_round(c) for c in clim],
        "anomaly": {"dates": list(dates), "values": [_round(a) for a in anomaly]},
        "annual": {"years": years, "values": [_round(a) for a in annual]},
        "max": {"date": dates[i_max], "value": _round(values[i_max])},
        "trend": {
            "slope_per_year": slope,
            "ci_low": result["slope_ci_low"],
            "ci_high": result["slope_ci_high"],
            "p_value": result["p_value"],
            "significant": result["significant"],
            "test": result["test"],
            "anomaly_line": [_round(v) for v in anomaly_line],
            "monthly_line": [_round(v) for v in monthly_line],
            "annual_line": [_round(v) for v in annual_line],
        },
        "extras": build_extras(dates, values, months, anomaly, thresholds or []),
    }


def build_tutorial(case_id: str, index: list[dict] | None = None, root: Path = ROOT) -> dict:
    """TutorialData for one case of data/cases_index.json."""
    if index is None:
        index = json.loads((root / "data" / "cases_index.json").read_text(encoding="utf-8"))
    entry = next((c for c in index if c["id"] == case_id), None)
    if entry is None:
        raise ValueError(f"case {case_id!r} not in cases_index.json")
    variables = {}
    for rel in entry["files"]:
        case = json.loads((root / rel).read_text(encoding="utf-8"))
        var = case["variable"]
        variables[var] = build_series(case, CASE_THRESHOLDS.get(case_id, {}).get(var, []))
    return {
        "case_id": case_id,
        "place": entry["place"],
        "lat": entry["lat"],
        "lon": entry["lon"],
        "variables": variables,
    }


def write_tutorial(data: dict, out_dir: Path = OUT_DIR) -> Path:
    """Write data/tutorial_data/<case_id>.json (deterministic)."""
    path = Path(out_dir) / f"{data['case_id']}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--case", help="case id from data/cases_index.json")
    group.add_argument("--all", action="store_true", help="every case in data/cases_index.json")
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = parser.parse_args(argv)

    index = json.loads(INDEX.read_text(encoding="utf-8"))
    ids = [c["id"] for c in index] if args.all else [args.case]
    for case_id in ids:
        path = write_tutorial(build_tutorial(case_id, index), args.out_dir)
        print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
