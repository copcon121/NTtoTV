import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LiveApp } from "./LiveApp";
import type { ChartContainerProps } from "./chart/ChartContainer";
import { barDurationForTimeframe } from "./chart/barCountdown";
import type { Timeframe } from "./socket/messages";

vi.mock("./chart/ChartContainer", () => ({
  ChartContainer: (props: ChartContainerProps) => (
    <div>
      <output data-testid="chart-data">{JSON.stringify({
        timeframe: props.timeframe,
        times: props.bars?.map((bar) => bar.time) ?? [],
        replay: props.suspendRealtime,
      })}</output>
      {props.onBarClick && props.bars && <button onClick={() => props.onBarClick?.(props.bars![11])}>
        Choose replay candle
      </button>}
      {props.children}
    </div>
  ),
}));

vi.mock("./socket/ChartSocket", () => ({
  ChartSocket: class {
    connect() {}
    close() {}
    subscribe() {}
    unsubscribe() {}
    ensureConnected() {}
    on() { return () => {}; }
    onOpen() { return () => {}; }
    onClose() { return () => {}; }
  },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function history(timeframe: Timeframe) {
  const duration = barDurationForTimeframe(timeframe);
  return {
    symbol: "GC", contract: "GC", tf: timeframe, source: "cache",
    bars: Array.from({ length: 30 * 60_000 / duration }, (_, index) => ({
      time: index * duration, open: 1, high: 2, low: 0, close: 1, volume: 10,
    })),
  };
}

function chart() {
  return JSON.parse(screen.getByTestId("chart-data").textContent!) as {
    timeframe: Timeframe; times: number[]; replay: boolean;
  };
}

describe("LiveApp timeframe replay", () => {
  it("keeps live data hidden through M1 -> M5 -> M1 and returns to live only on exit", async () => {
    let resolveHistory!: (response: Response) => void;
    const pendingHistory = new Promise<Response>((resolve) => { resolveHistory = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = new URL(input, "http://localhost");
      if (url.pathname === "/api/auth/me") return new Response(null, { status: 401 });
      if (url.pathname === "/api/history") {
        const tf = url.searchParams.get("tf") as Timeframe;
        if (tf === "5m" && url.searchParams.has("from")) return pendingHistory;
        return Response.json(history(tf));
      }
      if (url.pathname.includes("fvg-signals")) return Response.json({ signals: [] });
      if (url.pathname.includes("big-trades")) return Response.json({ trades: [] });
      if (url.pathname.includes("footprint")) return Response.json({ bars: [] });
      if (url.pathname.includes("volume-delta")) return Response.json({ bars: [] });
      return new Response(null, { status: 404 });
    }));

    render(<LiveApp />);
    await waitFor(() => expect(chart().times).toHaveLength(30));
    fireEvent.click(screen.getByRole("button", { name: "Bar Replay" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose replay candle" }));
    expect(chart().replay).toBe(true);
    expect(chart().times).toHaveLength(11);
    fireEvent.change(screen.getByRole("combobox", { name: "Replay speed" }), {
      target: { value: "0.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "5m" }));
    expect(chart().replay).toBe(true);
    expect(chart().times).toEqual([]);
    await screen.findByText("Loading replay history...");
    expect(screen.getByRole("button", { name: "Step" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Replay speed" })).toHaveValue("0.5");
    // The separate live-history request already returned six M5 candles.
    // Resolving replay history must reveal only the two closed before the shared clock.
    await act(async () => { resolveHistory(Response.json(history("5m"))); });
    await waitFor(() => expect(chart().times).toEqual([0, 300_000]));
    expect(chart().replay).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "1m" }));
    await waitFor(() => expect(chart().times).toHaveLength(11));
    expect(chart().replay).toBe(true);
    expect(chart().times[chart().times.length - 1]).toBe(600_000);

    fireEvent.click(screen.getByRole("button", { name: "Live" }));
    await waitFor(() => expect(chart().replay).toBe(false));
    expect(chart().times).toHaveLength(30);
  });
});
