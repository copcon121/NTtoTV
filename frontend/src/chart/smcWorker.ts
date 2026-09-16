import type { Bar } from "../cache/types";
import {
  computeSmcOverlay,
  type SmcOverlay,
  type SmcSettings,
} from "./smc";

export interface SmcWorkerRequest {
  requestId: number;
  bars: readonly Bar[];
  settings?: Partial<SmcSettings>;
}

export type SmcWorkerResponse =
  | { requestId: number; overlay: SmcOverlay }
  | { requestId: number; error: string };

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<SmcWorkerRequest>) => void) | null;
  postMessage(message: SmcWorkerResponse): void;
};

workerScope.onmessage = (event) => {
  const { requestId, bars, settings } = event.data;
  try {
    workerScope.postMessage({
      requestId,
      overlay: computeSmcOverlay(bars, settings),
    });
  } catch (error) {
    workerScope.postMessage({
      requestId,
      error: error instanceof Error ? error.message : "SMC computation failed",
    });
  }
};

