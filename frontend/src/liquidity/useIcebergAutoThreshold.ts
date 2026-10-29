import { useEffect, useRef, useState } from "react";
import type { NativeIcebergState } from "../socket/messages";
import { calculateIcebergAutoThreshold, type IcebergFilterSettings } from "./icebergFilters";

/** Sample the full loaded book at startup, after synchronization and once per minute. */
export function useIcebergAutoThreshold(
  rows: readonly NativeIcebergState[], settings: IcebergFilterSettings, synchronized: boolean, sessionId: string | null,
) {
  const latestRows = useRef(rows);
  latestRows.current = rows;
  const hasRows = rows.length > 0;
  const [result, setResult] = useState(() => calculateIcebergAutoThreshold(rows, settings, Date.now()));
  useEffect(() => {
    const refresh = () => setResult(calculateIcebergAutoThreshold(latestRows.current, settings, Date.now()));
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [settings, synchronized, sessionId, hasRows]);
  return result;
}
