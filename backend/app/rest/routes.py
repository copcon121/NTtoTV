"""REST_API router: meta, symbols, and contract endpoints.

Implements the core metadata surface of the REST API (task 10.1):

* ``GET  /api/health``           — liveness probe (kept from scaffolding)
* ``GET  /api/symbols``          — available symbols (Req 18.1)
* ``GET  /api/contracts``        — candidate GC contracts + Active_Contract (Req 18.2)
* ``POST /api/contracts/active`` — pin the Active_Contract (Req 18.3, 10.4)

All failures are rendered through the shared error envelope (Req 18.12) wired in
:mod:`app.rest.errors`. Unknown symbols/contracts produce descriptive 404/409
errors with the offending ``field`` named.

History, order-flow, big-trades, and alert CRUD endpoints are added by later
tasks (10.2, 14-18); they reuse the same router, error envelope, and contract
state seam.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from .. import __version__
from ..config import settings as default_settings
from ..engines.bar_aggregator import SUPPORTED_TFS, BarAggregator
from ..models.timestamp import now_ms
from ..storage.records import BarRecord
from ..storage.tick_store import TickStore
from .contract_state import ContractStateStore
from .errors import bad_request, conflict, not_found

router = APIRouter(prefix="/api", tags=["meta"])

# History cache cap: the cache path returns at most the most recent 5,000
# precomputed bars, and ``limit`` defaults to and is capped at this value.
# (Req 11.4; design "History semantics")
HISTORY_CACHE_CAP = 5000

# Supported timeframes, surfaced as a set for O(1) validation of the ``tf``
# query parameter (unknown values -> 404 with field "tf"). (design REST API)
_SUPPORTED_TFS = frozenset(SUPPORTED_TFS)


def get_contract_state(request: Request) -> ContractStateStore:
    """Provide the request-scoped :class:`ContractStateStore`.

    Reads the instance assembled by the app factory and cached on
    ``app.state.contract_state``. Built lazily on first use so importing the
    app (and the health route) never forces a Cache_Store open; tests inject
    their own instance by setting ``app.state.contract_state`` or via
    ``app.dependency_overrides``.
    """
    state = getattr(request.app.state, "contract_state", None)
    if state is None:
        state = ContractStateStore.from_settings()
        request.app.state.contract_state = state
    return state


def get_tick_store(request: Request) -> TickStore:
    """Provide the request-scoped :class:`TickStore` for the rebuild path.

    Like :func:`get_contract_state`, the instance is cached on
    ``app.state.tick_store`` and built lazily on first use so the rest of the
    REST surface never forces a Tick_Store open. Tests inject their own
    instance (pointed at a temporary ticks directory) by setting
    ``app.state.tick_store`` or via ``app.dependency_overrides``. Only the
    history endpoint's rebuild branch (cache miss) touches it. (Req 11.5, 8.5)
    """
    store = getattr(request.app.state, "tick_store", None)
    if store is None:
        store = TickStore()
        request.app.state.tick_store = store
    return store


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe used by smoke tests and the dev harness."""
    return {"status": "ok", "version": __version__}


@router.get("/symbols")
async def get_symbols(
    state: ContractStateStore = Depends(get_contract_state),
) -> dict[str, list[str]]:
    """Return the available user-facing symbols. (Req 18.1)

    v1 ships GC only, so the response is ``{"symbols": ["GC"]}``.
    """
    return {"symbols": state.list_symbols()}


@router.get("/contracts")
async def get_contracts(
    symbol: str = Query(..., description="User-facing symbol, e.g. 'GC'"),
    state: ContractStateStore = Depends(get_contract_state),
) -> dict[str, Any]:
    """Return the candidate contracts and Active_Contract for ``symbol``. (Req 18.2)

    An unknown ``symbol`` yields a descriptive 404 (Req 18.12); a missing
    ``symbol`` query param is rejected as 400 by request validation.
    """
    if not state.is_known_symbol(symbol):
        raise not_found(f"Unknown symbol {symbol!r}", field="symbol")

    active = state.active_contract(symbol)
    auto = state.auto_resolution_enabled(symbol)
    candidates: list[dict[str, Any]] = []
    for contract in state.candidates(symbol):
        entry: dict[str, Any] = {"contract": contract}
        # The active candidate carries the auto-selection flag so the Frontend
        # can show whether it was auto-resolved or manually pinned. (design
        # contracts response shape)
        if contract == active:
            entry["autoSelected"] = auto
        candidates.append(entry)

    return {"symbol": symbol, "active": active, "candidates": candidates}


