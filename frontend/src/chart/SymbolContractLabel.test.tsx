import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SymbolContractLabel } from "./SymbolContractLabel";

describe("SymbolContractLabel", () => {
  it("defaults the user-facing symbol to GC (Req 10.1)", () => {
    render(<SymbolContractLabel />);
    expect(screen.getByTestId("symbol")).toHaveTextContent("GC");
  });

  it("displays the resolved real contract identifier (Req 10.3)", () => {
    render(<SymbolContractLabel symbol="GC" contract="GC 08-26" />);
    expect(screen.getByTestId("symbol")).toHaveTextContent("GC");
    expect(screen.getByTestId("contract")).toHaveTextContent("GC 08-26");
  });

  it("shows a placeholder while the contract is unresolved", () => {
    render(<SymbolContractLabel contract={undefined} pendingLabel="…" />);
    expect(screen.getByTestId("contract")).toHaveTextContent("…");
  });
});
