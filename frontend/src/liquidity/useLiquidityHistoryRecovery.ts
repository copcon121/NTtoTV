import { useEffect, type Dispatch, type SetStateAction } from "react";
import { HistorySyncRefreshTracker } from "../cache/historySync";
import type { ChartSocket } from "../socket/ChartSocket";

/** Repair the LQ viewport after missed socket data or a background history repair. */
export function useLiquidityHistoryRecovery(
  socket: ChartSocket, setReloadKey: Dispatch<SetStateAction<number>>,
): void {
  useEffect(() => {
    const historySync = new HistorySyncRefreshTracker();
    let lastResumeAt = -Infinity;
    const refresh = () => setReloadKey((value) => value + 1);
    const resume = () => {
      if (document.visibilityState === "hidden" || Date.now() - lastResumeAt < 2_000) return;
      lastResumeAt = Date.now();
      socket.ensureConnected(45_000, 10_000);
      refresh();
    };
    const offOpen = socket.onOpen(refresh);
    const offHistory = socket.on("market_data_status", (message) => {
      if (historySync.accept(message)) refresh();
    });
    window.addEventListener("pageshow", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      offOpen();
      offHistory();
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [socket, setReloadKey]);
}
