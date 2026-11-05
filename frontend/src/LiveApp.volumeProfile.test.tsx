import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveApp, readProfileHotSnapshot } from "./LiveApp";
import type { ChartContainerProps } from "./chart/ChartContainer";
import { DEFAULT_EMA_SETTINGS, DEFAULT_FOOTPRINT_SETTINGS } from "./chart/IndicatorToggles";
import { DEFAULT_SMC_SETTINGS } from "./chart/smc";
import type { ChartProfilePayload } from "./profiles/types";

vi.mock("./chart/ChartContainer", () => ({
  ChartContainer: (props: ChartContainerProps) => <div>{props.children}</div>,
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

function payload(ticks?: number): ChartProfilePayload {
  return {
    version: 1, timeframe: "1m", chartBackgroundColor: "#101010",
    showDailyVolumeProfile: true, dailyVolumeProfileRowTicks: ticks,
    showFootprint: false, showBigTrades: false,
    ema: { ...DEFAULT_EMA_SETTINGS }, smc: { ...DEFAULT_SMC_SETTINGS },
    footprintSettings: { ...DEFAULT_FOOTPRINT_SETTINGS }, drawings: [],
  };
}

function mockWorkspace(ticks?: number) {
  const state = { user: "workspace-a", ticks };
  const requests: URL[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(input, "http://localhost");
    if (url.pathname === "/api/auth/me") {
      return Response.json({ user: { id: state.user, username: state.user } });
    }
    if (url.pathname === "/api/me/profile") {
      return Response.json({ profile: {
        id: state.user, name: state.user, payload: payload(state.ticks), createdAt: 1, updatedAt: 1,
      } });
    }
    if (url.pathname === "/api/mt5/status") return Response.json({ connected: false });
    if (url.pathname === "/api/mt5/terminals") return Response.json({ terminals: [] });
    if (url.pathname === "/api/orderflow/delta-profile") {
      requests.push(url);
      return Response.json({ rows: [], rowTicks: Number(url.searchParams.get("rowTicks")) });
    }
    if (url.pathname === "/api/history") return Response.json({ bars: [] });
    if (url.pathname.includes("signals")) return Response.json({ signals: [] });
    if (url.pathname.includes("big-trades")) return Response.json({ trades: [] });
    if (url.pathname.includes("footprint") || url.pathname.includes("volume-delta")) {
      return Response.json({ bars: [] });
    }
    return new Response(null, { status: 404 });
  }));
  return { state, requests };
}

function openSettings() {
  fireEvent.click(screen.getByLabelText("Indicators"));
  fireEvent.click(screen.getByLabelText("Volume Profile settings"));
  return screen.getByLabelText("Volume Profile ticks per row");
}

function lastRequest(requests: URL[]) {
  return requests[requests.length - 1];
}

describe("Volume Profile indicator requests and workspace persistence", () => {
  it("refetches edited row ticks and restores each workspace independently", async () => {
    const { state, requests } = mockWorkspace(3);
    const first = render(<LiveApp />);
    await waitFor(() => expect(lastRequest(requests)?.searchParams.get("rowTicks")).toBe("3"));
    const input = openSettings();
    fireEvent.change(input, { target: { value: "7" } });
    await waitFor(() => expect(lastRequest(requests)?.searchParams.get("rowTicks")).toBe("7"));
    expect(lastRequest(requests)?.searchParams.get("source")).toBe("footprint_cache");
    expect(lastRequest(requests)?.searchParams.get("contract")).toBe("GC");
    fireEvent(window, new Event("pagehide"));
    await waitFor(() => expect(readProfileHotSnapshot(state.user)?.payload.dailyVolumeProfileRowTicks).toBe(7));
    first.unmount();

    state.user = "workspace-b";
    state.ticks = 10;
    const second = render(<LiveApp />);
    await waitFor(() => expect(lastRequest(requests)?.searchParams.get("rowTicks")).toBe("10"));
    expect(openSettings()).toHaveValue(10);
    second.unmount();

    state.user = "workspace-a";
    state.ticks = 3;
    render(<LiveApp />);
    await waitFor(() => expect(lastRequest(requests)?.searchParams.get("rowTicks")).toBe("7"));
    expect(openSettings()).toHaveValue(7);
  });

  it.each([undefined, 0, 1.5])("requests legacy default for saved row ticks %s", async (ticks) => {
    const { requests } = mockWorkspace(ticks);
    render(<LiveApp />);
    await waitFor(() => expect(lastRequest(requests)?.searchParams.get("rowTicks")).toBe("2"));
    expect(openSettings()).toHaveValue(2);
  });
});
