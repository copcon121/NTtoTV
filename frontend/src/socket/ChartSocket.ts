// socket module — ChartSocket: the `/ws/chart` WebSocket client.
//
// Design Frontend Modules (design.md): `ChartSocket` connects to `/ws/chart`,
// sends subscribe/unsubscribe, and responds to a server ping with a pong.
//   - Req 5.4  subscribe request begins streaming the requested events
//   - Req 5.5  unsubscribe request stops the unsubscribed events
//   - Req 6.2  on receiving a ping, the Frontend responds with a pong
//   - Req 11.2 subscribe to realtime updates through the chart WebSocket
//
// The WebSocket transport is injectable (a factory or url) so the client can be
// driven by a mock WebSocket under Vitest/fast-check.

import type {
  ChartEventType,
  InboundMessage,
  InboundMessageOf,
  InboundMessageType,
  OutboundMessage,
  SubscribeMessage,
  Timeframe,
} from "./messages";

/**
 * Minimal structural contract for a WebSocket, covering only what ChartSocket
 * uses. The browser `WebSocket` satisfies this, and tests can supply a mock.
 */
export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((this: unknown, ev: unknown) => unknown) | null;
  onclose: ((this: unknown, ev: unknown) => unknown) | null;
  onerror: ((this: unknown, ev: unknown) => unknown) | null;
  onmessage: ((this: unknown, ev: { data: unknown }) => unknown) | null;
}

/** Factory that constructs a transport for a given url (Req: injectable). */
export type WebSocketFactory = (url: string) => WebSocketLike;

/** Standard WebSocket.readyState values (mirrors the DOM constants). */
export const SocketReadyState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

/** Handler invoked for every inbound message of a given type. */
export type MessageHandler<T extends InboundMessageType> = (
  message: InboundMessageOf<T>,
) => void;

/** Handler invoked for any inbound message (after typed dispatch). */
export type AnyMessageHandler = (message: InboundMessage) => void;
export type LifecycleHandler = () => void;

export interface ChartSocketOptions {
  /** Target endpoint, e.g. `ws://127.0.0.1:8000/ws/chart`. */
  url: string;
  /**
   * Transport factory. Defaults to the global `WebSocket` constructor when
   * available. Supply a mock for testing.
   */
  factory?: WebSocketFactory;
  /**
   * Optional sink for malformed inbound frames (non-JSON or non-object).
   * Defaults to a no-op so a hostile/garbled frame can never crash the client.
   */
  onParseError?: (raw: unknown, error: unknown) => void;
  /** Injectable wall clock for deterministic stale-transport recovery tests. */
  now?: () => number;
}

const defaultFactory: WebSocketFactory = (url) => {
  if (typeof WebSocket === "undefined") {
    throw new Error(
      "No WebSocket implementation available; pass a `factory` to ChartSocket.",
    );
  }
  return new WebSocket(url) as unknown as WebSocketLike;
};

/**
 * Typed client for the `/ws/chart` endpoint.
 *
 * Responsibilities (this task's scope only):
 *  - connect to `/ws/chart` via an injectable transport,
 *  - send subscribe / unsubscribe requests (buffered until the socket opens),
 *  - dispatch inbound messages to registered handlers by `type`,
 *  - automatically reply to `ping` with `pong` (Req 6.2).
 *
 * Reconnect scheduling is owned by the caller; this client preserves and
 * replays active subscriptions whenever a new transport opens.
 */
export class ChartSocket {
  private readonly url: string;
  private readonly factory: WebSocketFactory;
  private readonly onParseError: (raw: unknown, error: unknown) => void;
  private readonly now: () => number;

  private socket: WebSocketLike | null = null;
  private lastInboundAt: number;
  private stateChangedAt: number;

  /** Outbound frames queued while the socket is not yet OPEN. */
  private readonly pending: OutboundMessage[] = [];

  /** Per-type message handlers. */
  private readonly handlers = new Map<
    InboundMessageType,
    Set<(message: InboundMessage) => void>
  >();

  /** Handlers invoked for every inbound message regardless of type. */
  private readonly anyHandlers = new Set<AnyMessageHandler>();

  /** Socket lifecycle handlers. */
  private readonly openHandlers = new Set<LifecycleHandler>();
  private readonly closeHandlers = new Set<LifecycleHandler>();

  /** Active subscriptions replayed after a reconnect. */
  private readonly subscriptions = new Map<string, SubscribeMessage>();

  private hasOpened = false;

