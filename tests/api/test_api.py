"""API smoke tests. Run: python -m pytest tests/api -q (needs requirements-dev.txt)."""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from fastapi.testclient import TestClient  # noqa: E402

from backend import app as app_module  # noqa: E402
from backend import cases  # noqa: E402

client = TestClient(app_module.app)


def _no_supabase(monkeypatch):
    monkeypatch.setattr(cases, "get_client", lambda: None)
    monkeypatch.setattr(app_module, "get_client", lambda: None)


def test_health_without_supabase(monkeypatch):
    _no_supabase(monkeypatch)
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True, "supabase": "not_configured"}


def test_cases_fall_back_to_cache(monkeypatch):
    _no_supabase(monkeypatch)
    r = client.get("/api/cases")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_unknown_case_is_404(monkeypatch):
    _no_supabase(monkeypatch)
    assert client.get("/api/cases/does-not-exist").status_code == 404
