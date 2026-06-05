import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toolbar } from "./Toolbar";

describe("Toolbar", () => {
  it("renders a toolbar region with its children (Req 19.1)", () => {
    render(
      <Toolbar>
        <span data-testid="child">content</span>
      </Toolbar>,
    );
    const bar = screen.getByRole("toolbar", { name: "Chart toolbar" });
    expect(bar).toBeInTheDocument();
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("appends a custom class name", () => {
    render(<Toolbar className="compact" />);
    expect(screen.getByRole("toolbar")).toHaveClass("toolbar", "compact");
  });
});
