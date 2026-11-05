/** Keep legacy defaults until a drawing has an explicit shared row size. */
export function fixedRangeProfileRowTicks(
  value: number | undefined,
  mode: "volume" | "delta",
): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1
    ? value
    : mode === "delta" ? 2 : 1;
}

export interface DeltaProfileRow {
  price: number;
  bidVolume: number;
  askVolume: number;
  totalVolume: number;
  delta: number;
}

export interface DeltaProfileDevelopingLevelPoint {
  time: number;
  price: number;
}

export type DeltaProfileDevelopingPocPoint = DeltaProfileDevelopingLevelPoint;

export type DeltaProfileSource = "footprint_cache" | "minute_bars";

export interface DeltaProfileData {
  symbol: string;
  contract: string;
  tf: "1m";
  from: number;
  to: number;
  rowTicks: number;
  valueAreaPct: number;
  poc: number | null;
  vah: number | null;
  val: number | null;
  totalVolume: number;
  totalDelta: number;
  maxAbsDelta: number;
  coveredBars: number;
  source: DeltaProfileSource;
  developingPoc?: DeltaProfileDevelopingLevelPoint[];
  developingVah?: DeltaProfileDevelopingLevelPoint[];
  developingVal?: DeltaProfileDevelopingLevelPoint[];
  rows: DeltaProfileRow[];
}

export type DeltaProfileLoadState =
  | { status: "loading" }
  | { status: "ready"; profile: DeltaProfileData }
  | { status: "error"; error: string };
