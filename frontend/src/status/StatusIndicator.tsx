/**
 * StatusIndicator — displays the live connection state to the user.
 *
 * Renders the connected / degraded / disconnected state forwarded from the
 * backend `status` events (Req 20.3). Purely presentational: the parent maps
 * incoming StatusMessage.state to the `state` prop. A colored dot plus a text
 * label communicate the state, and `role="status"` with `aria-live` announces
 * changes to assistive technology.
 *
 * Requirements: 20.3 (display connected/degraded/disconnected), 19.1 (status
 * region of the layout chrome).
 */

/** The three connection states surfaced to the user (Req 20.3). */
export type ConnectionState = "connected" | "degraded" | "disconnected";

/** Default human-readable labels for each state. */
const DEFAULT_LABELS: Record<ConnectionState, string> = {
  connected: "Connected",
  degraded: "Degraded",
  disconnected: "Disconnected",
};

export interface StatusIndicatorProps {
  /** Current connection state. */
  state: ConnectionState;
  /** Optional override of the per-state display labels. */
  labels?: Partial<Record<ConnectionState, string>>;
  /**
   * Optional reason/detail (e.g. from StatusMessage.reason) shown as a tooltip
   * via the `title` attribute.
   */
  reason?: string;
}

export function StatusIndicator({ state, labels, reason }: StatusIndicatorProps) {
  const label = labels?.[state] ?? DEFAULT_LABELS[state];
  return (
    <span
      className={`status-indicator status-${state}`}
      role="status"
      aria-live="polite"
      aria-label={`Connection status: ${label}`}
      data-state={state}
      title={reason}
    >
      <span className="status-dot" aria-hidden="true" />
      <span className="status-label" data-testid="status-label">
        {label}
      </span>
    </span>
  );
}
