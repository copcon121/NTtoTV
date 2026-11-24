import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WidgetLinkMenu } from "./WidgetLinkMenu";

describe("widget link controls", () => {
  it("offers independent/A-D and separate sync switches in an accessible portal", async () => {
    const change = vi.fn();
    const view = render(<div style={{ overflow: "hidden" }}><WidgetLinkMenu name="Footprint" onChange={change} /></div>);
    const trigger = screen.getByRole("button", { name: "Link Footprint" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Link Footprint" });
    expect(view.container.contains(dialog)).toBe(false);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("combobox", { name: "Group" })).toHaveFocus();
    expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["Independent", "Group A", "Group B", "Group C", "Group D"]);
    expect(screen.getByRole("checkbox", { name: "Sync manual drawings" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "A" } });
    expect(change).toHaveBeenLastCalledWith({ groupId: "A", syncViewport: true, syncDrawings: false });
    view.rerender(<WidgetLinkMenu name="Footprint" value={{ groupId: "A", syncViewport: true, syncDrawings: false }} onChange={change} />);
    // The wrapper change remounts this test control.
    fireEvent.click(screen.getByRole("button", { name: "Link Footprint" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Sync manual drawings" }));
    expect(change).toHaveBeenLastCalledWith({ groupId: "A", syncViewport: true, syncDrawings: true });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Link Footprint" })).toHaveFocus();
  });
  it("closes on outside pointer input and keeps the linked group visible", () => {
    render(<WidgetLinkMenu name="Chart" value={{ groupId: "C", syncViewport: false, syncDrawings: true }} onChange={() => {}} />);
    const trigger = screen.getByRole("button", { name: "Link Chart" });
    expect(trigger).toHaveTextContent("Link C");
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
