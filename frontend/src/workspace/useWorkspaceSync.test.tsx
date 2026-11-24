import { StrictMode, type ReactNode } from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SYNC_PROTOCOL } from "../chart/shared/sync";
import { DEFAULT_THEME } from "./themes";
import type { WorkspacePayload } from "./types";
import { WidgetFrame } from "./WidgetFrame";
import { useWorkspaceSync } from "./useWorkspaceSync";

const context = { workspaceId: "one", symbol: "GC", contract: "GC", mode: "live" as const };
const payload: WorkspacePayload = { version: 1, template: "scratch", theme: DEFAULT_THEME,
  layout: { columnSplit: 52, firstRowSplit: 61, threeColumnSplits: [31, 70], tradingAccountPosition: "right" },
  panels: ["main", "mini", "fp"].map(id => ({ id, type: "chart", timeframe: "1m",
    sync: { groupId: "A", syncViewport: true, syncDrawings: true } })) };
const viewport = { fromUtcMs: 1700000000000, toUtcMs: 1700000300000 };
const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
afterEach(() => vi.useRealTimers());

describe("workspace sync lifecycle", () => {
  it("ACKs immediately, coalesces storage writes and flushes the old workspace on switch", () => {
    vi.useFakeTimers();
    const saved = new Map<string, WorkspacePayload>([["one", payload], ["two", payload]]);
    const update = vi.fn((transform: (p: WorkspacePayload) => WorkspacePayload, id = "one") => saved.set(id, transform(saved.get(id)!)));
    const hook = renderHook(({ id }) => useWorkspaceSync("guest", { ...context, workspaceId: id }, saved.get(id), update),
      { initialProps: { id: "one" }, wrapper });
    act(() => hook.result.current.connection("main")!.publish({ viewport }));
    expect(hook.result.current.connection("mini")!.config!.viewport).toEqual(viewport);
    act(() => hook.result.current.connection("main")!.publish({ viewport: { ...viewport, toUtcMs: viewport.toUtcMs + 60000 } }));
    expect(update).not.toHaveBeenCalled();
    hook.rerender({ id: "two" });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][1]).toBe("one");
    expect(saved.get("one")!.layout).toEqual(payload.layout);
    expect(saved.get("two")!.syncGroups).toBeUndefined();
    act(() => hook.result.current.connection("main")!.publish({ viewport }));
    act(() => vi.advanceTimersByTime(250));
    expect(update).toHaveBeenCalledTimes(2);
    hook.unmount();
  });

  it("suspends Main during replay, preserves peers/history and revokes detached callbacks", () => {
    const update = vi.fn();
    const hook = renderHook(({ replay }) => useWorkspaceSync("guest", context, payload, update, replay ? ["main"] : []),
      { initialProps: { replay: false }, wrapper });
    const stale = hook.result.current.connection("main")!;
    act(() => stale.publish({ viewport }));
    hook.rerender({ replay: true });
    expect(hook.result.current.connection("main")).toBeUndefined();
    expect(hook.result.current.connection("mini")!.config!.viewport).toEqual(viewport);
    act(() => stale.publish({ viewport: { ...viewport, toUtcMs: viewport.toUtcMs + 99999 } }));
    expect(hook.result.current.connection("mini")!.config!.viewport).toEqual(viewport);
    hook.rerender({ replay: false });
    expect(hook.result.current.connection("main")!.config!.viewport).toEqual(viewport);
    const detached = hook.result.current.connection("main")!;
    hook.unmount();
    const calls = update.mock.calls.length;
    act(() => detached.publish({ viewport: { ...viewport, toUtcMs: viewport.toUtcMs + 99999 } }));
    expect(update).toHaveBeenCalledTimes(calls);
  });

  it("does not flush pending data into another user and hydrates asynchronously loaded group history", () => {
    vi.useFakeTimers();
    const update = vi.fn();
    const hook = renderHook(({ scope, data }: { scope: string; data?: WorkspacePayload }) => useWorkspaceSync(scope, context, data, update),
      { initialProps: { scope: "guest", data: undefined as WorkspacePayload | undefined }, wrapper });
    expect(hook.result.current.connection("main")).toBeUndefined();
    hook.rerender({ scope: "guest", data: payload });
    const stale = hook.result.current.connection("main")!;
    act(() => stale.publish({ viewport }));
    hook.rerender({ scope: "user-b", data: payload });
    act(() => { stale.publish({ viewport }); vi.runAllTimers(); });
    expect(update).not.toHaveBeenCalled();
    expect(hook.result.current.connection("main")!.config!.viewport).toBeUndefined();
    act(() => hook.result.current.connection("main")!.publish({ viewport }));
    fireEvent(window, new Event("pagehide"));
    expect(update).toHaveBeenCalledTimes(1);
    hook.unmount();
  });

  it("registers the actual iframe after StrictMode cleanup/resume and rejects a retired mount", () => {
    const update = vi.fn();
    function Fixture() {
      const relay = useWorkspaceSync("guest", context, payload, update);
      return <WidgetFrame path="/fp" name="Footprint" theme={DEFAULT_THEME} widgetId="fp" relay={relay} />;
    }
    const view = render(<Fixture />, { wrapper });
    const frame = screen.getByTitle("Footprint") as HTMLIFrameElement;
    const mount = new URL(frame.src).searchParams.get("mountId")!;
    const send = vi.spyOn(frame.contentWindow!, "postMessage");
    const hello = { protocol: SYNC_PROTOCOL, type: "hello", widgetId: "fp", instanceId: mount, ...context, timeframe: "1m" };
    act(() => window.dispatchEvent(new MessageEvent("message", { origin: window.location.origin, source: frame.contentWindow, data: hello })));
    expect(send.mock.calls.slice(-1)[0]?.[0].config).toMatchObject({ groupId: "A", instanceId: mount });
    view.unmount();
    const calls = send.mock.calls.length;
    act(() => window.dispatchEvent(new MessageEvent("message", { origin: window.location.origin, source: frame.contentWindow, data: hello })));
    expect(send).toHaveBeenCalledTimes(calls);
  });
});
