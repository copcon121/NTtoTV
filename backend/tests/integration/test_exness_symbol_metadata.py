import asyncio
from dataclasses import replace
import pytest

from app.config import Settings
from app.execution.service import ExecutionService
from app.execution.store import ExecutionStore
from app.storage.cache_store import CacheStore

ACCOUNT = "18446744073709551000"


class MockSymbolClient:
    def __init__(self, api_key="k", secret="s", account_id=ACCOUNT, gateway="gw", currency="USD", quote_currency="USD", contract_size="100", digits=2):
        self.account_id = account_id
        self.gateway = "https://fixture.exness.com"
        self.origin = self.gateway
        self.limits = {}
        self.calls = []
        self.currency = currency
        self.quote_currency = quote_currency
        self.contract_size = contract_size
        self.digits = digits
        self.snapshot = dict(orders=[], positions=[], account_state={"balance": "1000", "equity": "1000", "used_margin": "0"})

    @property
    def trading_path(self): return f"/v1/trading/accounts/{self.account_id}"
    @property
    def config_path(self): return f"/v1/configuration/accounts/{self.account_id}"
    async def discover(self): pass

    async def request(self, method, path, body=None, *, idempotency=""):
        self.calls.append((method, path, body, idempotency))
        if path.endswith("/account"):
            return {"account_id": self.account_id, "settings": {"currency": self.currency, "trade_mode": "enabled", "account_status": "active", "execution_mode": "market"}}
        if path.endswith("/limits"): return {"limits": {}}
        if path.endswith("/instruments"): return {"instruments": ["XAUUSD"]}
        if path.endswith("/conditions"):
            return {
                "instrument": "XAUUSD",
                "quote_currency": self.quote_currency,
                "contract_size": str(self.contract_size),
                "point_digits": self.digits,
                "volume_min": "0.01",
                "volume_max": "100",
                "volume_step": "0.01",
                "exec_mode": "market",
                "trade_mode": "enabled",
            }
        if path.endswith("/snapshot"): return self.snapshot
        return {"status": "pending"}


@pytest.fixture
def service(tmp_path):
    cache = CacheStore(tmp_path / "cache.sqlite")
    store = ExecutionStore(tmp_path / "execution.sqlite", tmp_path / "vault.key")
    result = ExecutionService(cache, replace(Settings(), trading_enabled=True, live_trading_enabled=True), store=store, client_factory=MockSymbolClient)
    yield result
    store.close()
    cache.close()


async def connect_user(service, user, client_factory, account=ACCOUNT):
    service.client_factory = client_factory
    await service.connect(user, {"apiKey": "exnsk-test-only", "apiSecret": "mock-only", "accountId": account})
    s = service.sessions[user]
    for task in s.tasks: task.cancel()
    await asyncio.gather(*s.tasks, return_exceptions=True)
    s.tasks = []


@pytest.mark.integration
def test_symbol_metadata_usd_account(service):
    async def run():
        factory = lambda *a, **kw: MockSymbolClient(*a, **kw, currency="USD", quote_currency="USD", contract_size="100", digits=2)
        await connect_user(service, "one", factory)
        sym = service.symbol("one")
        assert sym["symbol"] == "XAUUSD"
        assert sym["digits"] == 2
        assert sym["tickSize"] == 0.01
        assert sym["minLot"] == 0.01
        assert sym["maxLot"] == 100.0
        assert sym["lotStep"] == 0.01
        # In USD account with quote USD: 100 * 0.01 = 1.0 USD per tick per lot
        assert sym["pipValue"] == 1.0
    asyncio.run(run())


@pytest.mark.integration
def test_symbol_metadata_usc_cent_account(service):
    async def run():
        # Case 1: 100-oz contract on USC account with USD quote:
        # 1 tick = 1.00 USD per lot = 100 USC per lot in account currency
        factory100 = lambda *a, **kw: MockSymbolClient(*a, **kw, currency="USC", quote_currency="USD", contract_size="100", digits=2)
        await connect_user(service, "one", factory100, ACCOUNT)
        sym100 = service.symbol("one")
        assert sym100["pipValue"] == 100.0

        # Case 2: 1-oz contract (typical for Exness cent XAUUSDm) on USC account with USD quote:
        # 1 tick = 0.01 USD per lot = 1 USC per lot in account currency
        factory1 = lambda *a, **kw: MockSymbolClient(*a, **kw, currency="USC", quote_currency="USD", contract_size="1", digits=2)
        await connect_user(service, "two", factory1, "18446744073709551001")
        sym1 = service.symbol("two")
        assert sym1["pipValue"] == 1.0
    asyncio.run(run())


@pytest.mark.integration
def test_symbol_metadata_unsupported_currency_safely_blocks(service):
    async def run():
        # E.g. account currency EUR without forex conversion legs:
        # pipValue must safely be 0 so risk sizing blocks rather than guessing rates
        factory = lambda *a, **kw: MockSymbolClient(*a, **kw, currency="EUR", quote_currency="USD", contract_size="100", digits=2)
        await connect_user(service, "three", factory)
        sym = service.symbol("three")
        assert sym["pipValue"] == 0
    asyncio.run(run())
