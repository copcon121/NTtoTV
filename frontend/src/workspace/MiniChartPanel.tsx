import { useEffect, useState } from "react";

import type { ApiClient, Instrument } from "../api/client";
import type { Bar } from "../cache/types";
import { ChartContainer, type ChartDrawingActions } from "../chart/ChartContainer";
import type { DrawingState } from "../chart/drawings/types";
import type { ChartSyncConnection } from "../chart/shared/sync";
import type { ScanAiSuggestion } from "../chart/scanAi/types";
import type { ChartSocket } from "../socket/ChartSocket";
import type { Timeframe } from "../socket/messages";
import type { WorkspaceTheme } from "./types";

export function MiniChartPanel({
  instrument, contract, timeframe, api, socket, theme, drawings, previewDrawing, scanDrafts, drawingKeyboardActive, onDrawingsChange, onDrawingActionsReady, timezoneOffsetMinutes, denseOverlayMinBarSpacing, autoFootprint, onAutoFootprintVisibilityChange, sync,
}: {
  instrument: Instrument;
  contract: string;
  timeframe: Timeframe;
  api: ApiClient;
  socket: ChartSocket;
  theme: WorkspaceTheme;
  drawings?: DrawingState[];
  sync?: ChartSyncConnection;
  previewDrawing?: DrawingState;
  scanDrafts?: {
    suggestions: ScanAiSuggestion[];
    onAddSuggestion: (sug: ScanAiSuggestion) => void;
  };
  drawingKeyboardActive: boolean;
  onDrawingsChange: (drawings: DrawingState[]) => void;
  onDrawingActionsReady: (actions: ChartDrawingActions | undefined) => void;
  timezoneOffsetMinutes: number;
  denseOverlayMinBarSpacing: number;
  autoFootprint: boolean;
  onAutoFootprintVisibilityChange: (visible: boolean) => void;
}) {
  const seriesKey = `${instrument.id}:${contract}:${timeframe}`;
  const [history, setHistory] = useState<{ seriesKey: string; bars?: Bar[]; error?: string }>();

  useEffect(() => {
    let cancelled = false;
    void api.history(instrument.symbol, contract, timeframe).then((bars) => {
      if (!cancelled) setHistory({ seriesKey, bars });
    }).catch((cause: unknown) => {
      if (!cancelled) setHistory({ seriesKey, error: cause instanceof Error ? cause.message : "History load failed" });
    });
    return () => { cancelled = true; };
  }, [api, instrument.symbol, contract, timeframe, seriesKey]);

  const activeHistory = history?.seriesKey === seriesKey ? history : undefined;
  return <div className="workspace-mini-chart">
    {!activeHistory && <div className="workspace-panel-message">Loading chart…</div>}
    {activeHistory?.error && <div className="workspace-panel-message" role="alert">{activeHistory.error}</div>}
    <ChartContainer
      sync={sync}
      symbol={instrument.symbol}
      contract={contract}
      timeframe={timeframe}
      bars={activeHistory?.bars}
      socket={socket}
      chartBackgroundColor={theme.background}
      chartTheme={theme}
      timezoneOffsetMinutes={timezoneOffsetMinutes}
      showVolume
      showVolumeDelta={false}
      autoFootprint={autoFootprint}
      footprintApi={api}
      onAutoFootprintVisibilityChange={onAutoFootprintVisibilityChange}
      denseOverlayMinBarSpacing={denseOverlayMinBarSpacing}
      showFvgGrader={false}
      showTduSignals={false}
      showBigTrades={false}
      showMgannSwing={false}
      showCvd={false}
      drawings={drawings}
      drawingsLoadKey={seriesKey}
      onDrawingsChange={onDrawingsChange}
      onDrawingActionsReady={onDrawingActionsReady}
      previewDrawing={previewDrawing}
      scanDrafts={scanDrafts}
      drawingKeyboardActive={drawingKeyboardActive}
    />
  </div>;
}
