import { useId } from "react";
import { normalizeSiStopSettings, type SiStopSettings } from "./siStops";
import { SettingFieldLabel } from "./SettingHelp";

export function SiStopSettingsEditor({ settings, onChange, hidden = false }: {
  settings: SiStopSettings; onChange: (settings: SiStopSettings) => void; hidden?: boolean;
}) {
  const id = useId();
  const patch = (change: Partial<SiStopSettings>) => onChange(normalizeSiStopSettings({ ...settings, ...change }));
  const check = (field: keyof SiStopSettings, label: string, help: string, disabled = false) => (
    <div className="liquidity-settings-field market-explorer-check-field">
      <SettingFieldLabel label={label} help={help} htmlFor={`${id}-${field}`} />
      <input id={`${id}-${field}`} type="checkbox" checked={settings[field] === true} disabled={disabled}
        onChange={(e) => patch({ [field]: e.target.checked })} />
    </div>
  );
  const number = (field: keyof SiStopSettings, label: string, min: number, max: number,
    help: string, disabled = false, step = 1) => (
    <div className="liquidity-settings-field">
      <SettingFieldLabel label={label} help={help} htmlFor={`${id}-${field}`} />
      <input id={`${id}-${field}`} type="number" value={Number(settings[field])} min={min} max={max} step={step}
        disabled={disabled} onChange={(e) => {
          if (Number.isFinite(e.target.valueAsNumber)) patch({ [field]: e.target.valueAsNumber });
        }} />
    </div>
  );
  return (
    <fieldset className="liquidity-settings-group si-stops-settings-group" hidden={hidden}>
      <legend>SI Stops</legend>
      {check("enabled", "Show SI Stops", "Show execution chains inferred by SI as stop activity. Only completed chains receive markers; the exchange has not confirmed the order type.")}
      <p className="si-stops-settings-help">Filter each chain first. The marker number is the total contracts after grouping.</p>
      <div className="si-stops-settings-columns">
        <section aria-label="SI Stops chain filter">
          <h4>Chain filter</h4>
          <div className={settings.enabled ? "liquidity-settings-fields" : "liquidity-settings-fields is-disabled"}>
            {check("automatic", "Automatic size filter", "Calculate the threshold from completed chains in the sample window, updating each minute. Auto replaces the fixed Minimum executed volume threshold.", !settings.enabled)}
            {number("minVolume", "Minimum executed volume", 0, 10_000_000,
              "Minimum executed contracts for EACH chain before grouping. A minimum of 50 excludes chains under 50, even if several small chains total 50. The initial seed trade is excluded from volume.", !settings.enabled || settings.automatic)}
            {number("intervalMinutes", "Sample interval (minutes)", 1, 2880,
              "Lookback in minutes for Auto to sample loaded completed chains. For example, 60 uses the last hour, independently of chart zoom.", !settings.enabled || !settings.automatic)}
            {number("standardDeviations", "Standard deviations", 0, 10,
              "Auto = mean volume + this factor × standard deviation, rounded down and capped at the largest sample. Higher factors generally filter more strictly; with no samples, the threshold is 0.", !settings.enabled || !settings.automatic, 0.1)}
            {check("throughPriceLevelsOnly", "Through price levels only",
              "Show only chains with at least two execution records and different first and last execution prices. Turn off to include chains executed at a single price.", !settings.enabled)}
            {(["buyColor", "sellColor"] as const).map((key) => {
              const label = key === "buyColor" ? "Buy SI Stops" : "Sell SI Stops";
              return <div key={key} className="liquidity-settings-field market-explorer-color-field">
                <SettingFieldLabel label={label} htmlFor={`${id}-${key}`}
                  help={key === "buyColor" ? "Marker color for aggressive buy chains. Changes appearance without changing detection logic." : "Marker color for aggressive sell chains. Changes appearance without changing detection logic."} />
                <input id={`${id}-${key}`} type="color" value={settings[key]} disabled={!settings.enabled}
                  onChange={(e) => patch({ [key]: e.target.value })} />
              </div>;
            })}
          </div>
        </section>
        <section aria-label="SI Stops grouping and alerts">
          <h4>Grouping &amp; alerts</h4>
          <div className="liquidity-settings-fields">
            {check("aggregate", "Aggregate nearby chains", "Group nearby markers on the same Buy/Sell side. The marker shows total group contracts; the tooltip lists chain count and execution-record count separately. Chain identities and alerts remain separate.", !settings.enabled)}
            {number("aggregateMinVolume", "Aggregate minimum volume", 0, 10_000_000,
              "Minimum total group contracts, applied AFTER filtering individual chains and grouping. Excluded chains cannot contribute to the threshold. 0 disables this additional threshold.", !settings.enabled)}
            {number("timeArea", "Aggregation time area", 0, 1000,
              "Horizontal grouping distance on screen rather than seconds. 10 is about one marker width; increase to group farther apart. Groups may change with zoom.", !settings.enabled || !settings.aggregate)}
            {number("priceArea", "Aggregation price area", 0, 1000,
              "Vertical grouping distance on screen rather than ticks. 10 is about one marker height; increase to group more distant prices. Groups may change with zoom.", !settings.enabled || !settings.aggregate)}
            {check("showFiltered", "Show filtered markers", "Fade markers that fail the filters instead of hiding them. Passing and filtered markers form separate groups.", !settings.enabled)}
            {number("filteredOpacity", "Filtered opacity", 0, 1,
              "Filtered marker opacity: 0 is transparent; 1 is fully visible. For example, 0.15 means 15%. Used only when Show filtered markers is enabled.", !settings.enabled || !settings.showFiltered, 0.05)}
            {number("alertMinVolume", "Alert minimum volume", 0, 10_000_000,
              "Contracts threshold per new chain for sounds or popups. Independent of display filters and total group volume; changing the display minimum does not change this threshold.", !settings.enabled)}
            {check("alertThroughPriceLevelsOnly", "Alert through price levels only",
              "Alert only for chains with at least two execution records and different first and last prices. This separate alert condition does not change markers.", !settings.enabled)}
            {check("showToast", "Popup notification", "Show a popup for a newly completed chain meeting the alert threshold. Each chain alerts at most once; loading history or reconnecting does not repeat it.", !settings.enabled)}
          </div>
        </section>
      </div>
    </fieldset>
  );
}
