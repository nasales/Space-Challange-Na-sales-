"""Slide figure of the featured case trends (Ivan).

Usage:
    python -m pipeline.results_figure [--out docs/figures/featured_trends.png]

Reads data/cache/case_*.json, recomputes the 95% CI of each slope with analyze_trend (the contract
files store only slope / p / significant), and draws one horizontal bar per series with its slope per
decade and CI as error bars. One panel per variable type, because the units differ.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from pipeline.build_cases import CACHE_DIR, ROOT, load_case_file  # noqa: E402
from pipeline.cases import CASES  # noqa: E402

OUT_PATH = ROOT / "docs" / "figures" / "featured_trends.png"
TITLE = "Featured cases: trend per decade (95% CI), NASA POWER 1981-2024"
FOOTER = "Data: NASA POWER (MERRA-2 based). Grey = not statistically significant (p >= 0.05)"

# Panel order and labels; the key is the case file `variable`.
PANELS = [
    ("T2M", "Temperature"),
    ("PRECTOTCORR", "Precipitation"),
    ("GWETTOP", "Soil moisture"),
    # Common ids written by build_cases --source case_export (units in the x label).
    ("PRECIP", "Precipitation"),
    ("SOILM", "Soil moisture"),
    ("NDVI", "Vegetation (NDVI)"),
    ("LST", "Land surface temperature"),
    ("SNOW", "Snow cover"),
]
STRONG = "#c0392b"
GREY = "#a6a6a6"


def collect(cache_dir: Path = CACHE_DIR) -> dict[str, list[dict]]:
    """Rows per variable: title, slope / CI per decade, significant, units. Case order of CASES."""
    titles = {c["id"]: c["title"] for c in CASES}
    order = {c["id"]: i for i, c in enumerate(CASES)}
    rows: dict[str, list[dict]] = {}
    for path in sorted(Path(cache_dir).glob("case_*.json")):
        variable = json.loads(path.read_text(encoding="utf-8"))["variable"]
        case_id = path.stem[len("case_"):-(len(variable) + 1)]
        trend, series = load_case_file(path)
        rows.setdefault(variable, []).append({
            "title": titles.get(case_id, series.place),
            "order": order.get(case_id, len(order)),
            "slope": trend["slope"] * 10,
            "lo": trend["slope_ci_low"] * 10,
            "hi": trend["slope_ci_high"] * 10,
            "significant": bool(trend["significant"]),
            "units": series.units,
        })
    for v in rows.values():
        v.sort(key=lambda r: r["order"])
    return rows


def make_figure(rows: dict[str, list[dict]]):
    panels = [(v, label) for v, label in PANELS if v in rows]
    panels += [(v, v) for v in rows if v not in dict(PANELS)]
    heights = [max(len(rows[v]), 2) for v, _ in panels]
    fig, axes = plt.subplots(1, len(panels), figsize=(16, 9), dpi=100, squeeze=False,
                             gridspec_kw={"wspace": 0.95})
    for ax, (variable, label) in zip(axes[0], panels):
        data = rows[variable][::-1]  # first case on top
        y = range(len(data))
        colors = [STRONG if r["significant"] else GREY for r in data]
        err = [[r["slope"] - r["lo"] for r in data], [r["hi"] - r["slope"] for r in data]]
        ax.barh(list(y), [r["slope"] for r in data], color=colors, height=0.6)
        ax.errorbar([r["slope"] for r in data], list(y), xerr=err, fmt="none", ecolor="#333333",
                    capsize=5, linewidth=1.5)
        ax.axvline(0, color="#333333", linewidth=1)
        ax.set_yticks(list(y))
        ax.set_yticklabels([r["title"] for r in data], fontsize=14)
        ax.set_ylim(-0.6, max(len(data), min(heights)) - 0.4)
        ax.set_title(label, fontsize=18, fontweight="bold")
        ax.set_xlabel(f"{data[0]['units']} per decade", fontsize=14)
        ax.tick_params(axis="x", labelsize=12)
        ax.grid(axis="x", alpha=0.3)
        for side in ("top", "right"):
            ax.spines[side].set_visible(False)
    fig.suptitle(TITLE, fontsize=22, fontweight="bold")
    fig.text(0.5, 0.015, FOOTER, ha="center", fontsize=12, color="#555555")
    fig.subplots_adjust(left=0.155, right=0.98, top=0.86, bottom=0.12)
    return fig


def write_figure(out: str | Path = OUT_PATH, cache_dir: Path = CACHE_DIR) -> Path:
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    fig = make_figure(collect(cache_dir))
    fig.savefig(out, dpi=100)  # 16 x 9 in at 100 dpi = 1600 x 900 px
    plt.close(fig)
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Slide figure of the featured case trends.")
    ap.add_argument("--out", default=str(OUT_PATH), help="output PNG path")
    args = ap.parse_args(argv)
    print(write_figure(args.out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
