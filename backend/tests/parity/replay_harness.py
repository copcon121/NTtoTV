"""Deterministic replay harness for reference-indicator parity (task 19.1).

Feeds a parity fixture's recorded event stream into the engines under test with
**identical ordering, bid/ask snapshot state, and ms-precision timestamps**, so
the engine output can be compared against the paired reference-output oracle
(Properties 28-30). (Req 13.8, 14.9, 15.6)

The driver keeps a **running quote snapshot**: a ``quote`` event replaces it,
and a ``trade`` event is classified against its OWN ``bid``/``ask`` when present
otherwise against the most recent quote's snapshot — exactly mirroring how
NinjaTrader evaluates each trade against the prevailing book. ``symbol``,
``contract``, and per-channel monotonic ``sequence`` values are assigned from
the fixture's top-level fields and event order, so a replay is fully
deterministic.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.engines.big_trade_engine import BigTradeEngine
from app.engines.footprint_engine import FootprintEngine
from app.engines.volume_delta_engine import VolumeDeltaEngine, VolumeDeltaMode
from app.models.canonical import NormalizedQuote, NormalizedTrade
from app.models.messages import FootprintUpdate, VolumeDeltaUpdate

from .fixtures_loader import ParityFixture

__all__ = [
    "ReplayDriver",
    "replay_trades",
    "replay_volume_delta",
    "replay_footprint",
    "replay_big_trade",
]


@dataclass(slots=True)
class _Snapshot:
    bid: float | None = None
    ask: float | None = None
    bid_size: int = 0
    ask_size: int = 0


class ReplayDriver:
    """Converts fixture events into NormalizedTrade/NormalizedQuote in order.

    Maintains the running quote snapshot and per-channel monotonic sequences so
    the produced stream is identical on every replay.
    """

    def __init__(self, symbol: str, contract: str) -> None:
        self.symbol = symbol
        self.contract = contract
        self._snapshot = _Snapshot()
        self._trade_seq = 0
        self._quote_seq = 0

    def trades(self, events: list[dict[str, Any]]) -> list[NormalizedTrade]:
        """Replay ``events`` and return the ordered NormalizedTrade list.

        Quotes update the running snapshot; trades are emitted with their own
        tagged bid/ask when present, otherwise the running snapshot's bid/ask.
        """
        out: list[NormalizedTrade] = []
        for ev in events:
            if ev["type"] == "quote":
                self._apply_quote(ev)
            elif ev["type"] == "trade":
                out.append(self._make_trade(ev))
            else:  # pragma: no cover - defensive
                raise ValueError(f"unknown event type: {ev['type']!r}")
        return out

    def quotes_and_trades(
        self, events: list[dict[str, Any]]
    ) -> list[NormalizedTrade | NormalizedQuote]:
        """Replay ``events`` preserving quotes and trades in interleaved order."""
        out: list[NormalizedTrade | NormalizedQuote] = []
        for ev in events:
            if ev["type"] == "quote":
                out.append(self._make_quote(ev))
                self._apply_quote(ev)
            elif ev["type"] == "trade":
                out.append(self._make_trade(ev))
            else:  # pragma: no cover - defensive
                raise ValueError(f"unknown event type: {ev['type']!r}")
        return out

    def _apply_quote(self, ev: dict[str, Any]) -> None:
        self._snapshot = _Snapshot(
            bid=float(ev["bid"]),
            ask=float(ev["ask"]),
            bid_size=int(ev.get("bidSize", 0)),
            ask_size=int(ev.get("askSize", 0)),
        )

    def _make_quote(self, ev: dict[str, Any]) -> NormalizedQuote:
        self._quote_seq += 1
        return NormalizedQuote(
            symbol=self.symbol,
            contract=self.contract,
            time=int(ev["time"]),
            bid=float(ev["bid"]),
            ask=float(ev["ask"]),
            bid_size=int(ev.get("bidSize", 0)),
            ask_size=int(ev.get("askSize", 0)),
            sequence=self._quote_seq,
        )

    def _make_trade(self, ev: dict[str, Any]) -> NormalizedTrade:
        self._trade_seq += 1
        # The trade's own tagged snapshot wins; otherwise the running snapshot.
        bid = float(ev["bid"]) if "bid" in ev else self._snapshot.bid
        ask = float(ev["ask"]) if "ask" in ev else self._snapshot.ask
        return NormalizedTrade(
            symbol=self.symbol,
            contract=self.contract,
            time=int(ev["time"]),
            price=float(ev["price"]),
            volume=int(ev["volume"]),
            bid=bid,
            ask=ask,
            best_bid=bid,
            best_ask=ask,
            sequence=self._trade_seq,
        )


def replay_trades(fixture: ParityFixture) -> list[NormalizedTrade]:
    """Return the ordered NormalizedTrade stream for a fixture."""
    return ReplayDriver(fixture.symbol, fixture.contract).trades(fixture.events)


def replay_volume_delta(fixture: ParityFixture) -> list[VolumeDeltaUpdate]:
    """Replay a volume_delta fixture and return per-bar final states in order."""
    cfg = fixture.config
    mode = (
        VolumeDeltaMode.CUMULATIVE
        if str(cfg.get("mode", "Delta")) == "CumulativeDelta"
        else VolumeDeltaMode.DELTA
    )
    engine = VolumeDeltaEngine(
        timeframe=str(cfg.get("timeframe", "1m")),
        mode=mode,
        min_trade_size=int(cfg.get("minTradeSize", 0)),
    )
    final: dict[int, VolumeDeltaUpdate] = {}
    order: list[int] = []
    for t in replay_trades(fixture):
        u = engine.on_trade(t)
        if u is None:
            continue
        if u.time not in final:
            order.append(u.time)
        final[u.time] = u
    return [final[time] for time in order]


def replay_footprint(fixture: ParityFixture) -> list[FootprintUpdate]:
    """Replay a footprint fixture and return per-M1-bar final states in order."""
    cfg = fixture.config
    engine = FootprintEngine(
        imbalance_percent=float(cfg.get("imbalancePercent", 100.0)),
        imbalance_min_volume=int(cfg.get("imbalanceMinVolume", 10)),
        group_ticks_per_level=int(cfg.get("groupTicksPerLevel", 0)),
        trade_volume_filter=int(cfg.get("tradeVolumeFilter", 0)),
        tick_size=float(cfg.get("tickSize", 0.1)),
    )
    final: dict[int, FootprintUpdate] = {}
    order: list[int] = []
    for t in replay_trades(fixture):
        u = engine.on_trade(t)
        if u is None:
            continue
        if u.time not in final:
            order.append(u.time)
        final[u.time] = u
    return [final[time] for time in order]


def replay_big_trade(fixture: ParityFixture):
    """Replay a big_trade fixture and return the emitted markers in order."""
    cfg = fixture.config
    engine = BigTradeEngine(
        min_volume=int(cfg.get("minVolume", 30)),
        max_volume=int(cfg.get("maxVolume", -1)),
        volume_filter_enable=bool(cfg.get("volumeFilterEnable", True)),
    )
    return engine.merge_stream(replay_trades(fixture))
