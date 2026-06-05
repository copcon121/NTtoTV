"""GC Chart Platform backend package.

A local, Windows-first FastAPI service that ingests live GC (Gold) futures
Level 1 trade and quote data from the NT_AddOn, derives bars and order-flow
indicators, persists raw and derived data to SQLite, and streams throttled
updates to the Frontend.

Package layout (see design.md "Components and Interfaces"):
    app.ingest    - /ws/nt ingestion endpoint + sequence validation
    app.storage   - Tick_Store (day-sharded) and Cache_Store (data/app.sqlite)
    app.engines   - Bar_Aggregator, VolumeDelta, Footprint, BigTrade, Alert, Contract_Resolver
    app.registry  - WebSocket_Registry (heartbeat + throttled broadcast) and /ws/chart
    app.rest      - REST_API endpoints
    app.models    - Canonical data models + WebSocket message schemas
"""

__version__ = "0.1.0"
