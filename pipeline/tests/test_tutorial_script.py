"""Every data/tutorials/*.json follows the TutorialScript shape in src/shared/tutorial.ts.

Chart specs are checked against the chart data of the same case,
data/tutorial_data/<case_id>.json (built by pipeline/tutorial_data.py): variables, months,
seasons, thresholds, windows, highlight and range dates must all exist there.
"""

import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
TUTORIALS = sorted((ROOT / "data" / "tutorials").glob("*.json"))
VARIABLES = {"PRECIP", "T2M", "SOILM"}
MONTHLY_VIEWS = {"monthly", "climatology", "anomaly", "zscore_pair", "cumulative",
                 "running_mean", "periods"}
YEARLY_VIEWS = {"annual", "same_month", "season", "ranking", "threshold_count",
                "season_scatter", "window_trends"}
VIEWS = MONTHLY_VIEWS | YEARLY_VIEWS
TREND_VIEWS = {"monthly", "anomaly", "annual", "same_month", "season", "threshold_count"}
SEASONS = {"DJF", "MAM", "JJA", "SON", "JJAS"}
WINDOWS = {12, 60}
MAX_WORDS = 90  # docs say "at most ~80 words"; small margin
MOODS = {"neutral", "happy", "curious", "explaining", "sad", "proud", "doubtful", "insistent", "determined", "confident"}  # LineMood in src/shared/tutorial.ts
SPEAKERS = {"detective", "witness"}
VERDICTS = {"right", "wrong", "partly"}
MAX_LINE_WORDS = 40  # one speech bubble
MAX_CLUE_WORDS = 15  # one notebook line


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def witness_ids():
    """Case ids that have a witness: keys of WITNESSES in src/shared/witness.ts."""
    text = (ROOT / "src" / "shared" / "witness.ts").read_text(encoding="utf-8")
    return set(re.findall(r"caseId:\s*['\"](\w+)['\"]", text))


def tutorial_data(case_id):
    path = ROOT / "data" / "tutorial_data" / f"{case_id}.json"
    assert path.exists(), f"missing {path} (py -m pipeline.tutorial_data --case {case_id})"
    return load(path)


def check_chart(step_id, chart, data):
    """Check one ChartSpec against TutorialData; returns the variables it uses."""
    var, view = chart["variable"], chart["view"]
    variables = data["variables"]
    assert var in VARIABLES, f"step {step_id}: variable {var}"
    assert var in variables, f"step {step_id}: variable {var} not in the data of this case"
    assert view in VIEWS, f"step {step_id}: view {view}"
    if chart.get("show_trend"):
        assert view in TREND_VIEWS, f"step {step_id}: no trend line on view {view}"
    s = variables[var]
    ex = s.get("extras")
    if view not in {"monthly", "climatology", "anomaly", "annual"}:
        assert ex, f"step {step_id}: view {view} needs extras in the data file"
    used = {var}

    # view-specific fields (also checked when given on another view)
    if view == "same_month" or "month" in chart:
        m = chart.get("month")
        assert isinstance(m, int) and 1 <= m <= 12, f"step {step_id}: month {m}"
    if view in ("season", "season_scatter") or "season" in chart:
        assert chart.get("season") in SEASONS, f"step {step_id}: season {chart.get('season')}"
    if view in ("zscore_pair", "season_scatter") or "variables" in chart:
        pair = chart.get("variables")
        assert isinstance(pair, list) and len(pair) == 2 and pair[0] != pair[1], \
            f"step {step_id}: variables must be two different ids"
        assert pair[0] == var, f"step {step_id}: variables[0] must equal variable"
        for v in pair:
            assert v in VARIABLES and v in variables, f"step {step_id}: variable {v} not in data"
        used |= set(pair)
    if view == "threshold_count" or "threshold_id" in chart:
        ids = [t["id"] for t in ex["threshold_counts"]]
        assert chart.get("threshold_id") in ids, \
            f"step {step_id}: threshold_id {chart.get('threshold_id')} not in {ids}"
    if view == "running_mean" or "window" in chart:
        assert chart.get("window") in WINDOWS, f"step {step_id}: window {chart.get('window')}"
    for key in ("top_n", "recent_years"):
        if key in chart:
            assert isinstance(chart[key], int) and chart[key] >= 1, f"step {step_id}: {key}"

    # dates allowed in highlights and range
    if view in MONTHLY_VIEWS:
        allowed = {d for d, v in zip(s["monthly"]["dates"], s["monthly"]["values"])
                   if v is not None}
    else:
        if view == "annual":
            years = s["annual"]["years"]
        elif view == "same_month":
            years = ex["same_month"][chart["month"] - 1]["years"]
        elif view == "season":
            years = ex["seasons"][chart["season"]]["years"]
        elif view == "ranking":
            years = (ex["seasons"][chart["season"]]["years"] if "season" in chart
                     else s["annual"]["years"])
        elif view == "threshold_count":
            years = next(t for t in ex["threshold_counts"]
                         if t["id"] == chart["threshold_id"])["years"]
        elif view == "season_scatter":
            a, b = chart["variables"]
            years = (set(variables[a]["extras"]["seasons"][chart["season"]]["years"])
                     & set(variables[b]["extras"]["seasons"][chart["season"]]["years"]))
        else:  # window_trends
            years = [w["start_year"] for w in ex["window_trends"]]
        allowed = {str(y) for y in years}
    kind = "YYYY-MM" if view in MONTHLY_VIEWS else "YYYY"
    for h in chart.get("highlights", []):
        assert h["kind"] in ("point", "band") and h["label"]
        for d in ([h["date"]] if h["kind"] == "point" else [h["from"], h["to"]]):
            assert d in allowed, f"step {step_id}: highlight date {d} ({kind}) not in data"
    if "range" in chart:
        assert len(chart["range"]) == 2
        for d in chart["range"]:
            assert d in allowed, f"step {step_id}: range {d} ({kind}) not in data"
    return used