  constructor(options: ChartSocketOptions) {
    this.url = options.url;
    this.factory = options.factory ?? defaultFactory;
    this.onParseError = options.onParseError ?? (() => {});
    this.now = options.now ?? Date.now;
    this.lastInboundAt = this.now();
    this.stateChangedAt = this.lastInboundAt;
  }

  /** Current transport readyState, or CLOSED when not connected. */
  get readyState(): number {
    return this.socket?.readyState ?? SocketReadyState.CLOSED;
  }

  /** True once the underlying socket is OPEN. */
  get isOpen(): boolean {
    return this.readyState === SocketReadyState.OPEN;
  }

  /**
   * Open the connection. Idempotent: calling again while a socket already
   * exists is a no-op and returns the existing transport.
   */
  connect(): WebSocketLike {
    if (this.socket && this.socket.readyState !== SocketReadyState.CLOSED) {
      return this.socket;
    }
    this.socket = null;
    const socket = this.factory(this.url);
    this.socket = socket;
    this.stateChangedAt = this.now();

    socket.onopen = () => {
      // Only the current socket should flush; a stale socket's late onopen is
      // ignored so it cannot interfere with a newer connection.
      if (this.socket === socket) {
        this.stateChangedAt = this.now();
        this.lastInboundAt = this.stateChangedAt;
        this.flushPending();
        if (this.hasOpened) {
          this.resendSubscriptions();
        }
        this.hasOpened = true;
        this.emitOpen();
      }
    };
    socket.onmessage = (ev) => {
      if (this.socket === socket) {
        this.lastInboundAt = this.now();
        this.handleRawMessage(ev.data);
      }
    };
    socket.onclose = () => {
      // Drop the reference ONLY if this exact socket is still the current one.
      // Under React StrictMode the effect mounts→cleanup→remounts, creating a
      // second socket; the first socket's delayed onclose must NOT null out the
      // newer socket (which would silently strand the pending subscribe and
      // stall all live updates). Pending queue is preserved for reconnect.
      if (this.socket === socket) {
        this.socket = null;
        this.stateChangedAt = this.now();
        this.emitClose();
      }
    };
    socket.onerror = () => {
      // Surface nothing here; close handling owns lifecycle. Kept non-null so
      // the transport does not log unhandled-error noise.
    };

    // A transport may already be OPEN synchronously (e.g. some mocks); flush.
    if (socket.readyState === SocketReadyState.OPEN) {
      this.flushPending();
    }
    return socket;
  }

  /**
   * Recover a socket that is closed or stuck without inbound frames.
   *
   * Browsers can remain in CONNECTING/CLOSING after a proxy or WAN failure,
   * and an apparently OPEN transport can stop receiving frames. A forced
   * reconnect preserves active subscriptions and replays them after open.
   */
  ensureConnected(
    idleTimeoutMs = 45_000,
    transitionTimeoutMs = 10_000,
  ): boolean {
    const state = this.readyState;
    const now = this.now();
    if (state === SocketReadyState.CLOSED) {
      this.forceReconnect("closed transport");
      return true;
    }
    const staleAfter =
      state === SocketReadyState.OPEN ? idleTimeoutMs : transitionTimeoutMs;
    const since =
      state === SocketReadyState.OPEN ? this.lastInboundAt : this.stateChangedAt;
    if (now - since < staleAfter) {
      return false;
    }
    this.forceReconnect("stale transport");
    return true;
  }

  /** Close the current transport and immediately open a replacement. */
  forceReconnect(reason = "reconnect"): void {
    const socket = this.socket;
    this.socket = null;
    this.stateChangedAt = this.now();
    if (socket) {
      try {
        socket.close(4000, reason);
      } catch {
        /* The stale transport is already unusable. */
      }
    }
    this.connect();
  }

  /**
   * Subscribe to `events` for `symbol` (Req 5.4, 11.2). When `tf` is provided it
   * selects the bar timeframe of interest.
   */
  subscribe(symbol: string, events: ChartEventType[], tf?: Timeframe): void {
    const message: OutboundMessage =
      tf === undefined
        ? { type: "subscribe", symbol, events }
        : { type: "subscribe", symbol, events, tf };
    this.rememberSubscription(symbol, events, tf);
    this.send(message);
  }

  /** Unsubscribe from `events` for `symbol` (Req 5.5). */
  unsubscribe(symbol: string, events: ChartEventType[], tf?: Timeframe): void {
    this.forgetSubscription(symbol, events, tf);
    const message: OutboundMessage =
      tf === undefined
        ? { type: "unsubscribe", symbol, events }
        : { type: "unsubscribe", symbol, events, tf };
    this.send(message);
  }