@router.post("/contracts/active")
async def set_active_contract(
    request: Request,
    state: ContractStateStore = Depends(get_contract_state),
) -> dict[str, Any]:
    """Set the Active_Contract to the requested contract. (Req 18.3, 10.4)

    Setting an active contract is a manual override: it pins the Active_Contract
    and disables auto-resolution. The body is parsed manually so the endpoint
    can return the precise status codes the design documents:

    * 400 ``BAD_REQUEST`` — body is not a JSON object or a field is missing;
    * 404 ``NOT_FOUND`` — unknown symbol (Req 18.12);
    * 409 ``CONFLICT`` — contract is not a known candidate (Req 18.12, 10.4).
    """
    try:
        body = await request.json()
    except Exception:  # malformed/empty JSON body
        raise bad_request("Request body must be valid JSON")

    if not isinstance(body, dict):
        raise bad_request("Request body must be a JSON object")

    symbol = body.get("symbol")
    contract = body.get("contract")
    if not isinstance(symbol, str) or not symbol:
        raise bad_request("Missing or invalid field 'symbol'", field="symbol")
    if not isinstance(contract, str) or not contract:
        raise bad_request("Missing or invalid field 'contract'", field="contract")

    if not state.is_known_symbol(symbol):
        raise not_found(f"Unknown symbol {symbol!r}", field="symbol")
    if not state.is_candidate(symbol, contract):
        raise conflict(
            f"Contract {contract!r} is not a candidate for symbol {symbol!r}",
            field="contract",
        )

    state.set_active(symbol, contract)
    return {
        "symbol": symbol,
        "active": state.active_contract(symbol),
        "autoResolution": state.auto_resolution_enabled(symbol),
    }


def _resolve_contract(
    state: ContractStateStore, symbol: str, contract: str | None
) -> str:
    """Resolve the contract for a read endpoint, defaulting to Active_Contract.

    When ``contract`` is omitted (``None`` or empty), it defaults to the current
    Active_Contract resolved for ``symbol`` (Req 18.4). When provided, it must be
    a known candidate or a descriptive 404 is raised with ``field: "contract"``
    (Req 18.12). The caller must have already validated ``symbol``.
    """
    if contract is None or contract == "":
        return state.active_contract(symbol)
    if not state.is_candidate(symbol, contract):
        raise not_found(
            f"Unknown contract {contract!r} for symbol {symbol!r}",
            field="contract",
        )
    return contract


def _bar_to_dict(bar: BarRecord) -> dict[str, Any]:
    """Serialize a :class:`BarRecord` to the OHLCV wire shape used by history.

    Matches the ``bar`` payload of a ``bar_update`` (time/open/high/low/close/
    volume), so the Frontend renders cache and rebuild bars identically.
    """
    return {
        "time": bar.time,
        "open": bar.open,
        "high": bar.high,
        "low": bar.low,
        "close": bar.close,
        "volume": bar.volume,
    }


def _rebuild_bars(
    tick_store: TickStore,
    symbol: str,
    contract: str,
    tf: str,
    frm: int,
    to: int,
) -> list[BarRecord]:
    """Rebuild OHLCV bars for one timeframe from raw Tick_Store ticks.

    Reads raw trades for ``contract`` over ``[frm, to]`` from the day-sharded
    Tick_Store and aggregates them into ``tf`` bars, reusing the Bar_Aggregator's
    bucketization (``bucket_start``) so the rebuild buckets exactly match the
    live aggregation. Returns bars in ascending ``time`` order. This is the
    cache-miss rebuild source path with no latency guarantee. (Req 11.5, 8.5)
    """
    agg = BarAggregator()
    bars: dict[int, BarRecord] = {}
    for trade in tick_store.read_range(contract, frm, to):
        bucket = agg.bucket_start(trade.time, tf)
        rec = bars.get(bucket)
        if rec is None:
            bars[bucket] = BarRecord(
                symbol=symbol,
                contract=contract,
                timeframe=tf,
                time=bucket,
                open=trade.price,
                high=trade.price,
                low=trade.price,
                close=trade.price,
                volume=trade.volume,
                closed=True,
            )
        else:
            if trade.price > rec.high:
                rec.high = trade.price
            if trade.price < rec.low:
                rec.low = trade.price
            rec.close = trade.price
            rec.volume += trade.volume
    return [bars[bucket] for bucket in sorted(bars)]


