import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor, cleanup, within } from "@testing-library/react";
import type { Mt5Symbol, Mt5Account, ExnessExecutionState } from "../api/client";
import {
  calculateRiskBasedLots,
  resolveOrderVolumeLots,
  buildChartLimitOrderDraft,
  LiveApp,
} from "../LiveApp";
import { MarketOrderBar, type MarketOrderSettings } from "./MarketOrderBar";

vi.mock("../chart/ChartContainer", () => ({
  ChartContainer: ({ children }: any) => <div data-testid="chart-container">{children}</div>,
}));

const standardSymbol: Mt5Symbol = {
  symbol: "XAUUSD",
  digits: 2,
  tickSize: 0.01,
  pipValue: 1, // $1.00 USD per 0.01 tick per standard lot
  minLot: 0.01,
  maxLot: 100,
  lotStep: 0.01,
  stopsLevel: 0,
};

const centSymbol1LotContract: Mt5Symbol = {
  symbol: "XAUUSDm",
  digits: 2,
  tickSize: 0.01,
  pipValue: 1, // 1 USC per 0.01 tick per 1-oz cent lot
  minLot: 0.01,
  maxLot: 100,
  lotStep: 0.01,
  stopsLevel: 0,
};

const centSymbol100LotContract: Mt5Symbol = {
  symbol: "XAUUSDc",
  digits: 2,
  tickSize: 0.01,
  pipValue: 100, // 100 USC per 0.01 tick per 100-oz lot
  minLot: 0.01,
  maxLot: 100,
  lotStep: 0.01,
  stopsLevel: 0,
};

const dummyAccountUSD: Mt5Account = {
  accountId: "acc-usd-1",
  login: 11111,
  server: "Exness-Real",
  tradeMode: "real",
  currency: "USD",
  balance: 5000,
  equity: 5000,
  connected: true,
};

const dummyAccountUSC: Mt5Account = {
  accountId: "acc-usc-2",
  login: 22222,
  server: "Exness-Real",
  tradeMode: "real",
  currency: "USC",
  balance: 500000,
  equity: 500000,
  connected: true,
};

describe("Risk-based lot sizing arithmetic (calculateRiskBasedLots)", () => {
  it("sizes Risk 30 USD with SL 5 to exactly 0.06 standard lots", () => {
    const lots = calculateRiskBasedLots({
      riskAmount: 30,
      entryGc: 0,
      stopGc: 5,
      symbol: standardSymbol,
    });
    expect(lots).toBe(0.06);
  });

  it("returns undefined when symbol metadata is missing or pipValue is 0", () => {
    expect(
      calculateRiskBasedLots({
        riskAmount: 30,
        entryGc: 0,
        stopGc: 5,
        symbol: undefined,
      })
    ).toBeUndefined();

    expect(
      calculateRiskBasedLots({
        riskAmount: 30,
        entryGc: 0,
        stopGc: 5,
        symbol: { ...standardSymbol, pipValue: 0 },
      })
    ).toBeUndefined();
  });

  it("returns undefined for invalid stop distance (stopGc == entryGc or negative)", () => {
    expect(
      calculateRiskBasedLots({
        riskAmount: 30,
        entryGc: 2500,
        stopGc: 2500,
        symbol: standardSymbol,
      })
    ).toBeUndefined();
  });

  it("uses USC risk directly with tick values already denominated in USC", () => {
    const lotsCent1 = calculateRiskBasedLots({
      riskAmount: 30,
      entryGc: 0,
      stopGc: 5,
      symbol: centSymbol1LotContract,
      accountCurrency: "USC",
    });
    expect(lotsCent1).toBe(0.06);

    const lotsCent100 = calculateRiskBasedLots({
      riskAmount: 30,
      entryGc: 0,
      stopGc: 5,
      symbol: centSymbol100LotContract,
      accountCurrency: "USC",
    });
    expect(lotsCent100).toBeUndefined(); // Minimum lot would risk 500 USC, above 30 USC.
    expect(calculateRiskBasedLots({
      riskAmount: 3000,
      entryGc: 0,
      stopGc: 5,
      symbol: centSymbol100LotContract,
      accountCurrency: "USC",
    })).toBe(0.06);
  });

  it("reproduces the reported cent-account metadata: Risk 10 USC, SL 5 -> 0.02 lots", () => {
    const symbol = { ...centSymbol1LotContract, digits: 3, tickSize: 0.001, pipValue: 0.1 };
    const lots = calculateRiskBasedLots({
      riskAmount: 10,
      entryGc: 3629.2,
      stopGc: 3624.2,
      symbol,
      accountCurrency: "USC",
    });
    expect(lots).toBe(0.02);
    expect(lots! * (5 / symbol.tickSize) * symbol.pipValue).toBe(10);
  });

  it("floors raw lots to the broker lotStep and respects minLot and maxLot bounds", () => {
    const stepped = calculateRiskBasedLots({
      riskAmount: 33,
      entryGc: 0,
      stopGc: 5,
      symbol: standardSymbol,
    });
    expect(stepped).toBe(0.06);

    const belowMin = calculateRiskBasedLots({
      riskAmount: 2,
      entryGc: 0,
      stopGc: 5,
      symbol: standardSymbol,
    });
    expect(belowMin).toBeUndefined();

    const aboveMax = calculateRiskBasedLots({
      riskAmount: 100_000,
      entryGc: 0,
      stopGc: 5,
      symbol: standardSymbol,
    });
    expect(aboveMax).toBe(100);
  });
});

