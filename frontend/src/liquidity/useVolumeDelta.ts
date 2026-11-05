import { useEffect, useState } from "react";
import { applyVolumeDelta, reduceVolumeDelta, type VolumeDeltaPoint } from "../chart/indicatorReducer";
import type { ChartSocket } from "../socket/ChartSocket";
import type { Timeframe } from "../socket/messages";

const RETENTION_MS = 24 * 60 * 60 * 1_000;

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
    setState({ tf, bars: [], error: null });
    const load = async () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const to = Date.now();
      const from = to - RETENTION_MS;
      const liveBucket = to - to % tfMs;
      const params = new URLSearchParams({
        symbol: "GC", contract: "GC", tf, from: String(from), to: String(to), limit: "3000",
      });
      try {
        const response = await fetch(`${api}/orderflow/volume-delta?${params}`, { signal: request.signal });
        if (!response.ok) throw new Error(`Volume Delta load failed (${response.status})`);
        const history = await response.json() as { bars: VolumeDeltaPoint[] };
        if (disposed || request.signal.aborted) return;
        setState((current) => ({
          tf,
          bars: reduceVolumeDelta(reduceVolumeDelta([], history.bars),
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
      const cutoff = Date.now() - RETENTION_MS;
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
