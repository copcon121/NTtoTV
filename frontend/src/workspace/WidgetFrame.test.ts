import { describe, expect, it, vi } from "vitest";
import { watchWidgetActivation } from "./WidgetFrame";

function fixture(search = "?widgetId=fp&mountId=mount", origin = window.location.origin) {
  const doc = Object.assign(new EventTarget(), { location: { href: origin + "/fp" + search } });
  const source = {};
  const frame = Object.assign(new EventTarget(), { contentWindow: source, contentDocument: doc });
  const activate = vi.fn();
  const dispose = watchWidgetActivation(frame as unknown as HTMLIFrameElement, window.location.origin, "fp", "mount", activate);
  return { frame, doc, source, activate, dispose };
}

describe("iframe visual activation", () => {
  it("observes actual pointer and keyboard focus within the assigned same-origin mount", () => {
    const f = fixture();
    f.doc.dispatchEvent(new Event("pointerdown"));
    f.doc.dispatchEvent(new Event("focusin"));
    expect(f.activate).toHaveBeenCalledTimes(2);
    f.dispose();
    f.doc.dispatchEvent(new Event("pointerdown"));
    f.frame.dispatchEvent(new Event("load"));
    f.doc.dispatchEvent(new Event("focusin"));
    expect(f.activate).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["?widgetId=other&mountId=mount", window.location.origin],
    ["?widgetId=fp&mountId=stale", window.location.origin],
    ["?widgetId=fp&mountId=mount", "https://untrusted.invalid"],
  ])("rejects a mismatched widget, mount or origin: %s %s", (search, origin) => {
    const f = fixture(search, origin);
    f.doc.dispatchEvent(new Event("pointerdown"));
    f.doc.dispatchEvent(new Event("focusin"));
    expect(f.activate).not.toHaveBeenCalled();
    f.dispose();
  });

  it("rejects stale source/document identity and detaches the old document on reload", () => {
    const f = fixture();
    f.frame.contentWindow = {};
    f.doc.dispatchEvent(new Event("pointerdown"));
    expect(f.activate).not.toHaveBeenCalled();
    f.frame.contentWindow = f.source;
    const next = Object.assign(new EventTarget(), { location: { href: f.doc.location.href } });
    f.frame.contentDocument = next;
    f.doc.dispatchEvent(new Event("focusin"));
    expect(f.activate).not.toHaveBeenCalled();
    f.frame.dispatchEvent(new Event("load"));
    f.doc.dispatchEvent(new Event("pointerdown"));
    next.dispatchEvent(new Event("pointerdown"));
    expect(f.activate).toHaveBeenCalledOnce();
    next.location.href = "https://untrusted.invalid/fp?widgetId=fp&mountId=mount";
    next.dispatchEvent(new Event("focusin"));
    expect(f.activate).toHaveBeenCalledOnce();
    f.dispose();
  });

  it("ignores inaccessible cross-origin documents", () => {
    const frame = new EventTarget();
    Object.defineProperty(frame, "contentWindow", { get() { throw new DOMException("Blocked", "SecurityError"); } });
    const activate = vi.fn();
    const dispose = watchWidgetActivation(frame as HTMLIFrameElement, window.location.origin, "fp", "mount", activate);
    expect(() => frame.dispatchEvent(new Event("load"))).not.toThrow();
    expect(activate).not.toHaveBeenCalled();
    dispose();
  });
});
