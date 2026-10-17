import { describe, expect, it } from "vitest";

import { routeForPathname } from "./routes";

describe("routeForPathname", () => {
  it("routes /fp to the standalone footprint page", () => {
    expect(routeForPathname("/fp")).toBe("footprint");
    expect(routeForPathname("/fp/")).toBe("footprint");
  });

  it("keeps /footprint as a footprint compatibility route", () => {
    expect(routeForPathname("/footprint")).toBe("footprint");
    expect(routeForPathname("/footprint/")).toBe("footprint");
  });

  it("routes /mp to the market profile page", () => {
    expect(routeForPathname("/mp")).toBe("marketProfile");
    expect(routeForPathname("/mp/")).toBe("marketProfile");
  });

  it("routes /lq to the liquidity page", () => {
    expect(routeForPathname("/lq")).toBe("liquidity");
    expect(routeForPathname("/lq/")).toBe("liquidity");
  });

  it("routes other paths to the live chart app", () => {
    expect(routeForPathname("/")).toBe("live");
    expect(routeForPathname("/anything")).toBe("live");
  });
});
