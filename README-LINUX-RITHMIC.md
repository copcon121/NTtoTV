# GC Flow on Linux (Rithmic-only)

This is the Ubuntu/ARM64 edition running at https://oracle.gcflowpy.xyz.
Rithmic is the only market-data source: Ticker Plant supplies L1/L2/MBO and
History Plant repairs chart history. Orders execute directly through Exness
using each signed-in user's own API credentials and account ID.

Execution defaults to `exness`; `disabled` turns it off. The old `windows`
mode fails closed. MT5 terminals and Windows relays are not execution paths.
Live mutations also require the server trading gates.

Account metadata selects USD/USC and instrument sizing rules. Amount Risk
uses the connected account's balance/PnL unit; USC Risk is not multiplied by
100. See [EXNESS-EXECUTION.md](EXNESS-EXECUTION.md) for details.

## Runtime

- FastAPI, one Uvicorn worker, loopback port 8001.
- SQLite WAL; derived chart contract `GC`, raw physical contract shards.
- Prebuilt React frontend; Caddy serves HTTPS and WebSockets.
- `/health` is liveness; `/ready` requires qualified Rithmic subscriptions,
  snapshots and history recovery. A live service can have readiness 503.

## Operations

[AGENTS.md](AGENTS.md) documents current architecture, checks, deployment and
security boundaries. [deploy/linux/README.md](deploy/linux/README.md) covers
release tooling. Releases live under `/opt/nttotv/releases` with
`/opt/nttotv/current` pointing to the active version; data and credentials
remain outside releases.

Owner configuration is managed through the existing protected Admin account.
Agents need explicit authorization for the current task before accessing
Admin sessions, settings or secrets. Deployment authorization alone does not
grant that access.
