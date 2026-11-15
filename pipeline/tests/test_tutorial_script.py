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


def check_task(where, task, chart, data):
    """Check one evidence-board task (EvidenceTask) against its chart and the data."""
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

        check_task(where, it["task"], chart, data)
    return used


# --- courtroom trial (Trial in src/shared/tutorial.ts) ---------------------------------------

SIDES = {"prosecution", "defence"}
RULINGS = {"admit", "reject", "insufficient"}
TRIAL_TASKS = {"translate", "sort_moves", "missing_data"}
MOVES = {"both_dry", "both_wet", "apart"}
SENTENCE_VERDICTS = {"guilty": "right", "not_guilty": "wrong", "not_proven": "partly"}
Z_TOL = 0.05       # script answer vs data (the UI accepts +/- 0.25 from the player)
MIN_MOVE_Z = 0.15  # sort_moves: both lines must be clearly away from zero at each date


def zscore(data, var, date):
    """Anomaly / population standard deviation of all the variable's anomalies (as the UI does)."""
    import statistics
    an = data["variables"][var]["anomaly"]
    vals = [v for v in an["values"] if v is not None]
    a = dict(zip(an["dates"], an["values"])).get(date)
    assert a is not None, f"no anomaly for {var} {date}"
    return a / statistics.pstdev(vals)


def smooth_z(data, var, date):
    z = data["variables"][var]["extras"]["zscore_smooth12"]
    return dict(zip(z["dates"], z["values"])).get(date)


def check_trial_task(where, task, chart, data):
    """Trial-only tasks; returns the variables they use."""
    t = task["type"]
    for key in ("prompt", "hint", "success"):
        assert str(task.get(key, "")).strip(), f"{where}: task needs {key}"
    if t == "translate":
        readings = task["readings"]
        assert readings, f"{where}: translate needs readings"
        for r in readings:
            assert r["variable"] in data["variables"], f"{where}: variable {r['variable']}"
            z = zscore(data, r["variable"], r["date"])
            assert abs(z - r["answer"]) <= Z_TOL, \
                f"{where}: {r['variable']} {r['date']} answer {r['answer']}, data says {z:.2f}"
        return {r["variable"] for r in readings}
    if t == "sort_moves":
        assert chart and chart["view"] == "zscore_pair", f"{where}: sort_moves needs zscore_pair"
        a, b = chart["variables"]
        dates, answers = task["dates"], task["answers"]
        assert dates and len(dates) == len(answers) and len(set(dates)) == len(dates), \
            f"{where}: dates vs answers"
        assert set(answers) <= MOVES, f"{where}: answers {answers}"
        for d, ans in zip(dates, answers):
            za, zb = smooth_z(data, a, d), smooth_z(data, b, d)
            assert za is not None and zb is not None, f"{where}: no smoothed value on {d}"
            assert min(abs(za), abs(zb)) >= MIN_MOVE_Z, f"{where}: {d} too close to zero"
            real = "both_dry" if za < 0 and zb < 0 else "both_wet" if za > 0 and zb > 0 else "apart"
            assert ans == real, f"{where}: {d} answer {ans}, data says {real}"
        return set()
    if t == "missing_data":
        opts = task["options"]
        assert len(opts) >= 3 and all(o["text"].strip() for o in opts), f"{where}: options"
        needed = [o["needed"] for o in opts]
        assert any(needed) and not all(needed), f"{where}: needs right and wrong options"
        return set()
    raise AssertionError(f"{where}: task type {t}")