# --- evidence board (docs/evidence_board.md, EvidenceBoard in src/shared/tutorial.ts) --------

BOARD_KINDS = {"chart", "clipping", "datacard"}
RELATIONS = {"supports", "contradicts", "neutral"}
TASK_TYPES = {"click_point", "fit_line", "order_cards", "slider_window", "tally", "compare"}
MIN_ITEMS, MAX_ITEMS = 4, 6


def yearly_series(chart, data):
    """{year: value} of a yearly chart view, or None if the view is not a single yearly series."""
    s = data["variables"][chart["variable"]]
    ex = s.get("extras") or {}
    view = chart["view"]
    if view == "annual" or (view == "ranking" and "season" not in chart):
        years, values = s["annual"]["years"], s["annual"]["values"]
    elif view == "same_month":
        sm = ex["same_month"][chart["month"] - 1]
        years, values = sm["years"], sm["values"]
    elif view in ("season", "ranking"):
        se = ex["seasons"][chart["season"]]
        years, values = se["years"], se["values"]
    elif view == "threshold_count":
        t = next(t for t in ex["threshold_counts"] if t["id"] == chart["threshold_id"])
        years, values = t["years"], t["counts"]
    else:
        return None
    return {str(y): v for y, v in zip(years, values)}


def chart_dates(chart, data):
    """Dates that exist on a chart: 'YYYY-MM' for monthly views, 'YYYY' for yearly views."""
    s = data["variables"][chart["variable"]]
    if chart["view"] in MONTHLY_VIEWS:
        return {d for d, v in zip(s["monthly"]["dates"], s["monthly"]["values"]) if v is not None}
    if chart["view"] == "window_trends":
        return {str(w["start_year"]) for w in s["extras"]["window_trends"]}
    if chart["view"] == "season_scatter":
        a, b = chart["variables"]
        v = data["variables"]
        return {str(y) for y in set(v[a]["extras"]["seasons"][chart["season"]]["years"])
                & set(v[b]["extras"]["seasons"][chart["season"]]["years"])}
    return set(yearly_series(chart, data))


def check_options(where, options):
    assert len(options) >= 2, f"{where}: needs at least two options"
    assert sum(o.get("correct") is True for o in options) == 1, f"{where}: exactly one correct option"
    assert all(o["text"].strip() for o in options), f"{where}: empty option"


