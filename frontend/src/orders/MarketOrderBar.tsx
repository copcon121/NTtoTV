import { useEffect, useState } from "react";

import type { Mt5Account } from "../api/client";

export interface MarketOrderSettings {
  volumeLots: number;
  slDistanceGc: number;
  tpDistanceGc: number;
}

export interface MarketOrderBarProps {
  account?: Mt5Account;
  pending?: boolean;
  error?: string;
  openOrderCount: number;
  settings: MarketOrderSettings;
  onSettingsChange: (settings: MarketOrderSettings) => void;
  onMarketOrder: (side: "buy" | "sell") => void;
}

function money(value: number | undefined, currency: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}${currency ? ` ${currency}` : ""}`;
}

export function MarketOrderBar({
  account,
  pending = false,
  error,
  openOrderCount,
  settings,
  onSettingsChange,
  onMarketOrder,
}: MarketOrderBarProps) {
  const connected = account !== undefined;
  const balance = money(account?.balance, account?.currency);
  const equity = money(account?.equity, account?.currency);
  const update = (patch: Partial<MarketOrderSettings>) =>
    onSettingsChange({ ...settings, ...patch });
  return (
    <section className="market-order-bar" aria-label="Market orders">
      <div className="market-order-meta">
        <span className={`account-badge ${account?.tradeMode === "live" ? "live" : "demo"}`}>
          {account ? account.tradeMode.toUpperCase() : "NO ACCOUNT"}
        </span>
        <span>{account ? `${account.server} ${account.login}` : "Trading locked"}</span>
        {balance && <span>Balance {balance}</span>}
        {equity && <span>Equity {equity}</span>}
        <span>{openOrderCount} open</span>
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
