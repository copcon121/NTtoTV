import { test } from "vitest";

/**
 * Test helper that enforces the design's property-test tagging convention.
 *
 * Every property-based test maps to exactly one of design Properties 1-31 and
 * MUST carry the tag in this exact format (see design Testing Strategy):
 *
 *   Feature: gc-chart-platform, Property {number}: {property_text}
 *
 * Usage:
 *   propertyTest(24, "Missing-range patching yields a contiguous series", () => {
 *     fc.assert(fc.property(...));
 *   });
 *
 * The generated test name embeds the tag so it is visible in test output and
 * greppable across the suite.
 */
export const FEATURE_TAG = "gc-chart-platform";

export function propertyTag(propertyNumber: number, propertyText: string): string {
  return `Feature: ${FEATURE_TAG}, Property ${propertyNumber}: ${propertyText}`;
}

export function propertyTest(
  propertyNumber: number,
  propertyText: string,
  fn: () => void | Promise<void>,
): void {
  test(propertyTag(propertyNumber, propertyText), fn);
}
