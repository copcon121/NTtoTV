import { useCallback, useEffect, useState } from "react";

import type { Bar } from "../cache/types";
import type { Timeframe } from "../socket/messages";
import { barDurationForTimeframe } from "./barCountdown";
import { replayCursorAtTime } from "./barReplay";

interface ReplayDataset {
  id: string;
  seriesKey: string;
  bars: readonly Bar[];
  barsTimeframe: Timeframe;
}

export interface ReplayHistoryRange {
  from: number;
  to: number;
}

interface ReplaySession<T> {
  id: string;
  dataset: T;
  cutoff: number;
  endExclusive: number;
  snapshots: ReadonlyMap<string, T>;
}

/** A replay clock survives timeframe changes and stays isolated from live history. */
export function useBarReplaySession<T extends ReplayDataset>(
  seriesKey: string,
  timeframe: Timeframe,
  loadDataset: (source: T, timeframe: Timeframe, range: ReplayHistoryRange) => Promise<T>,
) {
  const [session, setSession] = useState<ReplaySession<T>>();
  const [loadError, setLoadError] = useState<{ seriesKey: string; message: string }>();
  const dataset = session?.dataset;
  const active = session !== undefined;
  const ready = dataset?.seriesKey === seriesKey;
  const cursorIndex = ready && session !== undefined
    ? replayCursorAtTime(dataset.bars, session.cutoff, barDurationForTimeframe(timeframe))
    : -1;

  const start = useCallback((snapshot: T, cursor: number) => {
    const duration = barDurationForTimeframe(snapshot.barsTimeframe);
    setLoadError(undefined);
    setSession({
      id: snapshot.id,
      dataset: snapshot,
      cutoff: snapshot.bars[cursor].time + duration,
      endExclusive: snapshot.bars[snapshot.bars.length - 1].time + duration,
      snapshots: new Map([[snapshot.seriesKey, snapshot]]),
    });
  }, []);

  const stop = useCallback(() => {
    setSession(undefined);
    setLoadError(undefined);
  }, []);

  const updateDataset = useCallback((update: (current: T) => T) => {
    setSession((current) => {
      if (current === undefined) return current;
      const next = update(current.dataset);
      if (next === current.dataset) return current;
      return {
        ...current,
        dataset: next,
        snapshots: new Map(current.snapshots).set(next.seriesKey, next),
      };
    });
  }, []);

  const step = useCallback((direction: -1 | 1) => {
    setSession((current) => {
      if (current === undefined || current.dataset.seriesKey !== seriesKey) return current;
      const duration = barDurationForTimeframe(timeframe);
      const bars = current.dataset.bars;
      const cursor = replayCursorAtTime(bars, current.cutoff, duration);
      if (direction < 0 && cursor <= 0) return current;
      const next = Math.min(bars.length - 1, Math.max(0, cursor + direction));
      if (next === cursor || bars[next] === undefined) return current;
      return { ...current, cutoff: bars[next].time + duration };
    });
  }, [seriesKey, timeframe]);

  useEffect(() => {
    if (session === undefined || ready) return;
    let cancelled = false;
    const sessionId = session.id;
    const cached = session.snapshots.get(seriesKey);
    const duration = barDurationForTimeframe(timeframe);
    // Bound both sides of the cursor: a latest-history request can miss an old replay.
    const range = {
      from: Math.max(0, session.cutoff - 3_000 * duration),
      to: Math.min(session.endExclusive, session.cutoff + 2_000 * duration) - 1,
    };
    setLoadError(undefined);
    const cachedCoversCursor = cached !== undefined &&
      cached.bars[0]?.time <= session.cutoff &&
      cached.bars[cached.bars.length - 1]?.time + duration >= session.cutoff;
    void (cachedCoversCursor ? Promise.resolve(cached) : loadDataset(session.dataset, timeframe, range))
      .then((loaded) => {
        if (cancelled) return;
        // A larger candle that closes after the frozen session end is still future data.
        const bars = loaded.bars.filter((bar) => bar.time + duration <= session.endExclusive);
        if (bars.length === 0) throw new Error("No replay history for this timeframe");
        const next = { ...loaded, id: `${sessionId}:${seriesKey}`, seriesKey, bars };
        setSession((current) => current?.id !== sessionId ? current : {
          ...current,
          dataset: next,
          snapshots: new Map(current.snapshots).set(seriesKey, next),
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError({
          seriesKey,
          message: error instanceof Error ? error.message : "Unable to load replay history",
        });
      });
    return () => { cancelled = true; };
    // The clock only changes while ready. Keep an in-flight load independent of live updates.
  }, [session?.id, ready, seriesKey, timeframe, loadDataset]);

  return {
    dataset,
    active,
    ready,
    cursorIndex,
    loading: active && !ready && loadError?.seriesKey !== seriesKey,
    error: loadError?.seriesKey === seriesKey ? loadError.message : undefined,
    start,
    stop,
    updateDataset,
    step,
  };
}
