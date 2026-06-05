import { describe, expect, it, vi } from "vitest";
import {
  HistoryLoadError,
  HistoryLoader,
  type HistoryLikeResponse,
  type HistoryResponse,
  buildHistoryUrl,
} from "./historyLoader";
import { MemoryCache } from "./memoryCache";
import { type Bar, type HistoryRequest, type SeriesKey } from "./index";

const KEY: SeriesKey = { symbol: "GC", contract: "GC 08-26", timeframe: "1m" };

function bar(time: number, close = time): Bar {
  return { time, open: close, high: close, low: close, close, volume: 1 };
}

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }): HistoryLikeResponse {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  };
}

function okHistory(overrides: Partial<HistoryResponse> = {}): HistoryResponse {
  return {
    symbol: "GC",
    contract: "GC 08-26",
    tf: "1m",
    bars: [bar(10), bar(20), bar(30)],
    source: "cache",
    ...overrides,
  };
}

describe("buildHistoryUrl", () => {
  it("includes symbol, tf and contract", () => {
    const url = buildHistoryUrl(KEY);
    expect(url).toContain("/api/history?");
    expect(url).toContain("symbol=GC");
    expect(url).toContain("tf=1m");
    expect(url).toContain("contract=GC+08-26");
  });

  it("omits from/to/limit when not provided", () => {
    const url = buildHistoryUrl(KEY);
    expect(url).not.toContain("from=");
    expect(url).not.toContain("to=");
    expect(url).not.toContain("limit=");
  });

  it("includes from/to/limit when provided", () => {
    const req: HistoryRequest = { ...KEY, from: 100, to: 200, limit: 500 };
    const url = buildHistoryUrl(req);
    expect(url).toContain("from=100");
    expect(url).toContain("to=200");
    expect(url).toContain("limit=500");
  });

  it("honors a custom base path", () => {
    expect(buildHistoryUrl(KEY, "http://localhost:8000/api")).toContain(
      "http://localhost:8000/api/history?",
    );
  });
});

describe("HistoryLoader.load", () => {
  it("fetches the history URL and stores returned bars in the cache", async () => {
    const cache = new MemoryCache();
    const fetchFn = vi.fn(async (_url: string) => jsonResponse(okHistory()));
    const loader = new HistoryLoader(fetchFn, cache);

    const result = await loader.load(KEY);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0][0]).toContain("/api/history?");
    expect(result.source).toBe("cache");
    expect(result.bars.map((b) => b.time)).toEqual([10, 20, 30]);
    expect(cache.get(KEY)?.bars.map((b) => b.time)).toEqual([10, 20, 30]);
  });

  it("sorts returned bars before storing them", async () => {
    const cache = new MemoryCache();
    const fetchFn = vi.fn(async () =>
      jsonResponse(okHistory({ bars: [bar(30), bar(10), bar(20)] })),
    );
    const loader = new HistoryLoader(fetchFn, cache);

    const result = await loader.load(KEY);
    expect(result.bars.map((b) => b.time)).toEqual([10, 20, 30]);
  });

  it("uses the server-echoed identity (resolved contract) as the cache key", async () => {
    const cache = new MemoryCache();
    // request omits a concrete contract; server resolves Active_Contract
    const req: HistoryRequest = { symbol: "GC", contract: "", timeframe: "1m" };
    const fetchFn = vi.fn(async () => jsonResponse(okHistory({ contract: "GC 12-26" })));
    const loader = new HistoryLoader(fetchFn, cache);

    const result = await loader.load(req);
    expect(result.key.contract).toBe("GC 12-26");
    expect(cache.has({ ...KEY, contract: "GC 12-26" })).toBe(true);
  });

  it("records the requested range as the covered range when from/to are given", async () => {
    const cache = new MemoryCache();
    const req: HistoryRequest = { ...KEY, from: 0, to: 100 };
    const fetchFn = vi.fn(async () => jsonResponse(okHistory()));
    const loader = new HistoryLoader(fetchFn, cache);

    await loader.load(req);
    expect(cache.coveredRange(KEY)).toEqual({ from: 0, to: 100 });
  });

  it("falls back to bar span for covered range when no bounds are requested", async () => {
    const cache = new MemoryCache();
    const fetchFn = vi.fn(async () => jsonResponse(okHistory()));
    const loader = new HistoryLoader(fetchFn, cache);

    await loader.load(KEY);
    expect(cache.coveredRange(KEY)).toEqual({ from: 10, to: 30 });
  });

  it("propagates the rebuild source", async () => {
    const cache = new MemoryCache();
    const fetchFn = vi.fn(async () => jsonResponse(okHistory({ source: "rebuild" })));
    const loader = new HistoryLoader(fetchFn, cache);

    const result = await loader.load(KEY);
    expect(result.source).toBe("rebuild");
  });

  it("handles an empty bar set without error", async () => {
    const cache = new MemoryCache();
    const fetchFn = vi.fn(async () => jsonResponse(okHistory({ bars: [] })));
    const loader = new HistoryLoader(fetchFn, cache);

    const result = await loader.load(KEY);
    expect(result.bars).toEqual([]);
    expect(cache.has(KEY)).toBe(true);
  });

  it("throws HistoryLoadError on a non-OK response", async () => {
    const cache = new MemoryCache();
    const fetchFn = vi.fn(async () => jsonResponse(null, { ok: false, status: 404 }));
    const loader = new HistoryLoader(fetchFn, cache);

    await expect(loader.load(KEY)).rejects.toBeInstanceOf(HistoryLoadError);
    await expect(loader.load(KEY)).rejects.toMatchObject({ status: 404 });
    expect(cache.has(KEY)).toBe(false);
  });

  it("throws HistoryLoadError when the body has no bars array", async () => {
    const cache = new MemoryCache();
    const fetchFn = vi.fn(async () => jsonResponse({ symbol: "GC", tf: "1m" }));
    const loader = new HistoryLoader(fetchFn, cache);

    await expect(loader.load(KEY)).rejects.toBeInstanceOf(HistoryLoadError);
  });

  it("honors a custom base path option", async () => {
    const cache = new MemoryCache();
    const fetchFn = vi.fn(async (_url: string) => jsonResponse(okHistory()));
    const loader = new HistoryLoader(fetchFn, cache, { basePath: "http://x/api" });

    await loader.load(KEY);
    expect(fetchFn.mock.calls[0][0]).toContain("http://x/api/history?");
  });
});
