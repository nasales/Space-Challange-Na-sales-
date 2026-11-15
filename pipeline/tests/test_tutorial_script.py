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


# --- evidence board (EvidenceBoard in src/shared/tutorial.ts, docs/evidence_board.md) -------

BOARD_KINDS = {"chart", "clipping", "datacard"}
BOARD_RELATIONS = {"supports", "contradicts", "neutral"}
TASK_TYPES = {"click_point", "fit_line", "order_cards", "slider_window", "tally", "compare"}
FIT_LINE_VIEWS = {"monthly", "anomaly", "annual", "same_month", "season"}  # views with a trend
MIN_ITEMS, MAX_ITEMS = 4, 6


def _yearly_values(chart, data):
    """{"YYYY": value} of the yearly series a yearly chart draws (None if not yearly)."""
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
        tc = next(t for t in ex["threshold_counts"] if t["id"] == chart["threshold_id"])
        years, values = tc["years"], tc["counts"]
    else:
        return None
    return {str(y): v for y, v in zip(years, values)}


def _in_range(date, chart):
    return "range" not in chart or chart["range"][0] <= date <= chart["range"][1]


def _check_options(where, options):
    assert len(options) >= 2, f"{where}: needs at least 2 options"
    assert sum(o["correct"] is True for o in options) == 1, f"{where}: exactly one correct option"
    for o in options:
        assert o["text"].strip(), f"{where}: empty option"


def check_board(board, data):
    """Check an EvidenceBoard against TutorialData; returns the variables its charts use."""
    for key in ("title", "instructions", "summary"):
        assert board.get(key, "").strip(), f"board: missing {key}"
    items = board["items"]
    assert MIN_ITEMS <= len(items) <= MAX_ITEMS, f"board: {len(items)} items (need 4-6)"
    ids = [it["id"] for it in items]
    assert len(ids) == len(set(ids)), "board: item ids must be unique"

    used = set()
    for it in items:
        w = f"board item {it['id']}"
        for key in ("title", "teaser", "text", "relation_feedback", "clue"):
            assert it.get(key, "").strip(), f"{w}: missing {key}"
        assert it["kind"] in BOARD_KINDS, f"{w}: kind {it['kind']}"
        assert it["relation"] in BOARD_RELATIONS, f"{w}: relation {it['relation']}"
        assert len(it["text"].split()) <= MAX_WORDS, f"{w}: text too long"
        assert len(it["clue"].split()) <= MAX_CLUE_WORDS, f"{w}: clue too long"
        if it["kind"] == "clipping":
            c = it.get("clipping")
            assert c and c["headline"].strip() and c["body"].strip(), f"{w}: clipping needs text"
        else:
            assert it.get("chart"), f"{w}: kind {it['kind']} needs a chart"
        chart = it.get("chart")
        if chart:
            used |= check_chart(it["id"], chart, data)

        task = it["task"]
        t = task["type"]
        assert t in TASK_TYPES, f"{w}: task type {t}"
        for key in ("prompt", "hint", "success"):
            assert task.get(key, "").strip(), f"{w}: task needs {key}"
        if t != "compare":
            assert chart, f"{w}: task {t} needs a chart"
        yearly = _yearly_values(chart, data) if chart else None

        if t == "click_point":
            ans = task["answer"]
            if chart["view"] in MONTHLY_VIEWS:
                s = data["variables"][chart["variable"]]["monthly"]
                dates = {d for d, v in zip(s["dates"], s["values"]) if v is not None}
            else:
                assert yearly is not None, f"{w}: click_point on view {chart['view']}"
                dates = set(yearly)
            assert ans in dates, f"{w}: click_point answer {ans} not in the chart's series"
            assert _in_range(ans, chart), f"{w}: click_point answer {ans} outside the chart range"
        elif t == "fit_line":
            assert chart["view"] in FIT_LINE_VIEWS, \
                f"{w}: fit_line needs a view with a trend, not {chart['view']}"
            if "tolerance" in task:
                assert task["tolerance"] > 0, f"{w}: tolerance must be positive"
        elif t == "order_cards":
            assert yearly is not None, f"{w}: order_cards needs a yearly chart"
            cards = task["cards"]
            assert task["order"] in ("asc", "desc"), f"{w}: order {task['order']}"
            assert len(cards) >= 3 and len(cards) == len(set(cards)), f"{w}: 3+ distinct cards"
            for c in cards:
                assert c in yearly, f"{w}: card {c} not in the chart's yearly series"
            values = sorted(yearly[c] for c in cards)
            assert all(b - a > 1e-9 for a, b in zip(values, values[1:])), \
                f"{w}: two cards have the same value, the order is ambiguous"
        elif t == "slider_window":
            assert chart["view"] == "window_trends", f"{w}: slider_window needs window_trends"
            assert task["question"].strip(), f"{w}: slider_window needs a question"
            _check_options(w, task["options"])
        elif t == "tally":
            periods, answers = task["periods"], task["answers"]
            assert task["rule"].strip(), f"{w}: tally needs a rule"
            assert periods and len(periods) == len(answers), f"{w}: periods and answers"
            for p, a in zip(periods, answers):
                assert p["label"].strip() and p["from"] <= p["to"], f"{w}: period {p}"
                assert isinstance(a, int) and a >= 0, f"{w}: answer {a}"
                if chart["view"] == "threshold_count":
                    # recount: total months in the period, or number of years with any
                    counts = [v for y, v in yearly.items() if p["from"] <= y <= p["to"]]
                    assert counts, f"{w}: period {p['label']} has no data"
                    assert a in (sum(counts), sum(v > 0 for v in counts)), \
                        f"{w}: tally {p['label']} = {a}, data give {sum(counts)} months"
        else:  # compare
            _check_options(w, task["options"])
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
    assert s["steps"] or s.get("board"), "no steps (steps may be empty only with a board)"

    used = set()
    if s.get("board") is not None:
        used |= check_board(s["board"], data)
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


