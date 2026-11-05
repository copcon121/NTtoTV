import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "../api/client";
import { AUTH_SESSION_STORAGE_KEY, requestAuthSessionCheck } from "./sessionSync";
import { useAuthSessionSync } from "./useAuthSessionSync";

const user = { id: "user_a", username: "alice" };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("shared browser session", () => {
  it("verifies a login from another tab without trusting its storage payload", async () => {
    const api = { me: vi.fn().mockResolvedValue(user) };
    const onVerified = vi.fn();
    renderHook(() => useAuthSessionSync(api, onVerified));

    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", {
        key: AUTH_SESSION_STORAGE_KEY, newValue: "change-marker-only",
      }));
    });

    expect(api.me).toHaveBeenCalledTimes(1);
    expect(onVerified).toHaveBeenCalledWith(user);
  });

  it("does not discard a session after a temporary network failure", async () => {
    const api = { me: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) };
    const onVerified = vi.fn();
    renderHook(() => useAuthSessionSync(api, onVerified));

    await act(async () => { requestAuthSessionCheck(); });
    expect(onVerified).not.toHaveBeenCalled();

    api.me.mockResolvedValueOnce(undefined);
    await act(async () => { requestAuthSessionCheck(); });
    expect(onVerified).toHaveBeenCalledWith(undefined);
  });

  it("rechecks an old unauthorized response when a new login arrives in flight", async () => {
    let resolveOld!: (value: AuthUser | undefined) => void;
    const api = { me: vi.fn()
      .mockImplementationOnce(() => new Promise<AuthUser | undefined>((resolve) => { resolveOld = resolve; }))
      .mockResolvedValue(user) };
    const onVerified = vi.fn();
    renderHook(() => useAuthSessionSync(api, onVerified));

    await act(async () => {
      requestAuthSessionCheck();
      window.dispatchEvent(new StorageEvent("storage", { key: AUTH_SESSION_STORAGE_KEY }));
      resolveOld(undefined);
    });

    expect(api.me).toHaveBeenCalledTimes(2);
    expect(onVerified).toHaveBeenCalledTimes(1);
    expect(onVerified).toHaveBeenCalledWith(user);
  });

  it("checks on focus and periodically, and removes listeners on unmount", async () => {
    vi.useFakeTimers();
    const api = { me: vi.fn().mockResolvedValue(user) };
    const onVerified = vi.fn();
    const { unmount } = renderHook(() => useAuthSessionSync(api, onVerified));

    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(api.me).toHaveBeenCalledTimes(2);

    unmount();
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.me).toHaveBeenCalledTimes(2);
  });
});
