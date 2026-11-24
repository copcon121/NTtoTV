"""GC Flow Rithmic-only backend package.

The Linux FastAPI service ingests live GC futures directly from the Rithmic
Ticker Plant, repairs chart history from the History Plant, persists raw and
derived data to SQLite, and streams throttled updates to the frontend.

Package layout (see design.md "Components and Interfaces"):
    app.ingest    - direct-feed sequence validation and raw persistence
    app.storage   - Tick_Store (day-sharded) and Cache_Store (data/app.sqlite)
    app.engines   - Bar_Aggregator, VolumeDelta, Footprint, BigTrade, Alert, Contract_Resolver
    app.registry  - WebSocket_Registry (heartbeat + throttled broadcast) and /ws/chart
    app.rest      - REST_API endpoints
    app.models    - Canonical data models + WebSocket message schemas
"""

__version__ = "0.1.0"
