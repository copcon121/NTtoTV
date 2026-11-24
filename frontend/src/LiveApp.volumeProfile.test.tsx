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
  const state = { user: "user-a", ticks };
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
    if (url.pathname === "/api/execution") {
      return Response.json({ enabled: false, mode: "disabled", profiles: [] });
    }
    if (url.pathname === "/api/workspaces") {
      return Response.json({ workspaces: [{
        id: `${state.user}-workspace`, name: "GC Workspace", createdAt: 1, updatedAt: 1,
        payload: {
          version: 1, template: "essentials", useChartProfile: true,
          tradingAccountInitialized: true,
          panels: [{ id: "main-chart", type: "chart", timeframe: "1m" }],
        },
      }] });
    }
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

async function openSettings() {
  fireEvent.click(await screen.findByLabelText("Indicators"));
  fireEvent.click(screen.getByLabelText("Volume Profile settings"));
  return screen.getByLabelText("Volume Profile tick size");
}

function lastRequest(requests: URL[]) {
  return requests[requests.length - 1];
}

describe("Volume Profile indicator requests and user profile persistence", () => {
  it("refetches edited row ticks and restores each user's profile independently", async () => {
    const { state, requests } = mockWorkspace(3);
    const first = render(<LiveApp />);
    await waitFor(() => expect(lastRequest(requests)?.searchParams.get("rowTicks")).toBe("3"));
    const input = await openSettings();
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.blur(input);
    await waitFor(() => expect(lastRequest(requests)?.searchParams.get("rowTicks")).toBe("7"));
    expect(lastRequest(requests)?.searchParams.get("source")).toBe("footprint_cache");
    expect(lastRequest(requests)?.searchParams.get("contract")).toBe("GC");
    fireEvent(window, new Event("pagehide"));
    await waitFor(() => expect(readProfileHotSnapshot(state.user)?.payload.dailyVolumeProfileRowTicks).toBe(7));
    first.unmount();

    state.user = "user-b";
    state.ticks = 10;
    const second = render(<LiveApp />);
    await waitFor(() => expect(lastRequest(requests)?.searchParams.get("rowTicks")).toBe("10"));
    expect(await openSettings()).toHaveValue(10);
    second.unmount();

    state.user = "user-a";
    state.ticks = 3;
    render(<LiveApp />);
    await waitFor(() => expect(lastRequest(requests)?.searchParams.get("rowTicks")).toBe("7"));
    expect(await openSettings()).toHaveValue(7);
  });

  it.each([[undefined, 2], [0, 1], [1.5, 2]])("normalizes saved row ticks %s to %s", async (ticks, expected) => {
    const { requests } = mockWorkspace(ticks);
    render(<LiveApp />);
    await waitFor(() => expect(lastRequest(requests)?.searchParams.get("rowTicks")).toBe(String(expected)));
    expect(await openSettings()).toHaveValue(expected);
  });
});
