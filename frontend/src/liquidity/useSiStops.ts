import { useEffect, useRef, useState } from "react";
import type { ChartSocket } from "../socket/ChartSocket";
import type { SiStopChain } from "../socket/messages";
import { isSiStopChain, mergeSiStops, siStopKey, SiStopAlertTracker, SI_STOP_RETENTION_MS,
  type SiStopSettings } from "./siStops";
import { playLiquiditySound, type LiquiditySound } from "./alertSounds";

interface StopBook {
  chains: SiStopChain[];
  sessionId: string | null;
  sourceContract: string | null;
  sourceConnected: boolean;
  synchronized: boolean;
}

export function useSiStops(socket: ChartSocket, apiBase: string, settings: SiStopSettings,
  profileHydrated: boolean, sound: LiquiditySound, showToast: (text: string) => void) {
  const [book, setBook] = useState<StopBook>({ chains: [], sessionId: null,
    sourceContract: null, sourceConnected: false, synchronized: false });
  const [connected, setConnected] = useState(socket.isOpen);
  const [failed, setFailed] = useState(false);
  const current = useRef({ settings, profileHydrated, sound, showToast, book });
  current.current = { settings, profileHydrated, sound, showToast, book };
  const tracker = useRef(new SiStopAlertTracker(Date.now()));

  useEffect(() => {
    tracker.current = new SiStopAlertTracker(Date.now());
    tracker.current.seed(book.chains);
  }, [settings.enabled, settings.alertSound, settings.showToast, profileHydrated]);

  useEffect(() => {
    let disposed = false;
    let request: AbortController | undefined;
    let updates: SiStopChain[] = [];
    const pending = new Map<string, SiStopChain>();
    let renderTimer: number | undefined;
    const matches = (row: unknown): row is SiStopChain => isSiStopChain(row) &&
      row.symbol === "GC" && row.contract === "GC";
    const load = (replace = false) => {
      if (request && !replace) return;
      request?.abort();
      const controller = new AbortController();
      request = controller;
      updates = [];
      void fetch(`${apiBase}/orderflow/si-stops?symbol=GC&contract=GC&limit=5000`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("SI Stops history unavailable");
          const snapshot = await response.json() as StopBook & { source: string; symbol: string; contract: string; connected: boolean };
          if (disposed || controller.signal.aborted) return;
          if (snapshot.source !== "rithmic" || snapshot.symbol !== "GC" || snapshot.contract !== "GC" ||
              !Array.isArray(snapshot.chains)) throw new Error("Invalid SI Stops snapshot");
          const live = updates;
          // REST owns readiness/session metadata. Completed events from an old
          // queued session can extend history without rolling that metadata back.
          const sourceContract = snapshot.sourceContract;
          tracker.current.seed(snapshot.chains.filter(matches));
          setBook((previous) => ({
            chains: mergeSiStops(previous.chains.filter((r) => r.sourceContract === sourceContract),
              [...live, ...snapshot.chains].filter((r) => matches(r) && r.sourceContract === sourceContract),
              Date.now() - SI_STOP_RETENTION_MS),
            sourceContract,
            sessionId: snapshot.sessionId,
            sourceConnected: snapshot.connected,
            synchronized: snapshot.synchronized && (!live.length || live[live.length - 1].sessionId === snapshot.sessionId),
          }));
          setFailed(false);
        })
        .catch(() => { if (!disposed && !controller.signal.aborted) setFailed(true); })
        .finally(() => { if (request === controller) request = undefined; });
    };
    const offUpdate = socket.on("si_stop", (row) => {
      if (!matches(row)) return;
      if (request) updates = [...updates, row].slice(-5000);
      const state = current.current;
      const ready = socket.isOpen && state.profileHydrated && state.book.synchronized && state.book.sourceConnected &&
        state.book.sourceContract === row.sourceContract && state.book.sessionId === row.sessionId;
      const notify = tracker.current.accept(row, state.settings, Date.now());
      if (ready && notify) {
        if (state.settings.alertSound) playLiquiditySound("volumeStop", state.sound);
        if (state.settings.showToast) state.showToast(`SI Stops ${row.side.toUpperCase()} / ${row.executedVolume} @ ${row.price.toFixed(1)}`);
      }
      if (!pending.has(siStopKey(row))) pending.set(siStopKey(row), row);
      if (pending.size > 5000) pending.delete(pending.keys().next().value!);
      if (renderTimer === undefined) renderTimer = window.setTimeout(() => {
        renderTimer = undefined;
        const batch = [...pending.values()];
        pending.clear();
        const latest = batch[batch.length - 1];
        setBook((previous) => {
          const contract = previous.sourceContract ?? latest.sourceContract;
          return { ...previous, sourceContract: contract,
            chains: mergeSiStops(previous.chains.filter((r) => r.sourceContract === contract),
              batch.filter((r) => r.sourceContract === contract), Date.now() - SI_STOP_RETENTION_MS),
          };
        });
      }, 80);
    });
    const offOpen = socket.onOpen(() => { setConnected(true); load(true); });
    const offClose = socket.onClose(() => {
      request?.abort();
      request = undefined;
      updates = [];
      window.clearTimeout(renderTimer);
      renderTimer = undefined;
      pending.clear();
      setConnected(false);
      setBook((previous) => ({ ...previous, synchronized: false, sourceConnected: false }));
    });
    socket.subscribe("GC", ["si_stop"]);
    load();
    const timer = window.setInterval(() => load(), 10_000);
    return () => {
      disposed = true;
      request?.abort();
      window.clearTimeout(renderTimer);
      window.clearInterval(timer);
      offUpdate(); offOpen(); offClose();
      socket.unsubscribe("GC", ["si_stop"]);
    };
  }, [socket, apiBase]);

  return { ...book, connected, failed };
}
