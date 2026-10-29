export interface IcebergSessionMinVolumes {
  us: number;
  other: number;
}

export const DEFAULT_ICEBERG_SESSION_MIN_VOLUMES: Readonly<IcebergSessionMinVolumes> = {
  us: 10,
  other: 5,
};

export function normalizeIcebergSessionMinVolumes(input: unknown): IcebergSessionMinVolumes {
  const source = input && typeof input === "object" ? input as Partial<IcebergSessionMinVolumes> : {};
  const normalize = (value: unknown, fallback: number) => {
    const number = typeof value === "number" ? value : Number.NaN;
    return Number.isFinite(number) ? Math.max(1, Math.min(1_000_000, Math.round(number))) : fallback;
  };
  return {
    us: normalize(source.us, DEFAULT_ICEBERG_SESSION_MIN_VOLUMES.us),
    other: normalize(source.other, DEFAULT_ICEBERG_SESSION_MIN_VOLUMES.other),
  };
}

/** Fixed UTC+7: US starts at 19:00 inclusive and ends at 04:00 exclusive. */
export function icebergMinVolumeForTime(time: number, settings: IcebergSessionMinVolumes): number {
  const hour = new Date(time + 7 * 60 * 60_000).getUTCHours();
  return hour >= 19 || hour < 4 ? settings.us : settings.other;
}

export function icebergMatchesSessionVolume(
  row: { detectedTime: number; executedVolume: number }, settings: IcebergSessionMinVolumes,
): boolean {
  return row.executedVolume >= icebergMinVolumeForTime(row.detectedTime, settings);
}
