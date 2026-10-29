import { useEffect, useRef } from "react";
import type { ChartSocket } from "../socket/ChartSocket";
import type { NativeIcebergState } from "../socket/messages";
import { isNativeIceberg, type NativeIcebergBook } from "../orderflow/nativeIcebergs";
import { playLiquiditySound, type LiquiditySound } from "./alertSounds";
import { icebergMinVolumeForTime, type IcebergSessionMinVolumes } from "./icebergSessions";

/** Deduplicate refills and snapshots; alert once when an order reaches the filter. */
export class IcebergAlertTracker {
  private seen = new Map<string, { sequence: number; volume: number; notified: boolean }>();
  constructor(private minVolume: number | IcebergSessionMinVolumes, private armedAt: number) {}

  setMinVolume(minVolume: number | IcebergSessionMinVolumes): void {
    this.minVolume = minVolume;
  }

  seed(rows: readonly NativeIcebergState[]): void {
    for (const row of rows) this.record(row, false);
  }

  accept(row: NativeIcebergState, now: number): boolean {
    const fresh = row.time >= now - 10_000 && row.time <= now + 5_000;
    return this.record(row, fresh);
  }

  private record(row: NativeIcebergState, live: boolean): boolean {
    const key = `${row.sessionId}:${row.orderId}`;
    const previous = this.seen.get(key);
    if (previous && previous.sequence >= row.sequence) return false;
    const minVolume = typeof this.minVolume === "number" ? this.minVolume
      : icebergMinVolumeForTime(row.detectedTime, this.minVolume);
    const qualified = row.executedVolume >= minVolume;
    const notify = live && qualified && !previous?.notified &&
      (previous ? previous.volume < minVolume : row.detectedTime >= this.armedAt) &&
      (row.status === "active" || row.status === "executed");
    this.seen.set(key, {
      sequence: row.sequence, volume: row.executedVolume,
      notified: previous?.notified === true || qualified,
    });
    if (this.seen.size > 2_000) this.seen.delete(this.seen.keys().next().value!);
    return notify;
  }
}

export function useIcebergAlerts(
  socket: ChartSocket, book: NativeIcebergBook & { connected: boolean },
  enabled: boolean, minVolume: number | IcebergSessionMinVolumes, sound: LiquiditySound,
): void {
  const state = useRef({ book, enabled, sound });
  state.current = { book, enabled, sound };
  const tracker = useRef(new IcebergAlertTracker(minVolume, Date.now()));
  tracker.current.setMinVolume(minVolume);
  useEffect(() => {
    tracker.current = new IcebergAlertTracker(minVolume, Date.now());
    tracker.current.seed(book.icebergs);
  }, [enabled, book.sessionId]); // Threshold refreshes must not re-arm already notified orders.
  useEffect(() => { tracker.current.seed(book.icebergs); }, [book.icebergs]);
  useEffect(() => socket.on("iceberg_update", (row) => {
    const current = state.current;
    if (!isNativeIceberg(row) || row.symbol !== "GC" || row.contract !== "GC" ||
        row.sessionId !== current.book.sessionId || row.sourceContract !== current.book.sourceContract) return;
    if (!current.enabled || !current.book.connected || !current.book.sourceConnected || !current.book.synchronized) {
      tracker.current.seed([row]);
      return;
    }
    if (tracker.current.accept(row, Date.now())) playLiquiditySound("iceberg", current.sound);
  }), [socket]);
}
