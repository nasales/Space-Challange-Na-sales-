"""Vercel entrypoint. Every /api/* request is rewritten here (see vercel.json).

Keep this file tiny: all backend code lives in the `backend/` package.
"""
import os
import sys

# Make the project root importable both on Vercel and with `uvicorn api.index:app`.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app import app  # noqa: E402,F401
