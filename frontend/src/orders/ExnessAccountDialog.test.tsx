import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExnessAccountDialog } from "./ExnessAccountDialog";

afterEach(cleanup);

describe("ExnessAccountDialog", () => {
  it("preserves the full account ID and clears credentials after submission", () => {
    const submit = vi.fn();
    render(<ExnessAccountDialog open profileName="alice" onSubmit={submit} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Exness account ID"), { target: { value: "18446744073709551000" } });
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "exnsk-test-only" } });
    fireEvent.change(screen.getByLabelText("API secret"), { target: { value: "test-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(submit).toHaveBeenCalledWith({ accountId: "18446744073709551000", apiKey: "exnsk-test-only", apiSecret: "test-secret", gateway: "https://api.exness.com" });
    expect(screen.getByLabelText("API key")).toHaveValue("");
    expect(screen.getByLabelText("API secret")).toHaveValue("");
    expect(screen.queryByLabelText("Terminal path")).not.toBeInTheDocument();
  });

  it("clears unsaved credentials when the profile changes", () => {
    const props = { open: true, onSubmit: vi.fn(), onClose: vi.fn() };
    const { rerender } = render(<ExnessAccountDialog {...props} profileName="alice" />);
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "alice-secret-key" } });
    fireEvent.change(screen.getByLabelText("API secret"), { target: { value: "alice-secret" } });
    rerender(<ExnessAccountDialog {...props} profileName="bob" />);
    expect(screen.getByLabelText("API key")).toHaveValue("");
    expect(screen.getByLabelText("API secret")).toHaveValue("");
  });

  it("requires an explicit review action to clear an uncertain execution lock", () => {
    const review = vi.fn();
    const submit = vi.fn();
    render(<ExnessAccountDialog open onSubmit={submit} onClose={vi.fn()} onAcknowledgeUncertain={review}
      account={{ accountId: "123", login: "123", server: "Exness API", tradeMode: "live", uncertainActions: [{ key: "operation-key", action: "open", createdAt: 1000 }] }} />);
    expect(review).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "I checked Exness; clear the pending lock" }));
    expect(review).toHaveBeenCalledWith("operation-key");
    expect(submit).not.toHaveBeenCalled();
  });
});
