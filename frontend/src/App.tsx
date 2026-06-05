import { useState } from "react";
// Import chrome components directly from their modules (not the `./chart`
// barrel) so this layout does not depend on the barrel's export ordering, which
// is co-owned with the ChartContainer task (12.3).
import { Toolbar } from "./chart/Toolbar";
import { TimeframeSelector } from "./chart/TimeframeSelector";
import { SymbolContractLabel } from "./chart/SymbolContractLabel";
import { CrosshairBox } from "./chart/CrosshairBox";
import { StatusIndicator, type ConnectionState } from "./status/StatusIndicator";
import type { Bar, Timeframe } from "./socket/messages";

/**
 * Top-level application shell.
 *
 * Lays out the TradingView-like regions from Req 19.1: a top toolbar (with the
 * symbol/contract label and timeframe selector), a chart area, a crosshair
 * OHLCV box, and a status indicator. Task 12.7 wires the layout
 * chrome and status/crosshair UI; the chart instance (ChartContainer), alerts,
 * and live WebSocket data are composed in their own tasks. State here is held
 * locally so the chrome is interactive and testable in isolation.
 */
export function App() {
  // Local UI state — replaced by wiring to MemoryCache / ChartSocket / the
  // Contract_Resolver status stream in later integration tasks.
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [hoveredBar] = useState<Bar | undefined>(undefined);
  const [contract] = useState<string | undefined>(undefined);
  const [connection] = useState<ConnectionState>("disconnected");

  return (
    <div className="app-shell">
      <Toolbar>
        <SymbolContractLabel symbol="GC" contract={contract} />
        <TimeframeSelector value={timeframe} onChange={setTimeframe} />
        <StatusIndicator state={connection} />
      </Toolbar>
      <main className="chart-area">
        {/* ChartContainer (task 12.3) mounts the Lightweight Charts instance
            here and drives CrosshairBox via its crosshair-move subscription. */}
        <section className="chart-container" aria-label="Chart" />
        <CrosshairBox bar={hoveredBar} />
      </main>
    </div>
  );
}
