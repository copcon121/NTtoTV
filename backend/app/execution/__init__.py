"""Direct, per-user broker execution independent of market-data ingestion."""

import os


def execution_mode() -> str:
    mode = os.getenv("NTTOTV_EXECUTION_MODE", "").strip().lower()
    if not mode:
        return "exness"
    if mode == "windows":
        # Explicit old windows fails closed (no relay fallback).
        return "disabled"
    if mode not in {"exness", "disabled"}:
        raise ValueError("NTTOTV_EXECUTION_MODE must be exness or disabled")
    return mode
