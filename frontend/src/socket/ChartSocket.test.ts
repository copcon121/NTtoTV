import * as fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { ChartSocket, SocketReadyState, type WebSocketLike } from "./ChartSocket";
import type { InboundMessage, OutboundMessage } from "./messages";
import { propertyTag } from "../test/property";

/**
 * Minimal mock WebSocket used to drive ChartSocket deterministically under
 * Vitest/fast-check. It records sent frames and exposes helpers to simulate
 * open/message/close events.
 */
class MockWebSocket implements WebSocketLike {
  readyState: number = SocketReadyState.CONNECTING;
  readonly sent: string[] = [];
  closeCalls: Array<{ code?: number; reason?: string }> = [];

  onopen: ((this: unknown, ev: unknown) => unknown) | null = null;
  onclose: ((this: unknown, ev: unknown) => unknown) | null = null;
  onerror: ((this: unknown, ev: unknown) => unknown) | null = null;
  onmessage: ((this: unknown, ev: { data: unknown }) => unknown) | null = null;

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    this.readyState = SocketReadyState.CLOSED;
    this.onclose?.call(this, { code, reason });
  }

  // --- test helpers -------------------------------------------------------
  open(): void {
    this.readyState = SocketReadyState.OPEN;
    this.onopen?.call(this, {});
  }

  receive(message: InboundMessage | string): void {
    const data = typeof message === "string" ? message : JSON.stringify(message);
    this.onmessage?.call(this, { data });
  }

  /** Parsed view of frames the client has sent. */
  sentMessages(): OutboundMessage[] {
    return this.sent.map((s) => JSON.parse(s) as OutboundMessage);
  }
}

function makeSocket(): { client: ChartSocket; transport: MockWebSocket } {
  const transport = new MockWebSocket();
  const client = new ChartSocket({ url: "ws://test/ws/chart", factory: () => transport });
  return { client, transport };
}

