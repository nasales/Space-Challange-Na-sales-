"""Local API entrypoint (`npm run dev:api`). Vite proxies every /api/* request here.

Keep this file tiny: all backend code lives in the `backend/` package.
"""
import os
import sys

# Make the project root importable with `uvicorn api.index:app`.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app import app  # noqa: E402,F401