def check_trial(trial, data, reveal):
    """Check a Trial against TutorialData; returns the variables its charts and tasks use."""
    for key in ("title", "charge", "instructions"):
        assert str(trial.get(key, "")).strip(), f"trial: missing {key}"
    exhibits = trial["exhibits"]
    assert MIN_ITEMS <= len(exhibits) <= MAX_ITEMS, f"trial: {len(exhibits)} exhibits"
    ids = [ex["id"] for ex in exhibits]
    assert all(ids) and len(ids) == len(set(ids)), "trial: exhibit ids must be unique"
    assert {ex["side"] for ex in exhibits} == SIDES, "trial: both sides must present exhibits"
    used = set()
    for ex in exhibits:
        where = f"exhibit {ex['id']}"
        assert ex["side"] in SIDES, f"{where}: side {ex['side']}"
        kind = ex.get("kind", "exhibit")
        assert kind in ("exhibit", "missing"), f"{where}: kind {kind}"
        for key in ("title", "teaser", "argument", "text", "objection", "ruling_feedback", "clue"):
            assert str(ex.get(key, "")).strip(), f"{where}: missing {key}"
        assert len(ex["text"].split()) <= MAX_WORDS, f"{where}: text too long"
        assert len(ex["clue"].split()) <= MAX_CLUE_WORDS, f"{where}: clue too long"
        assert ex["ruling"] in RULINGS, f"{where}: ruling {ex['ruling']}"
        chart = ex.get("chart")
        if kind == "missing":
            assert not chart, f"{where}: a missing exhibit has no chart"
            assert ex["task"]["type"] == "missing_data", f"{where}: missing exhibit task"
            assert ex["ruling"] == "insufficient", f"{where}: a missing exhibit is insufficient"
        if chart:
            used |= check_chart(ex["id"], chart, data)
        task = ex["task"]
        if task["type"] in TRIAL_TASKS:
            used |= check_trial_task(where, task, chart, data)
        else:
            check_task(where, task, chart, data)
        fu = ex.get("follow_up")
        if fu:
            assert fu["prompt"].strip() and fu["hint"].strip() and fu["feedback"].strip(), \
                f"{where}: follow_up text"
            check_options(f"{where} follow_up", fu["options"])
    assert len({ex["ruling"] for ex in exhibits}) >= 2, "trial: rulings should not all be the same"

    sentence = trial["sentence"]
    assert sentence["prompt"].strip() and sentence["summary"].strip(), "trial: sentence text"
    opts = sentence["options"]
    assert {o["verdict"] for o in opts} == set(SENTENCE_VERDICTS), "trial: one option per verdict"
    check_options("trial sentence", opts)
    for o in opts:
        if not o["correct"]:
            assert str(o.get("objection", "")).strip(), f"trial sentence {o['verdict']}: objection"
    right = next(o for o in opts if o["correct"])["verdict"]
    assert "claim_verdict" in reveal, "trial: reveal needs claim_verdict"
    assert SENTENCE_VERDICTS[right] == reveal["claim_verdict"], \
        f"trial: sentence {right} does not match claim_verdict {reveal['claim_verdict']}"
    return used


# --- interrogation room (Interrogation in src/shared/tutorial.ts, Aneto) ---------------------

ALIBI_VERDICTS = {"breaks", "backs", "doubt"}
SUSPECT_LOOKS = {"heat", "snow"}
INTERROGATION_TASKS = TASK_TYPES | {"season_switch", "proof_line"}
ALPHA = 0.05  # the "standard of proof" line, same as the pipeline


def season_switch_answer(task, data):
    """Seasons the player must tick, recomputed from the data (same rule as the UI)."""
    s = data["variables"][task["variable"]]
    seasons = s["extras"]["seasons"]
    if task["rule"] == "faster_than_year":
        year = s["trend"]["slope_per_year"]
        return {k for k in task["seasons"] if seasons[k]["trend"]["slope_per_year"] > year}
    return {k for k in task["seasons"] if seasons[k]["trend"]["p_value"] < ALPHA}


def exhibit_p(ex, data):
    """p-value of one proof_line exhibit: whole record, a season or a threshold count."""
    s = data["variables"][ex["variable"]]
    if "threshold_id" in ex:
        return next(t for t in s["extras"]["threshold_counts"]
                    if t["id"] == ex["threshold_id"])["trend"]["p_value"]
    if "season" in ex:
        return s["extras"]["seasons"][ex["season"]]["trend"]["p_value"]
    return s["trend"]["p_value"]


