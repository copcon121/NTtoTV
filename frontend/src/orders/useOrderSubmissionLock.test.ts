import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useOrderSubmissionLock } from "./useOrderSubmissionLock";

describe("manual order submission", () => {
  it("blocks a second entry in the same event batch and through stale handlers", () => {
    const { result } = renderHook(() => useOrderSubmissionLock());
    const firstHandler = result.current;
    act(() => {
      expect(firstHandler.acquire()).toBe(true);
      expect(firstHandler.acquire()).toBe(false);
    });
    expect(result.current.pending).toBe(true);
    act(() => {
      expect(result.current.acquire()).toBe(false);
      firstHandler.release();
    });
    expect(result.current.pending).toBe(false);
    act(() => {
      expect(result.current.acquire()).toBe(true);
      expect(firstHandler.acquire()).toBe(false);
      result.current.release();
    });
  });
});
