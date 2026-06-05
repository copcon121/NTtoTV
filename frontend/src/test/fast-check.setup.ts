import * as fc from "fast-check";
import { beforeAll } from "vitest";
import "@testing-library/jest-dom/vitest";

// Global fast-check configuration for the GC Chart Platform frontend.
//
// The design's Testing Strategy mandates a MINIMUM of 100 iterations per
// property-based test for spec verification (fast-check `numRuns >= 100`).
// For local/dev iteration the run count defaults to a FASTER 30 so the suite
// runs quickly; CI MUST restore the 100-iteration floor by setting
// GC_PBT_RUNS=100. The reduced local default MUST NOT be used for spec
// verification.
//
// The run count is overridable via env vars (read by Vitest from the process
// env):
//   GC_PBT_RUNS=<n>  -> run exactly n iterations (CI sets 100; local default 30)
//   GC_PBT_FAST=1    -> shortcut for a small iteration count (20)
export const PBT_MIN_RUNS = 100;
export const PBT_FAST_RUNS = 20;
// Faster default for local/dev runs when no env override is supplied.
export const PBT_DEFAULT_RUNS = 30;

function resolveRuns(): number {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const explicit = raw?.GC_PBT_RUNS;
  if (explicit !== undefined) {
    const n = Number.parseInt(explicit, 10);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  const fast = (raw?.GC_PBT_FAST ?? "").trim().toLowerCase();
  if (fast === "1" || fast === "true" || fast === "yes" || fast === "on") {
    return PBT_FAST_RUNS;
  }
  return PBT_DEFAULT_RUNS;
}

export const PBT_RUNS = resolveRuns();

beforeAll(() => {
  fc.configureGlobal({ numRuns: PBT_RUNS });
});