# --- the board validator, on made-up items against the real Córdoba data ---------------------

def _board(task, chart, kind="chart"):
    item = {"id": "x", "kind": kind, "title": "t", "teaser": "t", "text": "t", "chart": chart,
            "task": {"prompt": "p", "hint": "h", "success": "s", **task},
            "relation": "supports", "relation_feedback": "f", "clue": "c"}
    items = [dict(item, id=f"x{i}") for i in range(4)]
    return {"title": "t", "instructions": "i", "summary": "s", "items": items}


JJA = {"variable": "T2M", "view": "season", "season": "JJA"}
HOT = {"variable": "T2M", "view": "threshold_count", "threshold_id": "above_28"}
WIN = {"variable": "T2M", "view": "window_trends"}
ONE_RIGHT = [{"text": "a", "correct": True}, {"text": "b", "correct": False}]
TWO_RIGHT = [{"text": "a", "correct": True}, {"text": "b", "correct": True}]
EIGHTIES = [{"label": "a", "from": "1980", "to": "1989"}]


@pytest.fixture(scope="module")
def cordoba():
    return tutorial_data("cordoba_heat")


@pytest.mark.parametrize("task,chart", [
    ({"type": "click_point", "answer": "2018"}, dict(JJA, range=["2014", "2026"])),
    ({"type": "click_point", "answer": "2021-08"}, {"variable": "T2M", "view": "monthly"}),
    ({"type": "order_cards", "cards": ["2022", "1997", "2018"], "order": "desc"}, JJA),
    ({"type": "tally", "rule": "r", "periods": EIGHTIES, "answers": [5]}, HOT),
    ({"type": "fit_line", "tolerance": 0.3}, JJA),
    ({"type": "slider_window", "question": "q", "options": ONE_RIGHT}, WIN),
    ({"type": "compare", "options": ONE_RIGHT}, None),
])
def test_board_validator_accepts(task, chart, cordoba):
    b = _board(task, chart)
    if chart is None:  # a clipping without a chart
        for it in b["items"]:
            it["kind"] = "clipping"
            it.pop("chart")
            it["clipping"] = {"headline": "h", "body": "b"}
    check_board(b, cordoba)


@pytest.mark.parametrize("task,chart", [
    ({"type": "click_point", "answer": "2010"}, dict(JJA, range=["2014", "2026"])),  # out of range
    ({"type": "click_point", "answer": "2018-08"}, JJA),                            # yearly view
    ({"type": "order_cards", "cards": ["2022", "1975", "2018"], "order": "desc"}, JJA),
    ({"type": "order_cards", "cards": ["2022", "1997", "2018"], "order": "up"}, JJA),
    ({"type": "tally", "rule": "r", "periods": EIGHTIES, "answers": [6]}, HOT),     # wrong count
    ({"type": "tally", "rule": "r", "periods": EIGHTIES, "answers": [5, 1]}, HOT),
    ({"type": "fit_line"}, {"variable": "T2M", "view": "climatology"}),
    ({"type": "slider_window", "question": "q", "options": TWO_RIGHT}, WIN),
    ({"type": "slider_window", "question": "q", "options": ONE_RIGHT}, JJA),
    ({"type": "compare", "options": TWO_RIGHT}, JJA),
    ({"type": "guess", "answer": "2018"}, JJA),
])
def test_board_validator_rejects(task, chart, cordoba):
    with pytest.raises(AssertionError):
        check_board(_board(task, chart), cordoba)


def test_board_validator_rejects_long_clue_and_few_items(cordoba):
    b = _board({"type": "fit_line"}, JJA)
    b["items"][0]["clue"] = " ".join(["word"] * (MAX_CLUE_WORDS + 1))
    with pytest.raises(AssertionError):
        check_board(b, cordoba)
    b = _board({"type": "fit_line"}, JJA)
    b["items"] = b["items"][:3]
    with pytest.raises(AssertionError):
        check_board(b, cordoba)
