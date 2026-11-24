import type { Instrument } from "../api/client";

export const DEFAULT_INSTRUMENT: Instrument = {
  id: "COMEX:GC",
  symbol: "GC",
  displaySymbol: "GC/USD",
  venue: "COMEX",
  assetClass: "future",
  provider: "rithmic",
  contractMode: "active-contract",
  readOnly: false,
};
