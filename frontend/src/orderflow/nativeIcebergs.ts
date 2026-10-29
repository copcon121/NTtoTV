import type { NativeIcebergState } from "../socket/messages";

export const MAX_NATIVE_ICEBERGS = 5_000;

export interface NativeIcebergSnapshot {
  symbol: string;
  contract: string;
  source: "rithmic";
  sourceContract: string | null;
  sessionId: string | null;
  synchronized: boolean;
  connected?: boolean;
  from?: number | null;
  icebergs: NativeIcebergState[];
}

export interface NativeIcebergBook {
  sessionId: string | null;
  sourceContract: string | null;
  synchronized: boolean;
  sourceConnected: boolean;
  icebergs: readonly NativeIcebergState[];
  retiredSessions: readonly string[];
}

export function emptyNativeIcebergBook(): NativeIcebergBook {
  return { sessionId: null, sourceContract: null, synchronized: false, sourceConnected: false,
    icebergs: [], retiredSessions: [] };
}

export function isNativeIceberg(value: unknown): value is NativeIcebergState {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Partial<NativeIcebergState>;
  return row.source === "rithmic" && row.method === "native" &&
    typeof row.sessionId === "string" && row.sessionId.length > 0 &&
    typeof row.orderId === "string" && row.orderId.length > 0 &&
    typeof row.sourceContract === "string" &&
    (row.side === "buy" || row.side === "sell") &&
    [row.price, row.time, row.detectedTime, row.sequence, row.executedVolume,
      row.displayedSize, row.refillCount].every((n) => typeof n === "number" && Number.isFinite(n)) &&
    (row.sequence ?? -1) >= 0 && (row.executedVolume ?? -1) >= 0 &&
    (row.displayedSize ?? -1) >= 0 &&
    ["active", "executed", "canceled", "invalidated"].includes(row.status ?? "") &&
    (row.detectionReason === "overfill" || row.detectionReason === "refill");
}

function bounded(rows: Iterable<NativeIcebergState>): NativeIcebergState[] {
  return [...rows].sort((a, b) => a.time - b.time || a.sequence - b.sequence)
    .slice(-MAX_NATIVE_ICEBERGS);
}

function orderKey(row: NativeIcebergState): string {
  return `${row.sessionId}\u0000${row.orderId}`;
}

function inactivePreviousSession(row: NativeIcebergState, sessionId: string | null): NativeIcebergState {
  return row.sessionId !== sessionId && row.status === "active"
    ? { ...row, status: "invalidated" } : row;
}

export function updateNativeIcebergBook(
  book: NativeIcebergBook, row: NativeIcebergState,
): NativeIcebergBook {
  if (!isNativeIceberg(row)) return book;
  const retired = book.retiredSessions.includes(row.sessionId);
  if (retired && (row.status === "active" || row.sourceContract !== book.sourceContract)) return book;
  if (retired) {
    const rows = new Map(book.icebergs.map((item) => [orderKey(item), item]));
    const previous = rows.get(orderKey(row));
    if (previous && previous.sequence >= row.sequence) return book;
    rows.set(orderKey(row), row);
    return { ...book, icebergs: bounded(rows.values()) };
  }
  const changedSession = book.sessionId !== null && book.sessionId !== row.sessionId;
  const changedContract = book.sourceContract !== null && book.sourceContract !== row.sourceContract;
  const rows = new Map((changedContract ? [] : book.icebergs)
    .map((item) => [orderKey(item), inactivePreviousSession(item, row.sessionId)]));
  const previous = rows.get(orderKey(row));
  if (previous && previous.sequence >= row.sequence) return book;
  rows.set(orderKey(row), row);
  return {
    sessionId: row.sessionId,
    sourceContract: row.sourceContract,
    synchronized: changedSession || changedContract ? false : book.synchronized,
    sourceConnected: book.sourceConnected,
    icebergs: bounded(rows.values()),
    retiredSessions: changedSession
      ? [...book.retiredSessions, book.sessionId!].slice(-16) : book.retiredSessions,
  };
}

/** A late REST response must not roll back any live sequence or newer session. */
export function reconcileNativeIcebergSnapshot(
  book: NativeIcebergBook,
  snapshot: NativeIcebergSnapshot,
  updatesDuringRequest: readonly NativeIcebergState[],
): NativeIcebergBook {
  if (snapshot.sessionId && book.retiredSessions.includes(snapshot.sessionId)) return book;
  const latestLive = updatesDuringRequest[updatesDuringRequest.length - 1];
  if (latestLive && (latestLive.sessionId !== snapshot.sessionId ||
      latestLive.sourceContract !== snapshot.sourceContract)) return book;
  const sameSession = book.sessionId === snapshot.sessionId;
  const sameContract = book.sourceContract === snapshot.sourceContract;
  const rows = new Map((sameContract ? book.icebergs : [])
    .filter((row) => snapshot.from == null || row.time >= snapshot.from)
    .map((row) => [orderKey(row), row]));
  for (const row of [...snapshot.icebergs, ...updatesDuringRequest]) {
    if (!isNativeIceberg(row) || row.sourceContract !== snapshot.sourceContract) continue;
    const previous = rows.get(orderKey(row));
    if (!previous || row.sequence > previous.sequence) rows.set(orderKey(row), row);
  }
  const priorSessions = [...rows.values()].map((row) => row.sessionId)
    .filter((id) => id !== snapshot.sessionId);
  return {
    sessionId: snapshot.sessionId,
    sourceContract: snapshot.sourceContract,
    synchronized: snapshot.synchronized,
    sourceConnected: snapshot.connected ?? snapshot.synchronized,
    icebergs: bounded([...rows.values()].map((row) => inactivePreviousSession(row, snapshot.sessionId))),
    retiredSessions: [...new Set([...book.retiredSessions, ...priorSessions,
      ...(!sameSession && book.sessionId ? [book.sessionId] : [])])].slice(-16),
  };
}
