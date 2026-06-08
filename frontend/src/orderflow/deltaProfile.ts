export interface DeltaProfileRow {
  price: number;
  bidVolume: number;
  askVolume: number;
  totalVolume: number;
  delta: number;
}

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
  source: "footprint_cache";
  rows: DeltaProfileRow[];
}

export type DeltaProfileLoadState =
  | { status: "loading" }
  | { status: "ready"; profile: DeltaProfileData }
  | { status: "error"; error: string };