describe("resolveOrderVolumeLots and buildChartLimitOrderDraft menu sizing", () => {
  it("resolves fixed lots in 'lots' mode without requiring symbol", () => {
    const settings: MarketOrderSettings = {
      volumeLots: 0.15,
      slDistanceGc: 5,
      tpDistanceGc: 15,
      takeProfit1rEnabled: false,
      autoSupertrendAfter1rEnabled: false,
      sizingMode: "lots",
    };
    expect(
      resolveOrderVolumeLots({
        settings,
        entryGc: 0,
        slGc: 5,
        symbol: undefined,
      })
    ).toBe(0.15);
  });

  it("resolves risk-based lots in 'risk' mode when symbol is present", () => {
    const settings: MarketOrderSettings = {
      volumeLots: 0.1,
      slDistanceGc: 5,
      tpDistanceGc: 15,
      takeProfit1rEnabled: false,
      autoSupertrendAfter1rEnabled: false,
      sizingMode: "risk",
      riskAmount: 30,
    };
    expect(
      resolveOrderVolumeLots({
        settings,
        entryGc: 0,
        slGc: 5,
        symbol: standardSymbol,
      })
    ).toBe(0.06);
  });

  it("builds chart limit order drafts using risk in each account's currency", () => {
    const settings: MarketOrderSettings = {
      volumeLots: 0.1,
      slDistanceGc: 5,
      tpDistanceGc: 15,
      takeProfit1rEnabled: false,
      autoSupertrendAfter1rEnabled: false,
      sizingMode: "risk",
      riskAmount: 30,
    };

    const draftUSD = buildChartLimitOrderDraft({
      entryPrice: 2500,
      referencePrice: 2510,
      settings,
      symbol: standardSymbol,
      accountCurrency: "USD",
    });
    expect(draftUSD?.volumeLots).toBe(0.06);

    const draftUSC1 = buildChartLimitOrderDraft({
      entryPrice: 2500,
      referencePrice: 2510,
      settings,
      symbol: centSymbol1LotContract,
      accountCurrency: "USC",
    });
    expect(draftUSC1?.volumeLots).toBe(0.06);
  });

  it.each([3619.2, 3639.2])("uses the same cent risk for a chart limit at %s", (entryPrice) => {
    const draft = buildChartLimitOrderDraft({
      entryPrice,
      referencePrice: 3629.2,
      settings: {
        volumeLots: 0.1, slDistanceGc: 5, tpDistanceGc: 15,
        takeProfit1rEnabled: false, autoSupertrendAfter1rEnabled: false,
        sizingMode: "risk", riskAmount: 10,
      },
      symbol: { ...centSymbol1LotContract, digits: 3, tickSize: 0.001, pipValue: 0.1 },
      accountCurrency: "USC",
    });
    expect(draft?.volumeLots).toBe(0.02);
  });
});