  /**
   * Register a handler for inbound messages of `type`. Returns a disposer that
   * removes the handler.
   */
  on<T extends InboundMessageType>(type: T, handler: MessageHandler<T>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    const erased = handler as (message: InboundMessage) => void;
    set.add(erased);
    return () => {
      set?.delete(erased);
    };
  }

  /**
   * Register a handler invoked for every inbound message (after typed
   * dispatch). Returns a disposer.
   */
  onMessage(handler: AnyMessageHandler): () => void {
    this.anyHandlers.add(handler);
    return () => {
      this.anyHandlers.delete(handler);
    };
  }

  /** Register a handler invoked when the underlying socket opens. */
  onOpen(handler: LifecycleHandler): () => void {
    this.openHandlers.add(handler);
    return () => {
      this.openHandlers.delete(handler);
    };
  }

  /** Register a handler invoked when the underlying socket closes. */
  onClose(handler: LifecycleHandler): () => void {
    this.closeHandlers.add(handler);
    return () => {
      this.closeHandlers.delete(handler);
    };
  }

  /** Close the connection and clear the pending queue. */
  close(code?: number, reason?: string): void {
    this.pending.length = 0;
    const socket = this.socket;
    if (!socket) {
      return;
    }
    this.socket = null;
    this.stateChangedAt = this.now();
    socket.close(code, reason);
  }

  /**
   * Send an outbound message. When the socket is not OPEN the frame is queued
   * and flushed on `open` so callers can subscribe before connection completes.
   */
  send(message: OutboundMessage): void {
    if (this.socket && this.socket.readyState === SocketReadyState.OPEN) {
      this.socket.send(JSON.stringify(message));
      return;
    }
    this.pending.push(message);
  }

  private flushPending(): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== SocketReadyState.OPEN) {
      return;
    }
    // Drain in FIFO order; preserve order if a send throws.
    while (this.pending.length > 0) {
      const message = this.pending[0];
      socket.send(JSON.stringify(message));
      this.pending.shift();
    }
  }

  private resendSubscriptions(): void {
    for (const message of this.subscriptions.values()) {
      this.send(message);
    }
  }

  private subscriptionKey(symbol: string, tf?: Timeframe): string {
    return `${symbol}\u0000${tf ?? ""}`;
  }

  private rememberSubscription(
    symbol: string,
    events: ChartEventType[],
    tf?: Timeframe,
  ): void {
    const key = this.subscriptionKey(symbol, tf);
    const existing = this.subscriptions.get(key);
    const merged = new Set<ChartEventType>(existing?.events ?? []);
    for (const event of events) {
      merged.add(event);
    }
    const next: SubscribeMessage =
      tf === undefined
        ? { type: "subscribe", symbol, events: [...merged] }
        : { type: "subscribe", symbol, events: [...merged], tf };
    this.subscriptions.set(key, next);
  }

  private forgetSubscription(
    symbol: string,
    events: ChartEventType[],
    tf?: Timeframe,
  ): void {
    const remove = new Set(events);
    for (const [key, subscription] of [...this.subscriptions]) {
      if (subscription.symbol !== symbol || (tf !== undefined && subscription.tf !== tf)) {
        continue;
      }
      const remaining = subscription.events.filter((event) => !remove.has(event));
      if (remaining.length === 0) {
        this.subscriptions.delete(key);
      } else {
        this.subscriptions.set(key, { ...subscription, events: remaining });
      }
    }
  }

  private emitOpen(): void {
    for (const handler of [...this.openHandlers]) {
      handler();
    }
  }

  private emitClose(): void {
    for (const handler of [...this.closeHandlers]) {
      handler();
    }
  }

  private handleRawMessage(raw: unknown): void {
    const message = this.parse(raw);
    if (!message) {
      return;
    }

    // Req 6.2: respond to a server ping with a pong automatically.
    if (message.type === "ping") {
      this.send({ type: "pong", time: message.time });
    }

    this.dispatch(message);
  }

  private parse(raw: unknown): InboundMessage | null {
    if (typeof raw !== "string") {
      this.onParseError(raw, new Error("expected string frame"));
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      this.onParseError(raw, error);
      return null;
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { type?: unknown }).type !== "string"
    ) {
      this.onParseError(raw, new Error("missing message type discriminator"));
      return null;
    }
    return parsed as InboundMessage;
  }

  private dispatch(message: InboundMessage): void {
    const set = this.handlers.get(message.type);
    if (set) {
      // Copy to tolerate handlers that unsubscribe during dispatch.
      for (const handler of [...set]) {
        handler(message);
      }
    }
    if (this.anyHandlers.size > 0) {
      for (const handler of [...this.anyHandlers]) {
        handler(message);
      }
    }
  }
}