def check_interrogation(inter, data):
    """Check an Interrogation against TutorialData; returns the variables it uses."""
    for key in ("title", "instructions", "summary"):
        assert str(inter.get(key, "")).strip(), f"interrogation: missing {key}"
    assert str(inter["finale"]["prompt"]).strip(), "interrogation: finale prompt"

    suspects = inter["suspects"]
    assert len(suspects) == 2, "interrogation: exactly two suspects"
    sids = [x["id"] for x in suspects]
    assert all(sids) and len(set(sids)) == 2, "interrogation: suspect ids must be unique"
    assert sum(x["guilty"] is True for x in suspects) == 1, "interrogation: exactly one guilty"
    for x in suspects:
        for key in ("name", "record", "alibi", "decision_text", "wrong_hint"):
            assert str(x.get(key, "")).strip(), f"suspect {x['id']}: missing {key}"
        assert x["look"] in SUSPECT_LOOKS, f"suspect {x['id']}: look {x['look']}"

    evidence = inter["evidence"]
    assert MIN_ITEMS <= len(evidence) <= MAX_ITEMS, f"interrogation: {len(evidence)} folders"
    ids = [e["id"] for e in evidence]
    assert all(ids) and len(ids) == len(set(ids)), "interrogation: evidence ids must be unique"
    used = set()
    for ev in evidence:
        where = f"evidence {ev['id']}"
        for key in ("title", "teaser", "text", "verdict_feedback", "clue"):
            assert str(ev.get(key, "")).strip(), f"{where}: missing {key}"
        assert len(ev["text"].split()) <= MAX_WORDS, f"{where}: text too long"
        assert len(ev["clue"].split()) <= MAX_CLUE_WORDS, f"{where}: clue too long"
        assert ev["suspect"] in sids, f"{where}: suspect {ev['suspect']}"
        assert ev["verdict"] in ALIBI_VERDICTS, f"{where}: verdict {ev['verdict']}"
        chart = ev.get("chart")
        if chart:
            used |= check_chart(ev["id"], chart, data)
        task = ev["task"]
        t = task["type"]
        assert t in INTERROGATION_TASKS, f"{where}: task type {t}"
        if t == "season_switch":
            for key in ("prompt", "hint", "success", "question"):
                assert str(task.get(key, "")).strip(), f"{where}: task needs {key}"
            var = task["variable"]
            assert var in data["variables"], f"{where}: variable {var} not in data"
            assert task["rule"] in ("faster_than_year", "significant"), f"{where}: rule"
            seasons = task["seasons"]
            assert len(seasons) >= 2 and len(set(seasons)) == len(seasons), f"{where}: seasons"
            assert set(seasons) <= SEASONS, f"{where}: seasons {seasons}"
            for k in seasons:
                assert k in data["variables"][var]["extras"]["seasons"], f"{where}: no {k} data"
            if not season_switch_answer(task, data):  # "None of them" is the right answer
                assert "none" in task["success"].lower(), f"{where}: answer is none, say so"
            used.add(var)
        elif t == "proof_line":
            for key in ("prompt", "hint", "success"):
                assert str(task.get(key, "")).strip(), f"{where}: task needs {key}"
            exhibits = task["exhibits"]
            assert 3 <= len(exhibits) <= 6, f"{where}: 3-6 exhibits"
            assert len({x["label"] for x in exhibits}) == len(exhibits), f"{where}: labels"
            sides = set()
            for x in exhibits:
                assert x["variable"] in data["variables"], f"{where}: {x['variable']} not in data"
                assert not ("season" in x and "threshold_id" in x), f"{where}: season or threshold"
                if "season" in x:
                    assert x["season"] in SEASONS, f"{where}: season {x['season']}"
                sides.add(exhibit_p(x, data) < ALPHA)
                used.add(x["variable"])
            assert sides == {True, False}, f"{where}: exhibits on both sides of the line"
        else:
            check_task(where, task, chart, data)

    # the verdicts must agree with who is guilty
    for x in suspects:
        verdicts = [e["verdict"] for e in evidence if e["suspect"] == x["id"]]
        assert verdicts, f"suspect {x['id']}: no evidence put to them"
        if x["guilty"]:
            assert "breaks" in verdicts and "backs" not in verdicts, \
                f"suspect {x['id']}: guilty needs a broken alibi and no backing"
        else:
            assert "breaks" not in verdicts, f"suspect {x['id']}: innocent with a broken alibi"
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
    formats = [k for k in ("board", "trial", "interrogation") if k in s]
    assert len(formats) <= 1, f"a case uses one learning format, not {formats}"
    if formats:
        assert s["steps"] == [], f"a case with a {formats[0]} has no quiz steps"
    else:
        assert s["steps"], "no steps"

    used = check_board(s["board"], data) if "board" in s else set()
    if "trial" in s:
        assert s.get("scene"), "a trial needs the witness scene (its claim is the charge)"
        used |= check_trial(s["trial"], data, s["reveal"])
    if "interrogation" in s:
        used |= check_interrogation(s["interrogation"], data)
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


