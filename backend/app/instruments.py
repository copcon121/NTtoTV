"""Instrument metadata exposed by the chart UI.

The v1 live feed is the existing Rithmic COMEX gold future. Keeping the
provider-facing symbol separate from its UI label lets additional exchanges
and data providers be added without changing the chart identity contract.
"""

from __future__ import annotations

from typing import Any

COMEX_GC = {
    "id": "COMEX:GC",
    "symbol": "GC",
    "displaySymbol": "GC/USD",
    "venue": "COMEX",
    "assetClass": "future",
    "provider": "rithmic",
    "contractMode": "active-contract",
    "readOnly": False,
}


def instrument_catalog(active_contract: str | None = None) -> list[dict[str, Any]]:
    item = dict(COMEX_GC)
    if active_contract:
        item["activeContract"] = active_contract
    return [item]

