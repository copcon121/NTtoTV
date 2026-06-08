# GC Chart Platform — Backend

Python FastAPI service for the local, Windows-first TradingView-like charting
platform for the GC (Gold) futures contract. It ingests live Level 1 trade and
quote data from the NT_AddOn over `ws://127.0.0.1:<port>/ws/nt`, derives bars
and order-flow indicators, persists raw and derived data to SQLite, exposes a
REST API, and streams throttled updates to the Frontend over
`ws://127.0.0.1:<port>/ws/chart`.

## Requirements

- Python >= 3.11

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt          # runtime
pip install -r requirements-test.txt     # + tests
```

Optional real MT5 execution backend on the Windows VPS/terminal host:

```bash
pip install -r requirements-mt5.txt
set NTTOTV_MT5_BACKEND=real
set NTTOTV_TRADING_ENABLED=1
set NTTOTV_CREDENTIAL_KEY=<stable random secret>
set NTTOTV_INVITE_CODE=join-9999
```

Live accounts remain fail-closed unless `NTTOTV_LIVE_TRADING_ENABLED=1` is
also set. The default backend is fake/demo-safe. Keep
`NTTOTV_CREDENTIAL_KEY` stable across restarts because stored MT5 passwords are
sealed with it.

## Run

```bash
python -m app.main
# or
uvicorn app.app:app --host 127.0.0.1 --port 8000
```

Health check: `GET http://127.0.0.1:8000/api/health`

When the frontend is exposed publicly, keep backend port `8000` closed to
inbound network traffic and expose only the frontend/proxy port.

## Package layout

| Package        | Responsibility |
| -------------- | -------------- |
| `app.models`   | Canonical models (`NormalizedTrade`/`NormalizedQuote`/`Side`), Canonical_Timestamp helpers, WS message schemas |
| `app.ingest`   | `/ws/nt` endpoint + sequence validator + liveness watchdog |
| `app.storage`  | Tick_Store (day-sharded) + Cache_Store (`data/app.sqlite`) |
| `app.engines`  | Bar_Aggregator, VolumeDelta, Footprint, BigTrade, Contract_Resolver, Alert_Engine |
| `app.registry` | WebSocket_Registry + `/ws/chart` endpoint |
| `app.rest`     | REST_API endpoints |

## Tests

See `tests/README.md` for the layout and the property-test tag convention.

```bash
pytest                 # all tests
pytest -m property     # property-based tests only (Hypothesis, >= 100 iterations)
```
