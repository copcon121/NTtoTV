"""Background scheduler for analyst snapshots and LLM reports."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from ..storage.cache_store import CacheStore
from .llm_client import AnalystLlmClient
from .snapshot_builder import SnapshotBuilder
from .store import AnalystStore
from .schemas import AnalystReport, MarketStateSnapshot

logger = logging.getLogger(__name__)

DEFAULT_ANALYST_INTERVAL_S = 30 * 60


@dataclass(frozen=True, slots=True)
class AnalystRunResult:
    snapshot: MarketStateSnapshot
    report: AnalystReport | None
    llm_enabled: bool
    error: str | None = None


async def run_analyst_once(
    *,
    cache: CacheStore,
    store: AnalystStore,
    llm_client: AnalystLlmClient,
    symbol: str = "GC",
    contract: str = "GC",
    reasoning_effort: str | None = None,
) -> AnalystRunResult:
    builder = SnapshotBuilder(cache, symbol=symbol, contract=contract)
    snapshot = await asyncio.to_thread(builder.build)
    await asyncio.to_thread(store.insert_snapshot, snapshot)
    if not llm_client.enabled:
        return AnalystRunResult(
            snapshot=snapshot,
            report=None,
            llm_enabled=False,
        )
    try:
        report = await asyncio.to_thread(
            llm_client.analyze,
            snapshot,
            reasoning_effort=reasoning_effort,
        )
    except Exception as exc:
        return AnalystRunResult(
            snapshot=snapshot,
            report=None,
            llm_enabled=True,
            error=str(exc),
        )
    if report is not None:
        await asyncio.to_thread(store.insert_report, report)
    return AnalystRunResult(
        snapshot=snapshot,
        report=report,
        llm_enabled=True,
    )


class AnalystScheduler:
    """Periodically build snapshots and optional LLM reports."""

    def __init__(
        self,
        *,
        cache: CacheStore,
        store: AnalystStore,
        llm_client: AnalystLlmClient,
        symbol: str = "GC",
        contract: str = "GC",
        interval_s: int = DEFAULT_ANALYST_INTERVAL_S,
        reasoning_effort: str | None = None,
    ) -> None:
        self._cache = cache
        self._store = store
        self._llm = llm_client
        self._symbol = symbol
        self._contract = contract
        self._interval_s = max(60, int(interval_s))
        self._reasoning_effort = reasoning_effort
        self._task: asyncio.Task[None] | None = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._loop())

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass
        self._task = None

    async def run_once(self) -> AnalystRunResult:
        result = await run_analyst_once(
            cache=self._cache,
            store=self._store,
            llm_client=self._llm,
            symbol=self._symbol,
            contract=self._contract,
            reasoning_effort=self._reasoning_effort,
        )
        if not result.llm_enabled:
            logger.info("analyst snapshot stored; LLM client is disabled")
        elif result.error is not None:
            logger.warning("analyst LLM run failed: %s", result.error)
        return result

    async def _loop(self) -> None:
        while True:
            try:
                await self.run_once()
            except Exception as exc:
                logger.warning("analyst scheduler run failed: %s", exc)
            await asyncio.sleep(self._interval_s)
