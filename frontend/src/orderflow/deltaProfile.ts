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
