import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarketProfilePage } from "./MarketProfilePage";
import { ApiClient } from "../api/client";
import type { DeltaProfileData } from "../orderflow/deltaProfile";

vi.mock("./MarketProfilePlanner", () => ({ MarketProfilePlanner: () => null }));

describe("MarketProfilePage price display", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("switches between line and OHLC bar display", () => {
    render(<MarketProfilePage />);

    const barButton = screen.getByRole("button", { name: "Bar" });
    const lineButton = screen.getByRole("button", { name: "Line" });
    expect(lineButton).toHaveAttribute("aria-pressed", "true");
    expect(barButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(barButton);

    expect(barButton).toHaveAttribute("aria-pressed", "true");
    expect(lineButton).toHaveAttribute("aria-pressed", "false");
  });
});

describe("MarketProfilePage session switch", () => {
  const day = {
    start: Date.parse("2026-01-12T23:00:00Z"),
    end: Date.parse("2026-01-13T22:00:00Z") - 1,
    tradeDate: "2026-01-13",
  };
  const usStart = Date.parse("2026-01-13T12:00:00Z");
  const usEnd = Date.parse("2026-01-13T21:00:00Z") - 1;
  const bar = (time: number) => ({ time, open: 4500, high: 4501, low: 4499, close: 4500, volume: 10 });
  let historyUrls: URL[];

  beforeEach(() => {
    historyUrls = [];
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-01-14T16:00:00Z"));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.spyOn(ApiClient.prototype, "deltaProfile").mockImplementation(async (input) => ({
      ...input, tf: "1m", poc: null, vah: null, val: null, totalVolume: 0,
      totalDelta: 0, maxAbsDelta: 0, coveredBars: 0, rows: [],
    }) as DeltaProfileData);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      if (url.pathname === "/api/mp/sessions") return Response.json({ sessions: [day] });
      if (url.pathname === "/api/history") {
        historyUrls.push(url);
        // Deliberately include data on both sides of the US window so the
        // page must filter it instead of merely changing the toolbar label.
        return Response.json({ bars: [bar(usStart - 900_000), bar(usStart), bar(usEnd - 899_999), bar(usEnd + 1)] });
      }
      throw new Error(`Unexpected fetch: ${url.pathname}`);
    }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reloads candles and profile levels for US only, then restores the full session", async () => {
    render(<MarketProfilePage />);
    await screen.findByText(/^4 15m bars - Volume/);
    expect(ApiClient.prototype.deltaProfile).toHaveBeenLastCalledWith(expect.objectContaining({
      from: day.start, to: day.end, contract: "GC", source: "minute_bars",
    }));

    historyUrls.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "US COMEX" }));
    await screen.findByText(/^2 15m bars - Volume/);
    expect(screen.getByRole("button", { name: "US COMEX" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("19:00-04:00 UTC+7")).toBeInTheDocument();
    expect(ApiClient.prototype.deltaProfile).toHaveBeenLastCalledWith(expect.objectContaining({
      from: usStart, to: usEnd, contract: "GC", source: "minute_bars",
    }));
    expect(historyUrls).toHaveLength(1);
    expect(historyUrls[0].searchParams.get("from")).toBe(String(usStart));
    expect(historyUrls[0].searchParams.get("to")).toBe(String(usEnd));

    fireEvent.click(screen.getByRole("button", { name: "Full Session" }));
    await screen.findByText(/^4 15m bars - Volume/);
    expect(ApiClient.prototype.deltaProfile).toHaveBeenLastCalledWith(expect.objectContaining({
      from: day.start, to: day.end,
    }));
  });

  it("uses the US range for Delta, TPO minute bars and timeframe changes", async () => {
    render(<MarketProfilePage />);
    await screen.findByText(/^4 15m bars/);
    fireEvent.click(screen.getByRole("button", { name: "US COMEX" }));
    await screen.findByText(/^2 15m bars - Volume/);
    fireEvent.click(screen.getByRole("button", { name: "Delta" }));
    await screen.findByText(/^2 15m bars - Delta/);
    expect(ApiClient.prototype.deltaProfile).toHaveBeenLastCalledWith(expect.objectContaining({
      from: usStart, to: usEnd, source: "footprint_cache",
    }));

    historyUrls.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "TPO" }));
    await screen.findByText(/^2 15m bars - TPO/);
    expect(historyUrls.some((url) => url.searchParams.get("tf") === "1m")).toBe(true);
    for (const url of historyUrls) {
      expect(url.searchParams.get("from")).toBe(String(usStart));
      expect(url.searchParams.get("to")).toBe(String(usEnd));
    }

    fireEvent.click(screen.getByRole("button", { name: "5m" }));
    await screen.findByText(/^2 5m bars - TPO/);
    expect(screen.getByRole("button", { name: "US COMEX" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows an unopened US slot without requesting a reversed range", async () => {
    vi.spyOn(Date, "now").mockReturnValue(usStart - 60_000);
    render(<MarketProfilePage />);
    await waitFor(() => expect(screen.queryByText("Loading")).not.toBeInTheDocument());
    vi.mocked(ApiClient.prototype.deltaProfile).mockClear();
    historyUrls.length = 0;

    fireEvent.click(screen.getByRole("button", { name: "US COMEX" }));
    await screen.findByText(/US profile starts at 19:00 UTC\+7/);
    expect(ApiClient.prototype.deltaProfile).not.toHaveBeenCalled();
    expect(historyUrls).toHaveLength(0);
  });
});
