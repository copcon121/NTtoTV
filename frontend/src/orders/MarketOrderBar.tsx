import { useEffect, useRef, useState } from "react";

import type { Mt5Account } from "../api/client";

export interface MarketOrderSettings {
  volumeLots: number;
  slDistanceGc: number;
  tpDistanceGc: number;
  takeProfit1rEnabled: boolean;
  autoSupertrendAfter1rEnabled: boolean;
  sizingMode?: "lots" | "risk";
  /** Amount in account currency, matching balance and the broker's tick value. */
  riskAmount?: number;
}

export interface MarketOrderRow {
  id: string;
  side: "buy" | "sell";
  title: string;
  detail: string;
  pnlText?: string;
  pnlValue?: number;
  action: "close" | "cancel";
  canBreakEven?: boolean;
  breakEvenPending?: boolean;
  close50Pending?: boolean;
  canSupertrendTrail?: boolean;
  supertrendTrailing?: boolean;
  supertrendTrailingPending?: boolean;
  supertrendTrailingTimeframe?: string;
  pending?: boolean;
  volumeLots?: number;
}

export interface MarketOrderBarProps {
  account?: Mt5Account;
  pending?: boolean;
  error?: string;
  variant?: "default" | "drawer";
  drawerOpen?: boolean;
  onDrawerOpenChange?: (open: boolean) => void;
  openOrderCount: number;
  orderRows?: readonly MarketOrderRow[];
  settings: MarketOrderSettings;
  onSettingsChange: (settings: MarketOrderSettings) => void;
  onMarketOrder: (side: "buy" | "sell") => void;
  onOrderRowBreakEven?: (id: string) => void;
  onOrderRowSupertrendTrailing?: (id: string) => void;
  onOrderRowClose?: (id: string) => void;
  onOrderRowClose50Percent?: (id: string, volumeLots: number) => void;
  onOrderRowCancel?: (id: string) => void;
}

function money(value: number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatAccountPnl(
  value: number | null | undefined,
  currency?: string,
  stale?: boolean,
): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  const sign = value > 0 ? "+" : "";
  const absFormatted = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = value < 0 ? "-" : sign;
  const cur = currency?.trim().toUpperCase();
  let text = "";
  if (cur === "USC") {
    text = `${prefix}${absFormatted} USC`;
  } else if (cur === "USD" || cur === "$") {
    text = `${prefix}$${absFormatted}`;
  } else if (cur) {
    text = `${prefix}${absFormatted} ${cur}`;
  } else {
    text = `${prefix}$${absFormatted}`;
  }
  return stale ? `${text} (stale)` : text;
}

