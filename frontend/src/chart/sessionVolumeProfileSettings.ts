export const DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX = 60;
export const MIN_SESSION_VOLUME_PROFILE_WIDTH_PX = 32;
export const MAX_SESSION_VOLUME_PROFILE_WIDTH_PX = 180;

export function normalizeSessionVolumeProfileWidth(value: unknown): number {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_SESSION_VOLUME_PROFILE_WIDTH_PX;
  return Math.min(
    MAX_SESSION_VOLUME_PROFILE_WIDTH_PX,
    Math.max(MIN_SESSION_VOLUME_PROFILE_WIDTH_PX, parsed),
  );
}