def check_board(board, data):
    """Check an EvidenceBoard against TutorialData; returns the variables its charts use."""
    for key in ("title", "instructions", "summary"):
        assert str(board.get(key, "")).strip(), f"board: missing {key}"
    items = board["items"]
    assert MIN_ITEMS <= len(items) <= MAX_ITEMS, f"board: {len(items)} items"
    ids = [it["id"] for it in items]
    assert all(ids) and len(ids) == len(set(ids)), "board: item ids must be unique"
    used = set()
    for it in items:
        where = f"board item {it['id']}"
        assert it["kind"] in BOARD_KINDS, f"{where}: kind {it['kind']}"
        for key in ("title", "teaser", "text", "relation_feedback", "clue"):
            assert str(it.get(key, "")).strip(), f"{where}: missing {key}"
        assert len(it["text"].split()) <= MAX_WORDS, f"{where}: text too long"
        assert len(it["clue"].split()) <= MAX_CLUE_WORDS, f"{where}: clue too long"
        assert it["relation"] in RELATIONS, f"{where}: relation {it['relation']}"
        chart = it.get("chart")
        if it["kind"] == "clipping":
            c = it.get("clipping")
            assert c and c["headline"].strip() and c["body"].strip(), f"{where}: clipping text"
        else:
            assert chart, f"{where}: kind {it['kind']} needs a chart"
        if chart:
            used |= check_chart(it["id"], chart, data)

        task = it["task"]
        t = task["type"]
        assert t in TASK_TYPES, f"{where}: task type {t}"
        for key in ("prompt", "hint", "success"):
            assert str(task.get(key, "")).strip(), f"{where}: task needs {key}"
        if t != "compare":
            assert chart, f"{where}: task {t} needs a chart"
        if t == "click_point":
            assert task["answer"] in chart_dates(chart, data), \
                f"{where}: answer {task['answer']} not on the chart"
        elif t == "fit_line":
            assert chart["view"] in TREND_VIEWS, f"{where}: fit_line needs a view with a trend"
            if "tolerance" in task:
                assert task["tolerance"] > 0, f"{where}: tolerance"
        elif t == "order_cards":
            series = yearly_series(chart, data)
            assert series is not None, f"{where}: order_cards needs a yearly chart"
            cards = task["cards"]
            assert len(cards) >= 3 and len(set(cards)) == len(cards), f"{where}: cards"
            for c in cards:
                assert c in series, f"{where}: card {c} not in the yearly series"
            assert len({series[c] for c in cards}) == len(cards), f"{where}: cards tie"
            assert task["order"] in ("asc", "desc"), f"{where}: order {task['order']}"
        elif t == "slider_window":
            assert chart["view"] == "window_trends", f"{where}: slider_window needs window_trends"
            assert task["question"].strip(), f"{where}: question"
            check_options(where, task["options"])
        elif t == "tally":
            assert task["rule"].strip(), f"{where}: rule"
            periods, answers = task["periods"], task["answers"]
            assert periods and len(periods) == len(answers), f"{where}: periods vs answers"
            dates = chart_dates(chart, data)
            for per in periods:
                assert per["label"].strip() and per["from"] <= per["to"], f"{where}: period"
                for d in (per["from"], per["to"]):
                    assert d in dates, f"{where}: period date {d} not on the chart"
            assert all(isinstance(a, int) and a >= 0 for a in answers), f"{where}: answers"
            if chart["view"] == "threshold_count":  # machine-checkable: sum the counts
                series = yearly_series(chart, data)
                for per, a in zip(periods, answers):
                    n = sum(v for y, v in series.items() if per["from"] <= y <= per["to"])
                    assert n == a, f"{where}: {per['label']} answer {a}, data says {n}"
        elif t == "compare":
            check_options(where, task["options"])
    return used


def test_there_is_at_least_one_tutorial():
    assert TUTORIALS


