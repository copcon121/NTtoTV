import { useEffect, useState } from "react";

import type { Mt5Account } from "../api/client";

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
}

export interface MarketOrderBarProps {
  account?: Mt5Account;
  pending?: boolean;
  error?: string;
  openOrderCount: number;
  orderRows?: readonly MarketOrderRow[];
  settings: MarketOrderSettings;
  onSettingsChange: (settings: MarketOrderSettings) => void;
  onMarketOrder: (side: "buy" | "sell") => void;
  onOrderRowBreakEven?: (id: string) => void;
  onOrderRowClose?: (id: string) => void;
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
  openOrderCount,
  orderRows = [],
  settings,
  onSettingsChange,
  onMarketOrder,
  onOrderRowBreakEven,
  onOrderRowClose,
  onOrderRowCancel,
}: MarketOrderBarProps) {
  const connected = account !== undefined;
  const balance = money(account?.balance);
  const equity = money(account?.equity);
  const update = (patch: Partial<MarketOrderSettings>) =>
    onSettingsChange({ ...settings, ...patch });
  return (
    <section className="market-order-bar" aria-label="Market orders">
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
        </div>
        <div className="market-order-actions">
          {connected ? (
            <>
              <button
                type="button"
                className="market-button buy"
                disabled={pending}
                onClick={() => onMarketOrder("buy")}
              >
                BUY
              </button>
              <button
                type="button"
                className="market-button sell"
                disabled={pending}
                onClick={() => onMarketOrder("sell")}
              >
                SELL
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