@router.get("/history")
async def get_history(
    symbol: str = Query(..., description="User-facing symbol, e.g. 'GC'"),
    tf: str = Query(..., description="Timeframe (1m,3m,5m,15m,30m,1h,4h,1D)"),
    contract: str | None = Query(
        None, description="GC contract; defaults to the Active_Contract"
    ),
    frm: int | None = Query(
        None, alias="from", description="Inclusive start Canonical_Timestamp (ms)"
    ),
    to: int | None = Query(
        None, description="Inclusive end Canonical_Timestamp (ms)"
    ),
    limit: int | None = Query(
        None, description=f"Max bars (defaults to and capped at {HISTORY_CACHE_CAP})"
    ),
    state: ContractStateStore = Depends(get_contract_state),
    tick_store: TickStore = Depends(get_tick_store),
) -> dict[str, Any]:
    """Return cached bars for a symbol/contract/timeframe/range. (Req 18.4, 11.4, 11.5)

    Reads the most recent up-to-5,000 precomputed bars from the Cache_Store and
    sets ``"source":"cache"`` on a cache hit (Req 11.4). When the Cache_Store has
    no precomputed bars for the requested ``(symbol, contract, timeframe)`` and
    range, the bars are rebuilt from raw Tick_Store ticks and the response sets
    ``"source":"rebuild"`` with no latency guarantee (Req 11.5, 8.5).

    Validation (Req 18.12): an unknown ``symbol`` or ``tf`` yields ``404`` (with
    the offending ``field``); a ``contract`` that is not a known candidate yields
    ``404`` with ``field: "contract"``. When ``contract`` is omitted it defaults
    to the current Active_Contract, which is echoed back in the response.
    """
    if not state.is_known_symbol(symbol):
        raise not_found(f"Unknown symbol {symbol!r}", field="symbol")
    if tf not in _SUPPORTED_TFS:
        raise not_found(
            f"Unknown timeframe {tf!r} for symbol {symbol!r}", field="tf"
        )

    resolved_contract = _resolve_contract(state, symbol, contract)

    # Range bounds are inclusive; reject an inverted window early. (Req 18.12)
    if frm is not None and to is not None and frm > to:
        raise bad_request(
            "'from' must be less than or equal to 'to'", field="from"
        )

    # ``limit`` defaults to and is capped at the 5,000-bar cache cap (Req 11.4);
    # a non-positive limit is a malformed request.
    if limit is not None and limit < 1:
        raise bad_request("'limit' must be a positive integer", field="limit")
    effective_limit = HISTORY_CACHE_CAP if limit is None else min(limit, HISTORY_CACHE_CAP)

    # Cache path: precomputed bars, most-recent-up-to-limit within the window.
    # (Req 11.4, 8.3)
    cached = state.cache.read_bars(
        symbol, resolved_contract, tf, frm, to, effective_limit
    )
    if cached:
        bars = cached
        source = "cache"
    else:
        # Cache miss for the range -> rebuild from raw ticks. Default the window
        # to the retention horizon ending now so the shard scan stays bounded;
        # no precomputed ticks exist beyond retention anyway. (Req 11.5, 8.5)
        to_ms = now_ms() if to is None else to
        if frm is not None:
            frm_ms = frm
        else:
            retention_ms = (
                default_settings.tick_retention_days * 24 * 60 * 60 * 1000
            )
            frm_ms = to_ms - retention_ms
        rebuilt = _rebuild_bars(
            tick_store, symbol, resolved_contract, tf, frm_ms, to_ms
        )
        # Keep the response bounded to the same most-recent cap as the cache path.
        bars = rebuilt[-effective_limit:]
        source = "rebuild"

    return {
        "symbol": symbol,
        "contract": resolved_contract,
        "tf": tf,
        "bars": [_bar_to_dict(b) for b in bars],
        "source": source,
    }


def state_retention_ms() -> int:
    """Default rebuild look-back window in ms (the tick retention horizon).

    Raw ticks are retained for ``tick_retention_days`` (Req 7.4), so when a
    rebuild request omits ``from`` there is no point scanning shards older than
    that. Bounds the day-shard scan to a fixed window. (Req 11.5)
    """
    from ..config import settings as _settings

    return _settings.tick_retention_days * 24 * 60 * 60 * 1000
