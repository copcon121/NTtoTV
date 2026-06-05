// cache module — HistoryLoader.
//
// Fetches the initial chart history from the REST_API and populates the
// MemoryCache so the chart can render immediately (Req 11.1, 11.4). After the
// initial fetch completes the caller subscribes to realtime updates through the
// chart WebSocket (Req 11.2); this loader returns the loaded series so the
// caller can wire that subscription.
//
// The REST history endpoint is:
//   GET /api/history?symbol=GC&tf=<tf>&contract=<contract>&from=&to=&limit=
// and responds with `{ symbol, contract, tf, bars: Bar[], source }` where
// `source` is "cache" (precomputed bars) or "rebuild" (rebuilt from raw ticks).
//
// `fetch` is injectable so the loader is testable without a network or a DOM
// `fetch` global.

import { MemoryCache } from "./memoryCache";
import { type Bar, type CoveredRange, type SeriesKey } from "./types";

/** Source of the bars in a history response (design.md "History semantics"). */
export type HistorySource = "cache" | "rebuild";

/** Shape of the `/api/history` JSON response. */
export interface HistoryResponse {
  symbol: string;
  contract: string;
  tf: string;
  bars: Bar[];
  source: HistorySource;
}

/** Optional bounds for a history request. */
export interface HistoryRequest extends SeriesKey {
  from?: number; // Canonical_Timestamp ms (inclusive)
  to?: number; // Canonical_Timestamp ms (inclusive)
  limit?: number; // max bars; backend caps the cache path at 5000
}

/** The minimal fetch surface the loader needs (matches the DOM `fetch`). */
export type FetchFn = (url: string) => Promise<HistoryLikeResponse>;

/** The minimal Response surface the loader needs. */
export interface HistoryLikeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

/** Result of loading history: the parsed response plus the cache key used. */
export interface LoadResult {
  key: SeriesKey;
  bars: Bar[];
  source: HistorySource;
}

export interface HistoryLoaderOptions {
  /** Base path for the REST API. Defaults to "/api". */
  basePath?: string;
}

export class HistoryLoadError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "HistoryLoadError";
  }
}

/**
 * Build the `/api/history` request URL from a request. Omitted optional
 * parameters are left off the query string entirely (so the backend can apply
 * its defaults — e.g. defaulting `contract` to the Active_Contract is handled
 * server-side, but the Frontend always knows its contract so it is sent).
 */
export function buildHistoryUrl(req: HistoryRequest, basePath = "/api"): string {
  const params = new URLSearchParams();
  params.set("symbol", req.symbol);
  params.set("tf", req.timeframe);
  if (req.contract) {
    params.set("contract", req.contract);
  }
  if (req.from !== undefined) {
    params.set("from", String(req.from));
  }
  if (req.to !== undefined) {
    params.set("to", String(req.to));
  }
  if (req.limit !== undefined) {
    params.set("limit", String(req.limit));
  }
  return `${basePath}/history?${params.toString()}`;
}

/**
 * Loads initial REST history into a MemoryCache. The loader does not subscribe
 * to realtime updates itself — that is the caller's responsibility (Req 11.2) —
 * but it returns the loaded series so the caller can seed its subscription.
 */
export class HistoryLoader {
  private readonly basePath: string;

  constructor(
    private readonly fetchFn: FetchFn,
    private readonly cache: MemoryCache,
    options: HistoryLoaderOptions = {},
  ) {
    this.basePath = options.basePath ?? "/api";
  }

  /**
   * Fetch history for `(symbol, contract, timeframe)` and store it in the
   * MemoryCache. The covered range is set from the request bounds when present
   * so the cache records exactly what range was fetched (the RangePatcher uses
   * this in task 12.5); otherwise it falls back to the span of returned bars.
   *
   * Returns the loaded bars and their source. Throws {@link HistoryLoadError}
   * on a non-OK HTTP response or a malformed body.
   */
  async load(req: HistoryRequest): Promise<LoadResult> {
    const url = buildHistoryUrl(req, this.basePath);
    const response = await this.fetchFn(url);

    if (!response.ok) {
      throw new HistoryLoadError(
        `history request failed with status ${response.status}`,
        response.status,
      );
    }

    const body = (await response.json()) as Partial<HistoryResponse> | null;
    if (!body || !Array.isArray(body.bars)) {
      throw new HistoryLoadError("history response is missing a bars array");
    }

    const key: SeriesKey = {
      // Prefer the server-echoed identity (it resolves a defaulted contract),
      // falling back to the request values when the field is absent.
      symbol: body.symbol ?? req.symbol,
      contract: body.contract ?? req.contract,
      timeframe: body.tf ?? req.timeframe,
    };

    const bars = body.bars;
    const range = rangeFromRequest(req, bars);
    this.cache.set(key, bars, range);

    return {
      key,
      bars: this.cache.get(key)?.bars ?? [],
      source: body.source === "rebuild" ? "rebuild" : "cache",
    };
  }
}

/**
 * Derive the covered range to record for a load. When the request specifies
 * `from`/`to`, that range is authoritative (the backend was asked for exactly
 * that window). Otherwise the covered range is the span of the returned bars,
 * left to the MemoryCache to compute (returns `undefined`).
 */
function rangeFromRequest(
  req: HistoryRequest,
  bars: readonly Bar[],
): CoveredRange | undefined {
  if (req.from !== undefined && req.to !== undefined) {
    return { from: req.from, to: req.to };
  }
  if (req.from !== undefined && bars.length > 0) {
    return { from: req.from, to: bars[bars.length - 1].time };
  }
  if (req.to !== undefined && bars.length > 0) {
    return { from: bars[0].time, to: req.to };
  }
  return undefined;
}
