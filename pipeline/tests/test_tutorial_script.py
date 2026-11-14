"""Every data/tutorials/*.json follows the TutorialScript shape in src/shared/tutorial.ts."""

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
TUTORIALS = sorted((ROOT / "data" / "tutorials").glob("*.json"))
VARIABLES = {"PRECIP", "T2M"}
VIEWS = {"monthly", "climatology", "anomaly", "annual"}
MAX_WORDS = 90  # docs say "at most ~80 words"; small margin


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def series_dates(case_id, variable):
    path = ROOT / "data" / "cache" / f"case_{case_id}_{variable}.json"
    assert path.exists(), f"missing {path}"
    data = load(path)
    return [d for d, v in zip(data["dates"], data["values"]) if v is not None]


def test_there_is_at_least_one_tutorial():
    assert TUTORIALS


@pytest.mark.parametrize("path", TUTORIALS, ids=lambda p: p.stem)
def test_tutorial_script(path):
    s = load(path)
    for key in ("case_id", "title", "place", "intro", "steps", "conclusion", "reveal"):
        assert key in s, f"missing key {key}"
    assert s["case_id"] == path.stem

    intro = s["intro"]
    assert intro["headline"] and intro["question"]
    assert 2 <= len(intro["paragraphs"]) <= 4

    ids = [step["id"] for step in s["steps"]]
    assert len(ids) == len(set(ids)), "step ids must be unique"
    assert s["steps"], "no steps"

    used = set()
    for step in s["steps"]:
        for key in ("id", "title", "text", "chart", "takeaway"):
            assert step.get(key), f"step {step.get('id')}: missing {key}"
        assert len(step["text"].split()) <= MAX_WORDS, f"step {step['id']}: text too long"

        chart = step["chart"]
        var, view = chart["variable"], chart["view"]
        assert var in VARIABLES, f"step {step['id']}: variable {var}"
        assert view in VIEWS, f"step {step['id']}: view {view}"
        if view == "climatology":
            assert not chart.get("show_trend"), f"step {step['id']}: no trend on climatology"
        used.add(var)

        dates = series_dates(s["case_id"], var)
        years = {d[:4] for d in dates}
        for h in chart.get("highlights", []):
            assert h["kind"] in ("point", "band") and h["label"]
            for d in ([h["date"]] if h["kind"] == "point" else [h["from"], h["to"]]):
                assert d in dates, f"step {step['id']}: highlight date {d} not in data"
        if "range" in chart:
            for d in chart["range"]:
                assert d in (years if view == "annual" else dates), f"step {step['id']}: range {d}"

        q = step.get("question")
        if q:
            assert q["prompt"]
            assert len(q["options"]) >= 2
            assert sum(o["correct"] is True for o in q["options"]) == 1, f"step {step['id']}"
            for o in q["options"]:
                assert o["text"] and o["feedback"]

    c = s["conclusion"]
    assert c["prompt"] and c["variable"] in VARIABLES

    r = s["reveal"]
    assert r["lesson"]
    assert set(r["by_variable"]) == used, "reveal needs one entry per variable used"
    assert all(r["by_variable"].values())
