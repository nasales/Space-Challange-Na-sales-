"""Case queries. Supabase first, offline fallback to data/cache/*.json (AGENTS.md rule 10).

Database team: add new queries here (or in new modules next to this one) and
expose them from backend/app.py. Table schema: supabase/schema.sql.
"""
import glob
import json
import logging
import os
from typing import Dict, List, Optional

from .db import get_client
from .models import CaseData, CaseSummary

log = logging.getLogger(__name__)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT, "data", "cache")
TABLE = "cases"
SUMMARY_FIELDS = ("place", "lat", "lon", "variable")


def _read_cache() -> Dict[str, dict]:
    """All cached cases, keyed by file name without extension."""
    result = {}
    for path in sorted(glob.glob(os.path.join(CACHE_DIR, "*.json"))):
        case_id = os.path.splitext(os.path.basename(path))[0]
        with open(path, encoding="utf-8") as f:
            result[case_id] = json.load(f)
    return result


def list_cases() -> List[CaseSummary]:
    client = get_client()
    if client is not None:
        try:
            rows = client.table(TABLE).select("id," + ",".join(SUMMARY_FIELDS)).execute().data
            return [CaseSummary(**row) for row in rows]
        except Exception:  # noqa: BLE001 - any DB failure falls back to the cache
            log.exception("Supabase list_cases failed, using data/cache")
    return [
        CaseSummary(id=case_id, **{k: d[k] for k in SUMMARY_FIELDS})
        for case_id, d in _read_cache().items()
    ]


def get_case(case_id: str) -> Optional[CaseData]:
    client = get_client()
    if client is not None:
        try:
            rows = client.table(TABLE).select("*").eq("id", case_id).limit(1).execute().data
            if rows:
                return CaseData(**rows[0])  # extra columns (id, created_at) are ignored
        except Exception:  # noqa: BLE001
            log.exception("Supabase get_case failed, using data/cache")
    data = _read_cache().get(case_id)
    return CaseData(**data) if data else None