describe("MarketOrderBar UI mode switching and error recovery", () => {
  it("switches between Lots and Risk $ and clears error when settings change", () => {
    const onSettingsChange = vi.fn();
    const settings: MarketOrderSettings = {
      volumeLots: 0.1,
      slDistanceGc: 5,
      tpDistanceGc: 15,
      takeProfit1rEnabled: false,
      autoSupertrendAfter1rEnabled: false,
      sizingMode: "lots",
    };

    const { rerender } = render(
      <MarketOrderBar
        account={dummyAccountUSD}
        openOrderCount={0}
        settings={settings}
        error="Risk sizing needs Exness instrument data and a valid stop distance."
        onSettingsChange={onSettingsChange}
        onMarketOrder={vi.fn()}
      />
    );

    expect(
      screen.getByText("Risk sizing needs Exness instrument data and a valid stop distance.")
    ).toBeInTheDocument();

    const modeSelect = screen.getByRole("combobox", { name: "Sizing mode" });
    fireEvent.change(modeSelect, { target: { value: "risk" } });
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ sizingMode: "risk" })
    );

    rerender(
      <MarketOrderBar
        account={dummyAccountUSD}
        openOrderCount={0}
        settings={{ ...settings, sizingMode: "risk", riskAmount: 30 }}
        error={undefined}
        onSettingsChange={onSettingsChange}
        onMarketOrder={vi.fn()}
      />
    );

    expect(
      screen.queryByText("Risk sizing needs Exness instrument data and a valid stop distance.")
    ).not.toBeInTheDocument();
  });
});