@pytest.mark.parametrize("path", TUTORIALS, ids=lambda p: p.stem)
def test_tutorial_script(path):
    s = load(path)
    for key in ("case_id", "title", "place", "intro", "steps", "conclusion", "reveal"):
        assert key in s, f"missing key {key}"
    assert s["case_id"] == path.stem
    data = tutorial_data(s["case_id"])

    intro = s["intro"]
    assert intro["headline"] and intro["question"]
    assert 2 <= len(intro["paragraphs"]) <= 4

    ids = [step["id"] for step in s["steps"]]
    assert len(ids) == len(set(ids)), "step ids must be unique"
    if "board" in s:
        assert s["steps"] == [], "a case with a board has no quiz steps"
    else:
        assert s["steps"], "no steps"

    used = check_board(s["board"], data) if "board" in s else set()
    for step in s["steps"]:
        for key in ("id", "title", "text", "chart", "takeaway"):
            assert step.get(key), f"step {step.get('id')}: missing {key}"
        assert len(step["text"].split()) <= MAX_WORDS, f"step {step['id']}: text too long"
        used |= check_chart(step["id"], step["chart"], data)

        q = step.get("question")
        if q:
            assert q["prompt"]
            assert len(q["options"]) >= 2
            assert sum(o["correct"] is True for o in q["options"]) == 1, f"step {step['id']}"
            for o in q["options"]:
                assert o["text"] and o["feedback"]

    c = s["conclusion"]
    assert c["prompt"] and c["variable"] in VARIABLES
    assert c["variable"] in data["variables"], f"conclusion variable {c['variable']} not in data"

    r = s["reveal"]
    assert r["lesson"]
    assert set(r["by_variable"]) == used, "reveal needs one entry per variable used"
    assert set(r["by_variable"]) <= set(data["variables"]), "reveal variable not in data"
    assert all(r["by_variable"].values())

    # optional witness scene, notebook clues and claim verdict
    scene = s.get("scene")
    if scene is not None:
        assert s["case_id"] in witness_ids(), \
            f"case {s['case_id']} has a scene but no witness in src/shared/witness.ts"
        assert scene["lines"], "scene needs lines"
        for i, line in enumerate(scene["lines"]):
            assert line["speaker"] in SPEAKERS, f"scene line {i}: speaker {line['speaker']}"
            assert line["text"].strip(), f"scene line {i}: empty text"
            assert line.get("mood", "neutral") in MOODS, f"scene line {i}: mood {line.get('mood')}"
            assert len(line["text"].split()) <= MAX_LINE_WORDS, f"scene line {i}: too long"
        assert scene["claim"].strip(), "scene needs a claim"
    for step in s["steps"]:
        if "clue" in step:
            assert step["clue"].strip(), f"step {step['id']}: empty clue"
            assert len(step["clue"].split()) <= MAX_CLUE_WORDS, f"step {step['id']}: clue too long"
    if "claim_verdict" in r:
        assert r["claim_verdict"] in VERDICTS, f"claim_verdict {r['claim_verdict']}"
    if "claim_text" in r:
        assert r["claim_text"].strip()


# --- the validator itself, on made-up charts against the real data --------------------------

@pytest.fixture(scope="module")
def aneto():
    return tutorial_data("aneto_glacier")


@pytest.mark.parametrize("chart", [
    {"variable": "T2M", "view": "same_month", "month": 1, "show_trend": True,
     "highlights": [{"kind": "point", "date": "2021", "label": "x"}]},
    {"variable": "T2M", "view": "season", "season": "DJF", "range": ["1981", "2025"]},
    {"variable": "T2M", "view": "ranking", "season": "JJA", "top_n": 10, "recent_years": 10},
    {"variable": "T2M", "view": "ranking"},
    {"variable": "T2M", "view": "threshold_count", "threshold_id": "below_0", "show_trend": True},
    {"variable": "T2M", "view": "zscore_pair", "variables": ["T2M", "PRECIP"]},
    {"variable": "PRECIP", "view": "cumulative",
     "highlights": [{"kind": "band", "from": "2005-01", "to": "2008-12", "label": "x"}]},
    {"variable": "T2M", "view": "running_mean", "window": 60},
    {"variable": "T2M", "view": "periods"},
    {"variable": "PRECIP", "view": "season_scatter", "season": "JJA",
     "variables": ["PRECIP", "T2M"], "highlights": [{"kind": "point", "date": "2005", "label": "x"}]},
    {"variable": "T2M", "view": "window_trends",
     "highlights": [{"kind": "point", "date": "1990", "label": "x"}]},
])
def test_validator_accepts(chart, aneto):
    check_chart("t", chart, aneto)


