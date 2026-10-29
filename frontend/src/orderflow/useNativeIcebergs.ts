import { useEffect, useMemo, useState } from "react";
import type { ChartSocket } from "../socket/ChartSocket";
import type { NativeIcebergState } from "../socket/messages";
import {
  emptyNativeIcebergBook, isNativeIceberg, reconcileNativeIcebergSnapshot,
  updateNativeIcebergBook, MAX_NATIVE_ICEBERGS, type NativeIcebergSnapshot,
} from "./nativeIcebergs";

export function useNativeIcebergs(
  socket: ChartSocket, apiBase: string, symbol: string, contract: string,
  enabled: boolean, minVolume: number,
) {
  const [book, setBook] = useState(emptyNativeIcebergBook);
  const [connected, setConnected] = useState(socket.isOpen);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setBook(emptyNativeIcebergBook());
    setFailed(false);
    if (!enabled) return;
    let disposed = false;
    let request: AbortController | undefined;
    let buffered: NativeIcebergState[] = [];
    const pending = new Map<string, NativeIcebergState>();
    let renderTimer: number | undefined;
    const matches = (row: NativeIcebergState) =>
      isNativeIceberg(row) && row.symbol === symbol && row.contract === contract;
    const load = (replacePending = false) => {
      if (request && !replacePending) return;
      request?.abort();
      const controller = new AbortController();
      request = controller;
      buffered = [];
      const query = new URLSearchParams({ symbol, contract, limit: String(MAX_NATIVE_ICEBERGS), min_volume: "1" });
      void fetch(`${apiBase}/orderflow/icebergs?${query}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("Iceberg snapshot unavailable");
          const snapshot = await response.json() as NativeIcebergSnapshot;
          if (disposed || controller.signal.aborted) return;
          if (snapshot.source !== "rithmic" || snapshot.symbol !== symbol ||
              snapshot.contract !== contract || !Array.isArray(snapshot.icebergs)) {
            throw new Error("Invalid iceberg snapshot");
          }
          const updates = buffered;
          setBook((current) => reconcileNativeIcebergSnapshot(current,
            { ...snapshot, icebergs: snapshot.icebergs.filter(matches) }, updates));
          setFailed(false);
        })
        .catch(() => {
          if (!disposed && !controller.signal.aborted) {
            setFailed(true);
            setBook((current) => ({ ...current, synchronized: false }));
          }
        })
        .finally(() => { if (request === controller) request = undefined; });
    };
    const offUpdate = socket.on("iceberg_update", (row) => {
      if (!matches(row)) return;
      if (request) buffered = [...buffered, row].slice(-1_000);
      const key = `${row.sessionId}\u0000${row.orderId}`;
      const previous = pending.get(key);
      if (!previous || row.sequence > previous.sequence) pending.set(key, row);
      if (pending.size > 1_000) pending.delete(pending.keys().next().value!);
      if (renderTimer === undefined) {
        renderTimer = window.setTimeout(() => {
          renderTimer = undefined;
          const updates = [...pending.values()];
          pending.clear();
          setBook((current) => updates.reduce(updateNativeIcebergBook, current));
        }, 80);
      }
    });
    const offOpen = socket.onOpen(() => { setConnected(true); load(true); });
    const offClose = socket.onClose(() => {
      setConnected(false);
      request?.abort();
      request = undefined;
      window.clearTimeout(renderTimer);
      renderTimer = undefined;
      pending.clear();
      setBook((current) => ({ ...current, synchronized: false }));
    });
    setConnected(socket.isOpen);
    socket.subscribe(symbol, ["iceberg_update"]);
    load();
    // Readiness can change without a detection event; poll the compact snapshot.
    const timer = window.setInterval(() => load(), 10_000);
    return () => {
      disposed = true;
      request?.abort();
      window.clearTimeout(renderTimer);
      window.clearInterval(timer);
      offUpdate(); offOpen(); offClose();
      socket.unsubscribe(symbol, ["iceberg_update"]);
    };
  }, [socket, apiBase, symbol, contract, enabled]);

  const icebergs = useMemo(() => book.icebergs.filter(
    (row) => row.executedVolume >= minVolume,
  ), [book.icebergs, minVolume]);
  return { ...book, icebergs, connected, failed };
}