# --- the trial validator itself, on the real Donana trial with one thing broken ------------

@pytest.fixture(scope="module")
def donana():
    return load(ROOT / "data" / "tutorials" / "donana.json"), tutorial_data("donana")


def test_trial_validator_accepts(donana):
    s, data = donana
    assert check_trial(s["trial"], data, s["reveal"]) == {"SOILM", "PRECIP"}


def _ex(t, task_type):
    return next(e for e in t["exhibits"] if e["task"]["type"] == task_type)


@pytest.mark.parametrize("breaker", [
    lambda t, r: _ex(t, "translate")["task"]["readings"][0].update(answer=-2.0),     # wrong z
    lambda t, r: _ex(t, "sort_moves")["task"]["answers"].reverse(),                   # wrong signs
    lambda t, r: _ex(t, "sort_moves")["task"].update(dates=["2005-04"], answers=["both_dry", "apart"]),
    lambda t, r: _ex(t, "missing_data")["task"].update(options=[{"text": "x", "needed": True}] * 3),
    lambda t, r: _ex(t, "missing_data").update(ruling="admit"),
    lambda t, r: t["exhibits"][0].update(ruling="maybe"),
    lambda t, r: t["exhibits"][0].update(side="jury"),
    lambda t, r: r.update(claim_verdict="wrong"),                                     # sentence mismatch
    lambda t, r: t["sentence"]["options"][0].update(correct=True),                    # two correct
    lambda t, r: t.update(exhibits=t["exhibits"][:2]),                                # too few
])
def test_trial_validator_rejects(breaker, donana):
    import copy
    s, data = donana
    t, r = copy.deepcopy(s["trial"]), copy.deepcopy(s["reveal"])
    breaker(t, r)
    with pytest.raises((AssertionError, KeyError)):
        check_trial(t, data, r)


# --- the interrogation validator itself, on the real Aneto script ----------------------------

def _interrogation():
    return load(ROOT / "data" / "tutorials" / "aneto_glacier.json")["interrogation"]


def test_interrogation_answers_from_data(aneto):
    inter = _interrogation()
    assert check_interrogation(inter, aneto) == {"T2M", "PRECIP"}
    tasks = {e["id"]: e["task"] for e in inter["evidence"]}
    # spring and summer warm faster than the whole record; no precipitation season is significant
    assert season_switch_answer(tasks["split_year"], aneto) == {"MAM", "JJA"}
    assert season_switch_answer(tasks["precip_gauge"], aneto) == set()
    proven = {x["label"] for x in tasks["standard_of_proof"]["exhibits"] if exhibit_p(x, aneto) < ALPHA}
    assert proven == {"Summer temperature", "Temperature, all months"}


def _one_sided(i):
    i["evidence"][3]["task"]["exhibits"] = [
        {"label": f"x{k}", "variable": "PRECIP", "season": s} for k, s in enumerate(["DJF", "JJA", "SON"])]


@pytest.mark.parametrize("break_it", [
    lambda i: i["suspects"][1].update(guilty=True),                     # two guilty
    lambda i: i["suspects"].pop(),                                      # one suspect
    lambda i: i["evidence"][0].update(suspect="nobody"),
    lambda i: i["evidence"][0].update(verdict="supports"),
    lambda i: i["evidence"][2].update(verdict="breaks"),                # innocent, alibi broken
    lambda i: i["evidence"][0]["task"].update(rule="slower"),
    lambda i: i["evidence"][2]["task"].update(success="Right: winter only."),  # answer is none
    lambda i: i["evidence"][3]["task"].update(exhibits=i["evidence"][3]["task"]["exhibits"][:1]),
    _one_sided,                                                         # all exhibits not proven
    lambda i: i["evidence"][4]["task"].update(answers=[20, 9]),         # tally: data says 8
    lambda i: i["evidence"][0]["task"].update(type="quiz"),
])
def test_interrogation_validator_rejects(break_it, aneto):
    inter = _interrogation()
    break_it(inter)
    with pytest.raises((AssertionError, KeyError)):
        check_interrogation(inter, aneto)
