# GC Flow on Linux (Rithmic-only)

This branch is the deployable Ubuntu/ARM64 edition. Its only market-data source
is Rithmic: Ticker Plant supplies live L1/L2/MBO and History Plant repairs
minute bars, delta and footprint gaps. There is no runtime route for Bookmap,
NinjaTrader, NT export import, MT5, or order placement.

## Runtime

- FastAPI + one Uvicorn worker on loopback port 8001.
- SQLite WAL with a single writer; chart cache uses logical contract `GC` and
  raw realtime shards use the physical contract such as `GC 12-26`.
- React is prebuilt; Node is not installed in production.
- Caddy owns public HTTP/HTTPS and WebSocket proxying.
- `/api/health` is liveness. `/api/ready` is 200 only after both Rithmic plants,
  all L1/L2/MBO subscriptions, an MBO snapshot, qualification time, and gap
  repair are complete.

## Owner setup

Open `/admin` through HTTPS or the supplied encrypted SSH tunnel. The bootstrap
owner is `admin` / `lktoday123` and must change the password at first login.
Tooltips explain every connector field. Save keeps the Rithmic secret outside
the source tree; **Save & connect** is the only action required after Rithmic
approves the application identity.

## Oracle deployment

Files under `deploy/systemd`, `deploy/caddy`, and `deploy/linux` define the
service, backup, security and cutover workflow. See
[`deploy/linux/README.md`](deploy/linux/README.md) for operations. Keep staging
active until readiness succeeds; production activation refuses to proceed
otherwise and has an explicit rollback command.
