import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * App-level error boundary. A render/runtime crash in the chart tree would
 * otherwise leave a frozen blank screen with no signal; this catches it and
 * shows the error so it can be diagnosed (and the rest of the page recovers on
 * the next reload).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to the console so the stack + component trace are visible.
    console.error("App crashed:", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error !== null) {
      return (
        <div
          role="alert"
          style={{
            padding: 16,
            margin: 16,
            border: "1px solid #8b0000",
            borderRadius: 8,
            background: "#1b1b1b",
            color: "#d8d8d8",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
          }}
        >
          <strong style={{ color: "#ef5350" }}>Chart crashed</strong>
          {"\n\n"}
          {error.message}
          {"\n\n"}
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 8,
              padding: "4px 10px",
              background: "#2962ff",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
