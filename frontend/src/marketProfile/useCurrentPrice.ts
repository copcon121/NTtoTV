import { useEffect, useState } from "react";

import { buildHistoryUrl, type HistoryResponse } from "../cache/historyLoader";
import type { Bar } from "../cache/types";
import { ChartSocket } from "../socket/ChartSocket";

interface CurrentPrice {
  price: number;
  time: number;
}

export function useCurrentPrice(basePath: string, ws: string): CurrentPrice | null {
  const [current, setCurrent] = useState<CurrentPrice | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const socket = new ChartSocket({ url: ws });
    let latestTime = -Infinity;
    let liveRevision = 0;

    const apply = (bar: Bar): boolean => {
      if (controller.signal.aborted || !Number.isFinite(bar.time) ||
          !Number.isFinite(bar.close) || bar.time < latestTime) return false;
      latestTime = bar.time;
      setCurrent((previous) => previous?.time === bar.time && previous.price === bar.close
        ? previous : { price: bar.close, time: bar.time });
      return true;
    };
    const refresh = async () => {
      const revision = liveRevision;
      try {
        const url = buildHistoryUrl({
          symbol: "GC", contract: "GC", timeframe: "1m", limit: 1,
        }, basePath);
        const response = await fetch(url, {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) return;
        const body = await response.json() as Partial<HistoryResponse>;
        if (revision !== liveRevision || !Array.isArray(body.bars)) return;
        for (const bar of body.bars) apply(bar);
      } catch {
        // Keep the last known price while the existing socket reconnects.
      }
    };
    const offBar = socket.on("bar_update", (message) => {
      if (message.symbol !== "GC" || message.contract !== "GC" || message.tf !== "1m") return;
      if (apply(message.bar)) liveRevision += 1;
    });
    const offOpen = socket.onOpen(() => { void refresh(); });
    socket.subscribe("GC", ["bar_update"], "1m");
    socket.connect();
    const timer = window.setInterval(() => socket.ensureConnected(), 5000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      offBar();
      offOpen();
      socket.close();
    };
  }, [basePath, ws]);

  return current;
}
