"""Supabase client, created lazily from environment variables.

Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in a local `.env` (see .env.example).
The key is server-side only: never expose it
to the frontend and never prefix it with VITE_.
"""
import os
from functools import lru_cache
from typing import Any, Optional


def _load_dotenv() -> None:
    """Minimal .env loader for local development (no extra dependency)."""
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    if not os.path.isfile(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@lru_cache(maxsize=1)
def get_client() -> Optional[Any]:
    """Return a Supabase client, or None when Supabase is not configured."""
    _load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    from supabase import create_client  # imported here so the app starts without it

    return create_client(url, key)
