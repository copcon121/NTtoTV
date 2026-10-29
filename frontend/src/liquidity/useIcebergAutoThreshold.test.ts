import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { NativeIcebergState } from "../socket/messages";
import { DEFAULT_ICEBERG_FILTERS } from "./icebergFilters";
import { useIcebergAutoThreshold } from "./useIcebergAutoThreshold";

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("samples the initial book and newest full book once per minute without viewport or tick-driven refreshes", () => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000_000);
  const sample = { detectedTime: 9_900_000, time: 9_950_000, endTime: 9_950_000,
    status: "executed", executedVolume: 10 } as NativeIcebergState;
  const { result, rerender } = renderHook(({ rows }) =>
    useIcebergAutoThreshold(rows, DEFAULT_ICEBERG_FILTERS, true, "session"),
  { initialProps: { rows: [] as NativeIcebergState[] } });
  rerender({ rows: [sample] });
  expect(result.current.threshold).toBe(10);
  rerender({ rows: [{ ...sample, executedVolume: 25 }] });
  expect(result.current.threshold).toBe(10);
  act(() => vi.advanceTimersByTime(60_000));
  expect(result.current.threshold).toBe(25);
  act(() => vi.advanceTimersByTime(3_600_000));
  expect(result.current).toMatchObject({ threshold: 0, sampleCount: 0 });
});
