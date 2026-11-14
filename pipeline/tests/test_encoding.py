"""Generated JSON files must be clean UTF-8: no double-encoded characters such as "Â°" for "°"."""
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
FILES = [ROOT / "data" / "cases_index.json", *sorted((ROOT / "src" / "levels").rglob("*.json"))]


@pytest.mark.parametrize("path", FILES, ids=lambda p: p.relative_to(ROOT).as_posix())
def test_no_double_encoded_text(path):
    raw = path.read_text(encoding="utf-8")
    # check the raw text and the decoded values (catches "\u00c2" escapes too)
    decoded = json.dumps(json.loads(raw), ensure_ascii=False)
    assert "Â" not in raw and "Â" not in decoded, f"{path.name} has a double-encoded character (Â)"
