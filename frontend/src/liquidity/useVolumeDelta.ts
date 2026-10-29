import { useEffect, useState } from "react";
import { applyVolumeDelta, reduceVolumeDelta, type VolumeDeltaPoint } from "../chart/indicatorReducer";
import type { ChartSocket } from "../socket/ChartSocket";
import type { Timeframe } from "../socket/messages";
import { LIQUIDITY_CANDLE_RETENTION_MS, LIQUIDITY_HISTORY_PAGE_LIMIT, liquidityHistoryRanges } from "./historyRanges";

export function useVolumeDelta(
  socket: ChartSocket,
  api: string,
  tf: Timeframe,
  tfMs: number,
  reloadKey: number,
): { bars: readonly VolumeDeltaPoint[]; error: string | null } {
  const [state, setState] = useState<{
    tf: Timeframe; bars: readonly VolumeDeltaPoint[]; error: string | null;
  }>({ tf, bars: [], error: null });

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | undefined;
    setState((current) => current.tf === tf ? current : { tf, bars: [], error: null });
    const load = async () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const to = Date.now();
      const from = to - LIQUIDITY_CANDLE_RETENTION_MS;
      const liveBucket = to - to % tfMs;
      try {
        const pages = await Promise.all(liquidityHistoryRanges(from, to, tfMs).map(async (range) => {
          const params = new URLSearchParams({
            symbol: "GC", contract: "GC", tf, from: String(range.from), to: String(range.to),
            limit: String(LIQUIDITY_HISTORY_PAGE_LIMIT),
          });
          const response = await fetch(`${api}/orderflow/volume-delta?${params}`, { signal: request.signal });
          if (!response.ok) throw new Error(`Volume Delta load failed (${response.status})`);
          return await response.json() as { bars: VolumeDeltaPoint[] };
        }));
        if (disposed || request.signal.aborted) return;
        setState((current) => ({
          tf,
          bars: reduceVolumeDelta(reduceVolumeDelta([], pages.flatMap((page) => page.bars)),
            current.tf === tf ? current.bars.filter((bar) => bar.time >= liveBucket) : []),
          error: null,
        }));
      } catch (cause) {
        if (disposed || request.signal.aborted) return;
        setState((current) => ({ ...current,
          error: cause instanceof Error ? cause.message : "Volume Delta load failed",
        }));
      }
    };
    socket.subscribe("GC", ["volume_delta_update"], tf);
    const offDelta = socket.on("volume_delta_update", (message) => {
      if (disposed || message.symbol !== "GC" || message.contract !== "GC" || message.tf !== tf) return;
      const cutoff = Date.now() - LIQUIDITY_CANDLE_RETENTION_MS;
      if (message.time < cutoff) return;
      setState((current) => ({ tf, error: current.error,
        bars: applyVolumeDelta(current.tf === tf
          ? current.bars.filter((bar) => bar.time >= cutoff) : [], message).series,
      }));
    });
    const offOpen = socket.onOpen(() => { void load(); });
    void load();
    return () => {
      disposed = true;
      controller?.abort();
      offOpen();
      offDelta();
      socket.unsubscribe("GC", ["volume_delta_update"], tf);
    };
  }, [socket, api, tf, tfMs, reloadKey]);

  return state.tf === tf ? state : { bars: [], error: null };
}
