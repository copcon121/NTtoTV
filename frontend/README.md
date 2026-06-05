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
