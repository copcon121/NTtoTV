from __future__ import annotations

import pytest

from app.engines.basis_engine import BasisEngine
from app.engines.symbol_map import SymbolMap
from app.models.mt5 import Mt5SymbolInfo


@pytest.mark.unit
def test_basis_uses_latest_raw_gc_broker_spread_for_conversion():
    basis = BasisEngine()
    symbol = SymbolMap.from_info(
        Mt5SymbolInfo(
            symbol="XAUUSDc",
            digits=3,
            tick_size=0.001,
            min_lot=0.01,
            max_lot=100.0,
            lot_step=0.01,
            stops_level=0.5,
            pip_value=1.0,
        )
    )

    basis.update_gc(4340.0, 1)
    basis.update_broker_mid(4316.0, 2)

    snap = basis.snapshot()
    assert snap.basis == -24.0
    assert basis.to_broker(4340.0, symbol).price == 4316.0
    assert basis.from_broker(4316.0, symbol).price == 4340.0

    basis.update_gc(4341.5, 3)
    basis.update_broker_mid(4316.2, 4)

    snap = basis.snapshot()
    assert snap.basis == pytest.approx(-25.3)
    assert basis.from_broker(4316.2, symbol).price == 4341.5
