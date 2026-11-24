import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ApiClient, Instrument } from "../api/client";
import { AiScanPanel, type AiScanPanelProps } from "./AiScanPanel";

const mockInstrument: Instrument = {
  id: "GC",
  symbol: "GC",
  displaySymbol: "GC",
  venue: "COMEX",
  assetClass: "futures",
  provider: "rithmic",
  contractMode: "standard",
  readOnly: false,
};

function createMockApi(suggestionsPayload: any[]) {
  return {
    aiScan: vi.fn().mockResolvedValue({
      scanId: "test-scan-123",
      symbol: "GC",
      contract: "GC",
      timeframe: "1m",
      depth: "medium",
      density: "normal",
      strength: "all",
      evaluatedBars: 500,
      candidates: [],
      suggestions: suggestionsPayload,
    }),
  } as unknown as ApiClient;
}

function renderPanel(propsOverrides: Partial<AiScanPanelProps> = {}, suggestions: any[] = []) {
  const api = createMockApi(suggestions);
  const onPreview = vi.fn();
  const onAdd = vi.fn();
  const onAddAll = vi.fn();
  const onClose = vi.fn();
  const onUndo = vi.fn();

  const props: AiScanPanelProps = {
    api,
    instrument: mockInstrument,
    timeframe: "1m",
    contract: "GC",
    onPreview,
    onAdd,
    onAddAll,
    onClose,
    onUndo,
    ...propsOverrides,
  };

  const utils = render(<AiScanPanel {...props} />);
  return { ...utils, api, onPreview, onAdd, onAddAll, onClose };
}

describe("AiScanPanel smoke tests", () => {
  it("does not crash when suggestions have undefined or missing metrics and options", async () => {
    // Regression test for production bug: suggestions without metrics/options
    const brokenSuggestions = [
      {
        id: "sug-broken-1",
        group: "levels",
        type: "support",
        name: "Support 2650.0",
        label: "Support",
        description: "Support level without metrics",
        state: "in_play",
        strength: "moderate",
        score: 85,
        drawingTool: "horizontal_line",
        anchors: [{ time: 1732000000, price: 2650.0 }],
        // metrics is deliberately undefined
        // options is deliberately undefined
      },
      {
        id: "sug-broken-2",
        group: "lines",
        type: "trendline_up",
        label: "Ascending Trendline",
        description: "Trendline without metrics or options",
        state: "waiting",
        strength: "strong",
        score: 92,
        drawingTool: "trendline",
        anchors: [
          { time: 1732000000, price: 2640.0 },
          { time: 1732003600, price: 2648.0 },
        ],
        metrics: undefined,
        options: null,
      },
    ];

    const { onPreview } = renderPanel({}, brokenSuggestions);

    // Wait for the suggestions to be loaded and rendered
    await waitFor(() => {
      expect(screen.getByText("Support")).toBeDefined();
      expect(screen.getByText("Ascending Trendline")).toBeDefined();
    });

    // Check that card badges rendered cleanly with defensive fallbacks
    expect(screen.getByText("In Play")).toBeDefined();
    expect(screen.getByText("Waiting")).toBeDefined();

    // Verify card hover triggers preview interaction
    const supportCard = screen.getByText("Support").closest(".scan-ai-card");
    expect(supportCard).not.toBeNull();
    if (supportCard) {
      fireEvent.mouseEnter(supportCard);
      expect(onPreview).toHaveBeenCalledWith(
        expect.objectContaining({ id: "sug-broken-1", label: "Support" })
      );
    }
  });

  it("renders normal suggestions with full metrics and handles Add and Add All", async () => {
    const normalSuggestions = [
      {
        id: "sug-normal-1",
        group: "levels",
        type: "resistance",
        name: "Resistance 2700.0",
        label: "Resistance",
        description: "Key resistance level",
        state: "waiting",
        strength: "strong",
        score: 95,
        drawingTool: "horizontal_line",
        anchors: [{ time: 1732000000, price: 2700.0 }],
        metrics: { touches: 4, volume: 15200 },
        options: { lineColor: "#ef4444", lineWidth: 2, lineStyle: "dashed" },
      },
      {
        id: "sug-normal-2",
        group: "fibonacci",
        type: "fib_retracement",
        name: "Fib Retracement",
        label: "Fib Retracement",
        description: "0.618 Golden Pocket",
        state: "in_play",
        strength: "moderate",
        score: 88,
        drawingTool: "fib_retracement",
        anchors: [
          { time: 1732000000, price: 2620.0 },
          { time: 1732007200, price: 2700.0 },
        ],
        metrics: { touches: 2 },
        options: { lineColor: "#eab308" },
      },
    ];

    const { onAdd, onAddAll } = renderPanel({}, normalSuggestions);

    await waitFor(() => {
      expect(screen.getByText("Resistance")).toBeDefined();
      expect(screen.getByText("Fib Retracement")).toBeDefined();
    });

    // Touches metric badge should be visible ("4 touches", "2 touches")
    expect(screen.getByText(/4\s+touches/)).toBeDefined();
    expect(screen.getByText(/2\s+touches/)).toBeDefined();

    // Test adding a single suggestion
    const addBtns = screen.getAllByRole("button", { name: /\+ Add to chart/i });
    expect(addBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(addBtns[0]);
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sug-normal-2" })
    );

    // Test Add All
    const addAllBtn = screen.getByRole("button", { name: /Add all/i });
    fireEvent.click(addAllBtn);
    expect(onAddAll).toHaveBeenCalled();
  });

  it("removes legacy SMC suggestions and saves an empty group selection", async () => {
    localStorage.clear();
    const { api, unmount } = renderPanel({ settingsScope: "empty-groups" }, [{
      id: "smc-old", group: "smc", type: "fvg_bullish", label: "Bullish FVG",
      drawingTool: "rectangle", anchors: [{time: 1700000000, price: 100}, {time: 1700000060, price: 101}],
    }]);
    await waitFor(() => expect(api.aiScan).toHaveBeenCalled());
    expect(screen.queryByText("Bullish FVG")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Filters & depth/i }));
    for (const group of ["levels", "lines", "fibonacci", "patterns", "elliott"]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(group, "i") }));
    }
    await waitFor(() => expect(api.aiScan).toHaveBeenLastCalledWith(expect.objectContaining({ groups: [] })));
    unmount();
    const remount = renderPanel({ settingsScope: "empty-groups" });
    await waitFor(() => expect(remount.api.aiScan).toHaveBeenLastCalledWith(expect.objectContaining({ groups: [] })));
    expect(screen.queryByRole("button", { name: /smc/i })).not.toBeInTheDocument();
  });
});
