import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarketProfilePage, sessionCloseMarker } from "./MarketProfilePage";
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
  const usStart = Date.parse("2026-01-13T20:00:00+07:00");
  const usEnd = Date.parse("2026-01-14T20:00:00+07:00") - 1;
  const usClose = Date.parse("2026-01-14T04:00:00+07:00");
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
        // US-anchored profiles retain the following Asia/EU sessions as well
        // as overnight US data, with only the next 20:00 in the next profile.
        return Response.json({ bars: [
          bar(usStart - 24 * 3_600_000), bar(usStart - 11 * 3_600_000),
          bar(usStart - 3 * 3_600_000), bar(usStart - 900_000), bar(usStart),
          bar(usClose - 900_000), bar(usClose + 4 * 3_600_000),
          bar(usClose + 12 * 3_600_000), bar(usEnd + 1),
        ] });
      }
      throw new Error(`Unexpected fetch: ${url.pathname}`);
    }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("regroups complete sessions at the US open, then restores the exchange session", async () => {
    render(<MarketProfilePage />);
    await screen.findByText(/^5 15m bars - Volume/);
    expect(ApiClient.prototype.deltaProfile).toHaveBeenLastCalledWith(expect.objectContaining({
      from: day.start, to: day.end, contract: "GC", source: "minute_bars",
    }));

    historyUrls.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "MP Comex" }));
    await screen.findByText(/^4 15m bars - Volume/);
    expect(screen.getByRole("button", { name: "MP Comex" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("24h 20:00-20:00 / US Close 04:00 UTC+7")).toBeInTheDocument();
    expect(ApiClient.prototype.deltaProfile).toHaveBeenLastCalledWith(expect.objectContaining({
      from: usStart, to: usEnd, contract: "GC", source: "minute_bars",
    }));
    expect(historyUrls).toHaveLength(1);
    expect(historyUrls[0].searchParams.get("from")).toBe(String(usStart));
    expect(historyUrls[0].searchParams.get("to")).toBe(String(usEnd));

    fireEvent.click(screen.getByRole("button", { name: "MP Asia" }));
    await screen.findByText(/^5 15m bars - Volume/);
    expect(ApiClient.prototype.deltaProfile).toHaveBeenLastCalledWith(expect.objectContaining({
      from: day.start, to: day.end,
    }));
  });

  it("includes Asia/EU in Volume, Delta and TPO across timeframe changes", async () => {
    render(<MarketProfilePage />);
    await screen.findByText(/^5 15m bars/);
    fireEvent.click(screen.getByRole("button", { name: "MP Comex" }));
    await screen.findByText(/^4 15m bars - Volume/);
    fireEvent.click(screen.getByRole("button", { name: "Delta" }));
    await screen.findByText(/^4 15m bars - Delta/);
    expect(ApiClient.prototype.deltaProfile).toHaveBeenLastCalledWith(expect.objectContaining({
      from: usStart, to: usEnd, source: "footprint_cache",
    }));

    historyUrls.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "TPO" }));
    await screen.findByText(/^4 15m bars - TPO/);
    expect(historyUrls.some((url) => url.searchParams.get("tf") === "1m")).toBe(true);
    for (const url of historyUrls) {
      expect(url.searchParams.get("from")).toBe(String(usStart));
      expect(url.searchParams.get("to")).toBe(String(usEnd));
    }

    fireEvent.click(screen.getByRole("button", { name: "5m" }));
    await screen.findByText(/^4 5m bars - TPO/);
    expect(screen.getByRole("button", { name: "MP Comex" })).toHaveAttribute("aria-pressed", "true");
  });

  it("retains the previous US open and today's Asia/EU before the next 20:00 rollover", async () => {
    vi.spyOn(Date, "now").mockReturnValue(usStart - 60_000);
    render(<MarketProfilePage />);
    await waitFor(() => expect(screen.queryByText("Loading")).not.toBeInTheDocument());
    vi.mocked(ApiClient.prototype.deltaProfile).mockClear();
    historyUrls.length = 0;

    fireEvent.click(screen.getByRole("button", { name: "MP Comex" }));
    await screen.findByText(/^4 15m bars - Volume/);
    expect(ApiClient.prototype.deltaProfile).toHaveBeenLastCalledWith(expect.objectContaining({
      from: usStart - 24 * 3_600_000, to: usStart - 60_000,
    }));
    expect(historyUrls).toHaveLength(1);
    expect(Number(historyUrls[0].searchParams.get("from"))).toBeLessThan(Number(historyUrls[0].searchParams.get("to")));
  });

  it("shows both session ranges together and returns to a single chart", async () => {
    render(<MarketProfilePage />);
    await screen.findByText(/^5 15m bars - Volume/);
    historyUrls.length = 0;

    fireEvent.click(screen.getByRole("button", { name: "Show both" }));
    await screen.findByText(/^9 15m bars - Volume/);
    expect(screen.getByRole("button", { name: "Show both" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("region", { name: "MP Asia" })).getByLabelText("Market profile")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "MP Comex" })).getByLabelText("Market profile")).toBeInTheDocument();
    expect(historyUrls.map((url) => Number(url.searchParams.get("from"))).sort()).toEqual([day.start, usStart].sort());

    fireEvent.click(screen.getByRole("button", { name: "5m" }));
    await screen.findByText(/^9 5m bars - Volume/);
    expect(screen.getAllByLabelText("Market profile")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Delta" }));
    await screen.findByText(/^9 5m bars - Delta/);
    expect(ApiClient.prototype.deltaProfile).toHaveBeenCalledWith(expect.objectContaining({
      from: day.start, to: day.end, source: "footprint_cache",
    }));
    expect(ApiClient.prototype.deltaProfile).toHaveBeenCalledWith(expect.objectContaining({
      from: usStart, to: usEnd, source: "footprint_cache",
    }));

    fireEvent.click(screen.getByRole("button", { name: "MP Comex" }));
    await screen.findByText(/^4 5m bars - Delta/);
    expect(screen.queryByRole("region", { name: "MP Asia" })).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Market profile")).toHaveLength(1);
  });
});

describe("US close reference inside a complete profile", () => {
  const closeTime = Date.parse("2026-01-14T04:00:00+07:00");
  const day = {
    start: Date.parse("2026-01-13T20:00:00+07:00"),
    end: Date.parse("2026-01-14T20:00:00+07:00") - 1,
    closeTime, profile: null, tpo: null,
  };
  const bar = (time: number, close: number) => ({ time, open: close, high: close + 1, low: close - 1, close, volume: 10 });

  it("uses the final US candle at 04:00 while retaining later Asia/EU candles", () => {
    expect(sessionCloseMarker({ ...day, bars: [
      bar(closeTime - 1_800_000, 4500), bar(closeTime - 900_000, 4501),
      bar(closeTime, 4505), bar(closeTime + 900_000, 4508),
      bar(closeTime + 4 * 3_600_000, 4510), bar(closeTime + 12 * 3_600_000, 4520),
    ] })).toEqual({ time: closeTime, price: 4501 });
  });

  it("does not invent a closing price when the final US candles are missing", () => {
    expect(sessionCloseMarker({ ...day, bars: [
      bar(closeTime - 3_600_000, 4500), bar(closeTime + 4 * 3_600_000, 4510),
    ] })).toBeNull();
  });
});
