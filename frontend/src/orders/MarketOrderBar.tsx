import { useEffect, useState } from "react";

import type { AutoTradeSettings, Mt5Account } from "../api/client";

export interface MarketOrderSettings {
  volumeLots: number;
  slDistanceGc: number;
  tpDistanceGc: number;
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
  autoTradeSettings?: AutoTradeSettings;
  autoTradePending?: boolean;
  onAutoTradeSettingsChange?: (settings: AutoTradeSettings) => void;
  onOrderRowBreakEven?: (id: string) => void;
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
  autoTradeSettings,
  autoTradePending = false,
  onAutoTradeSettingsChange,
  onOrderRowBreakEven,
  onOrderRowClose,
  onOrderRowClose50Percent,
  onOrderRowCancel,
}: MarketOrderBarProps) {
  const connected = account !== undefined;
  const balance = money(account?.balance);
  const equity = money(account?.equity);
  const drawer = variant === "drawer";
  const expanded = !drawer || drawerOpen;
  const update = (patch: Partial<MarketOrderSettings>) =>
    onSettingsChange({ ...settings, ...patch });
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
          <div className="market-order-main">
            <div className="market-order-meta">
              <span className={`account-badge ${account?.tradeMode === "live" ? "live" : "demo"}`}>
                {account ? account.tradeMode.toUpperCase() : "NO ACCOUNT"}
              </span>
              <span>{account ? `#${account.login}` : "Trading locked"}</span>
              {balance && <span>Bal {balance}</span>}
              {equity && <span>Eq {equity}</span>}
              <span>Open {openOrderCount}</span>
              {error && <span className="market-order-error">{error}</span>}
            </div>
            <div className="market-order-settings" aria-label="Market order settings">
              <label>
                <span>Lots</span>
                <NumberSettingInput
                  value={settings.volumeLots}
                  min={0.01}
                  step="0.01"
                  onCommit={(volumeLots) => update({ volumeLots })}
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
              {connected && autoTradeSettings && onAutoTradeSettingsChange && (
                <span className="auto-trade-controls" aria-label="Automatic mGann trading">
                  <label className={autoTradeSettings.longEnabled ? "auto-trade-toggle active long" : "auto-trade-toggle long"}>
                    <input
                      type="checkbox"
                      checked={autoTradeSettings.longEnabled}
                      disabled={autoTradePending}
                      aria-label="Auto trade L"
                      onChange={(event) =>
                        onAutoTradeSettingsChange({
                          ...autoTradeSettings,
                          longEnabled: event.currentTarget.checked,
                        })
                      }
                    />
                    <span>Auto L</span>
                  </label>
                  <label className={autoTradeSettings.shortEnabled ? "auto-trade-toggle active short" : "auto-trade-toggle short"}>
                    <input
                      type="checkbox"
                      checked={autoTradeSettings.shortEnabled}
                      disabled={autoTradePending}
                      aria-label="Auto trade S"
                      onChange={(event) =>
                        onAutoTradeSettingsChange({
                          ...autoTradeSettings,
                          shortEnabled: event.currentTarget.checked,
                        })
                      }
                    />
                    <span>Auto S</span>
                  </label>
                  <span className="auto-trade-detail">BOS/CHoCH · Body x2-x8 · &gt;4.0: Lmt70 · TP 3R / EMA21 @1R</span>
                </span>
              )}
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
          </div>
          {orderRows.length > 0 && (
            <div className="market-order-rows" aria-label="Open order controls">
              {orderRows.map((row) => (
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
                        disabled={row.pending || row.breakEvenPending}
                        onClick={() => onOrderRowBreakEven?.(row.id)}
                      >
                        {row.breakEvenPending ? "..." : "BE"}
                      </button>
                    )}
                    {row.action === "close" && row.volumeLots !== undefined && row.volumeLots >= 0.02 && (
                      <button
                        type="button"
                        className="market-order-row-close-50"
                        disabled={row.pending || row.breakEvenPending}
                        onClick={() => onOrderRowClose50Percent?.(row.id, row.volumeLots!)}
                      >
                        50%
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={row.pending}
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
