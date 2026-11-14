"""docs/featured_cases.md holds the current generated case list."""

from pipeline.featured_doc import DOC_PATH, cases_list, replace_block


def test_featured_doc_is_current():
    doc = DOC_PATH.read_text(encoding="utf-8")
    assert replace_block(doc, cases_list()) == doc


def test_case_list_content():
    text = cases_list()
    assert text.count("**") == 20  # 10 cases
    assert text.count("weak evidence") == 3
    assert text.count("temperature: +") == 7 and text.count("°C per decade, significant") == 7
    precip = [l for l in text.splitlines() if l.strip().startswith("- precipitation")]
    assert precip and all("not significant" in l for l in precip)