describe("ChartSocket", () => {
  it("connects via the injected factory with the configured url", () => {
    const factory = vi.fn((_url: string) => new MockWebSocket());
    const client = new ChartSocket({ url: "ws://127.0.0.1:9/ws/chart", factory });
    client.connect();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith("ws://127.0.0.1:9/ws/chart");
  });

  it("connect() is idempotent and reuses the existing transport", () => {
    const factory = vi.fn((_url: string) => new MockWebSocket());
    const client = new ChartSocket({ url: "ws://test/ws/chart", factory });
    const a = client.connect();
    const b = client.connect();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("sends a subscribe frame matching the design schema (Req 5.4)", () => {
    const { client, transport } = makeSocket();
    client.connect();
    transport.open();
    client.subscribe("GC", ["bar_update", "quote_update"], "1m");
    expect(transport.sentMessages()).toEqual([
      { type: "subscribe", symbol: "GC", events: ["bar_update", "quote_update"], tf: "1m" },
    ]);
  });

  it("omits tf from the subscribe frame when not provided", () => {
    const { client, transport } = makeSocket();
    client.connect();
    transport.open();
    client.subscribe("GC", ["status"]);
    expect(transport.sentMessages()).toEqual([
      { type: "subscribe", symbol: "GC", events: ["status"] },
    ]);
  });

  it("sends an unsubscribe frame matching the design schema (Req 5.5)", () => {
    const { client, transport } = makeSocket();
    client.connect();
    transport.open();
    client.unsubscribe("GC", ["footprint_update"]);
    expect(transport.sentMessages()).toEqual([
      { type: "unsubscribe", symbol: "GC", events: ["footprint_update"] },
    ]);
  });

  it("sends a timeframe-scoped unsubscribe frame when tf is provided", () => {
    const { client, transport } = makeSocket();
    client.connect();
    transport.open();
    client.unsubscribe("GC", ["bar_update", "volume_delta_update"], "1m");
    expect(transport.sentMessages()).toEqual([
      {
        type: "unsubscribe",
        symbol: "GC",
        events: ["bar_update", "volume_delta_update"],
        tf: "1m",
      },
    ]);
  });

  it("buffers outbound frames until the socket opens, then flushes in order (Req 11.2)", () => {
    const { client, transport } = makeSocket();
    client.connect();
    // Not open yet: frames queue rather than throw.
    client.subscribe("GC", ["bar_update"], "1m");
    client.unsubscribe("GC", ["bar_update"]);
    expect(transport.sent).toHaveLength(0);

    transport.open();
    expect(transport.sentMessages()).toEqual([
      { type: "subscribe", symbol: "GC", events: ["bar_update"], tf: "1m" },
      { type: "unsubscribe", symbol: "GC", events: ["bar_update"] },
    ]);
  });

  it("responds to a ping with a pong carrying the same time (Req 6.2)", () => {
    const { client, transport } = makeSocket();
    client.connect();
    transport.open();
    transport.receive({ type: "ping", time: 1730313600000 });
    expect(transport.sentMessages()).toEqual([{ type: "pong", time: 1730313600000 }]);
  });

  it("dispatches inbound messages to type-specific handlers", () => {
    const { client, transport } = makeSocket();
    const bars: InboundMessage[] = [];
    client.on("bar_update", (m) => bars.push(m));
    client.connect();
    transport.open();

    const barUpdate: InboundMessage = {
      type: "bar_update",
      symbol: "GC",
      contract: "GC 08-26",
      tf: "1m",
      bar: { time: 1730313600000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
      closed: false,
    };
    transport.receive(barUpdate);
    transport.receive({
      type: "quote_update",
      symbol: "GC",
      contract: "GC 08-26",
      time: 1,
      bid: 1,
      ask: 2,
      bidSize: 3,
      askSize: 4,
    });

    expect(bars).toEqual([barUpdate]);
  });

  it("invokes onMessage for every inbound message including ping", () => {
    const { client, transport } = makeSocket();
    const seen: string[] = [];
    client.onMessage((m) => seen.push(m.type));
    client.connect();
    transport.open();
    transport.receive({ type: "ping", time: 1 });
    transport.receive({ type: "status", state: "connected", time: 2 });
    expect(seen).toEqual(["ping", "status"]);
  });

  it("stops calling a handler after its disposer runs", () => {
    const { client, transport } = makeSocket();
    const handler = vi.fn();
    const dispose = client.on("status", handler);
    client.connect();
    transport.open();
    transport.receive({ type: "status", state: "connected", time: 1 });
    dispose();
    transport.receive({ type: "status", state: "degraded", time: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores malformed frames without throwing and reports them", () => {
    const transport = new MockWebSocket();
    const onParseError = vi.fn();
    const client = new ChartSocket({
      url: "ws://test/ws/chart",
      factory: () => transport,
      onParseError,
    });
    client.connect();
    transport.open();
    expect(() => transport.receive("not json{")).not.toThrow();
    expect(() => transport.receive(JSON.stringify({ noType: true }))).not.toThrow();
    expect(onParseError).toHaveBeenCalledTimes(2);
  });

  it("closes the transport and clears pending frames", () => {
    const { client, transport } = makeSocket();
    client.connect();
    client.subscribe("GC", ["bar_update"]); // queued (not open)
    client.close(1000, "bye");
    expect(transport.closeCalls).toEqual([{ code: 1000, reason: "bye" }]);
    expect(client.readyState).toBe(SocketReadyState.CLOSED);
  });

  it("replays active subscriptions after reconnect", () => {
    const first = new MockWebSocket();
    const second = new MockWebSocket();
    const factory = vi
      .fn((_url: string) => first)
      .mockImplementationOnce((_url: string) => first)
      .mockImplementationOnce((_url: string) => second);
    const client = new ChartSocket({ url: "ws://test/ws/chart", factory });

    client.connect();
    first.open();
    client.subscribe("GC", ["bar_update"], "1m");
    expect(first.sentMessages()).toEqual([
      { type: "subscribe", symbol: "GC", events: ["bar_update"], tf: "1m" },
    ]);

    first.close();
    expect(client.readyState).toBe(SocketReadyState.CLOSED);

    client.connect();
    second.open();
    expect(second.sentMessages()).toEqual([
      { type: "subscribe", symbol: "GC", events: ["bar_update"], tf: "1m" },
    ]);
  });

  it("replaces a CLOSED transport even when no close event fired", () => {
    const first = new MockWebSocket();
    const second = new MockWebSocket();
    const factory = vi
      .fn((_url: string) => first)
      .mockImplementationOnce((_url: string) => first)
      .mockImplementationOnce((_url: string) => second);
    const client = new ChartSocket({ url: "ws://test/ws/chart", factory });

    client.connect();
    first.open();
    client.subscribe("GC", ["bar_update"], "1m");
    first.readyState = SocketReadyState.CLOSED;

    expect(client.ensureConnected()).toBe(true);
    second.open();

    expect(second.sentMessages()).toEqual([
      { type: "subscribe", symbol: "GC", events: ["bar_update"], tf: "1m" },
    ]);
  });

  it("force-reconnects an OPEN transport with no inbound frames", () => {
    let now = 1_000;
    const first = new MockWebSocket();
    const second = new MockWebSocket();
    const factory = vi
      .fn((_url: string) => first)
      .mockImplementationOnce((_url: string) => first)
      .mockImplementationOnce((_url: string) => second);
    const client = new ChartSocket({
      url: "ws://test/ws/chart",
      factory,
      now: () => now,
    });

    client.connect();
    first.open();
    now += 45_001;

    expect(client.ensureConnected()).toBe(true);
    expect(first.closeCalls).toEqual([{ code: 4000, reason: "stale transport" }]);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("keeps an OPEN transport whose inbound activity is fresh", () => {
    let now = 1_000;
    const { client, transport } = (() => {
      const transport = new MockWebSocket();
      return {
        transport,
        client: new ChartSocket({
          url: "ws://test/ws/chart",
          factory: () => transport,
          now: () => now,
        }),
      };
    })();

    client.connect();
    transport.open();
    now += 44_000;
    transport.receive({ type: "status", state: "connected", time: now });
    now += 44_000;

    expect(client.ensureConnected()).toBe(false);
    expect(transport.closeCalls).toEqual([]);
  });

  it("emits socket lifecycle callbacks", () => {
    const { client, transport } = makeSocket();
    const opened = vi.fn();
    const closed = vi.fn();
    client.onOpen(opened);
    client.onClose(closed);

    client.connect();
    transport.open();
    transport.close();

    expect(opened).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  // Property 6.2-style invariant: a pong is always emitted for every ping, in
  // order, echoing each ping's time, regardless of interleaving with other
  // inbound traffic.
  it(
    propertyTag(
      62,
      "Every ping yields exactly one pong echoing its time, in order",
    ),
    () => {
      const inboundArb = fc.oneof(
        fc.record({ kind: fc.constant("ping" as const), time: fc.integer({ min: 0 }) }),
        fc.record({
          kind: fc.constant("status" as const),
          time: fc.integer({ min: 0 }),
        }),
      );
      fc.assert(
        fc.property(fc.array(inboundArb, { maxLength: 50 }), (events) => {
          const transport = new MockWebSocket();
          const client = new ChartSocket({
            url: "ws://test/ws/chart",
            factory: () => transport,
          });
          client.connect();
          transport.open();

          const expectedPongTimes: number[] = [];
          for (const ev of events) {
            if (ev.kind === "ping") {
              expectedPongTimes.push(ev.time);
              transport.receive({ type: "ping", time: ev.time });
            } else {
              transport.receive({ type: "status", state: "connected", time: ev.time });
            }
          }

          const pongs = transport
            .sentMessages()
            .filter((m): m is { type: "pong"; time: number } => m.type === "pong");
          expect(pongs.map((p) => p.time)).toEqual(expectedPongTimes);
        }),
      );
    },
  );
});
