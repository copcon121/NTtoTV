import type { MarketDataStatusMessage } from "../socket/messages";

/** Refresh REST data once after each successful background repair. */
export class HistorySyncRefreshTracker {
  private lastSuccessAt = 0;

  accept(message: MarketDataStatusMessage): boolean {
    const at = message.historySync?.lastSuccessAt;
    if (message.symbol !== "GC" || message.historySync?.state !== "synced" ||
        typeof at !== "number" || !Number.isFinite(at) || at <= this.lastSuccessAt) return false;
    this.lastSuccessAt = at;
    return true;
  }
}
