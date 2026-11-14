"""FastAPI app served by Vercel at /api/*. Run locally with `npm run dev:api`."""
from typing import List

from fastapi import FastAPI, HTTPException

from . import cases
from .db import get_client
from .models import CaseData, CaseSummary

app = FastAPI(title="Trend Detective API")


@app.get("/api/health")
def health() -> dict:
    """Backend is alive; also reports whether Supabase is reachable."""
    client = get_client()
    if client is None:
        status = "not_configured"
    else:
        try:
            client.table(cases.TABLE).select("id").limit(1).execute()
            status = "connected"
        except Exception:  # noqa: BLE001
            status = "error"
    return {"ok": True, "supabase": status}


@app.get("/api/cases", response_model=List[CaseSummary])
def list_cases() -> List[CaseSummary]:
    return cases.list_cases()


@app.get("/api/cases/{case_id}", response_model=CaseData)
def get_case(case_id: str) -> CaseData:
    case = cases.get_case(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return case