@pytest.mark.parametrize("chart", [
    {"variable": "SOILM", "view": "monthly"},                              # not in this case
    {"variable": "T2M", "view": "same_month", "month": 13},
    {"variable": "T2M", "view": "same_month"},
    {"variable": "T2M", "view": "season", "season": "JJAS2"},
    {"variable": "T2M", "view": "threshold_count", "threshold_id": "above_28"},
    {"variable": "PRECIP", "view": "threshold_count", "threshold_id": "below_0"},
    {"variable": "T2M", "view": "zscore_pair", "variables": ["T2M", "SOILM"]},
    {"variable": "T2M", "view": "zscore_pair", "variables": ["PRECIP", "T2M"]},
    {"variable": "T2M", "view": "running_mean", "window": 24},
    {"variable": "T2M", "view": "window_trends", "show_trend": True},
    {"variable": "T2M", "view": "season", "season": "DJF",
     "highlights": [{"kind": "point", "date": "2021-01", "label": "x"}]},  # yearly view
    {"variable": "T2M", "view": "season", "season": "DJF",
     "highlights": [{"kind": "point", "date": "1980", "label": "x"}]},     # no DJF 1980
    {"variable": "T2M", "view": "monthly",
     "highlights": [{"kind": "point", "date": "2021", "label": "x"}]},     # monthly view
    {"variable": "PRECIP", "view": "season_scatter", "season": "JJA",
     "variables": ["PRECIP", "T2M"], "highlights": [{"kind": "point", "date": "1985", "label": "x"}]},
    {"variable": "T2M", "view": "window_trends", "range": ["1980", "1992"]},
])
def test_validator_rejects(chart, aneto):
    with pytest.raises(AssertionError):
        check_chart("t", chart, aneto)


# --- the board validator itself, on a made-up board against the real data ------------------

def _board(**task_overrides):
    """A minimal valid board on aneto_glacier data; the first item's task can be overridden."""
    base = {"prompt": "p", "hint": "h", "success": "s"}
    items = [
        {"id": "a", "kind": "chart", "chart": {"variable": "T2M", "view": "same_month", "month": 1},
         "task": {**base, "type": "click_point", "answer": "2021"}},
        {"id": "b", "kind": "chart", "chart": {"variable": "T2M", "view": "anomaly"},
         "task": {**base, "type": "fit_line"}},
        {"id": "c", "kind": "datacard", "chart": {"variable": "T2M", "view": "window_trends"},
         "task": {**base, "type": "slider_window", "question": "q",
                  "options": [{"text": "x", "correct": True}, {"text": "y", "correct": False}]}},
        {"id": "d", "kind": "clipping", "clipping": {"headline": "h", "body": "b"},
         "task": {**base, "type": "compare",
                  "options": [{"text": "x", "correct": True}, {"text": "y", "correct": False}]}},
    ]
    for it in items:
        it.update(title="t", teaser="t", text="t", relation="neutral", relation_feedback="f", clue="c")
    items[0]["task"].update(task_overrides)
    return {"title": "t", "instructions": "i", "summary": "s", "items": items}


def test_board_validator_accepts(aneto):
    assert check_board(_board(), aneto) == {"T2M"}
    check_board(_board(type="order_cards", cards=["1992", "2021", "2016"], order="asc"), aneto)


@pytest.mark.parametrize("override", [
    {"answer": "2021-01"},                                          # monthly date on a yearly chart
    {"answer": "1970"},                                             # not in the data
    {"type": "order_cards", "cards": ["1992", "2021", "1970"], "order": "asc"},
    {"type": "order_cards", "cards": ["1992", "2021", "2016"], "order": "up"},
    {"type": "slider_window", "question": "q",
     "options": [{"text": "x", "correct": True}, {"text": "y", "correct": True}]},
    {"type": "tally", "rule": "r", "answers": [1],
     "periods": [{"label": "l", "from": "1990", "to": "1999"},
                 {"label": "m", "from": "2000", "to": "2009"}]},
    {"type": "quiz"},
])
def test_board_validator_rejects(override, aneto):
    with pytest.raises((AssertionError, KeyError)):
        check_board(_board(**override), aneto)
