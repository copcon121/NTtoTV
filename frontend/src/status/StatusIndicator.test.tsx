import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusIndicator, type ConnectionState } from "./StatusIndicator";

describe("StatusIndicator", () => {
  it.each<[ConnectionState, string]>([
    ["connected", "Connected"],
    ["degraded", "Degraded"],
    ["disconnected", "Disconnected"],
  ])("displays the %s state (Req 20.3)", (state, label) => {
    render(<StatusIndicator state={state} />);
    const node = screen.getByRole("status");
    expect(node).toHaveAttribute("data-state", state);
    expect(node).toHaveClass(`status-${state}`);
    expect(screen.getByTestId("status-label")).toHaveTextContent(label);
  });

  it("reflects state changes on re-render (Req 20.3)", () => {
    const { rerender } = render(<StatusIndicator state="connected" />);
    expect(screen.getByTestId("status-label")).toHaveTextContent("Connected");
    rerender(<StatusIndicator state="degraded" />);
    expect(screen.getByTestId("status-label")).toHaveTextContent("Degraded");
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "degraded");
  });

  it("supports custom labels and a reason tooltip", () => {
    render(
      <StatusIndicator
        state="disconnected"
        labels={{ disconnected: "Offline" }}
        reason="NT_AddOn silent >15s"
      />,
    );
    expect(screen.getByTestId("status-label")).toHaveTextContent("Offline");
    expect(screen.getByRole("status")).toHaveAttribute("title", "NT_AddOn silent >15s");
  });
});
