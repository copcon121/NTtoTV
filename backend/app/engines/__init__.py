"""Engines: derived-data and decision components.

Houses the Bar_Aggregator, VolumeDelta_Engine, Footprint_Engine,
BigTrade_Engine, Contract_Resolver, and Alert_Engine. All order-flow and alert
logic is computed server-side so parity with the reference NT indicators is
controlled in one place. (Requirements 9, 10, 13-17)
"""

from __future__ import annotations

from .bar_aggregator import SUPPORTED_TFS, BarAggregator
from .alert_engine import (
    ALERT_TYPES,
    LEVEL_ALERT_TYPES,
    Alert,
    AlertEngine,
    MarketContext,
)
from .volume_delta_engine import (
    DEFAULT_TIMEFRAME,
    VolumeDeltaEngine,
    VolumeDeltaMode,
)
from .footprint_engine import (
    FOOTPRINT_TIMEFRAME,
    FootprintEngine,
)
from .fvg_signal_engine import FVG_SIGNAL_TIMEFRAME, FvgSignalEngine
from .big_trade_engine import BigTradeEngine
from .breakout_box_engine import BREAKOUT_BOX_TIMEFRAME, BreakoutBoxEngine, BreakoutBoxEvent
from .contract_resolver import ContractResolver

__all__ = [
    "BarAggregator",
    "SUPPORTED_TFS",
    "VolumeDeltaEngine",
    "VolumeDeltaMode",
    "DEFAULT_TIMEFRAME",
    "FootprintEngine",
    "FOOTPRINT_TIMEFRAME",
    "FvgSignalEngine",
    "FVG_SIGNAL_TIMEFRAME",
    "BigTradeEngine",
    "BreakoutBoxEngine",
    "BreakoutBoxEvent",
    "BREAKOUT_BOX_TIMEFRAME",
    "ContractResolver",
    "AlertEngine",
    "Alert",
    "MarketContext",
    "ALERT_TYPES",
    "LEVEL_ALERT_TYPES",
]
