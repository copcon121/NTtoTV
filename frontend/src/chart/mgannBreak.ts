export interface MgannBreakSettings {
  requireBigTrade: boolean;
  bigTradeThreshold: number;
  volumeDeltaLookback: number;
  volumeDeltaMultiplier: number;
  minSpreadTicks: number;
  spreadLookback: number;
  spreadMultiplier: number;
  swingSize: number;
  pivotLookbackBars: number;
  minPivotCuts: number;
  pivotToleranceTicks: number;
  minPivotWickTicks: number;
  filterLiquidity: boolean;
  liquidityAtrMargin: number;
  liquiditySweepLookbackBars: number;
  confirmationBars: number;
  breakTicks: number;
}

export const MGANN_BREAK_SETTINGS_VERSION = 1;

export const DEFAULT_MGANN_BREAK_SETTINGS: MgannBreakSettings = {
  requireBigTrade: false,
  bigTradeThreshold: 70,
  volumeDeltaLookback: 20,
  volumeDeltaMultiplier: 2.5,
  minSpreadTicks: 10,
  spreadLookback: 30,
  spreadMultiplier: 3.5,
  swingSize: 5,
  pivotLookbackBars: 120,
  minPivotCuts: 3,
  pivotToleranceTicks: 5,
  minPivotWickTicks: 2,
  filterLiquidity: true,
  liquidityAtrMargin: 4,
  liquiditySweepLookbackBars: 10,
  confirmationBars: 0,
  breakTicks: 3,
};

function positiveInteger(value: unknown, fallback: number, maximum = 5_000): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(maximum, parsed)
    : fallback;
}

function nonnegativeInteger(value: unknown, fallback: number, maximum = 5_000): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.min(maximum, parsed)
    : fallback;
}

function positiveNumber(value: unknown, fallback: number, maximum = 100): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(maximum, parsed)
    : fallback;
}

export function normalizeMgannBreakSettings(
  input?: Partial<MgannBreakSettings> | null,
): MgannBreakSettings {
  const defaults = DEFAULT_MGANN_BREAK_SETTINGS;
  const swingSize = positiveInteger(input?.swingSize, defaults.swingSize, 100);
  return {
    requireBigTrade: input?.requireBigTrade === true,
    bigTradeThreshold: positiveNumber(
      input?.bigTradeThreshold,
      defaults.bigTradeThreshold,
      100_000,
    ),
    volumeDeltaLookback: positiveInteger(
      input?.volumeDeltaLookback,
      defaults.volumeDeltaLookback,
    ),
    volumeDeltaMultiplier: positiveNumber(
      input?.volumeDeltaMultiplier,
      defaults.volumeDeltaMultiplier,
    ),
    minSpreadTicks: nonnegativeInteger(
      input?.minSpreadTicks,
      defaults.minSpreadTicks,
    ),
    spreadLookback: positiveInteger(
      input?.spreadLookback,
      defaults.spreadLookback,
    ),
    spreadMultiplier: positiveNumber(
      input?.spreadMultiplier,
      defaults.spreadMultiplier,
    ),
    // The legacy value 2 was historically remapped to 5 server-side.
    swingSize: swingSize === 2 ? defaults.swingSize : swingSize,
    pivotLookbackBars: positiveInteger(
      input?.pivotLookbackBars,
      defaults.pivotLookbackBars,
    ),
    minPivotCuts: Math.max(
      2,
      positiveInteger(input?.minPivotCuts, defaults.minPivotCuts, 20),
    ),
    pivotToleranceTicks: nonnegativeInteger(
      input?.pivotToleranceTicks,
      defaults.pivotToleranceTicks,
    ),
    minPivotWickTicks: nonnegativeInteger(
      input?.minPivotWickTicks,
      defaults.minPivotWickTicks,
    ),
    filterLiquidity:
      typeof input?.filterLiquidity === "boolean"
        ? input.filterLiquidity
        : defaults.filterLiquidity,
    liquidityAtrMargin: positiveNumber(
      input?.liquidityAtrMargin,
      defaults.liquidityAtrMargin,
    ),
    liquiditySweepLookbackBars: positiveInteger(
      input?.liquiditySweepLookbackBars,
      defaults.liquiditySweepLookbackBars,
    ),
    confirmationBars: nonnegativeInteger(
      input?.confirmationBars,
      defaults.confirmationBars,
      100,
    ),
    breakTicks: nonnegativeInteger(input?.breakTicks, defaults.breakTicks),
  };
}

/**
 * Profiles saved before the optimized detector settings were introduced do
 * not carry a settings version. Reset only that stale section while keeping
 * the rest of the chart profile intact.
 */
export function mgannBreakSettingsFromProfile(
  input: Partial<MgannBreakSettings> | null | undefined,
  version: number | undefined,
): MgannBreakSettings {
  if (version !== MGANN_BREAK_SETTINGS_VERSION) {
    return { ...DEFAULT_MGANN_BREAK_SETTINGS };
  }
  return normalizeMgannBreakSettings(input);
}

export function mgannBreakAlertParams(
  settings?: Partial<MgannBreakSettings> | null,
): Record<string, number | string | boolean> {
  const value = normalizeMgannBreakSettings(settings);
  return {
    ...value,
    timeframe: "1m",
    repeat: true,
  };
}

export function mgannBreakSettingsJson(
  settings?: Partial<MgannBreakSettings> | null,
): string {
  return JSON.stringify(mgannBreakAlertParams(settings));
}

export function mgannBreakSettingsMatchParams(
  settings: Partial<MgannBreakSettings> | null | undefined,
  params: Record<string, number | string | boolean>,
): boolean {
  return JSON.stringify(normalizeMgannBreakSettings(settings)) ===
    JSON.stringify(
      normalizeMgannBreakSettings(params as Partial<MgannBreakSettings>),
    );
}
