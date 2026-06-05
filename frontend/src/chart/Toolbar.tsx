import type { ReactNode } from "react";

/**
 * Toolbar — the top-bar container of the TradingView-like layout chrome.
 *
 * Presentational only: it lays out its children (typically the
 * SymbolContractLabel, TimeframeSelector, and StatusIndicator) in the top
 * region of the chart shell. Composition of the concrete controls is the
 * caller's responsibility (see App.tsx).
 *
 * Requirements: 19.1 (top toolbar region).
 */
export interface ToolbarProps {
  /** Controls/labels rendered inside the toolbar, left-to-right. */
  children?: ReactNode;
  /** Optional extra class names appended to the base `toolbar` class. */
  className?: string;
}

export function Toolbar({ children, className }: ToolbarProps) {
  const classes = className ? `toolbar ${className}` : "toolbar";
  return (
    <header className={classes} role="toolbar" aria-label="Chart toolbar">
      {children}
    </header>
  );
}
