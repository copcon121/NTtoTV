"""Scan AI package for deterministic chart suggestions on GC futures."""

from .detector import run_scan_ai
from .models import (
    ALL_GROUPS,
    ALL_PATTERNS,
    ALL_STATES,
    SCAN_DENSITIES,
    SCAN_DEPTHS,
    SCAN_STRENGTHS,
    ScanAiAnchor,
    ScanAiRequest,
    ScanAiSuggestion,
    SuggestionGroup,
    SuggestionState,
    SuggestionStrength,
)

SCAN_DEPTH_LIMITS = SCAN_DEPTHS
SUPPORTED_ANALYSES = {"trendline", "fibonacci", "elliott"}

__all__ = [
    "ALL_GROUPS",
    "ALL_PATTERNS",
    "ALL_STATES",
    "SCAN_DENSITIES",
    "SCAN_DEPTHS",
    "SCAN_DEPTH_LIMITS",
    "SCAN_STRENGTHS",
    "SUPPORTED_ANALYSES",
    "ScanAiAnchor",
    "ScanAiRequest",
    "ScanAiSuggestion",
    "SuggestionGroup",
    "SuggestionState",
    "SuggestionStrength",
    "run_scan_ai",
]
