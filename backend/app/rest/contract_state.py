"""Active_Contract / candidate-contract state accessor for the REST API.

The contracts endpoints (``GET /api/contracts``, ``POST /api/contracts/active``)
need to read the candidate list and read/write the Active_Contract state
(Req 18.2, 18.3). The full :class:`~app.engines.contract_resolver.ContractResolver`
(task 9.1) owns auto-resolution scoring; this accessor is the **thin seam** the
REST layer uses so task 10.1 stands alone without editing the resolver:

* the candidate list comes from configuration (``Settings.gc_candidate_contracts``),
* the Active_Contract and its auto-resolution flag are persisted in the
  Cache_Store ``metadata`` table (whose comment already reserves it for
  "Active_Contract state"), and
* an optional ``resolver`` may be plugged in later: when present it becomes the
  source of truth for the candidate list, the resolved Active_Contract, and the
  manual-override toggle, while this accessor keeps mirroring that state into
  ``metadata`` for durability/observability.

Setting an active contract is a **manual override** (Req 10.4): it pins the
Active_Contract and disables auto-resolution. Selecting a contract that is not a
known candidate is rejected by the endpoint with a descriptive error (Req 18.12).
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from ..config import Settings
from ..config import settings as default_settings
from ..models.timestamp import now_ms
from ..storage.cache_store import CacheStore

__all__ = ["ResolverSeam", "ContractStateStore"]


@runtime_checkable
class ResolverSeam(Protocol):
    """Minimal subset of the Contract_Resolver the REST layer depends on.

    The real :class:`~app.engines.contract_resolver.ContractResolver` already
    satisfies this protocol, so task 9.x can pass an instance straight in
    without changes here.
    """

    @property
    def candidates(self) -> tuple[str, ...]: ...

    @property
    def auto_resolution_enabled(self) -> bool: ...

    def resolve(self) -> str: ...

    def set_manual_override(self, contract: str | None) -> None: ...


def _active_key(symbol: str) -> str:
    return f"active_contract:{symbol}"


def _auto_key(symbol: str) -> str:
    return f"auto_resolution:{symbol}"


class ContractStateStore:
    """Reads/writes symbols, candidates, and Active_Contract state. (Req 18.1-18.3)

    Backed by configuration (symbols + candidate list) and the Cache_Store
    ``metadata`` table (Active_Contract + auto-resolution flag). An optional
    ``resolver`` seam, when supplied, takes precedence as the source of truth
    for the candidate list and the resolved Active_Contract.
    """

    def __init__(
        self,
        cache: CacheStore,
        *,
        settings: Settings | None = None,
        resolver: ResolverSeam | None = None,
    ) -> None:
        s = settings or default_settings
        self._cache = cache
        self._symbols: tuple[str, ...] = tuple(s.supported_symbols)
        self._candidates: tuple[str, ...] = tuple(s.gc_candidate_contracts)
        self._resolver = resolver
        if not self._symbols:
            raise ValueError("at least one supported symbol is required")
        if not self._candidates:
            raise ValueError("at least one candidate contract is required")
        if self._resolver is not None:
            for symbol in self._symbols:
                self._hydrate_resolver_override(symbol)

    @classmethod
    def from_settings(
        cls,
        settings: Settings | None = None,
        *,
        resolver: ResolverSeam | None = None,
    ) -> "ContractStateStore":
        """Open a Cache_Store from ``settings`` and build the accessor."""
        s = settings or default_settings
        cache = CacheStore.open(s)
        return cls(cache, settings=s, resolver=resolver)

    @property
    def cache(self) -> CacheStore:
        """The backing Cache_Store (exposed for app lifecycle/cleanup)."""
        return self._cache

    # -- symbols ---------------------------------------------------------------

    def list_symbols(self) -> list[str]:
        """The available user-facing symbols (Req 18.1). v1: ``["GC"]``."""
        return list(self._symbols)

    def is_known_symbol(self, symbol: str) -> bool:
        return symbol in self._symbols

    # -- candidates ------------------------------------------------------------

    def candidates(self, symbol: str) -> tuple[str, ...]:
        """Candidate contracts for ``symbol``. Caller validates the symbol first.

        Prefers the resolver's candidate inventory when a resolver is plugged in.
        """
        if self._resolver is not None:
            return tuple(self._resolver.candidates)
        return self._candidates

    def is_candidate(self, symbol: str, contract: str) -> bool:
        return contract in self.candidates(symbol)

    def _hydrate_resolver_override(self, symbol: str) -> None:
        """Load a persisted manual override into the live resolver, if present."""

        if self._resolver is None:
            return
        if self._cache.get_metadata(_auto_key(symbol)) != "0":
            return
        stored = self._cache.get_metadata(_active_key(symbol))
        if stored is not None and stored in self.candidates(symbol):
            self._resolver.set_manual_override(stored)

    # -- active contract -------------------------------------------------------

    def auto_resolution_enabled(self, symbol: str) -> bool:
        """Whether auto-resolution is active for ``symbol`` (Req 10.2 vs 10.4)."""
        if self._resolver is not None:
            return self._resolver.auto_resolution_enabled
        stored = self._cache.get_metadata(_auto_key(symbol))
        # Default: auto-resolution enabled until a manual override is set.
        return stored != "0"

    def active_contract(self, symbol: str) -> str:
        """The current Active_Contract for ``symbol`` (Req 18.2, 18.3).

        With a resolver plugged in, the resolved contract is authoritative.
        Otherwise the value persisted in ``metadata`` is returned, defaulting to
        the first configured candidate before any selection has been made.
        """
        if self._resolver is not None:
            return self._resolver.resolve()
        stored = self._cache.get_metadata(_active_key(symbol))
        if stored is not None and stored in self.candidates(symbol):
            return stored
        # No (valid) stored selection yet: default to the first candidate, which
        # stands in for the resolver's initial front-month pick.
        return self.candidates(symbol)[0]

    def set_active(self, symbol: str, contract: str) -> None:
        """Pin ``contract`` as the Active_Contract for ``symbol`` (Req 18.3, 10.4).

        This is a manual override: it disables auto-resolution. The caller must
        have already validated that ``symbol`` is known and ``contract`` is a
        candidate.
        """
        if self._resolver is not None:
            self._resolver.set_manual_override(contract)
        ts = now_ms()
        self._cache.set_metadata(_active_key(symbol), contract, ts)
        # Selecting a contract is a manual override -> auto-resolution off.
        self._cache.set_metadata(_auto_key(symbol), "0", ts)