export function MarketOrderBar({
  account,
  pending = false,
  error,
  variant = "default",
  drawerOpen = false,
  onDrawerOpenChange,
  openOrderCount,
  orderRows = [],
  settings,
  onSettingsChange,
  onMarketOrder,
  onOrderRowBreakEven,
  onOrderRowSupertrendTrailing,
  onOrderRowClose,
  onOrderRowClose50Percent,
  onOrderRowCancel,
}: MarketOrderBarProps) {
  const orderRowIdsRef = useRef<readonly string[]>([]);
  const connected = account !== undefined && account.connected !== false;
  const balance = money(account?.balance);
  const currency = account?.currency?.trim().toUpperCase();
  const riskLabel = currency === "USD" || currency === "$"
    ? "Risk $"
    : currency ? `Risk ${currency}` : "Risk amount";
  const floatingPnl = account?.floatingPnl;
  const floatingPnlText = formatAccountPnl(
    floatingPnl,
    account?.currency,
    account?.accountStateStale,
  );
  const drawer = variant === "drawer";
  const expanded = !drawer || drawerOpen;
  const sizingMode = settings.sizingMode === "risk" ? "risk" : "lots";
  const riskAmount =
    typeof settings.riskAmount === "number" && Number.isFinite(settings.riskAmount)
      ? settings.riskAmount
      : 100;
  const update = (patch: Partial<MarketOrderSettings>) =>
    onSettingsChange({ ...settings, ...patch });
  const rowsById = new Map(orderRows.map((row) => [row.id, row]));
  const visibleRowIds = new Set(rowsById.keys());
  const stableRowIds = orderRowIdsRef.current.filter((id) => visibleRowIds.has(id));
  const knownRowIds = new Set(stableRowIds);
  for (const row of orderRows) {
    if (knownRowIds.has(row.id)) continue;
    stableRowIds.push(row.id);
    knownRowIds.add(row.id);
  }
  orderRowIdsRef.current = stableRowIds;
  const stableOrderRows = stableRowIds.flatMap((id) => {
    const row = rowsById.get(id);
    return row === undefined ? [] : [row];
  });
  return (
    <section
      className={`market-order-bar${
        drawer ? ` market-order-drawer ${drawerOpen ? "is-open" : "is-closed"}` : ""
      }`}
      aria-label="Market orders"
    >
      {drawer && (
        <button
          type="button"
          className="market-order-drawer-toggle"
          aria-expanded={drawerOpen}
          onClick={() => onDrawerOpenChange?.(!drawerOpen)}
        >
          {drawerOpen ? "Hide trade" : `Trade${openOrderCount > 0 ? ` (${openOrderCount})` : ""}`}
        </button>
      )}
      {expanded && (
        <>
          <div className={`market-order-main${stableOrderRows.length > 0 ? " has-order-rows" : ""}`}>
            <div className="market-order-meta">
              <span className={`account-badge ${account?.tradeMode === "live" ? "live" : "demo"}`}>
                {account ? account.tradeMode.toUpperCase() : "NO ACCOUNT"}
              </span>
              {!account && <span>Trading locked</span>}
              {balance && <span>Bal {balance}{currency ? ` ${currency}` : ""}</span>}
              {floatingPnlText && (
                <span
                  className={`account-floating-pnl${
                    (floatingPnl ?? 0) < 0 ? " losing" : " winning"
                  }${account?.accountStateStale ? " is-stale" : ""}`}
                  title={account?.accountStateStale ? "Account metrics may be stale" : undefined}
                >
                  PnL {floatingPnlText}
                </span>
              )}
              <label className="market-order-size-control">
                <span>Size</span>
                <select
                  aria-label="Sizing mode"
                  value={sizingMode}
                  onChange={(event) =>
                    update({
                      sizingMode: event.currentTarget.value === "risk" ? "risk" : "lots",
                    })
                  }
                >
                  <option value="lots">Lots</option>
                  <option value="risk">{riskLabel}</option>
                </select>
              </label>
              {error && <span className="market-order-error">{error}</span>}
            </div>
            <div className="market-order-settings" aria-label="Market order settings">
              <label title={sizingMode === "risk"
                ? "So tien rui ro tai SL, theo don vi tien te tai khoan. USC la cent: 100 USC = 1 USD."
                : undefined}>
                <span>{sizingMode === "risk" ? riskLabel : "Lots"}</span>
                <NumberSettingInput
                  value={sizingMode === "risk" ? riskAmount : settings.volumeLots}
                  min={sizingMode === "risk" ? 1 : 0.01}
                  step={sizingMode === "risk" ? "1" : "0.01"}
                  onCommit={(value) =>
                    sizingMode === "risk"
                      ? update({ riskAmount: value })
                      : update({ volumeLots: value })
                  }
                />
              </label>
              <label>
                <span>SL</span>
                <NumberSettingInput
                  value={settings.slDistanceGc}
                  min={0.1}
                  step="0.1"
                  onCommit={(slDistanceGc) => update({ slDistanceGc })}
                />
              </label>
              <label>
                <span>TP</span>
                <NumberSettingInput
                  value={settings.tpDistanceGc}
                  min={0.1}
                  step="0.1"
                  onCommit={(tpDistanceGc) => update({ tpDistanceGc })}
                />
              </label>
              <label
                className={
                  settings.takeProfit1rEnabled
                    ? "auto-trade-toggle active take-profit-1r"
                    : "auto-trade-toggle take-profit-1r"
                }
                title="Close 50% once a new Market or Limit order reaches +1R"
              >
                <input
                  type="checkbox"
                  checked={settings.takeProfit1rEnabled}
                  aria-label="Take profit 50% at 1R"
                  onChange={(event) =>
                    update({ takeProfit1rEnabled: event.currentTarget.checked })
                  }
                />
                <span>50% @ 1R</span>
              </label>
              <label
                className={
                  settings.autoSupertrendAfter1rEnabled
                    ? "auto-trade-toggle active supertrend-after-1r"
                    : "auto-trade-toggle supertrend-after-1r"
                }
                title="After the 1R partial close, trail the remainder with the current SuperTrend settings"
              >
                <input
                  type="checkbox"
                  checked={settings.autoSupertrendAfter1rEnabled}
                  disabled={!settings.takeProfit1rEnabled}
                  aria-label="Auto SuperTrend trailing after 1R"
                  onChange={(event) =>
                    update({
                      autoSupertrendAfter1rEnabled: event.currentTarget.checked,
                    })
                  }
                />
                <span>ST @ 1R</span>
              </label>
            </div>
            <div className="market-order-actions">
              {connected ? (
                <>
                  <button
                    type="button"
                    className="market-button sell"
                    disabled={pending}
                    onClick={() => onMarketOrder("sell")}
                  >
                    SELL
                  </button>
                  <button
                    type="button"
                    className="market-button buy"
                    disabled={pending}
                    onClick={() => onMarketOrder("buy")}
                  >
                    BUY
                  </button>
                </>
              ) : null}
            </div>
            {stableOrderRows.length > 0 && (
              <div className="market-order-rows" aria-label="Open order controls">
                {stableOrderRows.map((row) => (
                  <div key={row.id} className={`market-order-row ${row.side}`}>
                    <span className="market-order-row-title">{row.title}</span>
                    <span className="market-order-row-detail">{row.detail}</span>
                    {row.pnlText && (
                      <span
                        className={`market-order-row-pnl${
                          (row.pnlValue ?? 0) < 0 ? " losing" : " winning"
                        }`}
                      >
                        {row.pnlText}
                      </span>
                    )}
                    <span className="market-order-row-actions">
                      {row.canBreakEven && (
                        <button
                          type="button"
                          className="market-order-row-break-even"
                          disabled={
                            row.pending ||
                            row.breakEvenPending ||
                            row.close50Pending ||
                            row.supertrendTrailingPending
                          }
                          onClick={() => onOrderRowBreakEven?.(row.id)}
                        >
                          {row.breakEvenPending ? "..." : "BE"}
                        </button>
                      )}
                      {row.canSupertrendTrail && (
                        <button
                          type="button"
                          className={`market-order-row-trailing${
                            row.supertrendTrailing ? " active" : ""
                          }`}
                          disabled={
                            row.pending ||
                            row.breakEvenPending ||
                            row.close50Pending ||
                            row.supertrendTrailingPending
                          }
                          aria-pressed={row.supertrendTrailing === true}
                          title={
                            row.supertrendTrailing
                              ? `SuperTrend trailing active (${row.supertrendTrailingTimeframe ?? "chart"}); click to disable`
                              : "Follow the current SuperTrend and close only after the bar crosses it"
                          }
                          onClick={() => onOrderRowSupertrendTrailing?.(row.id)}
                        >
                          {row.supertrendTrailingPending ? "..." : "Trailing"}
                        </button>
                      )}
                      {row.action === "close" && row.volumeLots !== undefined && row.volumeLots >= 0.02 && (
                        <button
                          type="button"
                          className="market-order-row-close-50"
                          disabled={
                            row.pending ||
                            row.breakEvenPending ||
                            row.close50Pending ||
                            row.supertrendTrailingPending
                          }
                          onClick={() => onOrderRowClose50Percent?.(row.id, row.volumeLots!)}
                        >
                          {row.close50Pending ? "..." : "50%"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={
                          row.pending ||
                          row.breakEvenPending ||
                          row.close50Pending ||
                          row.supertrendTrailingPending
                        }
                        onClick={() =>
                          row.action === "close"
                            ? onOrderRowClose?.(row.id)
                            : onOrderRowCancel?.(row.id)
                        }
                      >
                        {row.pending ? "..." : row.action === "close" ? "Close" : "Cancel"}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function NumberSettingInput({
  value,
  min,
  step,
  onCommit,
}: {
  value: number;
  min: number;
  step: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [focused, value]);

  const commit = () => {
    const parsed = parseDecimalDraft(draft);
    if (parsed === undefined) {
      setDraft(String(value));
      return;
    }
    const next = Math.max(min, parsed);
    setDraft(String(next));
    onCommit(next);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      pattern="[0-9]*([.,][0-9]*)?"
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      min={min}
      step={step}
    />
  );
}

function parseDecimalDraft(draft: string): number | undefined {
  const normalized = draft.trim().replace(",", ".");
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}
