import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PBT_MIN_RUNS, PBT_RUNS } from "./fast-check.setup";
import { propertyTag } from "./property";

// Smoke test for the task 1.2 frontend test-runner scaffold.
//
// Confirms that:
//  1. fast-check is installed and runs property checks, and
//  2. the canonical floor is >= 100 iterations (design Testing Strategy:
//     fast-check `numRuns >= 100`) — a reduced GC_PBT_* override is allowed for
//     quick local iteration without weakening the mandated floor, and
//  3. the property-tag helper produces the exact required tag format.
describe("frontend test runner scaffold", () => {
  it("enforces a canonical floor of >= 100 iterations and runs property checks", () => {
    // The spec floor is a constant and must always be >= 100, regardless of any
    // fast-pass override applied to the active run count.
    expect(PBT_MIN_RUNS).toBeGreaterThanOrEqual(100);

    let runs = 0;
    fc.assert(
      fc.property(fc.integer(), (n) => {
        runs += 1;
        // trivial always-true property over the generated input
        return n === n;
      }),
    );
    // fast-check actually executed the configured number of runs.
    expect(runs).toBe(PBT_RUNS);
  });

  it("formats the property tag exactly as the design requires", () => {
    expect(propertyTag(24, "Missing-range patching yields a contiguous series")).toBe(
      "Feature: gc-chart-platform, Property 24: Missing-range patching yields a contiguous series",
    );
  });
});