describe("LiveApp deferred metadata, account-switch epoch, and duplicate click lifecycle", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const setupLiveApp = (overrides?: {
    initialAccount?: Mt5Account;
    connectedAccount?: Mt5Account;
    initialSettings?: MarketOrderSettings;
    symbolResolver?: () => Promise<Mt5Symbol>;
    orderCreator?: (body: any) => Promise<any>;
  }) => {
    localStorage.clear();
    const defaultWorkspace = {
      id: "ws-1",
      name: "Main",
      createdAt: 1,
      updatedAt: 1,
      payload: {
        version: 1,
        template: "scratch",
        useChartProfile: false,
        tradingAccountInitialized: true,
        panels: [
          { id: "main-chart", type: "chart", timeframe: "1m", drawings: [] },
          { id: "trading-account", type: "tradingAccount" },
        ],
        layout: {},
        theme: {},
      },
    };

    localStorage.setItem("gc.workspace.user-1.v1", JSON.stringify([defaultWorkspace]));
    localStorage.setItem("gc.workspace.guest.v1", JSON.stringify([defaultWorkspace]));
    const testSettings = overrides?.initialSettings ?? {
      volumeLots: 0.1,
      slDistanceGc: 5,
      tpDistanceGc: 15,
      takeProfit1rEnabled: false,
      autoSupertrendAfter1rEnabled: false,
      sizingMode: "risk" as const,
      riskAmount: 30,
    };

    localStorage.setItem("gc-chart-platform.market-order-settings", JSON.stringify(testSettings));
    localStorage.setItem("gc.marketOrderSettings", JSON.stringify(testSettings));

    const user = { id: "user-1", username: "trader" };
    let currentAccount: Mt5Account | undefined = overrides?.initialAccount ?? dummyAccountUSD;

    const mockFetch = vi.fn((url: string, init?: RequestInit) => {
      if (url === "/api/auth/me") {
        return Promise.resolve(Response.json({ user }));
      }
      if (url === "/api/auth/logout") {
        return Promise.resolve(Response.json({ ok: true }));
      }
      if (url === "/api/auth/login") {
        return Promise.resolve(Response.json({ user }));
      }
      if (url === "/api/execution") {
        return Promise.resolve(Response.json({ enabled: true }));
      }
      if (url === "/api/execution/status") {
        return Promise.resolve(
          Response.json({
            connected: currentAccount?.connected ?? false,
            account: currentAccount ?? null,
          })
        );
      }
      if (url === "/api/execution/state") {
        const state: ExnessExecutionState = {
          account: currentAccount ?? null,
          orders: [],
          trades: { positions: [], orders: [] },
          trailings: [],
        };
        return Promise.resolve(Response.json(state));
      }
      if (url === "/api/execution/connect") {
        currentAccount = { ...(overrides?.connectedAccount ?? dummyAccountUSD), connected: true };
        return Promise.resolve(Response.json({ account: currentAccount }));
      }
      if (url === "/api/execution/symbol") {
        if (overrides?.symbolResolver) {
          return overrides.symbolResolver().then((s) => Response.json({ symbol: s }));
        }
        return Promise.resolve(Response.json({ symbol: standardSymbol }));
      }
      if (url === "/api/orders") {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        if (overrides?.orderCreator) {
          return overrides.orderCreator(body).then((res) => Response.json({ order: res }));
        }
        return Promise.resolve(
          Response.json({ order: { id: "order-123", status: "open", volumeLots: body.volumeLots } })
        );
      }
      if (url === "/api/profiles/me" || url === "/api/me/profile") {
        return Promise.resolve(
          Response.json({
            profile: {
              id: "default",
              name: "default",
              payload: {
                version: 1,
                timeframe: "1m",
                chartBackgroundColor: "#101010",
                showFootprint: false,
                showBigTrades: false,
                drawings: [],
                marketOrderSettings: testSettings,
              },
              createdAt: 1,
              updatedAt: 1,
            },
          })
        );
      }
      if (url === "/api/workspaces") {
        return Promise.resolve(Response.json({ workspaces: [defaultWorkspace] }));
      }
      if (url.startsWith("/api/history")) {
        return Promise.resolve(Response.json({ bars: [] }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });

    vi.stubGlobal("fetch", mockFetch);

    return {
      setAccount: (acc: Mt5Account | undefined) => {
        currentAccount = acc;
      },
      mockFetch,
    };
  };

  it.each(["BUY", "SELL"])("submits %s with 0.02 lots for Risk 10 USC and SL 5", async (side) => {
    const createOrderMock = vi.fn().mockResolvedValue({ id: "cent-order", status: "pending" });
    setupLiveApp({
      initialAccount: { ...dummyAccountUSC, balance: 209.80, equity: 209.80 },
      initialSettings: {
        volumeLots: 0.05, slDistanceGc: 5, tpDistanceGc: 15,
        takeProfit1rEnabled: false, autoSupertrendAfter1rEnabled: false,
        sizingMode: "risk", riskAmount: 10,
      },
      symbolResolver: () => Promise.resolve({
        ...centSymbol1LotContract, digits: 3, tickSize: 0.001, pipValue: 0.1,
      }),
      orderCreator: createOrderMock,
    });
    render(<LiveApp />);
    expect(await screen.findByLabelText("Risk USC")).toHaveValue("10");
    fireEvent.click(await screen.findByRole("button", { name: side }));
    await waitFor(() => expect(createOrderMock).toHaveBeenCalledTimes(1));
    expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({
      side: side.toLowerCase(), kind: "market", volumeLots: 0.02,
      slDistanceGc: 5, tpDistanceGc: 15,
    }));
  });

  it("synchronously blocks duplicate clicks before async/commit completes", async () => {
    let orderResolve: ((val: any) => void) | undefined;
    const orderPromise = new Promise((resolve) => {
      orderResolve = resolve;
    });

    const createOrderMock = vi.fn().mockImplementation(() => orderPromise);

    setupLiveApp({
      orderCreator: createOrderMock,
    });

    render(<LiveApp />);

    const buyButton = await screen.findByRole("button", { name: "BUY" });

    // Invoke two clicks in a single synchronous act/event turn to test orderSubmittingRef guard
    // before React commits any re-renders or updates the DOM disabled property.
    act(() => {
      fireEvent.click(buyButton);
      fireEvent.click(buyButton);
    });

    // Guard must reject the second click synchronously, resulting in exactly one API call
    expect(createOrderMock).toHaveBeenCalledTimes(1);
    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        volumeLots: 0.06,
      })
    );
    expect(buyButton).toBeDisabled();

    // Resolve in-flight order
    await act(async () => {
      orderResolve?.({ id: "ord-1", status: "open", volumeLots: 0.06 });
    });

    // finally block resets pending state and re-enables buttons
    await waitFor(() => {
      expect(buyButton).not.toBeDisabled();
    });
  });

  it("same-account refresh during pending submission preserves pending state and enables buttons on completion", async () => {
    let orderResolve: ((val: any) => void) | undefined;
    const orderPromise = new Promise((resolve) => {
      orderResolve = resolve;
    });

    const createOrderMock = vi.fn().mockImplementation(() => orderPromise);

    let symbolCalls = 0;
    let resolveBackgroundSymbol: ((s: Mt5Symbol) => void) | undefined;
    const symbolResolver = vi.fn().mockImplementation(() => {
      symbolCalls++;
      if (symbolCalls === 1) {
        // Initial mount returns symbol with pipValue 0 (missing metadata)
        return Promise.resolve({ ...standardSymbol, pipValue: 0 });
      }
      // Background refresh while order pending returns valid symbol
      return new Promise<Mt5Symbol>((resolve) => {
        resolveBackgroundSymbol = resolve;
      });
    });

    const { mockFetch } = setupLiveApp({
      initialSettings: {
        volumeLots: 0.1,
        slDistanceGc: 5,
        tpDistanceGc: 15,
        takeProfit1rEnabled: false,
        autoSupertrendAfter1rEnabled: false,
        sizingMode: "lots",
        riskAmount: 30,
      },
      symbolResolver,
      orderCreator: createOrderMock,
    });

    render(<LiveApp />);

    const buyButton = await screen.findByRole("button", { name: "BUY" });

    // Wait for initial startup execution-state and symbol calls to finish
    await waitFor(() => {
      expect(symbolCalls).toBeGreaterThanOrEqual(1);
    });
    const stateCallsBeforeBuy = mockFetch.mock.calls.filter((call) => call[0] === "/api/execution/state").length;

    // Click BUY to start submission with initial Lots sizing (0.1 lots)
    await act(async () => {
      fireEvent.click(buyButton);
    });

    expect(createOrderMock).toHaveBeenCalledTimes(1);
    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        volumeLots: 0.1,
      })
    );
    expect(buyButton).toBeDisabled();

    // While createOrder remains deferred in-flight, wait for background refresh
    // to trigger both /api/execution/state and /api/execution/symbol (due to pipValue <= 0)
    await waitFor(() => {
      const currentCalls = mockFetch.mock.calls.filter((call) => call[0] === "/api/execution/state").length;
      expect(currentCalls).toBeGreaterThan(stateCallsBeforeBuy);
      expect(symbolCalls).toBeGreaterThanOrEqual(2);
    });

    // Settle the background symbol metadata refresh while the order is still pending
    await act(async () => {
      resolveBackgroundSymbol?.(standardSymbol);
    });

    // Button remains safely disabled while submission is pending despite background state and symbol refresh
    expect(buyButton).toBeDisabled();

    // Complete the pending order submission
    await act(async () => {
      orderResolve?.({ id: "ord-same-1", status: "open", volumeLots: 0.1 });
    });

    // finally block executes and resets orderPending because account identity was unchanged
    await waitFor(() => {
      expect(buyButton).not.toBeDisabled();
    });

    // Switch to Risk sizing mode and verify subsequent order placement uses the refreshed symbol
    const modeSelect = screen.getByRole("combobox", { name: "Sizing mode" });
    fireEvent.change(modeSelect, { target: { value: "risk" } });

    await act(async () => {
      fireEvent.click(buyButton);
    });

    await waitFor(() => {
      expect(createOrderMock).toHaveBeenCalledTimes(2);
      expect(createOrderMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          volumeLots: 0.06,
        })
      );
    });
  });

  it("recovers from failed initial symbol fetch on subsequent refresh", async () => {
    let callCount = 0;
    const symbolResolver = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("Network timeout on symbol"));
      }
      return Promise.resolve(standardSymbol);
    });

    const createOrderMock = vi.fn().mockResolvedValue({ id: "ord-2", status: "open", volumeLots: 0.06 });

    setupLiveApp({
      symbolResolver,
      orderCreator: createOrderMock,
    });

    render(<LiveApp />);

    const buyButton = await screen.findByRole("button", { name: "BUY" });

    // Initial symbol load failed, but clicking BUY triggers on-demand fetch
    await act(async () => {
      fireEvent.click(buyButton);
    });

    await waitFor(() => {
      expect(createOrderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          volumeLots: 0.06,
        })
      );
    });
  });

  it("rejects stale metadata response and handles deferred old order outcome across A -> B -> A account switch", async () => {
    let resolveSymbolA1: ((s: Mt5Symbol) => void) | undefined;
    const promiseSymbolA1 = new Promise<Mt5Symbol>((resolve) => {
      resolveSymbolA1 = resolve;
    });

    let rejectOrderA1: ((err: Error) => void) | undefined;
    const promiseOrderA1 = new Promise((_resolve, reject) => {
      rejectOrderA1 = reject;
    });

    let resolveOrderA2: ((val: any) => void) | undefined;
    const promiseOrderA2 = new Promise((resolve) => {
      resolveOrderA2 = resolve;
    });

    let symbolCallCount = 0;
    const symbolResolver = vi.fn().mockImplementation(() => {
      symbolCallCount++;
      if (symbolCallCount === 1) {
        // Initial Account A call: returns Standard symbol
        return Promise.resolve(standardSymbol);
      }
      if (symbolCallCount === 2) {
        // Stale/deferred symbol fetch: deferred via promiseSymbolA1
        return promiseSymbolA1;
      }
      if (symbolCallCount === 3) {
        // Account B call: returns Cent symbol
        return Promise.resolve(centSymbol1LotContract);
      }
      // Subsequent Account A call: returns Standard symbol
      return Promise.resolve(standardSymbol);
    });

    let orderCallCount = 0;
    const createOrderMock = vi.fn().mockImplementation(() => {
      orderCallCount++;
      if (orderCallCount === 1) {
        // Order A1: deferred
        return promiseOrderA1;
      }
      if (orderCallCount === 2) {
        // Order B: immediate
        return Promise.resolve({ id: "ord-b", status: "open", volumeLots: 0.06 });
      }
      // Order A2: deferred
      return promiseOrderA2;
    });

    const { setAccount, mockFetch } = setupLiveApp({
      symbolResolver,
      orderCreator: createOrderMock,
    });

    render(<LiveApp />);

    // Account A is initially connected (login 11111)
    const buyButtonA = await screen.findByRole("button", { name: "BUY" });
    await screen.findByText(/11111/);

    // 1. Submit Order A1 on Account A (deferred in-flight)
    await act(async () => {
      fireEvent.click(buyButtonA);
    });
    expect(createOrderMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        volumeLots: 0.06,
      })
    );
    expect(buyButtonA).toBeDisabled();

    // 2. Switch to Account B (login 22222, USC Cent account)
    await act(async () => {
      setAccount(dummyAccountUSC);
    });
    // Wait for state refresh to observe Account B
    await screen.findByText(/22222/);

    // Account B BUY button is enabled because account switch cleared pending
    const buyButtonB = await screen.findByRole("button", { name: "BUY" });
    expect(buyButtonB).not.toBeDisabled();

    // 3. Place Order B on Account B (30 USC risk / 500 USC per lot = 0.06 lots)
    await act(async () => {
      fireEvent.click(buyButtonB);
    });
    expect(createOrderMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        volumeLots: 0.06,
      })
    );
    // Order B settles immediately and re-enables button
    await waitFor(() => {
      expect(buyButtonB).not.toBeDisabled();
    });

    // 4. Switch back to Account A (login 11111, USD standard account)
    await act(async () => {
      setAccount(dummyAccountUSD);
    });
    // Wait for state refresh to observe Account A again
    await screen.findByText(/11111/);

    // Resolve the old deferred symbol response with a corrupted Cent symbol (pipValue 100)
    await act(async () => {
      resolveSymbolA1?.(centSymbol100LotContract);
    });

    // 5. Submit Order A2 on Account A (deferred in-flight)
    const currentBuyButtonA = await screen.findByRole("button", { name: "BUY" });
    await act(async () => {
      fireEvent.click(currentBuyButtonA);
    });
    expect(createOrderMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        volumeLots: 0.06,
      })
    );
    // Order A2 is held pending: button is disabled and duplicate clicks are blocked
    expect(currentBuyButtonA).toBeDisabled();

    // 6. While Order A2 is pending, reject the old deferred Order A1 from the first session
    const stateCallsBeforeOldRejection = mockFetch.mock.calls.filter((c) => c[0] === "/api/execution/state").length;
    await act(async () => {
      rejectOrderA1?.(new Error("Old order A1 stale network failure"));
    });

    // Stale rejection from prior session must NOT display error on current account
    expect(screen.queryByText(/Old order A1 stale network failure/)).not.toBeInTheDocument();

    // Stale rejection must NOT cause side-effect execution state refresh calls
    const stateCallsAfterOldRejection = mockFetch.mock.calls.filter((c) => c[0] === "/api/execution/state").length;
    expect(stateCallsAfterOldRejection).toBe(stateCallsBeforeOldRejection);

    // Stale Order A1 must NOT release Order A2's pending state or submitting token
    expect(currentBuyButtonA).toBeDisabled();

    // 7. Finally resolve Order A2
    await act(async () => {
      resolveOrderA2?.({ id: "ord-a2", status: "open", volumeLots: 0.06 });
    });

    // Order A2 completes and cleanly re-enables buttons
    await waitFor(() => {
      expect(currentBuyButtonA).not.toBeDisabled();
    });

    // 8. Prove token ownership and clean reset by placing subsequent Order A3
    await act(async () => {
      fireEvent.click(currentBuyButtonA);
    });
    expect(createOrderMock).toHaveBeenCalledTimes(4);
    expect(createOrderMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        volumeLots: 0.06,
      })
    );
  });

  it("safely blocks order and displays warning when symbol has pipValue 0", async () => {
    const createOrderMock = vi.fn();
    setupLiveApp({
      symbolResolver: () => Promise.resolve({ ...standardSymbol, pipValue: 0 }),
      orderCreator: createOrderMock,
    });

    render(<LiveApp />);

    const buyButton = await screen.findByRole("button", { name: "BUY" });
    await act(async () => {
      fireEvent.click(buyButton);
    });

    expect(createOrderMock).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Risk sizing needs Exness instrument data and a valid stop distance.")
    ).toBeInTheDocument();
  });

  it.each([
    { account: dummyAccountUSD, symbol: standardSymbol, risk: 30, label: "Risk $", lots: 0.06 },
    { account: dummyAccountUSC, symbol: { ...centSymbol1LotContract, digits: 3, tickSize: 0.001, pipValue: 0.1 }, risk: 10, label: "Risk USC", lots: 0.02 },
  ])("detects $account.currency after connecting Exness and sizes risk with its instrument data", async ({ account, symbol, risk, label, lots }) => {
    let resolveSymbol: ((s: Mt5Symbol) => void) | undefined;
    const delayedSymbolPromise = new Promise<Mt5Symbol>((resolve) => {
      resolveSymbol = resolve;
    });

    const symbolResolver = vi.fn().mockImplementation(() => delayedSymbolPromise);
    const createOrderMock = vi.fn().mockResolvedValue({ id: "ord-conn", status: "open", volumeLots: lots });

    setupLiveApp({
      initialAccount: { ...dummyAccountUSD, connected: false },
      connectedAccount: account,
      initialSettings: {
        volumeLots: 0.1, slDistanceGc: 5, tpDistanceGc: 15,
        takeProfit1rEnabled: false, autoSupertrendAfter1rEnabled: false,
        sizingMode: "risk", riskAmount: risk,
      },
      symbolResolver,
      orderCreator: createOrderMock,
    });

    render(<LiveApp />);

    // Initially disconnected, "Connect Account" button is shown
    const connectButton = await screen.findByRole("button", { name: "Connect Account" });
    fireEvent.click(connectButton);

    // Dialog opens
    const accountInput = await screen.findByLabelText(/Account ID/i);
    const keyInput = screen.getByLabelText(/API Key/i);
    const secretInput = screen.getByLabelText(/API Secret/i);

    fireEvent.change(accountInput, { target: { value: "11111" } });
    fireEvent.change(keyInput, { target: { value: "valid-key-12345" } });
    fireEvent.change(secretInput, { target: { value: "valid-secret" } });

    const submitButton = screen.getByRole("button", { name: "Connect" });
    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Connect succeeds, account is set, and dialog must close before delayed symbol metadata resolves
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(await screen.findByLabelText(label)).toHaveValue(String(risk));
    expect(screen.getByText(`Bal ${account.balance!.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${account.currency}`)).toBeInTheDocument();

    // Now resolve the delayed metadata promise allowing effects 2348 and 2975 to process
    await act(async () => {
      resolveSymbol?.(symbol);
    });

    // Trading account widget renders with BUY button
    const buyButton = await screen.findByRole("button", { name: "BUY" });
    expect(buyButton).toBeInTheDocument();

    // Verify order placement works with loaded symbol
    await act(async () => {
      fireEvent.click(buyButton);
    });

    await waitFor(() => {
      expect(createOrderMock).toHaveBeenCalledWith(
        expect.objectContaining({
          volumeLots: lots,
        })
      );
    });
  });

  it("clears trading state on logout and safely discards deferred order outcome on reconnect", async () => {
    let rejectOrder1: ((err: Error) => void) | undefined;
    const promiseOrder1 = new Promise((_resolve, reject) => {
      rejectOrder1 = reject;
    });

    let resolveOrder2: ((val: any) => void) | undefined;
    const promiseOrder2 = new Promise((resolve) => {
      resolveOrder2 = resolve;
    });

    let orderCount = 0;
    const createOrderMock = vi.fn().mockImplementation(() => {
      orderCount++;
      if (orderCount === 1) {
        return promiseOrder1;
      }
      return promiseOrder2;
    });

    setupLiveApp({
      orderCreator: createOrderMock,
    });

    render(<LiveApp />);

    // Initially connected with Account A (login 11111)
    const buyButton = await screen.findByRole("button", { name: "BUY" });
    expect(buyButton).toBeInTheDocument();

    // 1. Submit Order 1 that remains deferred in-flight
    await act(async () => {
      fireEvent.click(buyButton);
    });
    expect(createOrderMock).toHaveBeenCalledTimes(1);
    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        volumeLots: 0.06,
      })
    );
    expect(buyButton).toBeDisabled();

    // 2. User logs out while order submission is pending
    const logoutButton = screen.getByRole("button", { name: "Logout" });
    await act(async () => {
      fireEvent.click(logoutButton);
    });

    // Trading controls are replaced with connect/login prompt
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "BUY" })).not.toBeInTheDocument();
      expect(screen.getByText("Login to connect")).toBeInTheDocument();
    });

    // 3. Log back in before resolving Order 1
    const loginButton = screen.getByRole("button", { name: "Login" });
    fireEvent.click(loginButton);

    const usernameInput = await screen.findByLabelText(/Username/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    fireEvent.change(usernameInput, { target: { value: "trader" } });
    fireEvent.change(passwordInput, { target: { value: "secret123" } });

    const authForm = screen.getByRole("form", { name: "Trading account login" });
    const submitAuth = within(authForm).getByRole("button", { name: "Login" });
    await act(async () => {
      fireEvent.click(submitAuth);
    });

    // Reconnected: BUY button is restored and enabled
    const restoredBuyButton = await screen.findByRole("button", { name: "BUY" });
    expect(restoredBuyButton).toBeInTheDocument();
    expect(restoredBuyButton).not.toBeDisabled();

    // 4. Submit Order 2 on reconnected account (held pending)
    await act(async () => {
      fireEvent.click(restoredBuyButton);
    });
    expect(createOrderMock).toHaveBeenCalledTimes(2);
    expect(createOrderMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        volumeLots: 0.06,
      })
    );
    expect(restoredBuyButton).toBeDisabled();

    // 5. While Order 2 is pending, reject old Order 1 from before logout
    await act(async () => {
      rejectOrder1?.(new Error("Pre-logout order network disconnect"));
    });

    // Stale rejection from prior session must NOT display error on reconnected session
    expect(screen.queryByText(/Pre-logout order network disconnect/)).not.toBeInTheDocument();

    // Stale Order 1 must NOT release Order 2's pending state or guard
    expect(restoredBuyButton).toBeDisabled();

    // 6. Finally resolve Order 2
    await act(async () => {
      resolveOrder2?.({ id: "ord-2", status: "open", volumeLots: 0.06 });
    });

    await waitFor(() => {
      expect(restoredBuyButton).not.toBeDisabled();
    });

    // 7. Prove clean token ownership after settlement by placing Order 3
    await act(async () => {
      fireEvent.click(restoredBuyButton);
    });
    expect(createOrderMock).toHaveBeenCalledTimes(3);
    expect(createOrderMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        volumeLots: 0.06,
      })
    );
  });
});
