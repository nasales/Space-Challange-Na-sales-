"""FastAPI app serving /api/*. Not deployed (the hosted site is static); run locally with `npm run dev:api`."""
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException, Query

from . import cases
from .db import get_client
from .models import CaseData, CaseSummary

app = FastAPI(title="John Datason API")


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


@app.get("/api/cell")
def get_cell(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
) -> List[Dict[str, Any]]:
    """Any point of the map: one row per variable from the Supabase `get_cell` function
    (monthly series + trend of the nearest land cell). Empty list = sea / outside the map."""
    client = get_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase is not configured")
    try:
        return client.rpc("get_cell", {"p_lat": lat, "p_lon": lon}).execute().data or []
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="Supabase get_cell failed") from exc


@app.get("/api/cases/{case_id}", response_model=CaseData)
def get_case(case_id: str) -> CaseData:
    case = cases.get_case(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found")
    return case
