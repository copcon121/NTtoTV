"""Event-driven SMC POI scanner."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import replace
from typing import Any
from uuid import uuid4

from ..models.timestamp import now_ms
from ..rest.notifications import send_telegram_poi_event
from ..storage.cache_store import CacheStore
from ..storage.records import BarRecord, VolumeDeltaRecord
from .confluence import build_confluence
from .cvd_state import build_cvd_state
from .event_provider import AnalystEventProvider, MockAnalystEventProvider
from .poi_models import PoiEvent, PoiZone
from .poi_zones import POI_TIMEFRAMES, build_poi_zones
from .smc_structure import build_htf_structure_map
from .store import AnalystStore

logger = logging.getLogger(__name__)

EVENT_POI_TIMEFRAME = "M5"
EVENT_POI_KINDS = frozenset({"ob", "fvg"})
TOUCHED_STATUSES = frozenset({"inside", "reacting", "triggered"})


class PoiScanner:
    """Background queue worker that turns POI state transitions into reports."""

    def __init__(
        self,
        *,
        cache: CacheStore,
        store: AnalystStore,
        provider: AnalystEventProvider | None = None,
        real_provider: AnalystEventProvider | None = None,
        provider_mode: str = "mock",
        symbol: str = "GC",
        contract: str = "GC",
        tick_size: float = 0.1,
        cooldown_seconds: int = 1800,
        queue_size: int = 1,
        m1_internal_enabled: bool = True,
    ) -> None:
        self._cache = cache
        self._store = store
        self._mock_provider = provider or MockAnalystEventProvider()
        self._real_provider = real_provider
        self._symbol = symbol
        self._contract = contract
        self._tick_size = tick_size
        self._cooldown_ms = max(0, int(cooldown_seconds)) * 1000
        self._queue: asyncio.Queue[int] = asyncio.Queue(maxsize=max(1, queue_size))
        self._task: asyncio.Task[None] | None = None
        self._m1_internal_enabled = m1_internal_enabled

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    def start(self) -> None:
        if self.running:
            return
        self._task = asyncio.create_task(self._worker())

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None

    def enqueue_latest(self) -> None:
        """Coalesce updates; latest-state wins if scanner lags."""
        while self._queue.full():
            try:
                self._queue.get_nowait()
                self._queue.task_done()
            except asyncio.QueueEmpty:
                break
        try:
            self._queue.put_nowait(now_ms())
        except asyncio.QueueFull:
            pass

    async def _worker(self) -> None:
        while True:
            await self._queue.get()
            latest = now_ms()
            while not self._queue.empty():
                try:
                    latest = self._queue.get_nowait()
                    self._queue.task_done()
                except asyncio.QueueEmpty:
                    break
            try:
                await asyncio.to_thread(self.process_once, snapshot_time=latest)
            except Exception as exc:
                logger.warning("analyst POI scanner failed: %s", exc)
            finally:
                self._queue.task_done()

    def process_once(self, snapshot_time: int | None = None) -> list[PoiEvent]:
        ts = now_ms() if snapshot_time is None else int(snapshot_time)
        market = self._read_market()
        m1_bars = market["bars"].get("M1", [])
        current_price = _last_close(m1_bars)
        if current_price is None:
            return []

        previous = {zone.zone_id: zone for zone in self._store.poi_zones(self._symbol, self._contract)}
        contexts: dict[str, dict[str, Any]] = {}
        all_zones: list[PoiZone] = []
        event_zones: list[PoiZone] = []

        for label, _, _ in POI_TIMEFRAMES:
            bars = market["bars"].get(label, [])
            structure = build_htf_structure_map(label, bars)
            cvd = build_cvd_state(label, market["deltas"].get(label, []), bars)
            built, pd_context = build_poi_zones(
                symbol=self._symbol,
                contract=self._contract,
                timeframe=label,
                bars=bars,
                structure=structure,
                current_price=current_price,
                tick_size=self._tick_size,
                previous=previous,
            )
            contexts[label] = {
                "structureMap": structure["structureMap"],
                "breakEvents": structure["breakEvents"],
                "pdContext": pd_context,
                "cvd": cvd.to_dict(),
            }
            all_zones.extend(built)
            if label == EVENT_POI_TIMEFRAME:
                event_zones.extend(built)

        events: list[PoiEvent] = []
        preferred_side = _preferred_side(contexts)
        event_candidates: list[dict[str, Any]] = []
        for zone in _candidate_event_zones(event_zones, preferred_side):
            confluence = build_confluence(
                zone,
                all_zones,
                current_price=current_price,
                tick_size=self._tick_size,
            )
            zone = replace(zone, confluence=confluence)
            evidence = _price_evidence(
                zone,
                m1_bars,
                tick_size=self._tick_size,
            )
            status = _next_status(
                zone,
                evidence=evidence,
                tick_size=self._tick_size,
            )
            previous_zone = previous.get(zone.zone_id)
            updated_zone = _apply_status(zone, previous_zone, status, ts, evidence)
            event_types = _event_types(previous_zone, updated_zone, evidence)
            if event_types:
                updated_zone = replace(updated_zone, last_event_at=ts)
                event_candidates.append(
                    {
                        "zone": updated_zone,
                        "eventTypes": event_types,
                        "evidence": evidence,
                    }
                )
            self._store.upsert_poi_zone(updated_zone)

        selected = _select_best_event_candidate(event_candidates)
        if selected is None:
            return events

        selected_zone = selected["zone"]
        selected_evidence = selected["evidence"]
        for event_type in selected["eventTypes"]:
            if self._is_deduped(selected_zone.zone_id, event_type, ts):
                continue
            event = self._handle_event(
                event_type=event_type,
                zone=selected_zone,
                snapshot_time=ts,
                current_price=current_price,
                contexts=contexts,
                evidence=selected_evidence,
            )
            self._store.insert_poi_event(event)
            self._send_telegram_event(event)
            events.append(event)
        return events

    def _read_market(self) -> dict[str, dict[str, list[Any]]]:
        bars: dict[str, list[BarRecord]] = {}
        deltas: dict[str, list[VolumeDeltaRecord]] = {}
        for label, tf, limit in (*POI_TIMEFRAMES, ("M1", "1m", 300)):
            bars[label] = self._cache.read_bars(
                self._symbol, self._contract, tf, limit=limit
            )
            deltas[label] = self._cache.read_volume_delta(
                self._symbol, self._contract, tf, limit=limit
            )
        return {"bars": bars, "deltas": deltas}

    def _handle_event(
        self,
        *,
        event_type: str,
        zone: PoiZone,
        snapshot_time: int,
        current_price: float,
        contexts: dict[str, dict[str, Any]],
        evidence: dict[str, Any],
    ) -> PoiEvent:
        snapshot = _event_snapshot(
            event_type=event_type,
            zone=zone,
            snapshot_time=snapshot_time,
            current_price=current_price,
            contexts=contexts,
            evidence=evidence,
        )
        deduped = False
        response: dict[str, Any] | None = None
        error: str | None = None
        latency_ms: int | None = None
        provider = self._select_provider()
        if not deduped:
            start = time.perf_counter()
            try:
                response = provider.analyze(snapshot)
            except Exception as exc:
                error = str(exc)
            finally:
                latency_ms = int((time.perf_counter() - start) * 1000)
        return PoiEvent(
            event_id=str(uuid4()),
            zone_id=zone.zone_id,
            event_type=event_type,
            symbol=zone.symbol,
            contract=zone.contract,
            snapshot_time=snapshot_time,
            input_snapshot={**snapshot, "triggerEvidence": {**evidence, "deduped": deduped}},
            provider_name=provider.name,
            provider_mode=provider.mode,
            response=response,
            decision=None if response is None else str(response.get("decision")),
            confidence=None if response is None else float(response.get("confidence", 0.0)),
            allowed_to_auto_trade=False,
            error=error,
            latency_ms=latency_ms,
            deduped=deduped,
            created_at=now_ms(),
        )

    def _is_deduped(self, zone_id: str, event_type: str, ts: int) -> bool:
        if self._cooldown_ms <= 0:
            return False
        latest_symbol_event = self._store.latest_poi_symbol_event_time(
            self._symbol,
            self._contract,
        )
        if latest_symbol_event is not None and ts - latest_symbol_event < self._cooldown_ms:
            return True
        last = self._store.latest_poi_event_time(zone_id, event_type)
        return last is not None and ts - last < self._cooldown_ms

    def _select_provider(self) -> AnalystEventProvider:
        if self._real_provider is None:
            return self._mock_provider
        if not bool(getattr(self._real_provider, "enabled", True)):
            return self._mock_provider
        try:
            if self._store.any_event_ai_enabled():
                return self._real_provider
        except Exception as exc:
            logger.warning("analyst event AI setting check failed: %s", exc)
        return self._mock_provider

    def _send_telegram_event(self, event: PoiEvent) -> None:
        if event.response is None or event.deduped or event.provider_mode != "real":
            return
        try:
            profile_ids = self._store.event_ai_enabled_profile_ids()
        except Exception as exc:
            logger.warning("analyst Telegram profile lookup failed: %s", exc)
            return
        for profile_id in profile_ids:
            try:
                send_telegram_poi_event(self._cache, profile_id, event)
            except Exception as exc:
                logger.warning(
                    "analyst Telegram POI notification failed for profile %s: %s",
                    profile_id,
                    exc,
                )


def _event_snapshot(
    *,
    event_type: str,
    zone: PoiZone,
    snapshot_time: int,
    current_price: float,
    contexts: dict[str, dict[str, Any]],
    evidence: dict[str, Any],
) -> dict[str, Any]:
    return {
        "eventType": event_type,
        "symbol": zone.symbol,
        "contract": zone.contract,
        "snapshotTime": snapshot_time,
        "currentPrice": current_price,
        "activePoi": _active_poi(zone),
        "confluence": zone.confluence,
        "triggerEvidence": evidence,
        "h1Context": contexts.get("H1", {}),
        "m15Context": contexts.get("M15", {}),
        "m5Context": contexts.get("M5", {}),
        "decisionContext": {
            "allowedToAutoTrade": False,
            "scannerMode": "m5_poi_context",
            "timing": "manual_entry",
        },
    }


def _active_poi(zone: PoiZone) -> dict[str, Any]:
    return {
        "zoneId": zone.zone_id,
        "timeframe": zone.timeframe,
        "side": zone.side,
        "kind": zone.kind,
        "top": zone.top,
        "bottom": zone.bottom,
        "mid": zone.mid,
        "pdZone": zone.pd_zone,
        "biasAligned": zone.bias_aligned,
        "containsPrice": zone.contains_price,
        "distanceToPrice": zone.distance_to_price,
        "touchCount": zone.touch_count,
    }


def _price_evidence(
    zone: PoiZone,
    m1_bars: list[BarRecord],
    *,
    tick_size: float,
) -> dict[str, Any]:
    _ = tick_size
    ordered = [bar for bar in sorted(m1_bars, key=lambda b: b.time) if bar.closed]
    last = ordered[-1] if ordered else None
    price_entered = False
    touch_price = None
    current_price = None
    if last is not None:
        current_price = float(last.close)
        price_entered = last.low <= zone.top and last.high >= zone.bottom
        if price_entered:
            touch_price = max(zone.bottom, min(zone.top, current_price))

    return {
        "priceEnteredZone": price_entered or zone.contains_price,
        "touchPrice": touch_price,
        "currentPrice": current_price,
        "priceSource": "latest_price_probe",
        "barsSinceFirstTouch": 0 if price_entered or zone.contains_price else None,
        "deduped": False,
    }


def _next_status(
    zone: PoiZone,
    *,
    evidence: dict[str, Any],
    tick_size: float,
) -> str:
    current_price = evidence.get("currentPrice")
    if isinstance(current_price, (int, float)):
        if zone.side == "demand" and current_price < zone.bottom - tick_size * 2:
            return "invalidated"
        if zone.side == "supply" and current_price > zone.top + tick_size * 2:
            return "invalidated"
    if zone.contains_price or evidence["priceEnteredZone"]:
        return "inside"
    if zone.distance_to_price <= tick_size * 8:
        return "approaching"
    return "active"


def _apply_status(
    zone: PoiZone,
    previous: PoiZone | None,
    status: str,
    ts: int,
    evidence: dict[str, Any],
) -> PoiZone:
    touched = bool(evidence["priceEnteredZone"] or zone.contains_price)
    was_touched = previous is not None and previous.status in TOUCHED_STATUSES
    touch_count = zone.touch_count
    if touched and not was_touched:
        touch_count += 1
    return replace(
        zone,
        status=status,
        touch_count=touch_count,
        last_touched_at=ts if touched else zone.last_touched_at,
        last_state_change_at=(
            ts if previous is None or previous.status != status else zone.last_state_change_at
        ),
    )


def _event_types(
    previous: PoiZone | None,
    zone: PoiZone,
    evidence: dict[str, Any],
) -> list[str]:
    prev_status = "active" if previous is None else previous.status
    events: list[str] = []
    if zone.status == "invalidated" and prev_status != "invalidated":
        return ["poi_invalidated"]
    if evidence["priceEnteredZone"] and prev_status not in {"inside", "reacting", "triggered"}:
        events.append("price_entered_poi")
    return events


def _last_close(bars: list[BarRecord]) -> float | None:
    if not bars:
        return None
    return float(sorted(bars, key=lambda b: b.time)[-1].close)


def _candidate_event_zones(
    zones: list[PoiZone],
    preferred_side: str,
) -> list[PoiZone]:
    if preferred_side not in {"buy", "sell"}:
        return []
    return [
        zone
        for zone in zones
        if zone.timeframe == EVENT_POI_TIMEFRAME
        and zone.kind in EVENT_POI_KINDS
        and zone.status not in {"invalidated", "expired"}
        and _zone_matches_preferred_side(zone, preferred_side)
    ]


def _zone_matches_preferred_side(zone: PoiZone, preferred_side: str) -> bool:
    if preferred_side == "buy":
        return zone.side == "demand" and zone.bias_aligned
    if preferred_side == "sell":
        return zone.side == "supply" and zone.bias_aligned
    return False


def _preferred_side(contexts: dict[str, dict[str, Any]]) -> str:
    h1 = _context_structure(contexts.get("H1", {}))
    m15 = _context_structure(contexts.get("M15", {}))
    if h1 == "bullish" and m15 != "bearish":
        return "buy"
    if h1 in {"range", "unknown"} and m15 == "bullish":
        return "buy"
    if h1 == "bearish" and m15 != "bullish":
        return "sell"
    if h1 in {"range", "unknown"} and m15 == "bearish":
        return "sell"
    return "neutral"


def _context_structure(context: dict[str, Any]) -> str:
    structure_map = dict(context.get("structureMap", {}))
    external = dict(structure_map.get("external", {}))
    return str(external.get("structure", "unknown"))


def _select_best_event_candidate(
    candidates: list[dict[str, Any]],
) -> dict[str, Any] | None:
    if not candidates:
        return None
    return min(candidates, key=_event_candidate_rank)


def _event_candidate_rank(candidate: dict[str, Any]) -> tuple[object, ...]:
    zone: PoiZone = candidate["zone"]
    event_types = set(candidate["eventTypes"])
    event_priority = 0 if "price_entered_poi" in event_types else 1
    status_priority = 0 if zone.status == "inside" else 1
    kind_priority = 0 if zone.kind == "ob" else 1
    return (
        event_priority,
        status_priority,
        zone.distance_to_price,
        kind_priority,
        -int(zone.created_at),
        zone.zone_id,
    )
