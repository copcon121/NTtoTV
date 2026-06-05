/**
 * SymbolContractLabel — shows the user-facing symbol and the resolved contract.
 *
 * Per Req 10.1 the Frontend presents the user-facing symbol as `GC`; per
 * Req 10.3 it also displays the resolved real contract identifier (for example
 * `GC 08-26`). This component renders both: a prominent symbol and the resolved
 * contract beside it. While the contract is still being resolved (undefined),
 * a neutral placeholder is shown instead of a stale value.
 *
 * Requirements: 10.1 (user-facing symbol "GC"), 10.3 (resolved real contract),
 * 19.1 (symbol/contract label region).
 */
export interface SymbolContractLabelProps {
  /** User-facing symbol; defaults to "GC" (Req 10.1). */
  symbol?: string;
  /**
   * Resolved real contract identifier, e.g. "GC 08-26" (Req 10.3). When
   * undefined the contract has not been resolved yet and a placeholder shows.
   */
  contract?: string;
  /** Placeholder shown when no contract is resolved yet. */
  pendingLabel?: string;
}

export function SymbolContractLabel({
  symbol = "GC",
  contract,
  pendingLabel = "—",
}: SymbolContractLabelProps) {
  return (
    <div className="symbol-contract-label" aria-label="Symbol and contract">
      <span className="symbol" data-testid="symbol">
        {symbol}
      </span>
      <span className="contract" data-testid="contract">
        {contract ?? pendingLabel}
      </span>
    </div>
  );
}
