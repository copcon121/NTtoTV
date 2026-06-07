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
  onLogin: () => void;
  onConnect: () => void;
  onMarketOrder: (side: "buy" | "sell") => void;
}

function numericValue(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function MarketOrderBar({
  account,
  pending = false,
  error,
  openOrderCount,
  settings,
  onSettingsChange,
  onLogin,
  onConnect,
  onMarketOrder,
}: MarketOrderBarProps) {
  const connected = account !== undefined;
  const update = (patch: Partial<MarketOrderSettings>) =>
    onSettingsChange({ ...settings, ...patch });
  return (
    <section className="market-order-bar" aria-label="Market orders">
      <div className="market-order-meta">
        <span className={`account-badge ${account?.tradeMode === "live" ? "live" : "demo"}`}>
          {account ? account.tradeMode.toUpperCase() : "NO ACCOUNT"}
        </span>
        <span>{account ? `${account.server} ${account.login}` : "Trading locked"}</span>
        <span>{openOrderCount} open</span>
        {error && <span className="market-order-error">{error}</span>}
      </div>
      <div className="market-order-settings" aria-label="Market order settings">
        <label>
          <span>Lots</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={settings.volumeLots}
            onChange={(event) =>
              update({
                volumeLots: Math.max(
                  0.01,
                  numericValue(event.currentTarget.value, settings.volumeLots),
                ),
              })
            }
          />
        </label>
        <label>
          <span>SL</span>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={settings.slDistanceGc}
            onChange={(event) =>
              update({
                slDistanceGc: Math.max(
                  0.1,
                  numericValue(event.currentTarget.value, settings.slDistanceGc),
                ),
              })
            }
          />
        </label>
        <label>
          <span>TP</span>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={settings.tpDistanceGc}
            onChange={(event) =>
              update({
                tpDistanceGc: Math.max(
                  0.1,
                  numericValue(event.currentTarget.value, settings.tpDistanceGc),
                ),
              })
            }
          />
        </label>
      </div>
      <div className="market-order-actions">
        {!connected ? (
          <>
            <button type="button" onClick={onLogin}>
              Login
            </button>
            <button type="button" onClick={onConnect}>
              Connect Fake
            </button>
          </>
        ) : (
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
        )}
      </div>
    </section>
  );
}
