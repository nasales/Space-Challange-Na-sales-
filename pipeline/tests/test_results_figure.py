"""Smoke test for pipeline.results_figure: the slide PNG is created from the committed case files."""

from pipeline.results_figure import collect, write_figure


def test_figure_png_is_created(tmp_path):
    out = write_figure(tmp_path / "figures" / "featured_trends.png")
    assert out.exists() and out.stat().st_size > 10_000
    assert out.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"
    width, height = int.from_bytes(out.read_bytes()[16:20], "big"), int.from_bytes(out.read_bytes()[20:24], "big")
    assert (width, height) == (1600, 900)


def test_rows_cover_every_series():
    rows = collect()
    assert set(rows) == {"T2M", "PRECTOTCORR", "GWETTOP"}
    assert sum(len(v) for v in rows.values()) == 18
    assert all(r["lo"] <= r["slope"] <= r["hi"] for v in rows.values() for r in v)
