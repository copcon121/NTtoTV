import type { TduMomentumSample } from "../socket/messages";

export interface TduSettings {
  showLevel1: boolean;
  showLevel2: boolean;
  showLevel3: boolean;
  filterSmallBody: boolean;
  minBodyPercent: number;
  level1Sigma: number;
  level2Sigma: number;
  level3Sigma: number;
}

export const DEFAULT_TDU_SETTINGS: TduSettings = {
  showLevel1: true,
  showLevel2: true,
  showLevel3: true,
  filterSmallBody: true,
  minBodyPercent: 35,
  level1Sigma: 4,
  level2Sigma: 5,
  level3Sigma: 6,
};

export function normalizeTduSettings(settings?: Partial<TduSettings> | null): TduSettings {
  const percent = settings?.minBodyPercent;
  const thresholds = [
    settings?.level1Sigma ?? 4,
    settings?.level2Sigma ?? 5,
    settings?.level3Sigma ?? 6,
  ];
  const valid = thresholds.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0.1 && value <= 100)
    && thresholds[0] < thresholds[1] && thresholds[1] < thresholds[2];
  return {
    showLevel1: typeof settings?.showLevel1 === "boolean" ? settings.showLevel1 : true,
    showLevel2: typeof settings?.showLevel2 === "boolean" ? settings.showLevel2 : true,
    showLevel3: typeof settings?.showLevel3 === "boolean" ? settings.showLevel3 : true,
    filterSmallBody:
      typeof settings?.filterSmallBody === "boolean" ? settings.filterSmallBody : true,
    minBodyPercent:
      typeof percent === "number" && Number.isFinite(percent)
        ? Math.max(0, Math.min(100, percent))
        : DEFAULT_TDU_SETTINGS.minBodyPercent,
    level1Sigma: valid ? thresholds[0] : 4,
    level2Sigma: valid ? thresholds[1] : 5,
    level3Sigma: valid ? thresholds[2] : 6,
  };
}

/** Reclassify captured measurements using this profile's thresholds. */
export function tduMomentumForSettings(
  signal: { momentumLevel: number; momentumDirection: number; momentumSamples?: readonly TduMomentumSample[] },
  settings: TduSettings,
): { level: number; direction: number } {
  if (signal.momentumSamples === undefined) {
    // Legacy rows contain only a preclassified level; never pretend a custom
    // threshold was evaluated when the underlying measurement is unavailable.
    return settings.level1Sigma === 4 && settings.level2Sigma === 5 && settings.level3Sigma === 6
      ? { level: signal.momentumLevel, direction: signal.momentumDirection }
      : { level: 0, direction: 0 };
  }
  let level = 0;
  let direction = 0;
  for (const [volume, sigma, sampleDirection] of signal.momentumSamples) {
    if (!Number.isFinite(volume) || !Number.isFinite(sigma) || volume < 0 || sigma < 0) continue;
    const next = volume >= settings.level3Sigma * sigma ? 3
      : volume >= settings.level2Sigma * sigma ? 2
      : volume >= settings.level1Sigma * sigma ? 1 : 0;
    if (next > 0) {
      level = Math.max(level, next);
      direction = sampleDirection;
    }
  }
  return { level, direction };
}
