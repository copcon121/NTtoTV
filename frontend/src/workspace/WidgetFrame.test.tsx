import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WidgetFrame } from "./WidgetFrame";
import { DEFAULT_THEME } from "./themes";
import { WorkspaceSyncRelay } from "./syncRelay";
import { SYNC_PROTOCOL } from "../chart/shared/sync";

describe("workspace iframe registration", () => {
  it("registers actual window/mount URL before hello, preserves theme and retires source on unmount", () => {
    const relay = new WorkspaceSyncRelay({ workspaceId: "w", symbol: "GC", contract: "GC", mode: "live" }, window.location.origin,
      [{ id: "fp", type: "footprint", sync: { groupId: "A", syncViewport: true, syncDrawings: true } }], undefined, vi.fn(), vi.fn());
    const view = render(<WidgetFrame path="/fp" name="Footprint" theme={DEFAULT_THEME} widgetId="fp" relay={relay} />);
    const frame = screen.getByTitle("Footprint") as HTMLIFrameElement;
    const query = new URL(frame.src).searchParams;
    expect(query.get("widgetId")).toBe("fp");
    expect(query.get("mountId")).toBeTruthy();
    const post = vi.spyOn(frame.contentWindow!, "postMessage");
    const event = { origin: window.location.origin, source: frame.contentWindow!, data: { protocol: SYNC_PROTOCOL, type: "hello",
      widgetId: "fp", instanceId: query.get("mountId"), symbol: "GC", contract: "GC", timeframe: "1m", mode: "live" } };
    expect(relay.receive(event)).toBe(true);
    fireEvent.load(frame);
    expect(post).toHaveBeenCalledWith({ type: "workspace-theme", theme: DEFAULT_THEME }, window.location.origin);
    expect(post.mock.calls.slice(-1)[0]![0]).toMatchObject({ type: "config", config: { widgetId: "fp", instanceId: query.get("mountId"), groupId: "A" } });
    const old = post.mock.calls.slice(-1)[0]![0].config;
    const originalWindow = frame.contentWindow;
    fireEvent.load(frame); // An iframe document reload retains the WindowProxy and src/mountId.
    expect(frame.contentWindow).toBe(originalWindow);
    expect(new URL(frame.src).searchParams.get("mountId")).toBe(query.get("mountId"));
    expect(post.mock.calls.slice(-1)[0]![0].config.epoch).not.toBe(old.epoch);
    expect(relay.receive({ ...event, data: { ...event.data, type: "update", epoch: old.epoch,
      baseRevision: old.revision, sequence: 100, change: { viewport: { fromUtcMs: 1, toUtcMs: 2 } } } })).toBe(false);
    view.unmount();
    expect(relay.receive(event)).toBe(false);
  });
});
