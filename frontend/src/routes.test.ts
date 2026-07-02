import { describe, expect, it } from "vitest";

import { routeForPathname } from "./routes";

describe("routeForPathname", () => {
  it("routes /footprint to the standalone footprint page", () => {
    expect(routeForPathname("/footprint")).toBe("footprint");
    expect(routeForPathname("/footprint/")).toBe("footprint");
  });

  it("routes other paths to the live chart app", () => {
    expect(routeForPathname("/")).toBe("live");
    expect(routeForPathname("/anything")).toBe("live");
  });
});
