"""Backfill/import tools for repairing historical market-data gaps."""

from importlib import import_module
from typing import Any

__all__ = [
    "ImportMode",
    "ImportSummary",
    "NtExportPaths",
    "import_nt_export_gap",
    "parse_nt_timestamp",
]


def __getattr__(name: str) -> Any:
    if name not in __all__:
        raise AttributeError(name)
    module = import_module(".nt_export", __name__)
    return getattr(module, name)
