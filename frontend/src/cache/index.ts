// cache module — history loading, browser memory cache, and range patching.
//
// Design Frontend Modules mapped here (see design.md "Frontend Modules"):
//   - HistoryLoader  (Req 11.1, 11.4)         initial REST history fetch
//   - MemoryCache    (Req 12.1, 12.2)         per-(symbol, contract, timeframe) bar cache for <300ms switches
//   - RangePatcher   (Req 12.3, 12.4)         background fetch + patch for missing ranges
//
// HistoryLoader + MemoryCache implemented in task 12.2. RangePatcher (task 12.5)
// builds on MemoryCache.coveredRange / MemoryCache.merge.

export {
  type Bar,
  type CachedSeries,
  type CoveredRange,
  type SeriesKey,
  serializeKey,
} from "./types";

export { MemoryCache, normalizeBars } from "./memoryCache";

export {
  HistoryLoader,
  HistoryLoadError,
  buildHistoryUrl,
  type FetchFn,
  type HistoryLikeResponse,
  type HistoryLoaderOptions,
  type HistoryRequest,
  type HistoryResponse,
  type HistorySource,
  type LoadResult,
} from "./historyLoader";

export {
  RangePatcher,
  computeMissingRanges,
  type PatchResult,
  type RangeFetchFn,
  type RangeFetchRequest,
} from "./RangePatcher";
