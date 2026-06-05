import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContractSelector } from "./ContractSelector";

describe("ContractSelector", () => {
  it("renders available contracts and marks the active one", () => {
    render(
      <ContractSelector
        value="GC 06-26"
        contracts={["GC 06-26", "GC 08-26"]}
        onChange={() => {}}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Contract selector" });
    expect(select).toHaveValue("GC 06-26");
    expect(screen.getByRole("option", { name: "GC 08-26" })).toBeInTheDocument();
  });

  it("emits the selected contract", () => {
    const onChange = vi.fn();
    render(
      <ContractSelector
        value="GC 06-26"
        contracts={["GC 06-26", "GC 08-26"]}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Contract selector" }), {
      target: { value: "GC 08-26" },
    });

    expect(onChange).toHaveBeenCalledWith("GC 08-26");
  });
});
