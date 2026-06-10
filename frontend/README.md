# GC Chart Platform — Frontend

Vite + React + TypeScript web application that renders the GC chart, order-flow
indicators, alerts, and connection status (design tier 3).

## Stack

- **Vite** + **React 18** + **TypeScript** (strict)
- **lightweight-charts** — candle + volume + indicator series
- **Vitest** — test runner (jsdom environment)
- **fast-check** — property-based testing

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and produce a production build |
| `npm run typecheck` | Type-check only |
| `npm test` | Run the test suite once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

## Development networking note

Keep REST and chart WebSocket routing on the same origin. In Vite dev, `/api`
and `/ws` are both proxied to the backend; the browser should connect to
`ws(s)://<current-host>/ws/chart`, not directly to `:8000`. If REST uses the
Vite proxy but the WebSocket is hard-coded to `:8000`, multiple backend
processes can split the app state: refresh loads history from one backend while
live updates listen to another.

## Module layout (`src/`)

The design's Frontend Modules are mapped into folders:

| Folder | Design modules |
| --- | --- |
| `chart/` | ChartContainer, IndicatorLayer, CrosshairBox, Toolbar, TimeframeSelector, SymbolContractLabel |
| `socket/` | ChartSocket (`/ws/chart` client) |
| `cache/` | HistoryLoader, MemoryCache, RangePatcher |
| `footprint/` | FootprintCanvas (separate `<canvas>` layer) |
| `alerts/` | AlertPanel |
| `status/` | StatusIndicator |
| `test/` | fast-check global config + property-tag helper |

## Property-based tests

Property tests use **fast-check** at a minimum of **100 iterations** (configured
globally in `src/test/fast-check.setup.ts`). Each property test maps to exactly
one design property (Properties 1–31) and is tagged in the format:

```
Feature: gc-chart-platform, Property {n}: {property_text}
```

Use the `propertyTest` / `propertyTag` helpers in `src/test/property.ts` to apply
the tag consistently.

## Deployment

Production is served at `https://gcflowpy.xyz/` via **Caddy** reverse proxy
(config in `deploy/caddy/Caddyfile`). Caddy serves the built `frontend/dist`
directly as static files and proxies `/api/*` and `/ws/chart*` to the backend on
`127.0.0.1:8000`.

After frontend code changes, run `npm run build` to update `dist/`. Caddy will
serve the new bundle immediately — no restart needed. Users may need to hard
refresh (Ctrl+Shift+R) to bypass browser cache.

## Visual styling notes

### Big Trade Bubbles

Big trade markers are drawn as semi-transparent circle bubbles on the candle
chart via `BigTradeBubblePrimitive.ts`. Current style tuning:

| Property | Buy | Sell |
| --- | --- | --- |
| Fill | `rgba(30, 144, 255, 0.18)` | `rgba(220, 20, 60, 0.18)` |
| Stroke | `rgba(12, 95, 190, 0.30)` | `rgba(170, 12, 42, 0.30)` |
| Text weight | `400` (normal) | `400` (normal) |

Low opacity ensures candlesticks remain clearly visible behind the bubble
overlay. The volume label uses normal (non-bold) weight for a cleaner look.
Color constants live in `lightweightChartsAdapter.ts`; font weight is in
`BigTradeBubblePrimitive.ts`.
